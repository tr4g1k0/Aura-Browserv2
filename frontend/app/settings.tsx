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
import { SearchEngine, CaptioningLanguage } from '../src/hooks/useBrowserSettings';
import { useBrowserStore } from '../src/store/browserStore';
import * as Haptics from 'expo-haptics';

const SEARCH_ENGINES: { value: SearchEngine; label: string; icon: string }[] = [
  { value: 'google', label: 'Google', icon: 'logo-google' },
  { value: 'duckduckgo', label: 'DuckDuckGo', icon: 'shield-checkmark' },
  { value: 'bing', label: 'Bing', icon: 'search' },
];

const CAPTIONING_LANGUAGES: { value: CaptioningLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Español' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'japanese', label: '日本語' },
  { value: 'chinese', label: '中文' },
];

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

interface SettingsRowProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isHeavyToggle?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconColor = '#888',
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  rightElement,
  isHeavyToggle = false,
}) => {
  const handleToggle = (newValue: boolean) => {
    if (isHeavyToggle) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle?.(newValue);
  };

  const content = (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {rightElement ? (
        rightElement
      ) : onToggle ? (
        <Switch
          value={value}
          onValueChange={handleToggle}
          trackColor={{ false: '#333', true: '#00FF88' }}
          thumbColor={value ? '#FFF' : '#888'}
          ios_backgroundColor="#333"
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#666" />
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
    clearBrowsingData,
    isLoading,
  } = useSettings();

  // Get browser store for clearing history/bookmarks
  const { history, bookmarks } = useBrowserStore();

  const [showSearchEngineModal, setShowSearchEngineModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearedToast, setShowClearedToast] = useState(false);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // ============================================================================
  // CLEAR BROWSING DATA - Fully Wired
  // ============================================================================
  const handleClearData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Clear all browsing data?\n\nThis will delete:\n• Browsing history\n• Bookmarks\n• Cached pages\n• Cookies and site data\n\nThis action cannot be undone.'
      );
      if (confirmed) {
        performClearData();
      }
    } else {
      Alert.alert(
        'Clear Browsing Data',
        'This will delete:\n\n• Browsing history\n• Bookmarks\n• Cached pages\n• Cookies and site data\n\nThis action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear All',
            style: 'destructive',
            onPress: performClearData,
          },
        ]
      );
    }
  };

  const performClearData = async () => {
    setIsClearing(true);
    try {
      // Clear via settings context (clears AsyncStorage data)
      await clearBrowsingData();
      
      // Clear history and bookmarks in browser store
      useBrowserStore.getState().clearHistory();
      // Note: We don't have a clearBookmarks action, so we'll clear via individual removals
      const currentBookmarks = useBrowserStore.getState().bookmarks;
      currentBookmarks.forEach(bookmark => {
        useBrowserStore.getState().removeBookmark(bookmark.url);
      });
      
      // Show success toast
      setShowClearedToast(true);
      setTimeout(() => setShowClearedToast(false), 2000);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to clear data:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsClearing(false);
    }
  };

  // ============================================================================
  // TOOLBAR SHORTCUT TOGGLE HANDLER
  // ============================================================================
  const handleToolbarShortcutToggle = (shortcutKey: string, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    updateSetting('toolbarShortcuts', {
      ...settings.toolbarShortcuts,
      [shortcutKey]: value,
    });
  };

  // ============================================================================
  // SEARCH ENGINE SELECTION
  // ============================================================================
  const currentSearchEngine = SEARCH_ENGINES.find(
    (e) => e.value === settings.defaultSearchEngine
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00FF88" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================== */}
        {/* PRIVACY & SECURITY */}
        {/* ================================================================== */}
        <SectionHeader title="PRIVACY & SECURITY" />

        <SettingsRow
          icon="shield-checkmark"
          iconColor="#00FF88"
          title="Aggressive Ad-Blocking"
          subtitle="Block ads, trackers, and pop-ups"
          value={settings.aggressiveAdBlocking}
          onToggle={(v) => updateSetting('aggressiveAdBlocking', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="globe-outline"
          iconColor="#00E5FF"
          title="Always-On VPN"
          subtitle="Route traffic through secure servers"
          value={settings.alwaysOnVPN}
          onToggle={(v) => updateSetting('alwaysOnVPN', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="eye-off-outline"
          iconColor="#9B59B6"
          title="Do Not Track"
          subtitle="Send DNT header to websites"
          value={settings.doNotTrack}
          onToggle={(v) => updateSetting('doNotTrack', v)}
        />

        {/* ================================================================== */}
        {/* AI & ACCESSIBILITY */}
        {/* ================================================================== */}
        <SectionHeader title="AI & ACCESSIBILITY" />

        <SettingsRow
          icon="hardware-chip-outline"
          iconColor="#FFD700"
          title="Strict Local AI"
          subtitle="Never send data to cloud AI services"
          value={settings.strictLocalAI}
          onToggle={(v) => updateSetting('strictLocalAI', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="mic-outline"
          iconColor="#00FF88"
          title="Live Captioning"
          subtitle="Real-time speech-to-text overlay"
          value={settings.liveCaptioningEnabled}
          onToggle={(v) => updateSetting('liveCaptioningEnabled', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="language-outline"
          iconColor="#888"
          title="Captioning Language"
          subtitle={CAPTIONING_LANGUAGES.find(l => l.value === settings.captioningLanguage)?.label || 'English'}
          onPress={() => setShowLanguageModal(true)}
        />

        <SettingsRow
          icon="ear-outline"
          iconColor="#FF6B6B"
          title="Ambient Awareness"
          subtitle="Alert on important sounds nearby"
          value={settings.ambientAwarenessEnabled}
          onToggle={(v) => updateSetting('ambientAwarenessEnabled', v)}
          isHeavyToggle
        />

        {/* ================================================================== */}
        {/* BROWSING */}
        {/* ================================================================== */}
        <SectionHeader title="BROWSING" />

        <SettingsRow
          icon="search-outline"
          iconColor="#888"
          title="Search Engine"
          subtitle={currentSearchEngine?.label || 'Google'}
          onPress={() => setShowSearchEngineModal(true)}
        />

        <SettingsRow
          icon="desktop-outline"
          iconColor="#888"
          title="Request Desktop Site"
          subtitle="Default to desktop layout on new tabs"
          value={settings.requestDesktopSite}
          onToggle={(v) => updateSetting('requestDesktopSite', v)}
        />

        <SettingsRow
          icon="flash-outline"
          iconColor="#FFD700"
          title="Predictive Caching"
          subtitle="Pre-load links for faster navigation"
          value={settings.predictiveCaching}
          onToggle={(v) => updateSetting('predictiveCaching', v)}
        />

        {/* ================================================================== */}
        {/* DISPLAY & LAYOUT */}
        {/* ================================================================== */}
        <SectionHeader title="DISPLAY & LAYOUT" />

        <SettingsRow
          icon="moon-outline"
          iconColor="#9B59B6"
          title="Dark Mode"
          subtitle="Use dark theme throughout the app"
          value={settings.darkMode}
          onToggle={(v) => updateSetting('darkMode', v)}
        />

        <SettingsRow
          icon="swap-vertical-outline"
          iconColor="#888"
          title="Address Bar Position"
          subtitle="Choose top or bottom placement"
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
        {/* TOOLBAR SHORTCUTS */}
        {/* ================================================================== */}
        <SectionHeader title="TOOLBAR SHORTCUTS" />
        <Text style={styles.sectionSubtext}>
          Show quick-access icons in the navigation bar
        </Text>

        <SettingsRow
          icon="mic"
          iconColor="#00FF88"
          title="Live Captioning"
          subtitle="Quick toggle for captions"
          value={settings.toolbarShortcuts.showLiveCaptioning}
          onToggle={(v) => handleToolbarShortcutToggle('showLiveCaptioning', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="sparkles"
          iconColor="#FFD700"
          title="AI Agent"
          subtitle="Access AI features quickly"
          value={settings.toolbarShortcuts.showAIAgent}
          onToggle={(v) => handleToolbarShortcutToggle('showAIAgent', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="shield"
          iconColor="#00E5FF"
          title="VPN Toggle"
          subtitle="Quick VPN on/off switch"
          value={settings.toolbarShortcuts.showVPNToggle}
          onToggle={(v) => handleToolbarShortcutToggle('showVPNToggle', v)}
          isHeavyToggle
        />

        <SettingsRow
          icon="ban"
          iconColor="#FF6B6B"
          title="Ad-Block Status"
          subtitle="Show blocked ads counter"
          value={settings.toolbarShortcuts.showAdBlockStatus}
          onToggle={(v) => handleToolbarShortcutToggle('showAdBlockStatus', v)}
          isHeavyToggle
        />

        {/* ================================================================== */}
        {/* DANGER ZONE */}
        {/* ================================================================== */}
        <SectionHeader title="DANGER ZONE" />

        <TouchableOpacity 
          style={styles.dangerButton} 
          onPress={handleClearData}
          disabled={isClearing}
          activeOpacity={0.7}
        >
          {isClearing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
              <Text style={styles.dangerButtonText}>Clear All Browsing Data</Text>
            </>
          )}
        </TouchableOpacity>

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
                'This will restore all settings to their default values.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: resetSettings },
                ]
              );
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color="#888" />
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <Text style={styles.versionText}>ACCESS Browser v1.0</Text>
        <Text style={styles.versionSubtext}>Local AI Enabled</Text>
      </ScrollView>

      {/* ================================================================== */}
      {/* SEARCH ENGINE MODAL */}
      {/* ================================================================== */}
      <Modal
        visible={showSearchEngineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearchEngineModal(false)}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => setShowSearchEngineModal(false)}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Search Engine</Text>
          {SEARCH_ENGINES.map((engine) => (
            <TouchableOpacity
              key={engine.value}
              style={[
                styles.modalOption,
                settings.defaultSearchEngine === engine.value && styles.modalOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSetting('defaultSearchEngine', engine.value);
                setShowSearchEngineModal(false);
              }}
            >
              <Ionicons name={engine.icon as any} size={20} color="#FFF" />
              <Text style={styles.modalOptionText}>{engine.label}</Text>
              {settings.defaultSearchEngine === engine.value && (
                <Ionicons name="checkmark" size={20} color="#00FF88" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

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
          <Text style={styles.modalTitle}>Captioning Language</Text>
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
                <Ionicons name="checkmark" size={20} color="#00FF88" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* DATA CLEARED TOAST */}
      {/* ================================================================== */}
      {showClearedToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={20} color="#00FF88" />
          <Text style={styles.toastText}>Data Cleared</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  headerSpacer: {
    width: 40,
  },
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Section Header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 12,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  sectionSubtext: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    marginTop: -8,
  },
  // Settings Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#00FF88',
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  segmentButtonTextActive: {
    color: '#000',
  },
  // Danger Zone
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4444',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Version
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    marginTop: 32,
  },
  versionSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#444',
    marginTop: 4,
  },
  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  modalOptionActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
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
  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00FF88',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
});
