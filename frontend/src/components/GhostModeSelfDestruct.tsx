/**
 * Ghost Mode Self-Destruct Animation
 * Dramatic screen flash + dissolve when Ghost Mode self-destructs
 */
import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay,
  Easing, interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');
const DANGER_RED = '#FF4444';

interface Props {
  onComplete: () => void;
}

const GhostModeSelfDestructComponent: React.FC<Props> = ({ onComplete }) => {
  const flash = useSharedValue(0);
  const textOp = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Flash effect
    flash.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 200 }),
      withTiming(0.6, { duration: 100 }),
      withTiming(0, { duration: 300 }),
    );
    // Text
    textOp.value = withDelay(200, withTiming(1, { duration: 300 }));
    // Progress
    progress.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.linear }));
    // Complete
    setTimeout(onComplete, 1800);
  }, []);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ scale: interpolate(textOp.value, [0, 1], [0.8, 1]) }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  return (
    <View style={styles.container} data-testid="ghost-self-destruct-anim">
      {/* Flash overlay */}
      <Animated.View style={[styles.flash, flashStyle]} />

      {/* Content */}
      <Animated.View style={[styles.content, textStyle]}>
        <Ionicons name="flame" size={56} color={DANGER_RED} />
        <Text style={styles.title}>SELF DESTRUCTING</Text>
        <Text style={styles.subtitle}>Erasing all traces...</Text>

        {/* Progress bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>
      </Animated.View>
    </View>
  );
};

const GhostModeDestroyedMessage: React.FC<{ onComplete: () => void }> = memo(({ onComplete }) => {
  useEffect(() => { setTimeout(onComplete, 2000); }, []);
  return (
    <View style={styles.container} data-testid="ghost-destroyed-msg">
      <Animated.View entering={require('react-native-reanimated').FadeIn.duration(400)} style={styles.content}>
        <Ionicons name="skull-outline" size={44} color="#00FF88" />
        <Text style={styles.destroyedTitle}>Ghost Mode destroyed</Text>
        <Text style={styles.destroyedSub}>No traces left.</Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center', justifyContent: 'center', zIndex: 99999,
  },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: DANGER_RED },
  content: { alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: DANGER_RED, letterSpacing: 3, marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },
  barTrack: { width: 200, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: DANGER_RED },
  destroyedTitle: { fontSize: 24, fontWeight: '700', color: '#00FF88', marginTop: 16, letterSpacing: 1 },
  destroyedSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
});

export const GhostModeSelfDestruct = memo(GhostModeSelfDestructComponent);
export { GhostModeDestroyedMessage };
export default GhostModeSelfDestruct;
