// Model Registry Configuration
// These are placeholder URLs - replace with your actual S3/CDN URLs

import { ModelConfig } from './types';

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // Speech-to-Text Model (sub-200MB target)
  'moonshine-tiny-q4': {
    id: 'moonshine-tiny-q4',
    name: 'Moonshine Tiny (Quantized)',
    type: 'stt',
    description: 'Ultra-fast speech recognition for live captioning',
    size: 85, // MB
    downloadUrl: 'https://your-s3-bucket.amazonaws.com/models/moonshine-tiny-q4.onnx',
    filename: 'moonshine-tiny-q4.onnx',
    quantized: true,
    inputShape: [1, 16000], // 1 second of 16kHz audio
    outputShape: [1, 256],
  },
  
  'distil-whisper-tiny': {
    id: 'distil-whisper-tiny',
    name: 'DistilWhisper Tiny',
    type: 'stt',
    description: 'Compact Whisper for accurate transcription',
    size: 150, // MB
    downloadUrl: 'https://your-s3-bucket.amazonaws.com/models/distil-whisper-tiny.onnx',
    filename: 'distil-whisper-tiny.onnx',
    quantized: true,
    inputShape: [1, 80, 3000], // Mel spectrogram
    outputShape: [1, 448],
  },

  // Vision Language Model (sub-200MB target)
  'qwen-vl-tiny-q4': {
    id: 'qwen-vl-tiny-q4',
    name: 'Qwen-VL Tiny (Quantized)',
    type: 'vlm',
    description: 'Visual analysis for ad/tracker detection',
    size: 180, // MB
    downloadUrl: 'https://your-s3-bucket.amazonaws.com/models/qwen-vl-tiny-q4.onnx',
    filename: 'qwen-vl-tiny-q4.onnx',
    quantized: true,
    inputShape: [1, 3, 224, 224], // Image input
    outputShape: [1, 512],
  },

  // Large Language Model (sub-200MB target)
  'smollm-135m-q4': {
    id: 'smollm-135m-q4',
    name: 'SmolLM 135M (Quantized)',
    type: 'llm',
    description: 'Fast text generation for summaries and agent tasks',
    size: 135, // MB
    downloadUrl: 'https://your-s3-bucket.amazonaws.com/models/smollm-135m-q4.onnx',
    filename: 'smollm-135m-q4.onnx',
    quantized: true,
    inputShape: [1, 512], // Token sequence
    outputShape: [1, 512, 32000], // Vocab logits
  },

  'phi-mini-q4': {
    id: 'phi-mini-q4',
    name: 'Phi Mini (Quantized)',
    type: 'llm',
    description: 'Higher quality text generation',
    size: 190, // MB
    downloadUrl: 'https://your-s3-bucket.amazonaws.com/models/phi-mini-q4.onnx',
    filename: 'phi-mini-q4.onnx',
    quantized: true,
    inputShape: [1, 1024],
    outputShape: [1, 1024, 51200],
  },
};

// Default models for each task
export const DEFAULT_MODELS = {
  stt: 'moonshine-tiny-q4',
  vlm: 'qwen-vl-tiny-q4',
  llm: 'smollm-135m-q4',
};

export const getModelById = (id: string): ModelConfig | undefined => {
  return MODEL_REGISTRY[id];
};

export const getModelsByType = (type: string): ModelConfig[] => {
  return Object.values(MODEL_REGISTRY).filter(m => m.type === type);
};
