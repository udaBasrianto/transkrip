
import React, { useState } from 'react';
import { Clock, Trash2, ChevronRight, History as HistoryIcon, HardDrive, Download, Trash, Play, Pause, Music, Youtube, ExternalLink } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryListProps {
  items: HistoryItem[];
  activeId?: string | null;
  onSelectItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onExport: () => void;
  onClose: () => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ items, activeId, onSelectItem, onDeleteItem, onClearAll, onExport, onClose }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const togglePlayback = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPlayingId(playingId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80 shadow-2xl animate-in slide-in-from-right duration-300 relative z-[60]">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2 font-bold text-gray-800 uppercase tracking-tighter text-sm">
          <HistoryIcon className="w-4 h-4 text-blue-600" />
          Transcription History
          <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
            {items.length}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Clock className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-gray-400 text-xs">History is empty.</p>
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id}
              className={`group relative rounded-xl p-3 cursor-pointer transition-all border ${
                activeId === item.id 
                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-gray-50'
              }`}
              onClick={() => onSelectItem(item)}
            >
              <div className="pr-8">
                <div className="flex items-center gap-1.5 mb-1">
                  {item.fileName === 'YouTube Video' && <Youtube className="w-3 h-3 text-red-500 flex-shrink-0" />}
                  <h4 className={`text-sm font-semibold truncate ${activeId === item.id ? 'text-blue-900' : 'text-gray-800'}`}>
                    {item.fileName}
                  </h4>
                </div>
                
                <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                  <span className="flex items-center gap-1 uppercase tracking-wider"><Clock className="w-2.5 h-2.5" />{formatTime(item.timestamp)}</span>
                  {item.fileSize && <span className="flex items-center gap-1"><HardDrive className="w-2.5 h-2.5" />{Math.round(item.fileSize/1024)}KB</span>}
                </div>

                {item.url && item.fileName === 'YouTube Video' && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                    <ExternalLink className="w-2.5 h-2.5" /> Watch on YouTube
                  </a>
                )}

                {item.audioData && (
                  <div className="mt-3">
                    <button onClick={(e) => togglePlayback(e, item.id)} className={`flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold ${playingId === item.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {playingId === item.id ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      {playingId === item.id ? 'Stop' : 'Play Original'}
                    </button>
                    {playingId === item.id && (
                      <audio autoPlay src={`data:${item.mimeType};base64,${item.audioData}`} className="hidden" onEnded={() => setPlayingId(null)} />
                    )}
                  </div>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-100 gap-2 flex flex-col">
        <button onClick={onExport} className="w-full py-2 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 uppercase tracking-widest">Export JSON</button>
        <button onClick={onClearAll} className="w-full py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg uppercase tracking-widest">Clear All</button>
      </div>
    </div>
  );
};

export default HistoryList;
