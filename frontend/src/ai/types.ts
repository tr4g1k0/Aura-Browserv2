// AI Model Types and Interfaces

export type ModelType = 'stt' | 'vlm' | 'llm';
export type ExecutionProvider = 'cpu' | 'coreml' | 'nnapi' | 'npu';
export type ModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'loading' | 'error';

export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  size: number; // in MB
  downloadUrl: string;
  filename: string;
  quantized: boolean;
  inputShape?: number[];
  outputShape?: number[];
}

export interface ModelDownloadProgress {
  modelId: string;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  status: ModelStatus;
}

export interface InferenceResult {
  success: boolean;
  output: any;
  executionTimeMs: number;
  provider: ExecutionProvider;
  fromCache?: boolean;
  error?: string;
}

export interface STTResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export interface VLMResult {
  detectedElements: {
    type: 'ad' | 'sponsored' | 'cookie_banner' | 'popup';
    selector: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }[];
}

export interface LLMResult {
  text: string;
  tokens: number;
  finishReason: 'complete' | 'length' | 'error';
}

export interface AISettings {
  strictLocalProcessing: boolean;
  cloudFallbackEnabled: boolean;
  cloudFallbackTimeoutMs: number;
  preferredProvider: ExecutionProvider;
  maxMemoryMB: number;
  enableModelCaching: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  strictLocalProcessing: false,
  cloudFallbackEnabled: true,
  cloudFallbackTimeoutMs: 5000,
  preferredProvider: 'cpu',
  maxMemoryMB: 512,
  enableModelCaching: true,
};
