/**
 * Ghost Mode Floating Toolbar
 * Shows ghost icon, location spoof, timer countdown, self-destruct button
 * Auto-hides after 4s, reappears on tap
 */
import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useGhostModeStore } from '../store/useGhostModeStore';

const GHOST_GREEN = '#00FF88';
const DANGER_RED = '#FF4444';

interface Props {
  onLocationPress: () => void;
  onSelfDestruct: () => void;
}

const GhostModeToolbarComponent: React.FC<Props> = ({ onLocationPress, onSelfDestruct }) => {
  const [expanded, setExpanded] = useState(true);
  const [remaining, setRemaining] = useState(-1);
  const isActive = useGhostModeStore(s => s.isActive);
  const selfDestructEndTime = useGhostModeStore(s => s.selfDestructEndTime);
  const spoofedLocation = useGhostModeStore(s => s.spoofedLocation);

  const slide = useSharedValue(1);
  useEffect(() => {
    slide.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded]);

  // Auto-hide after 4s
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => setExpanded(false), 4000);
    return () => clearTimeout(timer);
  }, [expanded]);

  // Timer countdown
  useEffect(() => {
    if (!selfDestructEndTime) { setRemaining(-1); return; }
    const update = () => setRemaining(Math.max(0, Math.ceil((selfDestructEndTime - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [selfDestructEndTime]);

  // Check for self-destruct
  useEffect(() => {
    if (remaining === 0 && selfDestructEndTime) {
      onSelfDestruct();
    }
  }, [remaining, selfDestructEndTime]);

  // Warning at 60s
  useEffect(() => {
    if (remaining === 60) {
      Alert.alert('Ghost Mode', 'Self-destruct in 60 seconds');
    }
  }, [remaining]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isWarning = remaining >= 0 && remaining <= 120;

  const toolbarStyle = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateY: (1 - slide.value) * 60 }],
  }));

  const handleSelfDestructPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Self Destruct',
      'Destroy all Ghost Mode data immediately?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'DESTROY', style: 'destructive', onPress: onSelfDestruct },
      ]
    );
  }, [onSelfDestruct]);

  if (!isActive) return null;

  return (
    <>
      {/* Collapsed tap target */}
      {!expanded && (
        <TouchableOpacity
          style={styles.collapsedBtn}
          onPress={() => { setExpanded(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          data-testid="ghost-toolbar-expand"
        >
          <Ionicons name="skull-outline" size={18} color={GHOST_GREEN} />
          {remaining >= 0 && (
            <Text style={[styles.miniTimer, isWarning && { color: DANGER_RED }]}>{formatTimer(remaining)}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Expanded toolbar */}
      <Animated.View style={[styles.toolbar, toolbarStyle]} pointerEvents={expanded ? 'auto' : 'none'} data-testid="ghost-toolbar">
        {/* Ghost status */}
        <TouchableOpacity style={styles.toolItem} onPress={() => setExpanded(false)}>
          <Ionicons name="skull-outline" size={20} color={GHOST_GREEN} />
        </TouchableOpacity>

        {/* Location spoof */}
        <TouchableOpacity style={styles.toolItem} onPress={onLocationPress} data-testid="ghost-toolbar-location">
          <Ionicons name="location-outline" size={18} color={spoofedLocation ? '#FF9500' : 'rgba(255,255,255,0.4)'} />
          {spoofedLocation && (
            <Text style={styles.locText} numberOfLines={1}>{spoofedLocation.emoji} {spoofedLocation.name.split(',')[0]}</Text>
          )}
        </TouchableOpacity>

        {/* Timer */}
        {remaining >= 0 && (
          <View style={styles.toolItem}>
            <Ionicons name="time-outline" size={16} color={isWarning ? DANGER_RED : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.timerText, isWarning && { color: DANGER_RED }]}>{formatTimer(remaining)}</Text>
          </View>
        )}

        {/* Self-destruct */}
        <TouchableOpacity style={styles.destroyBtn} onPress={handleSelfDestructPress} data-testid="ghost-toolbar-destroy">
          <Ionicons name="flame" size={16} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  collapsedBtn: {
    position: 'absolute', bottom: 78, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', zIndex: 100,
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } as any }),
  },
  miniTimer: { fontSize: 13, fontWeight: '700', color: GHOST_GREEN },
  toolbar: {
    position: 'absolute', bottom: 78, left: 16, right: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', zIndex: 100,
    ...Platform.select({ web: { backdropFilter: 'blur(16px)' } as any }),
  },
  toolItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  locText: { fontSize: 12, color: '#FF9500', fontWeight: '600', maxWidth: 100 },
  timerText: { fontSize: 14, fontWeight: '700', color: GHOST_GREEN, fontVariant: ['tabular-nums'] },
  destroyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: DANGER_RED, alignItems: 'center', justifyContent: 'center' },
});

export const GhostModeToolbar = memo(GhostModeToolbarComponent);
export default GhostModeToolbar;
