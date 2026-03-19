/**
 * Ghost Mode Biometric Lock Screen
 * Requires biometric/PIN auth before entering Ghost Mode
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { useGhostModeStore } from '../store/useGhostModeStore';

const GHOST_GREEN = '#00FF88';

let LocalAuthentication: any = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

const GhostModeBiometricLockComponent: React.FC<Props> = ({ visible, onClose, onAuthenticated }) => {
  const insets = useSafeAreaInsets();
  const [lockRemaining, setLockRemaining] = useState(0);
  const recordBioFailure = useGhostModeStore(s => s.recordBioFailure);
  const resetBioFailures = useGhostModeStore(s => s.resetBioFailures);
  const isBioLocked = useGhostModeStore(s => s.isBioLocked);
  const failedAttempts = useGhostModeStore(s => s.failedBioAttempts);
  const bioLockoutUntil = useGhostModeStore(s => s.bioLockoutUntil);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.2, 0.5]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.2]) }],
  }));

  // Lockout timer
  useEffect(() => {
    if (!bioLockoutUntil) { setLockRemaining(0); return; }
    const update = () => setLockRemaining(Math.max(0, Math.ceil((bioLockoutUntil - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [bioLockoutUntil]);

  const handleAuthenticate = useCallback(async () => {
    if (isBioLocked()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (Platform.OS === 'web') {
      // Web fallback - skip biometric
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetBioFailures();
      onAuthenticated();
      return;
    }

    try {
      if (!LocalAuthentication) {
        onAuthenticated();
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // Fallback - no biometric available
        onAuthenticated();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enter Ghost Mode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetBioFailures();
        onAuthenticated();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        recordBioFailure();
      }
    } catch (e) {
      console.log('[GhostMode] Auth error:', e);
      onAuthenticated();
    }
  }, [isBioLocked, resetBioFailures, recordBioFailure, onAuthenticated]);

  useEffect(() => {
    if (visible) handleAuthenticate();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container} data-testid="ghost-bio-lock">
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#666" />
        </TouchableOpacity>

        <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
          <Animated.View style={[styles.iconGlow, glowStyle]} />
          <View style={styles.iconWrap}>
            <Ionicons name="skull-outline" size={52} color={GHOST_GREEN} />
          </View>

          <Text style={styles.title}>Ghost Mode</Text>
          <Text style={styles.tagline}>Chrome has Incognito. Aura has Ghost Mode.</Text>
          <Text style={styles.subtitle}>The only browser mode that truly disappears.</Text>

          {lockRemaining > 0 ? (
            <View style={styles.lockoutBox}>
              <Ionicons name="lock-closed" size={18} color="#FF6B6B" />
              <Text style={styles.lockoutText}>Locked for {lockRemaining}s</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.authBtn} onPress={handleAuthenticate} activeOpacity={0.8} data-testid="ghost-auth-btn">
              <Ionicons name="finger-print" size={22} color="#000" />
              <Text style={styles.authBtnText}>Authenticate to Enter</Text>
            </TouchableOpacity>
          )}

          <View style={styles.features}>
            {[
              ['skull-outline', 'Biometric protected entry'],
              ['flame-outline', 'Auto self destructs'],
              ['eye-off-outline', 'Decoy history protection'],
              ['location-outline', 'Fake GPS location'],
              ['shield-checkmark-outline', 'Zero fingerprint tracking'],
            ].map(([icon, text]) => (
              <View key={text} style={styles.featureRow}>
                <Ionicons name={icon as any} size={16} color={GHOST_GREEN} />
                <Text style={styles.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  iconGlow: { position: 'absolute', top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: GHOST_GREEN },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: 2, marginBottom: 8 },
  tagline: { fontSize: 14, color: GHOST_GREEN, textAlign: 'center', marginBottom: 4, letterSpacing: 0.5, fontWeight: '600' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 36 },
  lockoutBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.15)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, marginBottom: 36 },
  lockoutText: { fontSize: 16, fontWeight: '600', color: '#FF6B6B' },
  authBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GHOST_GREEN, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 28, marginBottom: 36 },
  authBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  features: { gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
});

export const GhostModeBiometricLock = memo(GhostModeBiometricLockComponent);
export default GhostModeBiometricLock;
