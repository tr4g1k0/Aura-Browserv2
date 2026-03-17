import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface TTSOptions {
  pitch?: number;
  rate?: number;
  language?: string;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

/**
 * TextToSpeechService - Manages Text-to-Speech functionality
 * 
 * Features:
 * - Read text aloud using expo-speech
 * - Control playback (play/stop)
 * - Callbacks for state changes
 * - Platform-specific voice selection
 */
class TextToSpeechService {
  private isSpeaking: boolean = false;
  private currentText: string = '';
  private onStopCallback?: () => void;

  /**
   * Check if TTS is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return Platform.OS !== 'web'; // Assume available on native
    }
  }

  /**
   * Get available voices for TTS
   */
  async getVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch {
      return [];
    }
  }

  /**
   * Check if currently speaking
   */
  async checkIsSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return this.isSpeaking;
    }
  }

  /**
   * Speak the given text
   */
  speak(text: string, options: TTSOptions = {}): void {
    if (!text || text.trim().length === 0) {
      console.log('[TTS] No text to speak');
      options.onError?.('No text to speak');
      return;
    }

    // Stop any current speech
    this.stop();

    this.currentText = text;
    this.isSpeaking = true;
    this.onStopCallback = options.onStopped;

    console.log(`[TTS] Speaking ${text.length} characters`);

    Speech.speak(text, {
      pitch: options.pitch ?? 1.0,
      rate: options.rate ?? 1.0,
      language: options.language ?? 'en-US',
      voice: options.voice,
      onStart: () => {
        console.log('[TTS] Started speaking');
        this.isSpeaking = true;
        options.onStart?.();
      },
      onDone: () => {
        console.log('[TTS] Finished speaking');
        this.isSpeaking = false;
        this.currentText = '';
        options.onDone?.();
      },
      onStopped: () => {
        console.log('[TTS] Stopped');
        this.isSpeaking = false;
        this.currentText = '';
        options.onStopped?.();
      },
      onError: (error) => {
        console.error('[TTS] Error:', error);
        this.isSpeaking = false;
        options.onError?.(error);
      },
    });
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.isSpeaking) {
      Speech.stop();
      this.isSpeaking = false;
      this.currentText = '';
      this.onStopCallback?.();
      console.log('[TTS] Stopped by user');
    }
  }

  /**
   * Pause speech (not available in expo-speech, using stop instead)
   */
  pause(): void {
    this.stop();
  }

  /**
   * Get current speaking state
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get current text being spoken
   */
  getCurrentText(): string {
    return this.currentText;
  }
}

// JavaScript injection script to extract page content
export const contentExtractionScript = `
(function() {
  try {
    // Priority order for content extraction
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      '.post',
      '.article',
      'body'
    ];
    
    let content = '';
    let foundElement = null;
    
    // Try each selector in priority order
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text content, excluding scripts and styles
        const clone = element.cloneNode(true);
        
        // Remove unwanted elements
        const unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ad, .social-share, .comments, .related-posts, noscript, iframe');
        unwanted.forEach(el => el.remove());
        
        content = clone.innerText || clone.textContent || '';
        
        // Clean up the text
        content = content
          .replace(/\\s+/g, ' ')           // Collapse whitespace
          .replace(/\\n\\s*\\n/g, '\\n')   // Collapse multiple newlines
          .trim();
        
        // If we got meaningful content (more than 100 chars), use it
        if (content.length > 100) {
          foundElement = selector;
          break;
        }
      }
    }
    
    // Fallback: if content is too short, try body
    if (content.length < 100) {
      const body = document.body;
      if (body) {
        const clone = body.cloneNode(true);
        const unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ad, noscript, iframe');
        unwanted.forEach(el => el.remove());
        content = (clone.innerText || clone.textContent || '').replace(/\\s+/g, ' ').trim();
        foundElement = 'body (fallback)';
      }
    }
    
    // Limit content length to avoid TTS issues (max ~10000 chars)
    if (content.length > 10000) {
      content = content.substring(0, 10000) + '... Content truncated for reading.';
    }
    
    // Send back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'TTS_CONTENT',
      content: content,
      source: foundElement,
      length: content.length
    }));
    
  } catch (error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'TTS_ERROR',
      error: error.message
    }));
  }
})();
true;
`;

// Export singleton instance
export const ttsService = new TextToSpeechService();
export default ttsService;
