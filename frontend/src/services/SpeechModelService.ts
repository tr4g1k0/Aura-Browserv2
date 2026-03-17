/**
 * Speech Model Service - ONNX STT Bridge
 * 
 * This service bridges the audio capture from expo-av to the ONNX Runtime
 * for Speech-to-Text inference. It handles audio preprocessing, model inference,
 * and mock mode fallback when the real .onnx models are not available.
 * 
 * Architecture:
 * 1. Receives raw audio chunks from useAudioStream hook
 * 2. Preprocesses audio into Float32 tensor format (16kHz, mono)
 * 3. Runs ONNX inference using AIModelManager (with drop policy for real-time)
 * 4. Returns transcribed text to useLiveCaptions (throttled to prevent UI jank)
 * 
 * OPTIMIZATION: This service implements:
 * - Real-time mode with drop policy (drops chunks when processing is busy)
 * - 100ms throttled callbacks to prevent rapid UI re-renders
 * - Event loop yielding via AIModelManager for smooth animations
 */

import { Platform } from 'react-native';
import { aiModelManager } from '../ai/AIModelManager';

// ============================================================================
// TYPES
// ============================================================================

export interface AudioChunk {
  buffer: Float32Array;
  sampleRate: number;
  timestamp: number;
  duration: number;
  volumeLevel: number; // 0-1 RMS volume
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  processingTimeMs: number;
}

export interface SpeechModelConfig {
  modelId: string;
  sampleRate: number;
  chunkSizeMs: number;
  language: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SpeechModelConfig = {
  modelId: 'whisper-tiny-en',
  sampleRate: 16000,
  chunkSizeMs: 500,
  language: 'en',
};

// Volume threshold for speech detection (0-1)
const SPEECH_THRESHOLD = 0.02;

// Mock transcription phrases for when volume is detected
const MOCK_TRANSCRIPTIONS = [
  'Capturing live audio stream...',
  'Processing speech input...',
  'Detecting voice activity...',
  'Transcribing audio...',
  'Listening to your voice...',
  'Speech detected, processing...',
  'Analyzing audio waveform...',
  'Converting speech to text...',
  'Voice input recognized...',
  'Audio stream active...',
];

// More realistic mock phrases for sustained speech
const MOCK_SPEECH_PHRASES = [
  ['Hello', 'how', 'are', 'you', 'doing', 'today?'],
  ['This', 'is', 'a', 'test', 'of', 'the', 'live', 'captioning', 'system.'],
  ['The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog.'],
  ['Welcome', 'to', 'the', 'ACCESS', 'Browser', 'with', 'live', 'captions.'],
  ['Speech', 'recognition', 'is', 'processing', 'your', 'voice.'],
  ['Real-time', 'transcription', 'powered', 'by', 'on-device', 'AI.'],
];

// ============================================================================
// INTERNAL STATE
// ============================================================================

let config = { ...DEFAULT_CONFIG };
let isModelLoaded = false;
let mockPhraseIndex = 0;
let mockWordIndex = 0;
let lastTranscriptionTime = 0;
let transcriptionListeners: ((result: TranscriptionResult) => void)[] = [];

// Throttled notification function - will be set up on first listener registration
let throttledNotify: ((result: TranscriptionResult) => void) | null = null;
const THROTTLE_INTERVAL_MS = 100; // Max 10 updates per second

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if we're in mock mode (no real ONNX model available)
 */
const isMockMode = (): boolean => {
  // Always mock on web
  if (Platform.OS === 'web') return true;
  
  // Check if ONNX Runtime is available
  if (!aiModelManager.isAvailable()) return true;
  
  // Check if model is loaded
  return !isModelLoaded;
};

/**
 * Calculate RMS volume level from audio buffer
 */
const calculateVolumeLevel = (buffer: Float32Array): number => {
  if (buffer.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  
  return Math.sqrt(sum / buffer.length);
};

/**
 * Resample audio to target sample rate if needed
 */
const resampleAudio = (
  buffer: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array => {
  if (fromRate === toRate) return buffer;
  
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    result[i] = buffer[Math.min(srcIndex, buffer.length - 1)];
  }
  
  return result;
};

/**
 * Normalize audio buffer to -1 to 1 range
 */
const normalizeAudio = (buffer: Float32Array): Float32Array => {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) {
    max = Math.max(max, Math.abs(buffer[i]));
  }
  
  if (max === 0) return buffer;
  
  const result = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] / max;
  }
  
  return result;
};

