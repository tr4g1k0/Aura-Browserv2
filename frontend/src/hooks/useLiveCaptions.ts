// useLiveCaptions Hook
// Manages live caption stream with mock simulation, buffer management, and pause/resume

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAI } from '../context/AIContext';

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
  // Is the stream currently active
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
}

// Mock transcript phrases for simulation
const MOCK_TRANSCRIPTS = [
  "Hey... how... are... you... doing... today?",
  "Welcome... to... our... channel... please... subscribe...",
  "In... this... video... we... will... show... you... how... to...",
  "The... weather... today... is... going... to... be... sunny...",
  "Breaking... news... this... just... in... from... our... reporters...",
  "Thank... you... so... much... for... watching...",
  "Let... me... explain... how... this... works...",
  "Click... the... link... in... the... description... below...",
  "Don't... forget... to... like... and... share... this... video...",
  "Today... we're... going... to... learn... something... new...",
];

const MAX_BUFFER_CHARS = 150;
const WORD_INTERVAL_MS = 350; // Time between words
const PHRASE_PAUSE_MS = 1500; // Pause between phrases

export const useLiveCaptions = (): UseLiveCaptionsReturn => {
  const { settings } = useAI();
  
  const [captionText, setCaptionText] = useState('');
  const [words, setWords] = useState<CaptionWord[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'paused' | 'processing'>('idle');
  const [confidence, setConfidence] = useState(0);

  // Refs for interval management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const phraseIndexRef = useRef(0);
  const wordIndexRef = useRef(0);
  const bufferRef = useRef<string[]>([]);

  /**
   * Add a word to the rolling buffer
   */
  const addWordToBuffer = useCallback((word: string) => {
    // Add to buffer
    bufferRef.current.push(word);
    
    // Create the full text
    let fullText = bufferRef.current.join(' ');
    
    // If exceeds max chars, drop oldest words
    while (fullText.length > MAX_BUFFER_CHARS && bufferRef.current.length > 1) {
      bufferRef.current.shift();
      fullText = bufferRef.current.join(' ');
    }
    
    // Update state
    setCaptionText(fullText);
    
    // Add word to animated words array
    const newWord: CaptionWord = {
      text: word,
      timestamp: Date.now(),
      id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    setWords(prev => [...prev.slice(-20), newWord]); // Keep last 20 words for animation
    
    // Update confidence with some variation
    setConfidence(0.85 + Math.random() * 0.15);
  }, []);

  /**
   * Process the next word in the mock stream
   */
  const processNextWord = useCallback(() => {
    if (isPaused) return;

    const currentPhrase = MOCK_TRANSCRIPTS[phraseIndexRef.current % MOCK_TRANSCRIPTS.length];
    const wordsInPhrase = currentPhrase.split('...');
    
    if (wordIndexRef.current < wordsInPhrase.length) {
      const word = wordsInPhrase[wordIndexRef.current].trim();
      if (word) {
        setStatus('processing');
        addWordToBuffer(word);
        setTimeout(() => setStatus('listening'), 100);
      }
      wordIndexRef.current++;
    } else {
      // Move to next phrase
      phraseIndexRef.current++;
      wordIndexRef.current = 0;
    }
  }, [isPaused, addWordToBuffer]);

  /**
   * Start the mock caption stream
   */
  const start = useCallback(async (): Promise<boolean> => {
    if (isActive) return true;

    // Reset state
    bufferRef.current = [];
    phraseIndexRef.current = Math.floor(Math.random() * MOCK_TRANSCRIPTS.length);
    wordIndexRef.current = 0;
    
    setCaptionText('');
    setWords([]);
    setIsActive(true);
    setIsPaused(false);
    setStatus('listening');
    setConfidence(0.9);

    // Start the interval
    intervalRef.current = setInterval(() => {
      processNextWord();
    }, WORD_INTERVAL_MS);

    return true;
  }, [isActive, processNextWord]);

  /**
   * Stop the caption stream
   */
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsActive(false);
    setIsPaused(false);
    setStatus('idle');
    setConfidence(0);
  }, []);

  /**
   * Toggle pause/resume (mute mic)
   */
  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      setStatus(newPaused ? 'paused' : 'listening');
      return newPaused;
    });
  }, []);

  /**
   * Clear all captions
   */
  const clear = useCallback(() => {
    bufferRef.current = [];
    setCaptionText('');
    setWords([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update interval when processNextWord changes
  useEffect(() => {
    if (isActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        processNextWord();
      }, WORD_INTERVAL_MS);
    }
  }, [isActive, processNextWord]);

  return {
    captionText,
    words,
    isActive,
    isPaused,
    start,
    stop,
    togglePause,
    clear,
    status,
    confidence,
  };
};
