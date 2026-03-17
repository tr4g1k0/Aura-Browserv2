import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import * as Haptics from 'expo-haptics';

interface StatusBarProps {
  onAccessibilityPress: () => void;
}

export const BrowserStatusBar: React.FC<StatusBarProps> = ({ onAccessibilityPress }) => {
  const insets = useSafeAreaInsets();
  const { settings, toggleAdblock, toggleVPN } = useBrowserStore();

  const handleToggle = (toggle: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftSection}>
        <TouchableOpacity
          style={[styles.toggleButton, settings.adblockEnabled && styles.activeToggle]}
          onPress={() => handleToggle(toggleAdblock)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield"
            size={20}
            color={settings.adblockEnabled ? '#00FF88' : '#666'}
          />
          {settings.adblockEnabled && <View style={styles.activeDot} />}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, settings.vpnEnabled && styles.activeToggle]}
          onPress={() => handleToggle(toggleVPN)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="globe"
            size={20}
            color={settings.vpnEnabled ? '#00AAFF' : '#666'}
          />
          {settings.vpnEnabled && <View style={[styles.activeDot, { backgroundColor: '#00AAFF' }]} />}
        </TouchableOpacity>
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.browserName}>ACCESS</Text>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={onAccessibilityPress}
          activeOpacity={0.7}
        >
          <Ionicons name="accessibility" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#0D0D0D',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 2,
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeToggle: {
    backgroundColor: '#1A2A1A',
  },
  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF88',
  },
});
