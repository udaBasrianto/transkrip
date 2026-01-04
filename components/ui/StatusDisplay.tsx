
import React from 'react';
import { Loader2, Sparkles, Wand2, Mic } from 'lucide-react';
import { AppStatus } from '../../types';

interface StatusDisplayProps {
  status: AppStatus;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ status }) => {
  if (status === AppStatus.IDLE || status === AppStatus.SUCCESS || status === AppStatus.ERROR) return null;

  const getMessage = () => {
    switch (status) {
      case AppStatus.LOADING:
        return "Preparing your file...";
      case AppStatus.TRANSCRIBING:
        return "Listening carefully to your audio...";
      case AppStatus.RECORDING:
        return "Recording Live...";
      case AppStatus.REFINING:
        return "Polishing the transcript with AI magic...";
      default:
        return "Processing...";
    }
  };

  const getIcon = () => {
    switch (status) {
      case AppStatus.TRANSCRIBING:
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
      case AppStatus.REFINING:
        return <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />;
      case AppStatus.RECORDING:
        return <Mic className="w-8 h-8 text-red-500 animate-pulse" />;
      default:
        return <Wand2 className="w-8 h-8 text-gray-400 animate-bounce" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in zoom-in duration-300">
      <div className="mb-4">{getIcon()}</div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{getMessage()}</h3>
      <p className="text-gray-500 text-sm text-center max-w-xs">
        {status === AppStatus.TRANSCRIBING 
          ? "This might take a minute depending on the length of your audio." 
          : status === AppStatus.RECORDING 
          ? "Speak clearly. We are transcribing your words in real-time."
          : "We're organizing your thoughts to make them look professional."}
      </p>
    </div>
  );
};

export default StatusDisplay;
