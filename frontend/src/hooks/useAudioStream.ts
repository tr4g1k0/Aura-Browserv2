/**
 * useAudioStream Hook
 * 
 * Manages audio capture from the device microphone using expo-av.
 * Handles permissions, recording sessions, and streams audio chunks
 * to the SpeechModelService for transcription.
 * 
 * Audio Configuration:
 * - Sample Rate: 16000Hz (optimal for speech)
 * - Channels: Mono (1 channel)
 * - Bit Depth: 16-bit PCM
 * - Chunk Size: 500ms
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { Audio, AVPlaybackStatus, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as SpeechModelService from '../services/SpeechModelService';

// ============================================================================
// TYPES
// ============================================================================

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
  chunkDurationMs: number;
}

export interface AudioStreamState {
  isRecording: boolean;
  isPaused: boolean;
  hasPermission: boolean | null;
  volumeLevel: number; // 0-1 RMS
  error: string | null;
}

export interface UseAudioStreamReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  hasPermission: boolean | null;
  volumeLevel: number;
  error: string | null;
  isMockMode: boolean;
  
  // Actions
  requestPermission: () => Promise<boolean>;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  togglePause: () => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AudioStreamConfig = {
  sampleRate: 16000,
  channels: 1,
  chunkDurationMs: 500,
};

// Recording settings for expo-av optimized for speech
const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

// ============================================================================
// HOOK
// ============================================================================

export const useAudioStream = (
  config: Partial<AudioStreamConfig> = {},
  onChunkReady?: (chunk: SpeechModelService.AudioChunk) => void
): UseAudioStreamReturn => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // State
  const [state, setState] = useState<AudioStreamState>({
    isRecording: false,
    isPaused: false,
    hasPermission: null,
    volumeLevel: 0,
    error: null,
  });
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mockModeRef = useRef<boolean>(Platform.OS === 'web');
  const volumeHistoryRef = useRef<number[]>([]);
  
  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // On web, we need to handle permissions differently
      if (Platform.OS === 'web') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          setState(prev => ({ ...prev, hasPermission: true }));
          return true;
        } catch {
          setState(prev => ({ ...prev, hasPermission: false }));
          return false;
        }
      }
      
      // Native platforms
      const { granted } = await Audio.requestPermissionsAsync();
      setState(prev => ({ ...prev, hasPermission: granted }));
      
      if (granted) {
        // Configure audio session
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      }
      
      return granted;
    } catch (error: any) {
      console.error('[useAudioStream] Permission error:', error);
      setState(prev => ({ 
        ...prev, 
        hasPermission: false,
        error: error.message || 'Failed to request permission',
      }));
      return false;
    }
  }, []);
  
  /**
   * Process audio chunk (simulate for now)
   * In a real implementation, this would read from the recording buffer
   */
  const processAudioChunk = useCallback(async () => {
    if (state.isPaused || !state.isRecording) return;
    
    // Get metering data if available
    let volumeLevel = 0;
    try {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          // Convert dB to 0-1 range (typically -160 to 0 dB)
          const db = status.metering;
          volumeLevel = Math.max(0, Math.min(1, (db + 60) / 60));
        }
      }
    } catch {
      // Metering not available, simulate volume
      volumeLevel = 0.1 + Math.random() * 0.3;
    }
    
    // Smooth volume using history
    volumeHistoryRef.current.push(volumeLevel);
    if (volumeHistoryRef.current.length > 5) {
      volumeHistoryRef.current.shift();
    }
    const smoothedVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;
    
    setState(prev => ({ ...prev, volumeLevel: smoothedVolume }));
    
    // Create audio chunk
    // In a real implementation, we would read actual audio data from the recording
    // For now, we create a simulated chunk based on volume
    const chunkSamples = Math.floor(mergedConfig.sampleRate * (mergedConfig.chunkDurationMs / 1000));
    const buffer = new Float32Array(chunkSamples);
    
    // Simulate audio data with noise based on volume
    for (let i = 0; i < chunkSamples; i++) {
      buffer[i] = (Math.random() * 2 - 1) * smoothedVolume;
    }
    
    const chunk: SpeechModelService.AudioChunk = {
      buffer,
      sampleRate: mergedConfig.sampleRate,
      timestamp: Date.now(),
      duration: mergedConfig.chunkDurationMs,
      volumeLevel: smoothedVolume,
    };
    
    // Send chunk to callback
    if (onChunkReady) {
      onChunkReady(chunk);
    }
    
    // Process through speech model
    await SpeechModelService.processAudioChunk(chunk);
  }, [state.isPaused, state.isRecording, mergedConfig, onChunkReady]);
  
  /**
   * Start audio recording
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Check/request permission
      if (state.hasPermission !== true) {
        const granted = await requestPermission();
        if (!granted) {
          setState(prev => ({ ...prev, error: 'Microphone permission denied' }));
          return false;
        }
      }
      
      // Initialize speech model service
      await SpeechModelService.initialize({
        sampleRate: mergedConfig.sampleRate,
        chunkSizeMs: mergedConfig.chunkDurationMs,
      });
      
      mockModeRef.current = SpeechModelService.isInMockMode();
      
      // Start recording on native platforms
      if (Platform.OS !== 'web') {
        try {
          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync(RECORDING_OPTIONS);
          await recording.startAsync();
          recordingRef.current = recording;
          console.log('[useAudioStream] Recording started');
        } catch (error) {
          console.warn('[useAudioStream] Native recording failed, using mock mode:', error);
          mockModeRef.current = true;
        }
      }
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null,
      }));
      
      // Start chunk processing interval
      chunkIntervalRef.current = setInterval(
        processAudioChunk,
        mergedConfig.chunkDurationMs
      );
      
      console.log(`[useAudioStream] Started in ${mockModeRef.current ? 'MOCK' : 'NATIVE'} mode`);
      return true;
    } catch (error: any) {
      console.error('[useAudioStream] Start error:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to start recording',
      }));
      return false;
    }
  }, [state.hasPermission, requestPermission, mergedConfig, processAudioChunk]);
  
  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Stop interval
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }
      
      // Stop native recording
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Ignore errors during cleanup
        }
        recordingRef.current = null;
      }
      
      // Reset state
      volumeHistoryRef.current = [];
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        volumeLevel: 0,
      }));
      
      // Reset speech model
      SpeechModelService.resetMockState();
      
      console.log('[useAudioStream] Recording stopped');
    } catch (error: any) {
      console.error('[useAudioStream] Stop error:', error);
    }
  }, []);
  
  /**
   * Toggle pause state
   */
  const togglePause = useCallback(() => {
    setState(prev => {
      const newPaused = !prev.isPaused;
      
      // Pause/resume the recording if possible
      if (recordingRef.current && Platform.OS !== 'web') {
        try {
          if (newPaused) {
            recordingRef.current.pauseAsync();
          } else {
            recordingRef.current.startAsync();
          }
        } catch {
          // Ignore pause/resume errors
        }
      }
      
      return { ...prev, isPaused: newPaused };
    });
  }, []);
  
  // Handle app state changes (pause when backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App going to background - pause recording
        if (state.isRecording && !state.isPaused) {
          togglePause();
        }
      }
      appStateRef.current = nextAppState;
    });
    
    return () => subscription.remove();
  }, [state.isRecording, state.isPaused, togglePause]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);
  
  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    hasPermission: state.hasPermission,
    volumeLevel: state.volumeLevel,
    error: state.error,
    isMockMode: mockModeRef.current,
    requestPermission,
    startRecording,
    stopRecording,
    togglePause,
  };
};

export default useAudioStream;
