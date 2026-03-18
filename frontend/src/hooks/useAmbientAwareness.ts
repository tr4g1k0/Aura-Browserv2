/**
 * Ambient Awareness Hook
 * 
 * Monitors ambient sound levels using expo-av Audio recording with metering.
 * Triggers haptic feedback and visual alerts when dangerous sound levels are detected.
 * 
 * Features:
 * - Real-time audio level monitoring (every 200ms)
 * - Configurable danger threshold (-10dB default)
 * - Haptic pulse notifications
 * - Sound type classification (loud noise, siren, etc.)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useBrowserStore } from '../store/browserStore';

// Conditionally import Audio to handle web platform
let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    Audio = require('expo-av').Audio;
  } catch (e) {
    console.log('[AmbientAwareness] expo-av not available');
  }
}

// Danger threshold in decibels (higher = louder)
// -160 is silence, 0 is max, -10 is very loud
const DANGER_THRESHOLD_DB = -10;
const WARNING_THRESHOLD_DB = -20;

// Monitoring interval in milliseconds
const MONITORING_INTERVAL_MS = 200;

// Cooldown between alerts (prevent spam)
const ALERT_COOLDOWN_MS = 3000;

interface AmbientAwarenessState {
  isMonitoring: boolean;
  currentLevel: number; // 0-1 normalized
  currentDb: number;
  isDanger: boolean;
  isWarning: boolean;
  error: string | null;
  hasPermission: boolean | null;
}

export const useAmbientAwareness = () => {
  const { settings, addAmbientAlert, toggleAmbientAwareness } = useBrowserStore();
  const [state, setState] = useState<AmbientAwarenessState>({
    isMonitoring: false,
    currentLevel: 0,
    currentDb: -160,
    isDanger: false,
    isWarning: false,
    error: null,
    hasPermission: null,
  });

  const recordingRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const flashCallbackRef = useRef<(() => void) | null>(null);

  /**
   * Request microphone permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !Audio) {
      setState(prev => ({ ...prev, error: 'Audio not available on web', hasPermission: false }));
      return false;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === 'granted';
      setState(prev => ({ ...prev, hasPermission: granted }));
      
      if (!granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Ambient Awareness needs microphone access to detect environmental sounds and keep you safe. Audio is processed locally and never sent to external servers.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      }
      
      return granted;
    } catch (error: any) {
      console.error('[AmbientAwareness] Permission error:', error);
      setState(prev => ({ ...prev, error: error.message, hasPermission: false }));
      return false;
    }
  }, []);

  /**
   * Start ambient sound monitoring
   */
  const startMonitoring = useCallback(async () => {
    if (Platform.OS === 'web' || !Audio) {
      setState(prev => ({ ...prev, error: 'Audio monitoring not available on web' }));
      return;
    }

    try {
      // Request permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        // Turn off the toggle if permission denied
        toggleAmbientAwareness();
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create recording with metering enabled
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            audioQuality: Audio.IOSAudioQuality.MIN,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
        },
        { isMeteringEnabled: true },
        null
      );

      recordingRef.current = recording;
      setState(prev => ({ ...prev, isMonitoring: true, error: null }));
      console.log('[AmbientAwareness] Started monitoring');

      // Start metering interval
      intervalRef.current = setInterval(async () => {
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            
            if (status.isRecording && status.metering !== undefined) {
              const db = status.metering;
              // Normalize to 0-1 range (assuming -160 to 0 dB range)
              const normalized = Math.max(0, Math.min(1, (db + 160) / 160));
              
              const isDanger = db >= DANGER_THRESHOLD_DB;
              const isWarning = db >= WARNING_THRESHOLD_DB && !isDanger;

              setState(prev => ({
                ...prev,
                currentDb: db,
                currentLevel: normalized,
                isDanger,
                isWarning,
              }));

              // Check for danger threshold
              if (isDanger) {
                const now = Date.now();
                if (now - lastAlertTimeRef.current > ALERT_COOLDOWN_MS) {
                  lastAlertTimeRef.current = now;
                  
                  // Trigger heavy haptic pulse
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  
                  // Classify the sound type (simplified)
                  let soundType = 'Loud Sound Detected';
                  if (db >= -5) {
                    soundType = '⚠️ VERY LOUD NOISE - Protect your hearing!';
                  } else if (db >= -10) {
                    soundType = '🔊 Loud Environmental Sound Detected';
                  }
                  
                  // Add alert to store
                  addAmbientAlert(soundType);
                  
                  // Trigger flash callback
                  if (flashCallbackRef.current) {
                    flashCallbackRef.current();
                  }
                  
                  console.log(`[AmbientAwareness] DANGER: ${db.toFixed(1)}dB - ${soundType}`);
                }
              }
            }
          } catch (err) {
            // Recording might have stopped
            console.log('[AmbientAwareness] Metering error:', err);
          }
        }
      }, MONITORING_INTERVAL_MS);

    } catch (error: any) {
      console.error('[AmbientAwareness] Start error:', error);
      setState(prev => ({ ...prev, error: error.message, isMonitoring: false }));
    }
  }, [requestPermissions, toggleAmbientAwareness, addAmbientAlert]);

  /**
   * Stop ambient sound monitoring
   */
  const stopMonitoring = useCallback(async () => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop and unload recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
        console.log('[AmbientAwareness] Stopped monitoring');
      } catch (err) {
        console.log('[AmbientAwareness] Stop error:', err);
      }
    }

    setState(prev => ({
      ...prev,
      isMonitoring: false,
      currentLevel: 0,
      currentDb: -160,
      isDanger: false,
      isWarning: false,
    }));

    // Reset audio mode
    if (Audio && Platform.OS !== 'web') {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  /**
   * Register flash callback
   */
  const onDangerFlash = useCallback((callback: () => void) => {
    flashCallbackRef.current = callback;
  }, []);

  // Auto-start/stop based on settings
  useEffect(() => {
    if (settings.ambientAwarenessEnabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [settings.ambientAwarenessEnabled]);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    requestPermissions,
    onDangerFlash,
  };
};

export default useAmbientAwareness;
