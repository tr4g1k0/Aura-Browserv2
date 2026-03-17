// Hybrid AI Router
// Routes AI requests to local ONNX or cloud API based on availability and settings

import { Platform } from 'react-native';
import { aiModelManager } from './AIModelManager';
import { mockInferenceEngine } from './MockInference';
import { modelDownloadManager } from './ModelDownloadManager';
import { DEFAULT_MODELS } from './models.config';
import {
  AISettings,
  DEFAULT_AI_SETTINGS,
  STTResult,
  VLMResult,
  LLMResult,
} from './types';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type AISource = 'local' | 'cloud' | 'mock';

export interface AIResponse<T> {
  result: T;
  source: AISource;
  executionTimeMs: number;
  modelId?: string;
}

class HybridAIRouter {
  private settings: AISettings = DEFAULT_AI_SETTINGS;
  private useMockMode: boolean = true; // Use mock by default until models are downloaded

  constructor() {
    this.checkModelAvailability();
  }

  /**
   * Update router settings
   */
  updateSettings(newSettings: Partial<AISettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    aiModelManager.updateSettings(this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): AISettings {
    return { ...this.settings };
  }

  /**
   * Check if local models are available
   */
  private async checkModelAvailability(): Promise<void> {
    if (Platform.OS === 'web') {
      this.useMockMode = true;
      return;
    }

    // Check if at least one model of each type is ready
    const sttReady = await modelDownloadManager.isModelReady(DEFAULT_MODELS.stt);
    const llmReady = await modelDownloadManager.isModelReady(DEFAULT_MODELS.llm);

    this.useMockMode = !(sttReady || llmReady);
    console.log(`[HybridAIRouter] Mock mode: ${this.useMockMode}`);
  }

  /**
   * Enable/disable mock mode
   */
  setMockMode(enabled: boolean): void {
    this.useMockMode = enabled;
  }

  /**
   * Determine the best source for a request
   */
  private async determineSource(modelType: 'stt' | 'vlm' | 'llm'): Promise<AISource> {
    // If strict local processing is enabled, never use cloud
    if (this.settings.strictLocalProcessing) {
      const modelId = DEFAULT_MODELS[modelType];
      const isReady = await modelDownloadManager.isModelReady(modelId);
      
      if (isReady && aiModelManager.isAvailable()) {
        return 'local';
      }
      // Fall back to mock if local not available but strict mode is on
      return 'mock';
    }

    // Check if running on web
    if (Platform.OS === 'web') {
      return this.settings.cloudFallbackEnabled ? 'cloud' : 'mock';
    }

    // Check if local model is available
    const modelId = DEFAULT_MODELS[modelType];
    const isReady = await modelDownloadManager.isModelReady(modelId);
    
    if (isReady && aiModelManager.isAvailable()) {
      return 'local';
    }

    // Fallback chain
    if (this.settings.cloudFallbackEnabled) {
      return 'cloud';
    }

    return 'mock';
  }

  /**
   * Run Speech-to-Text
   */
  async runSTT(audioData: Float32Array): Promise<AIResponse<STTResult>> {
    const startTime = Date.now();
    const source = await this.determineSource('stt');

    try {
      let result: STTResult;

      switch (source) {
        case 'local':
          result = await this.runLocalSTT(audioData);
          break;
        case 'cloud':
          result = await this.runCloudSTT(audioData);
          break;
        case 'mock':
        default:
          result = await mockInferenceEngine.runSTTInference(audioData);
          break;
      }

      return {
        result,
        source,
        executionTimeMs: Date.now() - startTime,
        modelId: source === 'local' ? DEFAULT_MODELS.stt : undefined,
      };
    } catch (error: any) {
      // Fallback on error
      if (source !== 'mock' && this.settings.cloudFallbackEnabled) {
        console.warn(`[HybridAIRouter] STT failed, falling back to mock:`, error.message);
        const result = await mockInferenceEngine.runSTTInference(audioData);
        return {
          result,
          source: 'mock',
          executionTimeMs: Date.now() - startTime,
        };
      }
      throw error;
    }
  }

  /**
   * Run Vision Language Model (ad detection)
   */
  async runVLM(imageData: Uint8Array | string): Promise<AIResponse<VLMResult>> {
    const startTime = Date.now();
    const source = await this.determineSource('vlm');

    try {
      let result: VLMResult;

      switch (source) {
        case 'local':
          result = await this.runLocalVLM(imageData);
          break;
        case 'cloud':
          result = await this.runCloudVLM(imageData);
          break;
        case 'mock':
        default:
          result = await mockInferenceEngine.runVLMInference(imageData);
          break;
      }

      return {
        result,
        source,
        executionTimeMs: Date.now() - startTime,
        modelId: source === 'local' ? DEFAULT_MODELS.vlm : undefined,
      };
    } catch (error: any) {
      console.warn(`[HybridAIRouter] VLM failed, falling back to mock:`, error.message);
      const result = await mockInferenceEngine.runVLMInference(imageData);
      return {
        result,
        source: 'mock',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run LLM for text generation
   */
  async runLLM(prompt: string, maxTokens: number = 256): Promise<AIResponse<LLMResult>> {
    const startTime = Date.now();
    const source = await this.determineSource('llm');

    try {
      let result: LLMResult;

      switch (source) {
        case 'local':
          result = await this.runLocalLLM(prompt, maxTokens);
          break;
        case 'cloud':
          result = await this.runCloudLLM(prompt, maxTokens);
          break;
        case 'mock':
        default:
          result = await mockInferenceEngine.runLLMInference(prompt, maxTokens);
          break;
      }

      return {
        result,
        source,
        executionTimeMs: Date.now() - startTime,
        modelId: source === 'local' ? DEFAULT_MODELS.llm : undefined,
      };
    } catch (error: any) {
      console.warn(`[HybridAIRouter] LLM failed, falling back:`, error.message);
      
      // Try cloud if local failed
      if (source === 'local' && this.settings.cloudFallbackEnabled) {
        try {
          const result = await this.runCloudLLM(prompt, maxTokens);
          return {
            result,
            source: 'cloud',
            executionTimeMs: Date.now() - startTime,
          };
        } catch {}
      }
      
      // Final fallback to mock
      const result = await mockInferenceEngine.runLLMInference(prompt, maxTokens);
      return {
        result,
        source: 'mock',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Stream LLM output
   */
  async *streamLLM(
    prompt: string,
    maxTokens: number = 256
  ): AsyncGenerator<{ token: string; done: boolean; source: AISource }> {
    const source = await this.determineSource('llm');

    if (source === 'cloud') {
      // For cloud, we'll use the streaming endpoint
      yield* this.streamCloudLLM(prompt, maxTokens);
    } else {
      // Use mock streaming
      for await (const chunk of mockInferenceEngine.streamLLMInference(prompt, maxTokens)) {
        yield { ...chunk, source: 'mock' };
      }
    }
  }

  // ==================== Local ONNX Inference ====================

  private async runLocalSTT(audioData: Float32Array): Promise<STTResult> {
    const modelId = DEFAULT_MODELS.stt;
    const result = await aiModelManager.runInference(
      modelId,
      { audio_input: audioData },
      { audio_input: [1, audioData.length] }
    );

    if (!result.success) {
      throw new Error(result.error || 'Local STT inference failed');
    }

    // Decode output tokens to text (placeholder - actual implementation depends on model)
    return {
      text: this.decodeSTTOutput(result.output),
      confidence: 0.9,
      isFinal: true,
      timestamp: Date.now(),
    };
  }

  private async runLocalVLM(imageData: Uint8Array | string): Promise<VLMResult> {
    const modelId = DEFAULT_MODELS.vlm;
    
    // Convert image to tensor format
    const imageTensor = this.preprocessImage(imageData);
    
    const result = await aiModelManager.runInference(
      modelId,
      { image_input: imageTensor },
      { image_input: [1, 3, 224, 224] }
    );

    if (!result.success) {
      throw new Error(result.error || 'Local VLM inference failed');
    }

    return this.decodeVLMOutput(result.output);
  }

  private async runLocalLLM(prompt: string, maxTokens: number): Promise<LLMResult> {
    const modelId = DEFAULT_MODELS.llm;
    
    // Tokenize prompt (placeholder)
    const inputTokens = this.tokenize(prompt);
    
    const result = await aiModelManager.runInference(
      modelId,
      { input_ids: inputTokens },
      { input_ids: [1, inputTokens.length] }
    );

    if (!result.success) {
      throw new Error(result.error || 'Local LLM inference failed');
    }

    return {
      text: this.decodeLLMOutput(result.output),
      tokens: maxTokens,
      finishReason: 'complete',
    };
  }

  // ==================== Cloud API Fallback ====================

  private async runCloudSTT(audioData: Float32Array): Promise<STTResult> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud STT timeout')), this.settings.cloudFallbackTimeoutMs);
    });

    const fetchPromise = async (): Promise<STTResult> => {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/ai/stt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: Array.from(audioData),
        }),
      });

      if (!response.ok) {
        throw new Error('Cloud STT request failed');
      }

      const data = await response.json();
      return {
        text: data.text,
        confidence: data.confidence || 0.9,
        isFinal: true,
        timestamp: Date.now(),
      };
    };

    return Promise.race([fetchPromise(), timeoutPromise]);
  }

