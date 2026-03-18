import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../src/context/SettingsContext';
import { CaptioningLanguage } from '../src/hooks/useBrowserSettings';
import { useBrowserStore } from '../src/store/browserStore';
import { PrivacyShredder } from '../src/components/PrivacyShredder';
import * as Haptics from 'expo-haptics';

// Electric Cyan - unified accent color
const ELECTRIC_CYAN = '#00FFFF';
const MUTED_GRAY = '#888888';

const CAPTIONING_LANGUAGES: { value: CaptioningLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Español' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'japanese', label: '日本語' },
  { value: 'chinese', label: '中文' },
];

// ============================================================================
// MINIMALIST COMPONENTS
// ============================================================================

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

interface SettingsRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  rightElement,
}) => {
  const handleToggle = (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle?.(newValue);
  };

  const content = (
    <View style={styles.row}>
      <Ionicons 
        name={icon as any} 
        size={22} 
        color={value ? ELECTRIC_CYAN : '#FFFFFF'} 
        style={styles.rowIcon}
      />
      <View style={styles.rowTextContainer}>
        <Text style={[styles.rowTitle, value && styles.rowTitleActive]}>{title}</Text>
        {subtitle && (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        )}
      </View>
      {rightElement ? (
        rightElement
      ) : onToggle ? (
        <Switch
          value={value}
          onValueChange={handleToggle}
          trackColor={{ false: '#333', true: ELECTRIC_CYAN }}
          thumbColor="#FFF"
          ios_backgroundColor="#333"
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={MUTED_GRAY} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange }) => (
  <View style={styles.segmentedControl}>
    {options.map((option) => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.segmentButton,
          value === option.value && styles.segmentButtonActive,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(option.value);
        }}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.segmentButtonText,
          value === option.value && styles.segmentButtonTextActive,
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSetting,
    resetSettings,
    isLoading,
  } = useSettings();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPrivacyShredder, setShowPrivacyShredder] = useState(false);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // ============================================================================
  // PRIVACY SHREDDER
  // ============================================================================
  const handleOpenPrivacyShredder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowPrivacyShredder(true);
  };

  const handleShredComplete = () => {
    useBrowserStore.getState().showToast('Privacy Shredded. You are on a clean slate.');
    router.replace('/');
    
    const tabs = useBrowserStore.getState().tabs;
    if (tabs.length > 0) {
      useBrowserStore.getState().updateTab(tabs[0].id, { 
        url: 'about:newtab', 
        title: 'New Tab' 
      });
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={ELECTRIC_CYAN} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Minimalist Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================== */}
        {/* SHIELD & PRIVACY */}
        {/* ================================================================== */}
        <SectionHeader title="SHIELD & PRIVACY" />

        <SettingsRow
          icon="shield-outline"
          title="Ad-Blocking"
          subtitle="Block ads, trackers, and pop-ups"
          value={settings.aggressiveAdBlocking}
          onToggle={(v) => updateSetting('aggressiveAdBlocking', v)}
        />

        <SettingsRow
          icon="eye-off-outline"
          title="Do Not Track"
          subtitle="Request websites not to track you"
          value={settings.doNotTrack}
          onToggle={(v) => updateSetting('doNotTrack', v)}
        />

        <SettingsRow
          icon="globe-outline"
          title="VPN"
          subtitle="Route traffic through secure servers"
          value={settings.alwaysOnVPN}
          onToggle={(v) => updateSetting('alwaysOnVPN', v)}
        />

        {/* ================================================================== */}
        {/* AI & ACCESSIBILITY */}
        {/* ================================================================== */}
        <SectionHeader title="AI & ACCESSIBILITY" />

        <SettingsRow
          icon="hardware-chip-outline"
          title="Strict Local AI"
          subtitle="Never send data to cloud services"
          value={settings.strictLocalAI}
          onToggle={(v) => updateSetting('strictLocalAI', v)}
        />

        <SettingsRow
          icon="sparkles-outline"
          title="AI History"
          subtitle="Smart page memory (100% local)"
          value={settings.aiHistoryEnabled}
          onToggle={(v) => updateSetting('aiHistoryEnabled', v)}
        />

        <SettingsRow
          icon="mic-outline"
          title="Live Captioning"
          subtitle="Real-time speech-to-text"
          value={settings.liveCaptioningEnabled}
          onToggle={(v) => updateSetting('liveCaptioningEnabled', v)}
        />

        <SettingsRow
          icon="language-outline"
          title="Caption Language"
          subtitle={CAPTIONING_LANGUAGES.find(l => l.value === settings.captioningLanguage)?.label || 'English'}
          onPress={() => setShowLanguageModal(true)}
        />

        <SettingsRow
          icon="ear-outline"
          title="Ambient Awareness"
          subtitle="Alert on important sounds"
          value={settings.ambientAwarenessEnabled}
          onToggle={(v) => updateSetting('ambientAwarenessEnabled', v)}
        />

        {/* ================================================================== */}
        {/* SYSTEM */}
        {/* ================================================================== */}
        <SectionHeader title="SYSTEM" />

        <SettingsRow
          icon="swap-vertical-outline"
          title="Address Bar"
          subtitle="Position in browser"
          rightElement={
            <SegmentedControl
              options={[
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
              ]}
              value={settings.addressBarPosition}
              onChange={(v) => updateSetting('addressBarPosition', v as 'top' | 'bottom')}
            />
          }
        />

        {/* ================================================================== */}
        {/* DANGER ZONE */}
        {/* ================================================================== */}
        <SectionHeader title="DANGER ZONE" />

        {/* Privacy Shredder - Full-width panic button */}
        <TouchableOpacity 
          style={styles.shredderButton} 
          onPress={handleOpenPrivacyShredder}
          activeOpacity={0.8}
        >
          <Ionicons name="flame-outline" size={24} color="#FF4444" />
          <View style={styles.shredderTextContainer}>
            <Text style={styles.shredderTitle}>Privacy Shredder</Text>
            <Text style={styles.shredderSubtitle}>Permanently delete all browsing data</Text>
          </View>
        </TouchableOpacity>

        {/* Reset to Defaults */}
        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (Platform.OS === 'web') {
              if (window.confirm('Reset all settings to default?')) {
                resetSettings();
              }
            } else {
              Alert.alert(
                'Reset Settings',
                'Restore all settings to default values?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: resetSettings },
                ]
              );
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color={MUTED_GRAY} />
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>ACCESS Browser v1.0</Text>
      </ScrollView>

      {/* ================================================================== */}
      {/* PRIVACY SHREDDER MODAL */}
      {/* ================================================================== */}
      <PrivacyShredder
        visible={showPrivacyShredder}
        onClose={() => setShowPrivacyShredder(false)}
        onShredComplete={handleShredComplete}
      />

      {/* ================================================================== */}
      {/* LANGUAGE MODAL */}
      {/* ================================================================== */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setShowLanguageModal(false)}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Caption Language</Text>
          {CAPTIONING_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.value}
              style={[
                styles.modalOption,
                settings.captioningLanguage === lang.value && styles.modalOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSetting('captioningLanguage', lang.value);
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>{lang.label}</Text>
              {settings.captioningLanguage === lang.value && (
                <Ionicons name="checkmark" size={20} color={ELECTRIC_CYAN} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

// ============================================================================
// MINIMALIST STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: 0.3,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  headerSpacer: {
    width: 44,
  },
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Section Header - Minimalist
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED_GRAY,
    letterSpacing: 2,
    marginTop: 32,
    marginBottom: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Settings Row - Clean & Spacious
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,  // 20% more padding
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowIcon: {
    marginRight: 16,
    width: 24,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  rowTitleActive: {
    color: ELECTRIC_CYAN,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: ELECTRIC_CYAN,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_GRAY,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  segmentButtonTextActive: {
    color: '#000',
  },
  // Privacy Shredder - Full-width panic button
  shredderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 0, 0, 0.5)',  // Dark red outline
  },
  shredderTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  shredderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  shredderSubtitle: {
    fontSize: 13,
    color: '#994444',
    marginTop: 3,
  },
  // Reset Button
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 16,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: MUTED_GRAY,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Version
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#444',
    marginTop: 40,
    letterSpacing: 0.5,
  },
  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  modalOptionActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
});
