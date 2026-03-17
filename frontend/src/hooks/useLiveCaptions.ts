/**
 * useLiveCaptions Hook
 * 
 * Manages live caption stream with real audio capture and ONNX STT processing.
 * Integrates with useAudioStream for microphone capture and SpeechModelService
 * for transcription.
 * 
 * Features:
 * - Real microphone capture with expo-av
 * - Volume-based activity detection
 * - Rolling text buffer with word animations
 * - Mock mode fallback when ONNX is unavailable
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAI } from '../context/AIContext';
import { useAudioStream } from './useAudioStream';
import * as SpeechModelService from '../services/SpeechModelService';

// ============================================================================
// TYPES
// ============================================================================

export interface CaptionWord {
  text: string;
  timestamp: number;
  id: string;
}

export interface UseLiveCaptionsReturn {
  // Current caption text (rolling buffer)
  captionText: string;
  // Array of recent words for animation
  words: CaptionWord[];
  // Is the stream currently active (recording)
  isActive: boolean;
  // Is the stream paused (mic muted)
  isPaused: boolean;
  // Start the caption stream
  start: () => Promise<boolean>;
  // Stop the caption stream
  stop: () => void;
  // Pause/Resume toggle (mute mic)
  togglePause: () => void;
  // Clear all captions
  clear: () => void;
  // Status indicator
  status: 'idle' | 'listening' | 'paused' | 'processing';
  // Confidence level (0-1)
  confidence: number;
  // Current volume level (0-1) from microphone
  volumeLevel: number;
  // Is using mock mode
  isMockMode: boolean;
  // Does the app have mic permission
  hasPermission: boolean | null;
  // Any error message
  error: string | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_BUFFER_CHARS = 200;
const MAX_WORDS = 30; // Keep for animation

// ============================================================================
// HOOK
// ============================================================================

export const useLiveCaptions = (): UseLiveCaptionsReturn => {
  const { settings } = useAI();
  
  // State
  const [captionText, setCaptionText] = useState('');
  const [words, setWords] = useState<CaptionWord[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'paused' | 'processing'>('idle');
  const [confidence, setConfidence] = useState(0);
  
  // Buffer ref for managing rolling text
  const bufferRef = useRef<string[]>([]);
  
  // Use the audio stream hook
  const audioStream = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    chunkDurationMs: 500,
  });
  
  /**
   * Add a word to the rolling buffer
   */
  const addWordToBuffer = useCallback((word: string, wordConfidence: number = 0.9) => {
    if (!word.trim()) return;
    
    // Add to buffer
    bufferRef.current.push(word);
    
    // Create the full text
    let fullText = bufferRef.current.join(' ');
    
    // If exceeds max chars, drop oldest words
    while (fullText.length > MAX_BUFFER_CHARS && bufferRef.current.length > 1) {
      bufferRef.current.shift();
      fullText = bufferRef.current.join(' ');
    }
    
    // Update caption text
    setCaptionText(fullText);
    
    // Create animated word entry
    const newWord: CaptionWord = {
      text: word,
      timestamp: Date.now(),
      id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    setWords(prev => [...prev.slice(-MAX_WORDS), newWord]);
    
    // Update confidence with the word's confidence
    setConfidence(wordConfidence);
    
    // Brief "processing" flash
    setStatus('processing');
    setTimeout(() => {
      if (!audioStream.isPaused) {
        setStatus('listening');
      }
    }, 100);
  }, [audioStream.isPaused]);
  
  /**
   * Handle transcription results from SpeechModelService
   */
  useEffect(() => {
    const unsubscribe = SpeechModelService.addTranscriptionListener((result) => {
      if (result.text) {
        addWordToBuffer(result.text, result.confidence);
      }
    });
    
    return () => unsubscribe();
  }, [addWordToBuffer]);
  
  /**
   * Update status based on audio stream state
   */
  useEffect(() => {
    if (!audioStream.isRecording) {
      setStatus('idle');
    } else if (audioStream.isPaused) {
      setStatus('paused');
    } else {
      setStatus('listening');
    }
  }, [audioStream.isRecording, audioStream.isPaused]);
  
  /**
   * Start the caption stream
   */
  const start = useCallback(async (): Promise<boolean> => {
    // Reset state
    bufferRef.current = [];
    setCaptionText('');
    setWords([]);
    setConfidence(0);
    
    // Reset mock state for fresh start
    SpeechModelService.resetMockState();
    
    // Start audio recording
    const success = await audioStream.startRecording();
    
    if (success) {
      setStatus('listening');
      setConfidence(0.9);
    }
    
    return success;
  }, [audioStream]);
  
  /**
   * Stop the caption stream
   */
  const stop = useCallback(() => {
    audioStream.stopRecording();
    setStatus('idle');
    setConfidence(0);
  }, [audioStream]);
  
  /**
   * Toggle pause/resume (mute mic)
   */
  const togglePause = useCallback(() => {
    audioStream.togglePause();
  }, [audioStream]);
  
  /**
   * Clear all captions
   */
  const clear = useCallback(() => {
    bufferRef.current = [];
    setCaptionText('');
    setWords([]);
    SpeechModelService.resetMockState();
  }, []);
  
  return {
    captionText,
    words,
    isActive: audioStream.isRecording,
    isPaused: audioStream.isPaused,
    start,
    stop,
    togglePause,
    clear,
    status,
    confidence,
    volumeLevel: audioStream.volumeLevel,
    isMockMode: audioStream.isMockMode,
    hasPermission: audioStream.hasPermission,
    error: audioStream.error,
  };
};

export default useLiveCaptions;
