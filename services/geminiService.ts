
import { GoogleGenAI } from "@google/genai";
import { FileData, TranscriptionResult } from "../types";

export const transcribeAndRefine = async (fileData: FileData): Promise<TranscriptionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isYoutube = fileData.fileName === 'YouTube Video';
  
  // Step 1: Transcription
  let transcriptionResponse;
  
  if (isYoutube && fileData.url) {
    // For YouTube, we ask the model to access the video content directly
    transcriptionResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Use Pro for better external content handling
      contents: [
        {
          role: "user",
          parts: [
            { text: `Please provide a verbatim transcript for the following YouTube video: ${fileData.url}. If you cannot access the video content, please explain why. Only return the transcript.` }
          ]
        }
      ],
    });
  } else {
    // For uploaded files or direct audio links
    transcriptionResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: fileData.mimeType,
                data: fileData.base64
              }
            },
            { text: "Transcribe this audio/video file accurately. Only return the transcript without any additional comments." }
          ]
        }
      ],
    });
  }

  const rawTranscript = transcriptionResponse.text || "No transcript generated.";

  // Step 2: Refinement
  const refinementResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: "user",
        parts: [
          { text: `The following text is a transcript. Please rewrite it to be clear, professional, and grammatically correct. Remove filler words, fix repetitions, and improve the flow while preserving original meaning. Return only the polished text.\n\nTranscript:\n${rawTranscript}` }
        ]
      }
    ],
  });

  const refinedTranscript = refinementResponse.text || rawTranscript;

  return {
    raw: rawTranscript,
    refined: refinedTranscript
  };
};

export const convertToSubtitles = async (text: string, format: 'srt' | 'vtt'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Convert the following transcript into a valid ${format.toUpperCase()} subtitle file. 
  
  CRITICAL INSTRUCTION FOR TIMING: 
  Do not use generic 5-second blocks. Instead, simulate a natural human speech rhythm:
  1. Split segments at logical punctuation marks (full stops, question marks) or significant pauses (commas, conjunctions).
  2. Estimate duration based on word count (average speech is 150-180 words per minute).
  3. Ensure each segment is readable (max 2 lines, approx 40-70 characters per segment).
  4. Add slightly longer gaps (0.5s - 1s) between timestamps when a sentence ends.
  5. Ensure timestamps are strictly sequential and never overlap.
  
  Rules for ${format.toUpperCase()}:
  ${format === 'srt' ? '- Use format: [Index]\\n[HH:MM:SS,mmm] --> [HH:MM:SS,mmm]\\n[Text]' : '- Start with "WEBVTT". Use format: [HH:MM:SS.mmm] --> [HH:MM:SS.mmm]\\n[Text]'}
  
  Return ONLY the raw subtitle file content without any markdown blocks or commentary.
  
  Transcript:
  ${text}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  // Clean up any potential markdown formatting if the model accidentally included it
  let output = response.text || "";
  output = output.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
  
  return output.trim();
};

export const fetchUrlAsBase64 = async (url: string): Promise<FileData> => {
  // Handle YouTube specifically
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return {
      base64: '',
      mimeType: 'text/html',
      fileName: 'YouTube Video',
      url: url
    };
  }

  const tryFetch = async (targetUrl: string) => {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response;
  };

  try {
    let response;
    try {
      response = await tryFetch(url);
    } catch (directError) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      response = await tryFetch(proxyUrl);
    }
    
    const blob = await response.blob();
    const mimeType = blob.type || 'audio/mpeg';
    const fileSize = blob.size;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (!base64) {
          reject(new Error("Failed to convert file."));
          return;
        }
        resolve({
          base64,
          mimeType,
          fileSize,
          fileName: url.split('/').pop()?.split('?')[0] || 'remote-file',
          url: url
        });
      };
      reader.onerror = () => reject(new Error("Error reading file data."));
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    const message = error.message?.includes('Failed to fetch') 
      ? "CORS access denied. Please download the file and upload it instead."
      : `Unable to access audio: ${error.message}`;
    throw new Error(message);
  }
};
