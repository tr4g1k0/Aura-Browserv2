/**
 * Ghost Mode Timer Selection Bottom Sheet
 * Allows user to set self-destruct timer before entering Ghost Mode
 */
import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

const GHOST_GREEN = '#00FF88';
const GLASS_BG = 'rgba(255,255,255,0.06)';

const TIMER_OPTIONS = [
  { value: 0, label: 'No Timer', desc: 'Manual close' },
  { value: 5, label: '5 Minutes', desc: 'Quick session' },
  { value: 15, label: '15 Minutes', desc: 'Short session' },
  { value: 30, label: '30 Minutes', desc: 'Medium session' },
  { value: 60, label: '1 Hour', desc: 'Extended session' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (minutes: number) => void;
}

const GhostModeTimerSheetComponent: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const insets = useSafeAreaInsets();
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(minutes);
  };

  const handleCustomSubmit = () => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 480) return;
    handleSelect(mins);
    setCustomMinutes('');
    setShowCustom(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Ionicons name="flame-outline" size={28} color={GHOST_GREEN} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.title}>Self-Destruct Timer</Text>
          <Text style={styles.subtitle}>Session auto-destroys when time is up</Text>

          {TIMER_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={styles.option}
              onPress={() => handleSelect(opt.value)}
              activeOpacity={0.7}
              data-testid={`ghost-timer-${opt.value}`}
            >
              <View>
                <Text style={styles.optLabel}>{opt.label}</Text>
                <Text style={styles.optDesc}>{opt.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}

          {showCustom ? (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="Minutes (1-480)"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                autoFocus
                data-testid="ghost-timer-custom-input"
              />
              <TouchableOpacity style={styles.customBtn} onPress={handleCustomSubmit}>
                <Text style={styles.customBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.customToggle} onPress={() => setShowCustom(true)} data-testid="ghost-timer-custom">
              <Ionicons name="create-outline" size={18} color={GHOST_GREEN} />
              <Text style={styles.customToggleText}>Custom Timer</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: 'rgba(18,18,22,0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 18, backgroundColor: GLASS_BG, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  optLabel: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  optDesc: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  customInput: { flex: 1, backgroundColor: GLASS_BG, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  customBtn: { backgroundColor: GHOST_GREEN, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  customBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  customToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 4 },
  customToggleText: { fontSize: 15, fontWeight: '600', color: GHOST_GREEN },
});

export const GhostModeTimerSheet = memo(GhostModeTimerSheetComponent);
export default GhostModeTimerSheet;
