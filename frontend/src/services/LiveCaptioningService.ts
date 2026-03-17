// Accessibility Engine - Speech-to-Text Service
// Provides live captioning using local ONNX models with cloud fallback

import { Platform } from 'react-native';
import { hybridAIRouter } from '../ai/HybridAIRouter';
import { STTResult } from '../ai/types';

type AudioRecordingModule = any;

export interface CaptionSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  confidence: number;
}

export type CaptionCallback = (segment: CaptionSegment) => void;
export type StatusCallback = (status: 'idle' | 'listening' | 'processing' | 'error') => void;

class LiveCaptioningService {
  private isActive: boolean = false;
  private captionCallbacks: Set<CaptionCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private audioRecording: AudioRecordingModule | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private audioBuffer: Float32Array[] = [];
  private segmentId: number = 0;

  // Audio configuration
  private readonly SAMPLE_RATE = 16000; // 16kHz for STT models
  private readonly BUFFER_DURATION_MS = 1000; // Process every 1 second
  private readonly MAX_BUFFER_SIZE = 5; // Keep last 5 buffers for context

  /**
   * Check if microphone permission is granted
   */
  async checkPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    // For native platforms, use expo-av
    try {
      const { Audio } = require('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[LiveCaptioning] Permission check failed:', error);
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return this.checkPermission();
    }

    try {
      const { Audio } = require('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[LiveCaptioning] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Start live captioning
   */
  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log('[LiveCaptioning] Already active');
      return true;
    }

    // Check permission first
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        this.notifyStatus('error');
        console.error('[LiveCaptioning] Microphone permission denied');
        return false;
      }
    }

    try {
      this.isActive = true;
      this.notifyStatus('listening');

      if (Platform.OS === 'web') {
        await this.startWebAudioCapture();
      } else {
        await this.startNativeAudioCapture();
      }

      // Start processing loop
      this.startProcessingLoop();

      console.log('[LiveCaptioning] Started');
      return true;
    } catch (error) {
      this.isActive = false;
      this.notifyStatus('error');
      console.error('[LiveCaptioning] Failed to start:', error);
      return false;
    }
  }

  /**
   * Stop live captioning
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    this.notifyStatus('idle');

    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Stop audio capture
    if (Platform.OS === 'web') {
      this.stopWebAudioCapture();
    } else {
      await this.stopNativeAudioCapture();
    }

    // Clear buffers
    this.audioBuffer = [];

    console.log('[LiveCaptioning] Stopped');
  }

  /**
   * Subscribe to caption updates
   */
  onCaption(callback: CaptionCallback): () => void {
    this.captionCallbacks.add(callback);
    return () => this.captionCallbacks.delete(callback);
  }

  /**
   * Subscribe to status updates
   */
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Check if currently active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  // ==================== Web Audio Capture ====================

  private webAudioContext: AudioContext | null = null;
  private webMediaStream: MediaStream | null = null;
  private webAnalyser: AnalyserNode | null = null;

  private async startWebAudioCapture(): Promise<void> {
    this.webMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.webAudioContext = new AudioContext({ sampleRate: this.SAMPLE_RATE });
    const source = this.webAudioContext.createMediaStreamSource(this.webMediaStream);
    
    // Create analyser for getting audio data
    this.webAnalyser = this.webAudioContext.createAnalyser();
    this.webAnalyser.fftSize = 2048;
    source.connect(this.webAnalyser);

    // Create script processor for raw audio data
    const processor = this.webAudioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!this.isActive) return;
      
      const inputData = event.inputBuffer.getChannelData(0);
      this.addAudioBuffer(new Float32Array(inputData));
    };
    
    source.connect(processor);
    processor.connect(this.webAudioContext.destination);
  }

  private stopWebAudioCapture(): void {
    if (this.webMediaStream) {
      this.webMediaStream.getTracks().forEach(track => track.stop());
      this.webMediaStream = null;
    }
    if (this.webAudioContext) {
      this.webAudioContext.close();
      this.webAudioContext = null;
    }
    this.webAnalyser = null;
  }

  // ==================== Native Audio Capture ====================

  private async startNativeAudioCapture(): Promise<void> {
    try {
      const { Audio } = require('expo-av');

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Create recording with appropriate settings
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: this.SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: this.SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      this.audioRecording = recording;

      // Set up status update callback
      recording.setOnRecordingStatusUpdate((status: any) => {
        if (status.isRecording && status.metering !== undefined) {
          // We'll process the audio in the main loop
        }
      });

    } catch (error) {
      console.error('[LiveCaptioning] Native audio capture failed:', error);
      throw error;
    }
  }

  private async stopNativeAudioCapture(): Promise<void> {
    if (this.audioRecording) {
      try {
        await this.audioRecording.stopAndUnloadAsync();
      } catch (error) {
        console.warn('[LiveCaptioning] Error stopping recording:', error);
      }
      this.audioRecording = null;
    }
  }

  // ==================== Processing Loop ====================

  private addAudioBuffer(buffer: Float32Array): void {
    this.audioBuffer.push(buffer);
    
    // Keep only recent buffers
    if (this.audioBuffer.length > this.MAX_BUFFER_SIZE) {
      this.audioBuffer.shift();
    }
  }

  private startProcessingLoop(): void {
    this.processingInterval = setInterval(async () => {
      if (!this.isActive || this.audioBuffer.length === 0) return;

      this.notifyStatus('processing');

      try {
        // Combine recent audio buffers
        const combinedBuffer = this.combineAudioBuffers();
        
        // Run STT inference
        const response = await hybridAIRouter.runSTT(combinedBuffer);
        
        // Create caption segment
        const segment: CaptionSegment = {
          id: `caption-${++this.segmentId}`,
          text: response.result.text,
          timestamp: response.result.timestamp,
          isFinal: response.result.isFinal,
          confidence: response.result.confidence,
        };

        // Notify listeners
        this.notifyCaption(segment);
        
        this.notifyStatus('listening');
      } catch (error) {
        console.error('[LiveCaptioning] Processing error:', error);
      }
    }, this.BUFFER_DURATION_MS);
  }

  private combineAudioBuffers(): Float32Array {
    const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const combined = new Float32Array(totalLength);
    
    let offset = 0;
    for (const buffer of this.audioBuffer) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }
    
    return combined;
  }

  private notifyCaption(segment: CaptionSegment): void {
    this.captionCallbacks.forEach(callback => callback(segment));
  }

  private notifyStatus(status: 'idle' | 'listening' | 'processing' | 'error'): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }
}

// Singleton instance
export const liveCaptioningService = new LiveCaptioningService();
