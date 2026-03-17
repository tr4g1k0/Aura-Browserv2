import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import * as Haptics from 'expo-haptics';

interface AccessibilityModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const {
    settings,
    toggleLiveCaptioning,
    toggleAmbientAwareness,
  } = useBrowserStore();

  const handleToggle = (toggle: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Accessibility Engine</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Break down real-world communication barriers with AI-powered features.
          </Text>

          <View style={styles.optionCard}>
            <View style={styles.optionIcon}>
              <Ionicons name="text" size={24} color="#00FF88" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Live Captioning</Text>
              <Text style={styles.optionDescription}>
                Generate real-time text overlays for any audio playing through the browser.
              </Text>
            </View>
            <Switch
              value={settings.liveCaptioningEnabled}
              onValueChange={() => handleToggle(toggleLiveCaptioning)}
              trackColor={{ false: '#333', true: '#00FF88' }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.optionCard}>
            <View style={[styles.optionIcon, { backgroundColor: 'rgba(255, 184, 0, 0.1)' }]}>
              <Ionicons name="ear" size={24} color="#FFB800" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Ambient Awareness</Text>
              <Text style={styles.optionDescription}>
                Listen for environmental sounds and translate them into visual alerts and haptic feedback.
              </Text>
            </View>
            <Switch
              value={settings.ambientAwarenessEnabled}
              onValueChange={() => handleToggle(toggleAmbientAwareness)}
              trackColor={{ false: '#333', true: '#FFB800' }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={16} color="#666" />
            <Text style={styles.privacyText}>
              Audio is processed locally on your device. No data is sent to external servers.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  privacyText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});
