// AIModelManager - Core ONNX Runtime Manager
// Handles model loading, session management, and inference execution
// 
// OPTIMIZATION: This manager is designed to NEVER block the React Native UI thread:
// - Uses optimized ONNX session options (xnnpack, limited threads)
// - Yields to event loop before heavy inference operations
// - Implements concurrency lock with drop policy for real-time tasks
// - Provides throttled callbacks to prevent rapid re-renders

import { Platform } from 'react-native';
import {
  ModelType,
  ExecutionProvider,
  InferenceResult,
  AISettings,
  DEFAULT_AI_SETTINGS,
} from './types';
import { modelDownloadManager } from './ModelDownloadManager';
import { getModelById, DEFAULT_MODELS } from './models.config';

// Type for ONNX Runtime (will be dynamically imported on native)
type OrtInferenceSession = any;
type OrtTensor = any;

// Throttle utility for UI callbacks
type ThrottledCallback<T> = (data: T) => void;

/**
 * Creates a throttled version of a callback that only fires at most once per interval
 * @param callback The function to throttle
 * @param intervalMs Maximum frequency of calls in milliseconds
 * @returns Throttled function
 */
function createThrottledCallback<T>(
  callback: (data: T) => void,
  intervalMs: number = 100
): ThrottledCallback<T> {
  let lastCall = 0;
  let pendingData: T | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  return (data: T) => {
    const now = Date.now();
    const timeSinceLast = now - lastCall;

    if (timeSinceLast >= intervalMs) {
      // Enough time has passed, call immediately
      lastCall = now;
      callback(data);
    } else {
      // Store pending data and schedule a call
      pendingData = data;
      
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (pendingData !== null) {
            lastCall = Date.now();
            callback(pendingData);
            pendingData = null;
          }
          timeoutId = null;
        }, intervalMs - timeSinceLast);
      }
    }
  };
}

class AIModelManager {
  private sessions: Map<string, OrtInferenceSession> = new Map();
  private settings: AISettings = DEFAULT_AI_SETTINGS;
  private ort: any = null;
  private isNativePlatform: boolean;
  private memoryUsage: number = 0;
  private maxMemory: number = 512 * 1024 * 1024; // 512MB default
  
  // Concurrency lock for real-time inference (drop policy)
  private isProcessing: boolean = false;
  private droppedChunks: number = 0;
  
  // Throttled callbacks registry
  private throttledCallbacks: Map<string, ThrottledCallback<any>> = new Map();

  constructor() {
    this.isNativePlatform = Platform.OS !== 'web';
    this.initializeONNX();
  }

  /**
   * Initialize ONNX Runtime (only on native platforms)
   */
  private async initializeONNX(): Promise<void> {
    if (!this.isNativePlatform) {
      console.log('[AIModelManager] Running on web - ONNX Runtime not available');
      return;
    }

    try {
      // Dynamic import for ONNX Runtime
      this.ort = require('onnxruntime-react-native');
      console.log('[AIModelManager] ONNX Runtime initialized');
    } catch (error) {
      console.warn('[AIModelManager] Failed to initialize ONNX Runtime:', error);
      this.ort = null;
    }
  }

  /**
   * Update AI settings
   */
  updateSettings(newSettings: Partial<AISettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.maxMemory = this.settings.maxMemoryMB * 1024 * 1024;
  }

  /**
   * Get current settings
   */
  getSettings(): AISettings {
    return { ...this.settings };
  }

  /**
   * Determine the best execution provider for the current device
   */
  private getBestExecutionProvider(): ExecutionProvider {
    if (this.settings.preferredProvider !== 'cpu') {
      // User has a preference
      if (Platform.OS === 'ios' && this.settings.preferredProvider === 'coreml') {
        return 'coreml';
      }
      if (Platform.OS === 'android' && this.settings.preferredProvider === 'nnapi') {
        return 'nnapi';
      }
    }

    // Auto-detect best provider
    if (Platform.OS === 'ios') {
      // CoreML is generally well-supported on iOS
      return 'coreml';
    } else if (Platform.OS === 'android') {
      // NNAPI for Android (if available)
      return 'nnapi';
    }

    // Fallback to CPU
    return 'cpu';
  }

