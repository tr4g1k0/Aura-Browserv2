import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// Maximum characters per TTS chunk to prevent crashes
const MAX_CHUNK_SIZE = 3500;

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
 * - Text chunking for large pages (max 3500 chars per chunk)
 * - Safe error handling to prevent UI crashes
 */
class TextToSpeechService {
  private isSpeaking: boolean = false;
  private currentText: string = '';
  private onStopCallback?: () => void;
  private onErrorCallback?: (error: any) => void;
  private chunks: string[] = [];
  private currentChunkIndex: number = 0;
  private currentOptions: TTSOptions = {};

  /**
   * Check if TTS is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch (error) {
      console.warn('[TTS] Availability check failed:', error);
      return Platform.OS !== 'web'; // Assume available on native
    }
  }

  /**
   * Get available voices for TTS
   */
  async getVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (error) {
      console.warn('[TTS] Get voices failed:', error);
      return [];
    }
  }

  /**
   * Check if currently speaking
   */
  async checkIsSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch (error) {
      console.warn('[TTS] isSpeaking check failed:', error);
      return this.isSpeaking;
    }
  }

  /**
   * Split text into chunks of MAX_CHUNK_SIZE characters
   * Tries to break at sentence boundaries for natural reading
   */
  private chunkText(text: string): string[] {
    if (text.length <= MAX_CHUNK_SIZE) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK_SIZE) {
        chunks.push(remaining);
        break;
      }

      // Try to find a sentence break near the limit
      let breakPoint = MAX_CHUNK_SIZE;
      const searchStart = Math.max(0, MAX_CHUNK_SIZE - 500);
      
      // Look for sentence endings (. ! ?)
      for (let i = MAX_CHUNK_SIZE; i >= searchStart; i--) {
        const char = remaining[i];
        if (char === '.' || char === '!' || char === '?') {
          breakPoint = i + 1;
          break;
        }
      }

      // Fallback: break at a space
      if (breakPoint === MAX_CHUNK_SIZE) {
        for (let i = MAX_CHUNK_SIZE; i >= searchStart; i--) {
          if (remaining[i] === ' ') {
            breakPoint = i;
            break;
          }
        }
      }

      chunks.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }

    console.log(`[TTS] Split text into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Speak the next chunk in the queue
   */
  private speakNextChunk(): void {
    if (this.currentChunkIndex >= this.chunks.length) {
      // All chunks done
      console.log('[TTS] Finished all chunks');
      this.isSpeaking = false;
      this.currentText = '';
      this.chunks = [];
      this.currentChunkIndex = 0;
      this.currentOptions.onDone?.();
      return;
    }

    if (!this.isSpeaking) {
      // User stopped playback
      return;
    }

    const chunk = this.chunks[this.currentChunkIndex];
    console.log(`[TTS] Speaking chunk ${this.currentChunkIndex + 1}/${this.chunks.length} (${chunk.length} chars)`);

    try {
      Speech.speak(chunk, {
        pitch: this.currentOptions.pitch ?? 1.0,
        rate: this.currentOptions.rate ?? 1.0,
        language: this.currentOptions.language ?? 'en-US',
        voice: this.currentOptions.voice,
        onStart: () => {
          if (this.currentChunkIndex === 0) {
            console.log('[TTS] Started speaking');
            this.currentOptions.onStart?.();
          }
        },
        onDone: () => {
          this.currentChunkIndex++;
          // Speak next chunk
          this.speakNextChunk();
        },
        onStopped: () => {
          console.log('[TTS] Stopped');
          this.isSpeaking = false;
          this.currentText = '';
          this.chunks = [];
          this.currentChunkIndex = 0;
          this.currentOptions.onStopped?.();
        },
        onError: (error) => {
          console.warn('[TTS] Chunk error:', error);
          // Try to continue with next chunk instead of stopping
          this.currentChunkIndex++;
          if (this.currentChunkIndex < this.chunks.length) {
            setTimeout(() => this.speakNextChunk(), 100);
          } else {
            this.handleError(error);
          }
        },
      });
    } catch (error) {
      console.warn('[TTS] Speech.speak threw:', error);
      this.handleError(error);
    }
  }

  /**
   * Handle TTS errors - reset UI state and notify callback
   */
  private handleError(error: any): void {
    console.warn('[TTS] Error:', error);
    this.isSpeaking = false;
    this.currentText = '';
    this.chunks = [];
    this.currentChunkIndex = 0;
    this.currentOptions.onError?.(error);
    // Also call onStopped to reset UI
    this.currentOptions.onStopped?.();
  }

  /**
   * Speak the given text with chunking support
   */
  speak(text: string, options: TTSOptions = {}): void {
    try {
      if (!text || text.trim().length === 0) {
        console.log('[TTS] No text to speak');
        options.onError?.('No text to speak');
        options.onStopped?.(); // Reset UI
        return;
      }

      // Stop any current speech
      this.stop();

      // Store options and text
      this.currentOptions = options;
      this.currentText = text;
      this.onStopCallback = options.onStopped;
      this.onErrorCallback = options.onError;

      // Chunk the text for large pages
      this.chunks = this.chunkText(text);
      this.currentChunkIndex = 0;
      this.isSpeaking = true;

      console.log(`[TTS] Speaking ${text.length} characters in ${this.chunks.length} chunk(s)`);

      // Start speaking first chunk
      this.speakNextChunk();

    } catch (error) {
      console.warn('[TTS] speak() threw:', error);
      this.handleError(error);
    }
  }

  /**
   * Stop current speech
   */
  stop(): void {
    try {
      if (this.isSpeaking) {
        Speech.stop();
        this.isSpeaking = false;
        this.currentText = '';
        this.chunks = [];
        this.currentChunkIndex = 0;
        this.onStopCallback?.();
        console.log('[TTS] Stopped by user');
      }
    } catch (error) {
      console.warn('[TTS] stop() threw:', error);
      // Force reset state even if stop failed
      this.isSpeaking = false;
      this.currentText = '';
      this.chunks = [];
      this.currentChunkIndex = 0;
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

  /**
   * Get current progress (chunk index / total chunks)
   */
  getProgress(): { current: number; total: number } {
    return {
      current: this.currentChunkIndex + 1,
      total: this.chunks.length || 1,
    };
  }
}

// JavaScript injection script to extract page content
// STABILITY FIX: Limited to 3500 chars to prevent TTS engine crashes
export const contentExtractionScript = `
(function() {
  try {
    // Maximum safe length for TTS to prevent crashes
    var MAX_TTS_LENGTH = 3500;
    
    // Priority order for content extraction
    var selectors = [
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
    
    var content = '';
    var foundElement = null;
    
    // Try each selector in priority order
    for (var i = 0; i < selectors.length; i++) {
      var selector = selectors[i];
      try {
        var element = document.querySelector(selector);
        if (element) {
          // Get text content, excluding scripts and styles
          var clone = element.cloneNode(true);
          
          // Remove unwanted elements
          var unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ad, .social-share, .comments, .related-posts, noscript, iframe, [aria-hidden="true"]');
          for (var j = 0; j < unwanted.length; j++) {
            try { unwanted[j].remove(); } catch(e) {}
          }
          
          content = clone.innerText || clone.textContent || '';
          
          // Clean up the text
          content = content
            .replace(/[\\t\\r]+/g, ' ')       // Replace tabs/carriage returns
            .replace(/  +/g, ' ')              // Collapse multiple spaces
            .replace(/\\n\\n+/g, '\\n')        // Collapse multiple newlines
            .trim();
          
          // If we got meaningful content (more than 100 chars), use it
          if (content.length > 100) {
            foundElement = selector;
            break;
          }
        }
      } catch (selectorError) {
        // Continue to next selector if this one fails
        console.warn('[TTS] Selector error for ' + selector + ':', selectorError);
      }
    }
    
    // Fallback: if content is too short, try body
    if (content.length < 100) {
      try {
        var body = document.body;
        if (body) {
          var clone = body.cloneNode(true);
          var unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ad, noscript, iframe');
          for (var k = 0; k < unwanted.length; k++) {
            try { unwanted[k].remove(); } catch(e) {}
          }
          content = (clone.innerText || clone.textContent || '').replace(/  +/g, ' ').trim();
          foundElement = 'body (fallback)';
        }
      } catch (bodyError) {
        console.warn('[TTS] Body fallback error:', bodyError);
      }
    }
    
    // STABILITY FIX: Strict limit to 3500 chars to prevent TTS engine crashes
    var originalLength = content.length;
    if (content.length > MAX_TTS_LENGTH) {
      // Try to break at a sentence boundary for natural reading
      var truncated = content.substring(0, MAX_TTS_LENGTH);
      var lastPeriod = truncated.lastIndexOf('.');
      var lastExclaim = truncated.lastIndexOf('!');
      var lastQuestion = truncated.lastIndexOf('?');
      var lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);
      
      if (lastSentenceEnd > MAX_TTS_LENGTH - 500) {
        content = truncated.substring(0, lastSentenceEnd + 1) + ' Content truncated for reading.';
      } else {
        content = truncated + '... Content truncated for reading.';
      }
      console.log('[TTS] Truncated content from ' + originalLength + ' to ' + content.length + ' chars');
    }
    
    // Send back to React Native
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'TTS_CONTENT',
        content: content,
        source: foundElement,
        length: content.length,
        originalLength: originalLength,
        truncated: originalLength > MAX_TTS_LENGTH
      }));
    } else {
      console.warn('[TTS] ReactNativeWebView not available');
    }
    
  } catch (error) {
    // STABILITY FIX: Ensure we always send a response, even on error
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'TTS_ERROR',
          error: error.message || 'Unknown extraction error'
        }));
      }
    } catch (sendError) {
      console.error('[TTS] Failed to send error:', sendError);
    }
  }
})();
true;
`;

// Export singleton instance
export const ttsService = new TextToSpeechService();
export default ttsService;
