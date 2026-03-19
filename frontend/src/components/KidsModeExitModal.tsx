/**
 * Kids Mode Exit Modal
 * PIN entry to exit kids mode with lockout after 3 failed attempts
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKidsModeStore } from '../store/useKidsModeStore';

const KIDS_PURPLE = '#667eea';
const KIDS_BLUE = '#764ba2';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.7)';

interface KidsModeExitModalProps {
  visible: boolean;
  onClose: () => void;
  onExit: () => void;
  onParentDashboard?: () => void;
}

const KidsModeExitModalComponent: React.FC<KidsModeExitModalProps> = ({
  visible, onClose, onExit, onParentDashboard,
}) => {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockRemaining, setLockRemaining] = useState(0);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const deactivateKidsMode = useKidsModeStore(s => s.deactivateKidsMode);
  const isLocked = useKidsModeStore(s => s.isLocked);
  const lockoutUntil = useKidsModeStore(s => s.lockoutUntil);
  const failedAttempts = useKidsModeStore(s => s.failedAttempts);
  const verifyPin = useKidsModeStore(s => s.verifyPin);

  useEffect(() => {
    if (!visible) { setPin(''); setError(''); }
  }, [visible]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) { setLockRemaining(0); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockRemaining(remaining);
      if (remaining <= 0) setError('');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handlePinChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isLocked()) {
      setError(`Locked. Try again in ${lockRemaining}s`);
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN');
      return;
    }

    const success = await deactivateKidsMode(pin);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onExit();
    } else {
      setPin('');
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isLocked()) {
        setError('Too many attempts. Locked for 5 minutes.');
      } else {
        setError(`Wrong PIN. ${3 - failedAttempts - 1} attempts left.`);
      }
    }
  }, [pin, deactivateKidsMode, isLocked, lockRemaining, failedAttempts, onExit, triggerShake]);

  const handleParentAccess = useCallback(async () => {
    if (isLocked()) {
      setError(`Locked. Try again in ${lockRemaining}s`);
      return;
    }
    if (pin.length !== 4) {
      setError('Enter PIN to access parent controls');
      return;
    }
    const valid = await verifyPin(pin);
    if (valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPin('');
      onParentDashboard?.();
    } else {
      setPin('');
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Wrong PIN');
    }
  }, [pin, verifyPin, isLocked, lockRemaining, onParentDashboard, triggerShake]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <LinearGradient colors={[KIDS_PURPLE, KIDS_BLUE]} style={styles.container}>
        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} data-testid="kids-exit-close">
            <Ionicons name="close" size={28} color={TEXT_WHITE} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color={TEXT_WHITE} />
          </View>
          <Text style={styles.title}>Parent Verification</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>

          <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}>
            <TextInput
              style={styles.hiddenInput}
              value={pin}
              onChangeText={handlePinChange}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus={visible}
              data-testid="kids-exit-pin-input"
            />
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
              ))}
            </View>
          </Animated.View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {lockRemaining > 0 ? (
            <View style={styles.lockoutBox}>
              <Ionicons name="time-outline" size={20} color={TEXT_WHITE} />
              <Text style={styles.lockoutText}>Locked for {lockRemaining}s</Text>
            </View>
          ) : null}

          <Text style={styles.helpText}>Ask a grown-up to help you exit</Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.exitButton}
              onPress={handleSubmit}
              activeOpacity={0.8}
              data-testid="kids-exit-submit-btn"
            >
              <Text style={styles.exitButtonText}>Exit Kids Mode</Text>
            </TouchableOpacity>

            {onParentDashboard && (
              <TouchableOpacity
                style={styles.parentButton}
                onPress={handleParentAccess}
                activeOpacity={0.8}
                data-testid="kids-parent-dashboard-btn"
              >
                <Ionicons name="bar-chart-outline" size={18} color={TEXT_WHITE} />
                <Text style={styles.parentButtonText}>Parent Controls</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  closeBtn: {
    position: 'absolute', top: 60, left: 24,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '700', color: TEXT_WHITE, marginBottom: 8 },
  subtitle: { fontSize: 16, color: TEXT_MUTED, marginBottom: 36 },
  pinContainer: { alignItems: 'center', marginBottom: 24 },
  hiddenInput: {
    fontSize: 32, color: TEXT_WHITE, textAlign: 'center',
    letterSpacing: 16, padding: 16, width: 200,
    position: 'absolute', opacity: 0,
  },
  pinDots: { flexDirection: 'row', gap: 20 },
  pinDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: TEXT_WHITE, backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: TEXT_WHITE },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,107,107,0.2)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, fontWeight: '600', color: '#FF6B6B' },
  lockoutBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16,
    marginBottom: 16,
  },
  lockoutText: { fontSize: 16, fontWeight: '600', color: TEXT_WHITE },
  helpText: { fontSize: 14, color: TEXT_MUTED, marginBottom: 32 },
  buttonsRow: { width: '100%', gap: 12 },
  exitButton: {
    backgroundColor: TEXT_WHITE, paddingVertical: 18,
    borderRadius: 30, alignItems: 'center',
  },
  exitButtonText: { fontSize: 18, fontWeight: '700', color: KIDS_PURPLE },
  parentButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14, borderRadius: 30,
  },
  parentButtonText: { fontSize: 16, fontWeight: '600', color: TEXT_WHITE },
});

export const KidsModeExitModal = memo(KidsModeExitModalComponent);
export default KidsModeExitModal;
