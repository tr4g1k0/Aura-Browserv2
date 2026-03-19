/**
 * Ghost Mode Entry/Exit Animation
 * Dramatic full-screen animation when activating/deactivating Ghost Mode
 */
import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence,
  Easing, interpolate, FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');
const GHOST_GREEN = '#00FF88';

interface Props {
  mode: 'enter' | 'exit';
  onComplete: () => void;
}

const GhostModeEntryAnimationComponent: React.FC<Props> = ({ mode, onComplete }) => {
  const ripple = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOp = useSharedValue(0);
  const textOp = useSharedValue(0);
  const subOp = useSharedValue(0);
  const dissolve = useSharedValue(0);

  useEffect(() => {
    if (mode === 'enter') {
      ripple.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      ghostScale.value = withDelay(200, withSequence(
        withTiming(1.2, { duration: 400, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 200 }),
      ));
      ghostOp.value = withDelay(200, withTiming(1, { duration: 400 }));
      textOp.value = withDelay(500, withTiming(1, { duration: 300 }));
      subOp.value = withDelay(700, withTiming(1, { duration: 300 }));
      // Auto-dismiss
      setTimeout(() => {
        ghostOp.value = withTiming(0, { duration: 300 });
        textOp.value = withTiming(0, { duration: 200 });
        subOp.value = withTiming(0, { duration: 200 });
        setTimeout(onComplete, 400);
      }, 1500);
    } else {
      ghostOp.value = 1;
      ghostScale.value = 1;
      textOp.value = 1;
      dissolve.value = withDelay(300, withTiming(1, { duration: 600 }));
      ghostOp.value = withDelay(200, withTiming(0, { duration: 500 }));
      textOp.value = withDelay(100, withTiming(0, { duration: 300 }));
      setTimeout(onComplete, 1200);
    }
  }, []);

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ripple.value, [0, 1], [0, 4]) }],
    opacity: interpolate(ripple.value, [0, 0.5, 1], [1, 0.8, 1]),
  }));
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ghostScale.value }],
    opacity: ghostOp.value,
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOp.value }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOp.value }));

  // Dissolve particles for exit
  const particles = mode === 'exit' ? Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return { angle, key: i };
  }) : [];

  return (
    <View style={styles.container} data-testid="ghost-entry-animation">
      {/* Ripple */}
      <Animated.View style={[styles.ripple, rippleStyle]} />

      {/* Ghost icon */}
      <Animated.View style={[styles.ghostWrap, ghostStyle]}>
        <Ionicons name="skull-outline" size={80} color={GHOST_GREEN} />
      </Animated.View>

      {/* Text */}
      <Animated.Text style={[styles.title, textStyle]}>
        {mode === 'enter' ? 'You are now invisible' : 'Ghost Mode destroyed'}
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, subStyle]}>
        {mode === 'enter' ? 'No traces. No tracking. No evidence.' : 'No traces left.'}
      </Animated.Text>

      {/* Dissolve particles on exit */}
      {particles.map(p => (
        <DissolveParticle key={p.key} angle={p.angle} dissolve={dissolve} />
      ))}
    </View>
  );
};

const DissolveParticle = ({ angle, dissolve }: { angle: number; dissolve: any }) => {
  const style = useAnimatedStyle(() => {
    const dist = interpolate(dissolve.value, [0, 1], [0, 120]);
    return {
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: interpolate(dissolve.value, [0, 0.5, 1], [1, 0.5, 0]) },
      ],
      opacity: interpolate(dissolve.value, [0, 0.7, 1], [0.8, 0.3, 0]),
    };
  });
  return (
    <Animated.View style={[styles.dissolveParticle, style]} />
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  ripple: {
    position: 'absolute', width: SW * 0.5, height: SW * 0.5, borderRadius: SW * 0.25,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  ghostWrap: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#FFF', letterSpacing: 1, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  dissolveParticle: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: GHOST_GREEN,
  },
});

export const GhostModeEntryAnimation = memo(GhostModeEntryAnimationComponent);
export default GhostModeEntryAnimation;
