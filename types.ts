
export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Step 1: Image/PDF -> Text Script
  SYNTHESIZING = 'SYNTHESIZING', // Step 2: Text Script -> Audio
  PLAYING = 'PLAYING',
  ERROR = 'ERROR',
}

export enum InputMode {
  FILE = 'FILE',
  TEXT = 'TEXT',
}

export interface VideoRecommendation {
  title: string;
  query: string;
}

export interface SolutionItem {
  questionDisplay: string; // Clean text for UI (No markdown bold, formatted)
  questionReading: string; // Phonetic/IUPAC for Audio
  solutionDisplay: string; // Clean text for UI (No markdown bold, formatted)
  solutionReading: string; // Phonetic/IUPAC for Audio
  imagePrompt?: string; // NEW: The prompt used to generate the image
  illustrationImage?: string; // NEW: Base64 string of the generated image
}

export interface ProcessingResult {
  script: string; // The text optimized for reading
  audioBase64: string | null;
  relatedVideos: VideoRecommendation[];
  solutions: SolutionItem[];
}

export interface FileData {
  file: File;
  previewUrl?: string;
  base64?: string;
  mimeType: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  title: string;
}