  /**
   * Configure session options based on device capabilities
   * 
   * OPTIMIZATION: These options are tuned to prevent UI thread blocking:
   * - intraOpNumThreads: 2 - prevents maxing out CPU cores
   * - executionProviders: ['xnnpack', 'cpu'] - mobile-optimized math operations
   */
  private getSessionOptions(provider: ExecutionProvider): any {
    const options: any = {
      graphOptimizationLevel: 'all',
      // Limit thread usage to prevent UI freezing
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
    };

    // Add provider-specific options with xnnpack optimization
    if (provider === 'coreml') {
      options.executionProviders = [
        {
          name: 'coreml',
          useCPUOnly: false,
          enableOnSubgraph: true,
        },
        'xnnpack', // Mobile-optimized SIMD operations
        'cpu', // Fallback
      ];
    } else if (provider === 'nnapi') {
      options.executionProviders = [
        {
          name: 'nnapi',
          useFP16: true,
          useNCHW: false,
        },
        'xnnpack', // Mobile-optimized SIMD operations
        'cpu', // Fallback
      ];
    } else {
      // CPU-only mode - prioritize xnnpack for mobile optimization
      options.executionProviders = ['xnnpack', 'cpu'];
    }

    return options;
  }

  /**
   * Load an ONNX model and create inference session
   */
  async loadModel(modelId: string): Promise<boolean> {
    if (!this.isNativePlatform || !this.ort) {
      console.log(`[AIModelManager] Skipping model load on web: ${modelId}`);
      return false;
    }

    // Check if already loaded
    if (this.sessions.has(modelId)) {
      console.log(`[AIModelManager] Model already loaded: ${modelId}`);
      return true;
    }

    // Check if model is downloaded
    const isReady = await modelDownloadManager.isModelReady(modelId);
    if (!isReady) {
      console.warn(`[AIModelManager] Model not downloaded: ${modelId}`);
      return false;
    }

    const config = getModelById(modelId);
    if (!config) {
      console.error(`[AIModelManager] Unknown model: ${modelId}`);
      return false;
    }

    // Check memory constraints
    const estimatedMemory = config.size * 1024 * 1024 * 1.5; // Estimate 1.5x model size
    if (this.memoryUsage + estimatedMemory > this.maxMemory) {
      console.warn(`[AIModelManager] Memory limit exceeded, unloading other models`);
      await this.unloadLeastRecentlyUsed(estimatedMemory);
    }

    try {
      const modelPath = modelDownloadManager.getModelPath(modelId);
      const provider = this.getBestExecutionProvider();
      const options = this.getSessionOptions(provider);

      console.log(`[AIModelManager] Loading model: ${modelId} with provider: ${provider}`);

      const session = await this.ort.InferenceSession.create(modelPath, options);
      
      this.sessions.set(modelId, session);
      this.memoryUsage += estimatedMemory;

      console.log(`[AIModelManager] Model loaded: ${modelId}`);
      return true;
    } catch (error) {
      console.error(`[AIModelManager] Failed to load model: ${modelId}`, error);
      return false;
    }
  }

  /**
   * Unload a model to free memory
   */
  async unloadModel(modelId: string): Promise<void> {
    const session = this.sessions.get(modelId);
    if (session) {
      try {
        // ONNX Runtime session cleanup
        if (typeof session.release === 'function') {
          await session.release();
        }
      } catch (error) {
        console.warn(`[AIModelManager] Error releasing session: ${modelId}`, error);
      }
      
      this.sessions.delete(modelId);
      
      const config = getModelById(modelId);
      if (config) {
        this.memoryUsage -= config.size * 1024 * 1024 * 1.5;
        this.memoryUsage = Math.max(0, this.memoryUsage);
      }
      
      console.log(`[AIModelManager] Model unloaded: ${modelId}`);
    }
  }

  /**
   * Unload least recently used models to free up memory
   */
  private async unloadLeastRecentlyUsed(requiredMemory: number): Promise<void> {
    const loadedModels = Array.from(this.sessions.keys());
    
    for (const modelId of loadedModels) {
      if (this.memoryUsage + requiredMemory <= this.maxMemory) {
        break;
      }
      await this.unloadModel(modelId);
    }
  }

