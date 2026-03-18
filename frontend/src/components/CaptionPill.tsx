/**
 * Caption Pill Component
 * 
 * A floating glassmorphic caption pill that appears at the top of the WebView
 * when Live Captioning is enabled. Shows real-time text captions.
 * 
 * Demo Mode: Shows "[AI Listening for Browser Audio...]" placeholder
 * Production: Would receive captions from Whisper/Vosk STT engine
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Colors
const CAPTION_GREEN = '#00FF88';
const GLASS_BG = 'rgba(0, 0, 0, 0.85)';

interface CaptionPillProps {
  visible: boolean;
  captionText?: string;
  onClose: () => void;
}

export const CaptionPill: React.FC<CaptionPillProps> = ({
  visible,
  captionText,
  onClose,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);

  // Demo scrolling text
  const demoText = '[AI Listening for Browser Audio...]';

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Demo text scrolling effect
  useEffect(() => {
    if (!visible || captionText) return;

    setTextIndex(0);
    setDisplayText('');

    const interval = setInterval(() => {
      setTextIndex(prev => {
        const newIndex = prev + 1;
        if (newIndex > demoText.length) {
          // Reset after showing full text
          setTimeout(() => {
            setDisplayText('');
            setTextIndex(0);
          }, 2000);
          return prev;
        }
        setDisplayText(demoText.substring(0, newIndex));
        return newIndex;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [visible, captionText]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!visible) return null;

  const isWeb = Platform.OS === 'web';
  const textToShow = captionText || displayText || '...';

  const pillContent = (
    <>
      {/* Status indicator */}
      <Animated.View
        style={[
          styles.statusDot,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      
      {/* Caption text */}
      <Text style={styles.captionText} numberOfLines={2}>
        {textToShow}
        {!captionText && <Text style={styles.cursor}>|</Text>}
      </Text>
      
      {/* Close button */}
      <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
        <Ionicons name="close" size={16} color="#666" />
      </TouchableOpacity>
    </>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {isWeb ? (
        <View style={styles.pill}>
          {pillContent}
        </View>
      ) : (
        <BlurView tint="dark" intensity={60} style={styles.pill}>
          {pillContent}
        </BlurView>
      )}
      
      {/* Demo mode badge */}
      {!captionText && (
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>DEMO</Text>
        </View>
      )}
    </Animated.View>
  );
};

/**
 * ============================================================
 * TRANSCRIPTION BRIDGE (Architecture for Real STT)
 * ============================================================
 * 
 * For production speech-to-text, this component would receive
 * captions from a local STT engine like:
 * 
 * 1. Whisper.cpp (via ONNX Runtime or native module)
 * 2. Vosk (offline speech recognition)
 * 3. Mozilla DeepSpeech
 * 
 * Example integration:
 * 
 * ```typescript
 * import { WhisperModule } from './WhisperModule';
 * 
 * const whisper = new WhisperModule();
 * 
 * whisper.on('transcript', (text: string) => {
 *   setCaptionText(text);
 * });
 * 
 * // Start capturing browser audio
 * const startCaption = async () => {
 *   await whisper.loadModel('tiny.en');
 *   await whisper.startCapturing({
 *     sampleRate: 16000,
 *     channels: 1,
 *   });
 * };
 * ```
 * 
 * The actual implementation would use:
 * - expo-av for audio capture
 * - onnxruntime-react-native for model inference
 * - A worker thread for non-blocking processing
 */

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: CAPTION_GREEN,
    ...Platform.select({
      ios: {
        shadowColor: CAPTION_GREEN,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: `0 2px 12px rgba(0, 255, 136, 0.2)`,
      },
    }),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CAPTION_GREEN,
    marginRight: 10,
  },
  captionText: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
    lineHeight: 20,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  cursor: {
    color: CAPTION_GREEN,
    fontWeight: '300',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  demoBadge: {
    position: 'absolute',
    top: -4,
    right: 20,
    backgroundColor: 'rgba(255, 184, 0, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
});

export default CaptionPill;
