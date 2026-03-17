// Mock Inference Engine
// Provides placeholder responses for rapid UI development
// Will be replaced with actual ONNX inference when models are available

import { STTResult, VLMResult, LLMResult } from './types';

// Simulated processing delays (ms)
const MOCK_DELAYS = {
  stt: 100,
  vlm: 300,
  llm: 500,
};

// Sample phrases for mock STT
const MOCK_TRANSCRIPTIONS = [
  "Hello, welcome to the website.",
  "Today we're going to discuss the latest features.",
  "Click the button below to continue.",
  "Thank you for watching this video.",
  "Don't forget to subscribe and like.",
  "Here's an important announcement.",
  "Let me show you how this works.",
  "The results are quite impressive.",
];

// Sample ad detection results for mock VLM
const MOCK_AD_ELEMENTS = [
  { type: 'ad' as const, selector: '.ad-banner', confidence: 0.95 },
  { type: 'sponsored' as const, selector: '[data-ad-unit]', confidence: 0.88 },
  { type: 'cookie_banner' as const, selector: '#cookie-consent', confidence: 0.92 },
  { type: 'popup' as const, selector: '.newsletter-popup', confidence: 0.85 },
];

// Sample summaries for mock LLM
const MOCK_SUMMARIES = [
  "This page contains information about product pricing and features. Key points include competitive pricing, free shipping options, and customer reviews.",
  "The article discusses recent developments in technology. Main topics cover AI advancements, mobile computing trends, and future predictions.",
  "A comprehensive guide to getting started. The content covers installation steps, basic configuration, and troubleshooting tips.",
  "News article about current events. The report includes expert opinions, statistical data, and potential implications.",
];

export class MockInferenceEngine {
  private transcriptionIndex: number = 0;
  private isActive: boolean = false;

  /**
   * Mock Speech-to-Text inference
   */
  async runSTTInference(audioData: Float32Array): Promise<STTResult> {
    // Simulate processing delay
    await this.delay(MOCK_DELAYS.stt);

    // Return mock transcription
    const text = MOCK_TRANSCRIPTIONS[this.transcriptionIndex % MOCK_TRANSCRIPTIONS.length];
    this.transcriptionIndex++;

    return {
      text,
      confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0
      isFinal: Math.random() > 0.3, // 70% chance of being final
      timestamp: Date.now(),
    };
  }

  /**
   * Mock continuous STT stream
   */
  async *streamSTTInference(
    getAudioBuffer: () => Float32Array | null
  ): AsyncGenerator<STTResult> {
    this.isActive = true;
    
    while (this.isActive) {
      const audioBuffer = getAudioBuffer();
      if (audioBuffer && audioBuffer.length > 0) {
        yield await this.runSTTInference(audioBuffer);
      }
      await this.delay(500); // Check every 500ms
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    this.isActive = false;
  }

  /**
   * Mock Vision Language Model inference for ad detection
   */
  async runVLMInference(imageData: Uint8Array | string): Promise<VLMResult> {
    // Simulate processing delay
    await this.delay(MOCK_DELAYS.vlm);

    // Return random subset of mock ad elements
    const numElements = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...MOCK_AD_ELEMENTS].sort(() => Math.random() - 0.5);
    const detectedElements = shuffled.slice(0, numElements).map(el => ({
      ...el,
      boundingBox: {
        x: Math.floor(Math.random() * 800),
        y: Math.floor(Math.random() * 600),
        width: Math.floor(Math.random() * 300) + 100,
        height: Math.floor(Math.random() * 100) + 50,
      },
    }));

    return {
      detectedElements,
    };
  }

  /**
   * Mock LLM inference for text generation
   */
  async runLLMInference(prompt: string, maxTokens: number = 256): Promise<LLMResult> {
    // Simulate processing delay based on output length
    const baseDelay = MOCK_DELAYS.llm;
    const tokensDelay = Math.min(maxTokens, 100) * 5;
    await this.delay(baseDelay + tokensDelay);

    // Generate contextual mock response
    let text: string;
    
    if (prompt.toLowerCase().includes('summarize')) {
      text = MOCK_SUMMARIES[Math.floor(Math.random() * MOCK_SUMMARIES.length)];
    } else if (prompt.toLowerCase().includes('find') || prompt.toLowerCase().includes('search')) {
      text = `I found several relevant items on this page. The most notable results include product listings, navigation links, and related content sections. Would you like me to elaborate on any specific item?`;
    } else if (prompt.toLowerCase().includes('extract')) {
      text = `Extracted content:\n• Item 1: $29.99\n• Item 2: $49.99\n• Item 3: $19.99\n\nTotal items found: 3`;
    } else {
      text = `Based on the page content, I can see this is a ${this.getRandomPageType()} page. ${MOCK_SUMMARIES[0]}`;
    }

    return {
      text,
      tokens: Math.ceil(text.split(' ').length * 1.3),
      finishReason: 'complete',
    };
  }

  /**
   * Mock streaming LLM inference
   */
  async *streamLLMInference(
    prompt: string,
    maxTokens: number = 256
  ): AsyncGenerator<{ token: string; done: boolean }> {
    const result = await this.runLLMInference(prompt, maxTokens);
    const words = result.text.split(' ');

    for (let i = 0; i < words.length; i++) {
      await this.delay(30 + Math.random() * 50); // Variable typing speed
      yield {
        token: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1,
      };
    }
  }

  private getRandomPageType(): string {
    const types = ['e-commerce', 'news', 'blog', 'documentation', 'social media', 'entertainment'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const mockInferenceEngine = new MockInferenceEngine();
