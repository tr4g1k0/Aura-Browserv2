// AIModelManager - Core ONNX Runtime Manager
// Handles model loading, session management, and inference execution

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

class AIModelManager {
  private sessions: Map<string, OrtInferenceSession> = new Map();
  private settings: AISettings = DEFAULT_AI_SETTINGS;
  private ort: any = null;
  private isNativePlatform: boolean;
  private memoryUsage: number = 0;
  private maxMemory: number = 512 * 1024 * 1024; // 512MB default

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
   */
  private getSessionOptions(provider: ExecutionProvider): any {
    const options: any = {
      executionProviders: [provider],
      graphOptimizationLevel: 'all',
    };

    // Add provider-specific options
    if (provider === 'coreml') {
      options.executionProviders = [
        {
          name: 'coreml',
          useCPUOnly: false,
          enableOnSubgraph: true,
        },
        'cpu', // Fallback
      ];
    } else if (provider === 'nnapi') {
      options.executionProviders = [
        {
          name: 'nnapi',
          useFP16: true,
          useNCHW: false,
        },
        'cpu', // Fallback
      ];
    } else {
      options.executionProviders = ['cpu'];
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
   */
  async runInference(
    modelId: string,
    inputData: Record<string, Float32Array | Int32Array | BigInt64Array>,
    inputShapes: Record<string, number[]>
  ): Promise<InferenceResult> {
    const startTime = Date.now();

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

    try {
      // Create input tensors
      const feeds: Record<string, OrtTensor> = {};
      for (const [name, data] of Object.entries(inputData)) {
        const shape = inputShapes[name];
        feeds[name] = new this.ort.Tensor(data, shape);
      }

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
}

// Singleton instance
export const aiModelManager = new AIModelManager();