  /**
   * Run inference on a loaded model
   * 
   * OPTIMIZATION: Non-blocking inference with:
   * - Event loop yielding before heavy operations
   * - Concurrency lock with drop policy for real-time tasks
   * 
   * @param modelId - The model to run inference on
   * @param inputData - Input tensor data
   * @param inputShapes - Input tensor shapes
   * @param options - Optional inference options
   * @param options.realTime - If true, drops chunk when already processing (for STT)
   */
  async runInference(
    modelId: string,
    inputData: Record<string, Float32Array | Int32Array | BigInt64Array>,
    inputShapes: Record<string, number[]>,
    options?: { realTime?: boolean }
  ): Promise<InferenceResult> {
    const startTime = Date.now();
    const isRealTime = options?.realTime ?? false;

    // Check if running on web
    if (!this.isNativePlatform || !this.ort) {
      return {
        success: false,
        output: null,
        executionTimeMs: Date.now() - startTime,
        provider: 'cpu',
        error: 'ONNX Runtime not available on web platform',
      };
    }

    // CONCURRENCY LOCK: For real-time tasks, drop if already processing
    if (isRealTime && this.isProcessing) {
      this.droppedChunks++;
      console.log(`[AIModelManager] Dropping chunk (drop policy). Total dropped: ${this.droppedChunks}`);
      return {
        success: false,
        output: null,
        executionTimeMs: Date.now() - startTime,
        provider: 'cpu',
        error: 'Processing in progress - chunk dropped (real-time mode)',
        dropped: true,
      } as InferenceResult & { dropped: boolean };
    }

    // Check if model is loaded
    let session = this.sessions.get(modelId);
    if (!session) {
      // Try to load the model
      const loaded = await this.loadModel(modelId);
      if (!loaded) {
        return {
          success: false,
          output: null,
          executionTimeMs: Date.now() - startTime,
          provider: 'cpu',
          error: `Model not loaded: ${modelId}`,
        };
      }
      session = this.sessions.get(modelId);
    }

    // Set processing lock
    this.isProcessing = true;

    try {
      // Create input tensors
      const feeds: Record<string, OrtTensor> = {};
      for (const [name, data] of Object.entries(inputData)) {
        const shape = inputShapes[name];
        feeds[name] = new this.ort.Tensor(data, shape);
      }

      // EVENT LOOP YIELDING: Allow UI to paint before heavy inference
      // This prevents the JS bridge from locking up during the native call
      await new Promise(resolve => setTimeout(resolve, 0));

      // Run inference
      const results = await session.run(feeds);

      // Extract output
      const outputNames = Object.keys(results);
      const output: Record<string, any> = {};
      for (const name of outputNames) {
        output[name] = results[name].data;
      }

      return {
        success: true,
        output,
        executionTimeMs: Date.now() - startTime,
        provider: this.getBestExecutionProvider(),
      };
    } catch (error: any) {
      console.error(`[AIModelManager] Inference error: ${modelId}`, error);
      return {
        success: false,
        output: null,
        executionTimeMs: Date.now() - startTime,
        provider: 'cpu',
        error: error.message || 'Inference failed',
      };
    } finally {
      // Always release the processing lock
      this.isProcessing = false;
    }
  }

  /**
   * Check if ONNX Runtime is available
   */
  isAvailable(): boolean {
    return this.isNativePlatform && this.ort !== null;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { used: number; max: number; percentage: number } {
    return {
      used: this.memoryUsage,
      max: this.maxMemory,
      percentage: Math.round((this.memoryUsage / this.maxMemory) * 100),
    };
  }

  /**
   * Unload all models
   */
  async unloadAll(): Promise<void> {
    for (const modelId of this.sessions.keys()) {
      await this.unloadModel(modelId);
    }
  }

  /**
   * Get list of loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get or create a throttled callback for UI updates
   * 
   * OPTIMIZATION: Prevents React Native from re-rendering too rapidly
   * by limiting callback frequency to max 1 call per intervalMs
   * 
   * @param key - Unique identifier for the callback
   * @param callback - The callback function to throttle
   * @param intervalMs - Minimum interval between calls (default: 100ms)
   */
  getThrottledCallback<T>(
    key: string,
    callback: (data: T) => void,
    intervalMs: number = 100
  ): ThrottledCallback<T> {
    if (!this.throttledCallbacks.has(key)) {
      this.throttledCallbacks.set(key, createThrottledCallback(callback, intervalMs));
    }
    return this.throttledCallbacks.get(key) as ThrottledCallback<T>;
  }

  /**
   * Remove a throttled callback
   */
  removeThrottledCallback(key: string): void {
    this.throttledCallbacks.delete(key);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): { isProcessing: boolean; droppedChunks: number } {
    return {
      isProcessing: this.isProcessing,
      droppedChunks: this.droppedChunks,
    };
  }

  /**
   * Reset dropped chunks counter
   */
  resetDroppedChunks(): void {
    this.droppedChunks = 0;
  }
}

// Singleton instance
export const aiModelManager = new AIModelManager();
