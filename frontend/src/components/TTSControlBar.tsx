import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBrowserStore } from '../store/browserStore';

interface TTSControlBarProps {
  visible: boolean;
  onStop: () => void;
  isGhostMode?: boolean;
}

/**
 * TTSControlBar - Floating control bar for Text-to-Speech
 * 
 * Features:
 * - Slides up from bottom when TTS is active
 * - Glassmorphism styling
 * - Stop button to kill audio
 * - Speed badge to cycle through rates (1.0x, 1.25x, 1.5x, 2.0x, 0.8x)
 * - Animated waveform indicator
 */
export const TTSControlBar: React.FC<TTSControlBarProps> = ({
  visible,
  onStop,
  isGhostMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const { ttsRate, cycleTTSRate } = useBrowserStore();
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.5)).current;
  const waveAnim3 = useRef(new Animated.Value(0.4)).current;

  // Slide in/out animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
      
      // Start wave animations
      startWaveAnimation();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Wave animation for active indicator
  const startWaveAnimation = () => {
    const createWaveAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    createWaveAnimation(waveAnim1, 0).start();
    createWaveAnimation(waveAnim2, 133).start();
    createWaveAnimation(waveAnim3, 266).start();
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStop();
  };

  const handleSpeedChange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cycleTTSRate();
  };

  // Colors based on Ghost Mode
  const colors = {
    accent: isGhostMode ? '#9B59B6' : '#00FF88',
    background: isGhostMode ? 'rgba(42, 0, 0, 0.9)' : 'rgba(30, 30, 30, 0.9)',
    border: isGhostMode ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    text: '#FFF',
    subtext: '#AAA',
  };

  const isWeb = Platform.OS === 'web';

  if (!visible) return null;

  const renderContent = () => (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + 12,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.bar, { borderColor: colors.border }]}>
        {/* Wave Indicator */}
        <View style={styles.waveContainer}>
          <Animated.View
            style={[
              styles.waveLine,
              { backgroundColor: colors.accent, transform: [{ scaleY: waveAnim1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.waveLine,
              { backgroundColor: colors.accent, transform: [{ scaleY: waveAnim2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.waveLine,
              { backgroundColor: colors.accent, transform: [{ scaleY: waveAnim3 }] },
            ]}
          />
        </View>

        {/* Reading Label */}
        <View style={styles.labelContainer}>
          <Text style={[styles.labelText, { color: colors.accent }]}>Reading</Text>
          <Text style={styles.sublabelText}>Page content</Text>
        </View>

        {/* Speed Badge */}
        <TouchableOpacity
          style={[styles.speedBadge, { borderColor: colors.accent }]}
          onPress={handleSpeedChange}
          activeOpacity={0.7}
        >
          <Text style={[styles.speedText, { color: colors.accent }]}>
            {ttsRate.toFixed(ttsRate % 1 === 0 ? 1 : 2)}x
          </Text>
        </TouchableOpacity>

        {/* Stop Button */}
        <TouchableOpacity
          style={[styles.stopButton, { backgroundColor: colors.accent }]}
          onPress={handleStop}
          activeOpacity={0.8}
        >
          <Ionicons name="stop" size={20} color="#0D0D0D" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Web fallback without BlurView
  if (isWeb) {
    return (
      <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
        {renderContent()}
      </View>
    );
  }

  // Native with BlurView
  return (
    <BlurView tint="dark" intensity={80} style={styles.wrapper}>
      <View style={{ backgroundColor: colors.background, flex: 1 }}>
        {renderContent()}
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    gap: 3,
  },
  waveLine: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  labelContainer: {
    flex: 1,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  sublabelText: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  speedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    minWidth: 50,
    alignItems: 'center',
  },
  speedText: {
    fontSize: 13,
    fontWeight: '700',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TTSControlBar;
