
import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, FileText, Wand2, Download, ChevronDown, Loader2, Play, Pause, Youtube, ExternalLink, Activity, AudioLines } from 'lucide-react';
import { TranscriptionResult } from '../types';
import { convertToSubtitles } from '../services/geminiService';

interface TranscriptViewProps {
  result: TranscriptionResult;
  fileName: string;
  audioData?: string;
  mimeType?: string;
  sourceUrl?: string;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ result, fileName, audioData, mimeType, sourceUrl }) => {
  const [activeTab, setActiveTab] = useState<'refined' | 'raw'>('refined');
  const [copied, setCopied] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    const text = activeTab === 'refined' ? result.refined : result.raw;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (format: 'txt' | 'srt' | 'vtt') => {
    setIsExportMenuOpen(false);
    const text = activeTab === 'refined' ? result.refined : result.raw;
    
    if (format === 'txt') {
      downloadFile(text, `transcript-${activeTab}.txt`);
      return;
    }

    try {
      setIsGeneratingSubtitles(true);
      const subtitleContent = await convertToSubtitles(text, format);
      downloadFile(subtitleContent, `transcript-${activeTab}.${format}`);
    } catch (error) {
      console.error("Subtitle generation failed", error);
      alert("Failed to generate subtitle format.");
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const isYouTube = sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'));

  return (
    <div className="w-full space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header with Filename and YouTube Link */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full w-fit text-sm font-medium border border-blue-100 shadow-sm">
          {isYouTube ? <Youtube className="w-4 h-4 text-red-500" /> : <AudioLines className="w-4 h-4" />}
          <span className="truncate max-w-[250px] sm:max-w-md">{fileName}</span>
        </div>
        
        {isYouTube && (
          <a 
            href={sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition-all bg-red-50 px-3 py-2 rounded-full border border-red-100 hover:bg-red-100 active:scale-95 group"
          >
            <Youtube className="w-3.5 h-3.5" />
            Watch on YouTube
            <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        )}
      </div>

      {/* Audio Playback Studio Bar */}
      <div className={`bg-white border-2 rounded-2xl p-4 shadow-lg transition-all duration-300 ${isPlaying ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-100'}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {isYouTube ? (
              <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-xl text-red-600 font-bold text-sm">
                <Youtube className="w-5 h-5" />
                <span>External Content</span>
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1 ml-2 bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Watch Video
                </a>
              </div>
            ) : audioData ? (
              <div className="flex items-center gap-4 w-full">
                <button 
                  onClick={togglePlayback}
                  className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all shadow-md ${isPlaying ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {isPlaying ? <Activity className="w-3 h-3 text-blue-500" /> : null}
                      {isPlaying ? 'Playing Original Source' : 'Original Audio Ready'}
                    </span>
                    <button 
                      onClick={cyclePlaybackSpeed}
                      className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      {playbackSpeed}x
                    </button>
                  </div>
                  <audio 
                    ref={audioRef} 
                    src={`data:${mimeType || 'audio/mpeg'};base64,${audioData}`} 
                    onEnded={() => setIsPlaying(false)}
                    className="w-full h-8 brightness-95 contrast-125"
                    controls
                  />
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-xs italic">Original audio source unavailable for playback.</div>
            )}
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('refined')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'refined' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                Refined
              </div>
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'raw' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Raw
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Transcript Output</div>
        <div className="flex gap-2 relative" ref={menuRef}>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={isGeneratingSubtitles}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-70`}
            >
              {isGeneratingSubtitles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingSubtitles ? 'Processing...' : 'Export'}
              <ChevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 z-[70] animate-in fade-in zoom-in-95 duration-200">
                <button onClick={() => handleDownload('txt')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-500">TXT</div>
                  <div className="font-bold">Plain Text</div>
                </button>
                <button onClick={() => handleDownload('srt')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-[10px] font-bold text-blue-600">SRT</div>
                  <div className="font-bold">SubRip</div>
                </button>
                <button onClick={() => handleDownload('vtt')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-[10px] font-bold text-purple-600">VTT</div>
                  <div className="font-bold">WebVTT</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative bg-white border border-gray-200 rounded-3xl shadow-sm p-8 min-h-[350px]">
        <div className="prose prose-blue max-w-none whitespace-pre-wrap leading-relaxed text-gray-700 text-lg font-medium selection:bg-blue-100">
          {activeTab === 'refined' ? result.refined : result.raw}
        </div>
        {activeTab === 'refined' && (
          <div className="mt-10 pt-6 border-t border-gray-100 italic text-sm text-gray-400 flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Professionally edited for clarity and readability by Gemini AI.
          </div>
        )}
      </div>
      <style>{`
        audio::-webkit-media-controls-panel {
          background-color: #f8fafc;
        }
        audio::-webkit-media-controls-play-button,
        audio::-webkit-media-controls-current-time-display,
        audio::-webkit-media-controls-time-remaining-display,
        audio::-webkit-media-controls-timeline,
        audio::-webkit-media-controls-volume-slider {
          filter: grayscale(1) contrast(1.2);
        }
      `}</style>
    </div>
  );
};

export default TranscriptView;
