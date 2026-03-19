/**
 * Ghost Mode Location Spoofer Sheet
 * Choose a fake location from presets or enter custom
 */
import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGhostModeStore, PRESET_LOCATIONS, SpoofLocation } from '../store/useGhostModeStore';

const GHOST_GREEN = '#00FF88';
const GLASS_BG = 'rgba(255,255,255,0.06)';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GhostModeLocationSheetComponent: React.FC<Props> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const [customCity, setCustomCity] = useState('');
  const spoofedLocation = useGhostModeStore(s => s.spoofedLocation);
  const setSpoofedLocation = useGhostModeStore(s => s.setSpoofedLocation);
  const setRandomLocation = useGhostModeStore(s => s.setRandomLocation);

  const handleSelect = (loc: SpoofLocation | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSpoofedLocation(loc);
    onClose();
  };

  const handleRandom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRandomLocation();
    onClose();
  };

  const handleCustom = () => {
    if (!customCity.trim()) return;
    // Generate pseudo-random coords for the city name
    const hash = customCity.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const lat = ((hash * 17) % 180) - 90;
    const lng = ((hash * 31) % 360) - 180;
    setSpoofedLocation({ name: customCity.trim(), lat, lng, emoji: '\ud83d\udccd' });
    setCustomCity('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Ionicons name="location-outline" size={28} color="#FF9500" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.title}>Spoof Location</Text>
          <Text style={styles.subtitle}>Websites will see this as your location</Text>

          {/* Current */}
          {spoofedLocation && (
            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>Active: {spoofedLocation.emoji} {spoofedLocation.name}</Text>
              <TouchableOpacity onPress={() => handleSelect(null)} style={styles.clearBtn} data-testid="ghost-loc-clear">
                <Ionicons name="close-circle" size={18} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          )}

          {/* Presets */}
          {PRESET_LOCATIONS.map(loc => (
            <TouchableOpacity
              key={loc.name}
              style={[styles.option, spoofedLocation?.name === loc.name && styles.optionActive]}
              onPress={() => handleSelect(loc)}
              activeOpacity={0.7}
              data-testid={`ghost-loc-${loc.name.split(',')[0].toLowerCase()}`}
            >
              <Text style={styles.optEmoji}>{loc.emoji}</Text>
              <Text style={styles.optLabel}>{loc.name}</Text>
              {spoofedLocation?.name === loc.name && <Ionicons name="checkmark-circle" size={18} color={GHOST_GREEN} />}
            </TouchableOpacity>
          ))}

          {/* Random */}
          <TouchableOpacity style={styles.option} onPress={handleRandom} data-testid="ghost-loc-random">
            <Text style={styles.optEmoji}>\ud83c\udfb2</Text>
            <Text style={styles.optLabel}>Random Location</Text>
          </TouchableOpacity>

          {/* Custom */}
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customCity}
              onChangeText={setCustomCity}
              placeholder="City name or coords"
              placeholderTextColor="#555"
              autoCapitalize="none"
              data-testid="ghost-loc-custom-input"
            />
            <TouchableOpacity style={styles.customBtn} onPress={handleCustom} data-testid="ghost-loc-custom-set">
              <Text style={styles.customBtnText}>Set</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: 'rgba(18,18,22,0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 16 },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,149,0,0.12)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginBottom: 12 },
  currentLabel: { fontSize: 14, fontWeight: '600', color: '#FF9500' },
  clearBtn: { padding: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  optionActive: { borderColor: 'rgba(0,255,136,0.3)', backgroundColor: 'rgba(0,255,136,0.06)' },
  optEmoji: { fontSize: 20 },
  optLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#FFF' },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  customInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  customBtn: { backgroundColor: '#FF9500', paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  customBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

export const GhostModeLocationSheet = memo(GhostModeLocationSheetComponent);
export default GhostModeLocationSheet;
