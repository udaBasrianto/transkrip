
export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  TRANSCRIBING = 'TRANSCRIBING',
  RECORDING = 'RECORDING',
  REFINING = 'REFINING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface TranscriptionResult {
  raw: string;
  refined: string;
}

export interface FileData {
  base64: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  url?: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  fileSize?: number;
  timestamp: number;
  result: TranscriptionResult;
  audioData?: string; 
  mimeType?: string;
  url?: string;
}