/**
 * Get mock transcription based on volume level
 */
const getMockTranscription = (volumeLevel: number): string => {
  // Only transcribe if volume is above threshold
  if (volumeLevel < SPEECH_THRESHOLD) {
    return '';
  }
  
  const now = Date.now();
  const timeSinceLast = now - lastTranscriptionTime;
  
  // Rate limit mock transcriptions (one word every ~400ms)
  if (timeSinceLast < 400) {
    return '';
  }
  
  lastTranscriptionTime = now;
  
  // Get the next word from the current phrase
  const currentPhrase = MOCK_SPEECH_PHRASES[mockPhraseIndex % MOCK_SPEECH_PHRASES.length];
  const word = currentPhrase[mockWordIndex % currentPhrase.length];
  
  mockWordIndex++;
  
  // Move to next phrase after completing current one
  if (mockWordIndex >= currentPhrase.length) {
    mockWordIndex = 0;
    mockPhraseIndex++;
  }
  
  return word;
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the speech model service
 */
export const initialize = async (customConfig?: Partial<SpeechModelConfig>): Promise<boolean> => {
  if (customConfig) {
    config = { ...config, ...customConfig };
  }
  
  console.log('[SpeechModelService] Initializing with config:', config);
  
  // Try to load the model if on native platform
  if (Platform.OS !== 'web' && aiModelManager.isAvailable()) {
    try {
      const loaded = await aiModelManager.loadModel(config.modelId);
      isModelLoaded = loaded;
      console.log(`[SpeechModelService] Model loaded: ${loaded}`);
    } catch (error) {
      console.warn('[SpeechModelService] Failed to load model:', error);
      isModelLoaded = false;
    }
  }
  
  console.log(`[SpeechModelService] Running in ${isMockMode() ? 'MOCK' : 'NATIVE'} mode`);
  
  return true;
};

/**
 * Process an audio chunk and return transcription
 * 
 * @param chunk - The audio chunk to process
 * @returns TranscriptionResult with text and metadata
 */
export const processAudioChunk = async (chunk: AudioChunk): Promise<TranscriptionResult> => {
  const startTime = Date.now();
  
  // Calculate volume if not provided
  const volumeLevel = chunk.volumeLevel || calculateVolumeLevel(chunk.buffer);
  
  // MOCK MODE: Return realistic dummy strings
  if (isMockMode()) {
    const text = getMockTranscription(volumeLevel);
    
    const result: TranscriptionResult = {
      text,
      confidence: text ? 0.85 + Math.random() * 0.15 : 0,
      isFinal: text.endsWith('.') || text.endsWith('?') || text.endsWith('!'),
      timestamp: Date.now(),
      processingTimeMs: Date.now() - startTime,
    };
    
    // Notify listeners
    if (text) {
      notifyListeners(result);
    }
    
    return result;
  }
  
  // NATIVE MODE: Run ONNX inference with real-time drop policy
  try {
    // Preprocess audio
    let audioData = chunk.buffer;
    
    // Resample if needed
    if (chunk.sampleRate !== config.sampleRate) {
      audioData = resampleAudio(audioData, chunk.sampleRate, config.sampleRate);
    }
    
    // Normalize
    audioData = normalizeAudio(audioData);
    
    // Run inference with real-time mode (drops chunk if busy processing)
    const inferenceResult = await aiModelManager.runInference(
      config.modelId,
      { audio_input: audioData },
      { audio_input: [1, audioData.length] },
      { realTime: true } // Enable drop policy for real-time STT
    );
    
    // Check if chunk was dropped
    if ((inferenceResult as any).dropped) {
      console.log('[SpeechModelService] Audio chunk dropped (processing busy)');
      return {
        text: '',
        confidence: 0,
        isFinal: false,
        timestamp: Date.now(),
        processingTimeMs: inferenceResult.executionTimeMs,
      };
    }
    
    if (inferenceResult.success && inferenceResult.output) {
      // Decode output tokens to text (model-specific)
      const text = decodeModelOutput(inferenceResult.output);
      
      const result: TranscriptionResult = {
        text,
        confidence: 0.9,
        isFinal: false,
        timestamp: Date.now(),
        processingTimeMs: inferenceResult.executionTimeMs,
      };
      
      notifyListeners(result);
      return result;
    }
    
    // Inference failed, fall back to mock
    console.warn('[SpeechModelService] Inference failed:', inferenceResult.error);
    return {
      text: '',
      confidence: 0,
      isFinal: false,
      timestamp: Date.now(),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[SpeechModelService] Processing error:', error);
    return {
      text: '',
      confidence: 0,
      isFinal: false,
      timestamp: Date.now(),
      processingTimeMs: Date.now() - startTime,
    };
  }
};

/**
 * Decode ONNX model output to text
 * This is model-specific and would be customized for different STT models
 */
const decodeModelOutput = (output: Record<string, any>): string => {
  // Placeholder for model-specific decoding
  // For Whisper models, this would decode the token IDs to text
  // For now, return empty string (mock mode handles actual text)
  return '';
};

/**
 * Notify all listeners of a transcription result (THROTTLED)
 * 
 * OPTIMIZATION: Uses AIModelManager's throttled callback to prevent
 * React Native from trying to re-render the text component too rapidly.
 * Max 1 update per THROTTLE_INTERVAL_MS (100ms = 10 updates/second)
 */
const notifyListeners = (result: TranscriptionResult) => {
  // Create throttled notifier if not exists
  if (!throttledNotify) {
    throttledNotify = aiModelManager.getThrottledCallback(
      'speech-transcription-notify',
      (data: TranscriptionResult) => {
        transcriptionListeners.forEach(listener => listener(data));
      },
      THROTTLE_INTERVAL_MS
    );
  }
  
  // Use throttled notification
  throttledNotify(result);
};

/**
 * Add a listener for transcription results
 */
export const addTranscriptionListener = (
  listener: (result: TranscriptionResult) => void
): (() => void) => {
  transcriptionListeners.push(listener);
  
  return () => {
    transcriptionListeners = transcriptionListeners.filter(l => l !== listener);
  };
};

/**
 * Check if service is in mock mode
 */
export const isInMockMode = (): boolean => isMockMode();

/**
 * Check if real ONNX model is loaded
 */
export const isModelReady = (): boolean => isModelLoaded;

/**
 * Get current configuration
 */
export const getConfig = (): SpeechModelConfig => ({ ...config });

/**
 * Reset mock state (for testing)
 */
export const resetMockState = () => {
  mockPhraseIndex = 0;
  mockWordIndex = 0;
  lastTranscriptionTime = 0;
};

/**
 * Release resources
 */
export const release = async (): Promise<void> => {
  if (isModelLoaded) {
    await aiModelManager.unloadModel(config.modelId);
    isModelLoaded = false;
  }
  
  // Clean up throttled callback
  if (throttledNotify) {
    aiModelManager.removeThrottledCallback('speech-transcription-notify');
    throttledNotify = null;
  }
  
  transcriptionListeners = [];
  resetMockState();
};

export default {
  initialize,
  processAudioChunk,
  addTranscriptionListener,
  isInMockMode,
  isModelReady,
  getConfig,
  resetMockState,
  release,
};
