// Ambient Awareness Service
// Listens for environmental sounds and provides visual/haptic alerts

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hybridAIRouter } from '../ai/HybridAIRouter';

export type AmbientSoundType = 
  | 'speech'
  | 'doorbell'
  | 'alarm'
  | 'phone_ringing'
  | 'baby_crying'
  | 'dog_barking'
  | 'car_horn'
  | 'siren'
  | 'knock'
  | 'unknown';

export interface AmbientAlert {
  id: string;
  type: AmbientSoundType;
  description: string;
  confidence: number;
  timestamp: number;
  transcription?: string; // For speech
}

export type AlertCallback = (alert: AmbientAlert) => void;
export type StatusCallback = (status: 'idle' | 'listening' | 'error') => void;

// Sound classification patterns (for mock mode)
const SOUND_PATTERNS: Record<AmbientSoundType, string[]> = {
  speech: ['talking', 'speaking', 'conversation', 'voice'],
  doorbell: ['ding dong', 'doorbell', 'chime'],
  alarm: ['beeping', 'alarm', 'alert sound'],
  phone_ringing: ['ring', 'phone', 'ringtone'],
  baby_crying: ['baby', 'crying', 'infant'],
  dog_barking: ['bark', 'dog', 'woof'],
  car_horn: ['horn', 'honk', 'car'],
  siren: ['siren', 'emergency', 'ambulance'],
  knock: ['knock', 'door', 'tapping'],
  unknown: [],
};

class AmbientAwarenessService {
  private isActive: boolean = false;
  private alertCallbacks: Set<AlertCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;
  private alertId: number = 0;

  // Detection settings
  private detectionIntervalMs: number = 2000; // Check every 2 seconds
  private minConfidenceThreshold: number = 0.7;
  private enableHapticFeedback: boolean = true;
  private enabledSoundTypes: Set<AmbientSoundType> = new Set([
    'speech', 'doorbell', 'alarm', 'phone_ringing', 'knock', 'siren'
  ]);

  /**
   * Configure detection settings
   */
  configure(options: {
    detectionIntervalMs?: number;
    minConfidenceThreshold?: number;
    enableHapticFeedback?: boolean;
    enabledSoundTypes?: AmbientSoundType[];
  }): void {
    if (options.detectionIntervalMs) {
      this.detectionIntervalMs = options.detectionIntervalMs;
    }
    if (options.minConfidenceThreshold) {
      this.minConfidenceThreshold = options.minConfidenceThreshold;
    }
    if (options.enableHapticFeedback !== undefined) {
      this.enableHapticFeedback = options.enableHapticFeedback;
    }
    if (options.enabledSoundTypes) {
      this.enabledSoundTypes = new Set(options.enabledSoundTypes);
    }
  }

  /**
   * Start ambient awareness monitoring
   */
  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log('[AmbientAwareness] Already active');
      return true;
    }

    // Check microphone permission
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      this.notifyStatus('error');
      return false;
    }

    this.isActive = true;
    this.notifyStatus('listening');

    // Start detection loop
    this.processingInterval = setInterval(() => {
      this.detectAmbientSounds();
    }, this.detectionIntervalMs);

    console.log('[AmbientAwareness] Started');
    return true;
  }

  /**
   * Stop ambient awareness monitoring
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.notifyStatus('idle');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('[AmbientAwareness] Stopped');
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: AlertCallback): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
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

  /**
   * Check microphone permission
   */
  private async checkPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    try {
      const { Audio } = require('expo-av');
      const { status } = await Audio.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Main detection loop
   */
  private async detectAmbientSounds(): Promise<void> {
    if (!this.isActive) return;

    try {
      // Capture short audio sample (mock: generate random detection)
      const audioSample = this.captureAudioSample();

      // Run STT for speech detection
      const sttResponse = await hybridAIRouter.runSTT(audioSample);
      
      // Check if speech was detected
      if (sttResponse.result.text && sttResponse.result.confidence > this.minConfidenceThreshold) {
        const soundType = this.classifySound(sttResponse.result.text);
        
        // Only alert for enabled sound types
        if (this.enabledSoundTypes.has(soundType)) {
          const alert: AmbientAlert = {
            id: `ambient-${++this.alertId}`,
            type: soundType,
            description: this.getAlertDescription(soundType, sttResponse.result.text),
            confidence: sttResponse.result.confidence,
            timestamp: Date.now(),
            transcription: soundType === 'speech' ? sttResponse.result.text : undefined,
          };

          this.triggerAlert(alert);
        }
      }
    } catch (error) {
      console.error('[AmbientAwareness] Detection error:', error);
    }
  }

  /**
   * Capture audio sample (placeholder - returns mock data)
   */
  private captureAudioSample(): Float32Array {
    // In real implementation, this would capture actual audio
    // For now, return empty buffer (mock inference will handle it)
    return new Float32Array(16000); // 1 second at 16kHz
  }

  /**
   * Classify the detected sound type
   */
  private classifySound(text: string): AmbientSoundType {
    const lowerText = text.toLowerCase();

    for (const [type, patterns] of Object.entries(SOUND_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          return type as AmbientSoundType;
        }
      }
    }

    // Default to speech if text was detected
    if (text.trim().length > 0) {
      return 'speech';
    }

    return 'unknown';
  }

  /**
   * Get human-readable alert description
   */
  private getAlertDescription(type: AmbientSoundType, rawText?: string): string {
    const descriptions: Record<AmbientSoundType, string> = {
      speech: 'Someone is speaking nearby',
      doorbell: 'Doorbell detected',
      alarm: 'Alarm or alert sound detected',
      phone_ringing: 'Phone ringing nearby',
      baby_crying: 'Baby crying detected',
      dog_barking: 'Dog barking nearby',
      car_horn: 'Car horn detected',
      siren: 'Emergency siren detected',
      knock: 'Knocking sound detected',
      unknown: 'Sound detected',
    };

    return descriptions[type] || 'Sound detected';
  }

  /**
   * Trigger alert with haptic feedback
   */
  private async triggerAlert(alert: AmbientAlert): Promise<void> {
    // Haptic feedback
    if (this.enableHapticFeedback && Platform.OS !== 'web') {
      try {
        switch (alert.type) {
          case 'alarm':
          case 'siren':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case 'doorbell':
          case 'knock':
          case 'phone_ringing':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          default:
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.warn('[AmbientAwareness] Haptic feedback failed:', error);
      }
    }

    // Notify listeners
    this.alertCallbacks.forEach(callback => callback(alert));
  }

  private notifyStatus(status: 'idle' | 'listening' | 'error'): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }
}

// Singleton instance
export const ambientAwarenessService = new AmbientAwarenessService();
