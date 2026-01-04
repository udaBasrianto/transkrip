
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Link as LinkIcon, AlertCircle, RefreshCw, AudioLines, History as HistoryIcon, Mic, Square, Sparkles, Download, Trash2, Youtube, Activity, Sliders } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { AppStatus, TranscriptionResult, FileData, HistoryItem } from './types';
import { transcribeAndRefine, fetchUrlAsBase64 } from './services/geminiService';
import StatusDisplay from './components/ui/StatusDisplay';
import TranscriptView from './components/TranscriptView';
import HistoryList from './components/HistoryList';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(1.5);
  
  const [currentAudio, setCurrentAudio] = useState<{ data?: string, mimeType?: string, url?: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('echorefine_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) { console.error("Failed to parse history", e); }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('echorefine_history', JSON.stringify(history));
    } catch (e) { setError("Storage is full. Please delete some items."); }
  }, [history]);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  // Update gain in real-time if slider changes during recording
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(sensitivity, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [sensitivity]);

  const addToHistory = (fileName: string, res: TranscriptionResult, audioData?: string, mimeType?: string, fileSize?: number, sourceUrl?: string) => {
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      fileName,
      fileSize,
      timestamp: Date.now(),
      result: res,
      audioData,
      mimeType,
      url: sourceUrl
    };
    setHistory(prev => [newItem, ...prev].slice(0, 30));
    setActiveHistoryId(newItem.id);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeHistoryId === id) setActiveHistoryId(null);
  };

  const clearAllHistory = () => {
    if (window.confirm("Clear all history?")) {
      setHistory([]);
      setActiveHistoryId(null);
    }
  };

  const exportHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "echorefine_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const selectHistoryItem = (item: HistoryItem) => {
    setResult(item.result);
    setActiveFileName(item.fileName);
    setActiveHistoryId(item.id);
    setCurrentAudio({ data: item.audioData, mimeType: item.mimeType, url: item.url });
    setStatus(AppStatus.SUCCESS);
    if (window.innerWidth < 768) setShowHistory(false);
  };

  const processAudio = async (fileData: FileData) => {
    try {
      setStatus(AppStatus.TRANSCRIBING);
      setError(null);
      setActiveFileName(fileData.fileName);
      setCurrentAudio({ data: fileData.base64, mimeType: fileData.mimeType, url: fileData.url });
      const res = await transcribeAndRefine(fileData);
      setResult(res);
      addToHistory(fileData.fileName, res, fileData.base64, fileData.mimeType, fileData.fileSize, fileData.url);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "An error occurred during transcription.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(AppStatus.LOADING);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await processAudio({ base64, mimeType: file.type || 'audio/mpeg', fileName: file.name, fileSize: file.size });
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      setStatus(AppStatus.LOADING);
      const fileData = await fetchUrlAsBase64(url);
      await processAudio(fileData);
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const encodeToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startLiveRecording = async () => {
    try {
      setError(null);
      setLiveTranscript('');
      setVolumeLevel(0);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus(AppStatus.RECORDING);
            setActiveFileName(`Live Recording ${new Date().toLocaleTimeString()}`);
            
            const source = audioContext.createMediaStreamSource(stream);
            
            // 1. High Pass Filter (buang noise frekuensi rendah/gemuruh)
            const hpf = audioContext.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 80;

            // 2. Dynamics Compressor (menormalkan level suara secara otomatis)
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
            compressor.knee.setValueAtTime(30, audioContext.currentTime);
            compressor.ratio.setValueAtTime(12, audioContext.currentTime);
            compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
            compressor.release.setValueAtTime(0.25, audioContext.currentTime);

            // 3. Manual Gain Control (Sensitivitas)
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(sensitivity, audioContext.currentTime);
            gainNodeRef.current = gainNode;

            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolumeLevel(rms);

              const int16Array = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }

              const pcmData = encodeToBase64(int16Array.buffer);
              const pcmBlob = { data: pcmData, mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };

            // Audio Pipeline: Source -> HPF -> Compressor -> Gain -> ScriptProcessor
            source.connect(hpf);
            hpf.connect(compressor);
            compressor.connect(gainNode);
            gainNode.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
            
            (window as any)._scriptProcessor = scriptProcessor;
          },
          onmessage: async (m: LiveServerMessage) => { 
            if (m.serverContent?.inputTranscription) {
              setLiveTranscript(prev => prev + m.serverContent!.inputTranscription!.text);
            } 
          },
          onerror: (e) => { 
            setError("Connection lost."); 
            stopLiveRecording(); 
          },
          onclose: () => { if (status === AppStatus.RECORDING) setStatus(AppStatus.IDLE); }
        },
        config: { 
          responseModalities: [Modality.AUDIO], 
          inputAudioTranscription: {},
          systemInstruction: "You are a professional transcriber. Transcribe all speech accurately, even if the person is speaking softly. Ignore background noise."
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err: any) { 
      setError(err.message || "Failed to access microphone.");
      setStatus(AppStatus.ERROR); 
    }
  };

  const stopLiveRecording = async () => {
    if (liveSessionRef.current) liveSessionRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    if ((window as any)._scriptProcessor) (window as any)._scriptProcessor.disconnect();
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setVolumeLevel(0);
    if (liveTranscript.trim()) handleRefine(liveTranscript);
    else setStatus(AppStatus.IDLE);
  };

  const handleRefine = async (rawText: string) => {
    try {
      setStatus(AppStatus.REFINING);
      let audioData = '';
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioData = await new Promise<string>(r => { 
          const rd = new FileReader(); 
          rd.onloadend = () => r((rd.result as string).split(',')[1]); 
          rd.readAsDataURL(audioBlob); 
        });
      }
      setCurrentAudio({ data: audioData, mimeType: 'audio/webm' });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: "user", parts: [{ text: `Refine this live transcript for clarity: ${rawText}` }] }]
      });
      const res = { raw: rawText, refined: response.text || rawText };
      setResult(res);
      addToHistory(activeFileName, res, audioData, 'audio/webm');
      setStatus(AppStatus.SUCCESS);
    } catch (err) { setStatus(AppStatus.ERROR); }
  };

  const reset = () => { 
    setStatus(AppStatus.IDLE); setResult(null); setUrl(''); setError(null); 
    setCurrentAudio(null); setActiveHistoryId(null); setVolumeLevel(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {showHistory && (
        <HistoryList items={history} activeId={activeHistoryId} onSelectItem={selectHistoryItem} onDeleteItem={deleteFromHistory} onClearAll={clearAllHistory} onExport={exportHistory} onClose={() => setShowHistory(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg cursor-pointer hover:bg-blue-700 transition-colors" onClick={reset}>
                <AudioLines className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">EchoRefine</h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">AI Transcript Studio</p>
              </div>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${showHistory ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <HistoryIcon className="w-5 h-5" />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>
        </header>

        {showSavedToast && (
          <div className="fixed top-20 right-8 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300 z-[100]">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium">Saved to History</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            {status === AppStatus.IDLE && (
              <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="text-center space-y-4 pt-8">
                  <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
                    Transcribe and <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Perfect</span>.
                  </h2>
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    YouTube links, audio uploads, or live mic. Everything converted to polished text instantly.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 pb-20">
                  <div onClick={startLiveRecording} className="group bg-white p-8 rounded-2xl border-2 border-transparent shadow-sm border-gray-100 hover:border-red-400 hover:shadow-xl transition-all duration-300 cursor-pointer text-center space-y-4">
                    <div className="p-5 bg-red-50 text-red-600 rounded-full mx-auto w-fit group-hover:scale-110 transition-transform">
                      <Mic className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Live Mic</h3>
                    <p className="text-xs text-gray-500">Record speech directly</p>
                  </div>

                  <div className="group relative bg-white p-8 rounded-2xl border-2 border-transparent shadow-sm border-gray-100 hover:border-blue-400 hover:shadow-xl transition-all duration-300 text-center space-y-4">
                    <input type="file" accept="audio/*,video/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="p-5 bg-blue-50 text-blue-600 rounded-full mx-auto w-fit group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Upload File</h3>
                    <p className="text-xs text-gray-500">Audio or Video files</p>
                  </div>

                  <div className="bg-white p-8 rounded-2xl border-2 border-transparent shadow-sm border-gray-100 flex flex-col justify-center space-y-4">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="p-4 bg-purple-50 text-purple-600 rounded-full">
                        <LinkIcon className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">YouTube / URL</h3>
                    </div>
                    <form onSubmit={handleUrlSubmit} className="space-y-2">
                      <input type="url" placeholder="Paste YouTube link..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" required />
                      <button type="submit" className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                        <Youtube className="w-4 h-4 text-red-500" />
                        Transcribe
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {status === AppStatus.RECORDING && (
              <div className="space-y-6 max-w-2xl mx-auto py-10">
                <StatusDisplay status={status} />
                <div className="bg-gray-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </div>
                      <span className="text-sm font-bold text-red-500 uppercase tracking-widest">Recording Live</span>
                    </div>
                    <button onClick={stopLiveRecording} className="px-6 py-2 bg-white text-gray-900 rounded-full text-sm font-bold hover:bg-gray-100 shadow-lg active:scale-95 transition-all">Stop</button>
                  </div>
                  
                  {/* Sensitivitas & Metering */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Sliders className="w-3 h-3" />
                          Mic Sensitivity
                        </label>
                        <span className="text-[10px] font-bold text-blue-400">{(sensitivity * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="3" step="0.1" 
                        value={sensitivity} 
                        onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          Input Level
                        </label>
                        <span className={`text-[10px] font-bold ${volumeLevel > 0.2 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {volumeLevel > 0.2 ? 'Optimal' : 'Too Quiet'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex gap-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500 transition-all duration-75"
                          style={{ width: `${Math.min(100, volumeLevel * 800)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div ref={transcriptScrollRef} className="h-64 overflow-y-auto text-xl text-gray-300 font-medium leading-relaxed pr-4 custom-scrollbar relative z-10 italic">
                    {liveTranscript || "Speak clearly. The AI is listening..."}
                  </div>

                  <div 
                    className="absolute inset-0 bg-blue-500/5 transition-opacity duration-150 pointer-events-none"
                    style={{ opacity: volumeLevel * 15 }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <StatusDisplay status={status} />
            </div>

            {status === AppStatus.SUCCESS && result && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <TranscriptView 
                  result={result} 
                  fileName={activeFileName}
                  audioData={currentAudio?.data} 
                  mimeType={currentAudio?.mimeType} 
                  sourceUrl={currentAudio?.url}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <div>
                  <h3 className="font-bold text-red-800">Error</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                  <button onClick={reset} className="text-red-800 font-bold text-sm underline mt-2">Try again</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