  private async runCloudVLM(imageData: Uint8Array | string): Promise<VLMResult> {
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/ai/vlm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: typeof imageData === 'string' ? imageData : Array.from(imageData),
      }),
    });

    if (!response.ok) {
      throw new Error('Cloud VLM request failed');
    }

    return await response.json();
  }

  private async runCloudLLM(prompt: string, maxTokens: number): Promise<LLMResult> {
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: prompt,
        context: { maxTokens },
      }),
    });

    if (!response.ok) {
      throw new Error('Cloud LLM request failed');
    }

    const data = await response.json();
    return {
      text: data.response,
      tokens: maxTokens,
      finishReason: 'complete',
    };
  }

  private async *streamCloudLLM(
    prompt: string,
    maxTokens: number
  ): AsyncGenerator<{ token: string; done: boolean; source: AISource }> {
    // For simplicity, get full response and simulate streaming
    const result = await this.runCloudLLM(prompt, maxTokens);
    const words = result.text.split(' ');

    for (let i = 0; i < words.length; i++) {
      yield {
        token: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1,
        source: 'cloud',
      };
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  // ==================== Utility Functions ====================

  private decodeSTTOutput(output: any): string {
    // Placeholder - actual implementation depends on model architecture
    return 'Transcribed text from local model';
  }

  private decodeVLMOutput(output: any): VLMResult {
    // Placeholder - actual implementation depends on model architecture
    return {
      detectedElements: [],
    };
  }

  private decodeLLMOutput(output: any): string {
    // Placeholder - actual implementation depends on model architecture
    return 'Generated text from local model';
  }

  private preprocessImage(imageData: Uint8Array | string): Float32Array {
    // Placeholder - convert image to normalized tensor
    return new Float32Array(1 * 3 * 224 * 224);
  }

  private tokenize(text: string): Int32Array {
    // Placeholder - tokenize text for LLM input
    const tokens = text.split(' ').map((_, i) => i);
    return new Int32Array(tokens);
  }
}

// Singleton instance
export const hybridAIRouter = new HybridAIRouter();
