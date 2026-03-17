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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../src/context/SettingsContext';
import { SearchEngine, CaptioningLanguage } from '../src/hooks/useBrowserSettings';
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

  const [showSearchEngineModal, setShowSearchEngineModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleToggle = (key: keyof typeof settings, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSetting(key, value);
  };

  const handleClearData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    if (Platform.OS === 'web') {
      // Web fallback
      const confirmed = window.confirm(
        'Clear all browsing data?\n\nThis will delete:\n• Browsing history\n• Cached pages\n• Cookies and site data\n\nThis action cannot be undone.'
      );
      if (confirmed) {
        performClearData();
      }
    } else {
      Alert.alert(
        'Clear Browsing Data',
        'This will delete:\n\n• Browsing history\n• Cached pages\n• Cookies and site data\n\nThis action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Clear Data',
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
      await clearBrowsingData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (Platform.OS === 'web') {
        window.alert('Browsing data cleared successfully!');
      } else {
        Alert.alert('Success', 'Browsing data cleared successfully!');
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert('Failed to clear data');
      } else {
        Alert.alert('Error', 'Failed to clear browsing data');
      }
    } finally {
      setIsClearing(false);
    }
  };

  const handleResetSettings = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Reset all settings to defaults?');
      if (confirmed) {
        resetSettings();
      }
    } else {
      Alert.alert(
        'Reset Settings',
        'Reset all settings to their default values?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: resetSettings },
        ]
      );
    }
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderToggleRow = (
    icon: string,
    iconColor: string,
    title: string,
    description: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    disabled?: boolean
  ) => (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: '#00FF88' }}
        thumbColor="#FFF"
        disabled={disabled}
      />
    </View>
  );

  const renderSelectionRow = (
    icon: string,
    iconColor: string,
    title: string,
    currentValue: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{currentValue}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderSelectionModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { value: string; label: string }[],
    currentValue: string,
    onSelect: (value: any) => void
  ) => {
    if (!visible) return null;
    
    return (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.modalOption,
                currentValue === option.value && styles.modalOptionSelected,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(option.value);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  currentValue === option.value && styles.modalOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {currentValue === option.value && (
                <Ionicons name="checkmark-circle" size={22} color="#00FF88" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: AI & Accessibility */}
        {renderSectionHeader('AI & ACCESSIBILITY')}
        <View style={styles.section}>
          {renderToggleRow(
            'hardware-chip',
            '#00FF88',
            'Strict Local AI Processing',
            'Force on-device models only. No cloud fallback.',
            settings.strictLocalAI,
            (value) => handleToggle('strictLocalAI', value)
          )}
          
          {renderSelectionRow(
            'language',
            '#A78BFA',
            'Captioning Language',
            CAPTIONING_LANGUAGES.find(l => l.value === settings.captioningLanguage)?.label || 'English',
            () => setShowLanguageModal(true)
          )}
          
          {renderToggleRow(
            'text',
            '#FFB800',
            'Live Captioning',
            'Show real-time captions for audio content.',
            settings.liveCaptioningEnabled,
            (value) => handleToggle('liveCaptioningEnabled', value)
          )}
          
          {renderToggleRow(
            'ear',
            '#FF6B6B',
            'Ambient Awareness',
            'Detect environmental sounds while browsing.',
            settings.ambientAwarenessEnabled,
            (value) => handleToggle('ambientAwarenessEnabled', value)
          )}
        </View>

        {/* Section 2: Privacy & Security */}
        {renderSectionHeader('PRIVACY & SECURITY')}
        <View style={styles.section}>
          {renderToggleRow(
            'shield-checkmark',
            '#00FF88',
            'Aggressive Ad & Tracker Blocking',
            'Block ads, trackers, and malicious scripts.',
            settings.aggressiveAdBlocking,
            (value) => handleToggle('aggressiveAdBlocking', value)
          )}
          
          {renderToggleRow(
            'globe',
            '#00AAFF',
            'Always-On VPN',
            'Route all traffic through secure VPN.',
            settings.alwaysOnVPN,
            (value) => handleToggle('alwaysOnVPN', value)
          )}
          
          {renderToggleRow(
            'eye-off',
            '#A78BFA',
            'Do Not Track',
            'Send DNT header to websites.',
            settings.doNotTrack,
            (value) => handleToggle('doNotTrack', value)
          )}
        </View>

        {/* Section: Toolbar Shortcuts */}
        {renderSectionHeader('TOOLBAR SHORTCUTS')}
        <View style={styles.section}>
          <Text style={styles.toolbarDescription}>
            Choose which quick tools appear in the main toolbar
          </Text>
          
          {renderToggleRow(
            'text',
            '#00FF88',
            'Show Live Captioning Shortcut',
            'Quick access to live captions from toolbar.',
            settings.toolbarShortcuts?.showLiveCaptioning ?? false,
            (value) => updateSetting('toolbarShortcuts', {
              ...settings.toolbarShortcuts,
              showLiveCaptioning: value,
            })
          )}
          
          {renderToggleRow(
            'sparkles',
            '#A78BFA',
            'Show AI Agent Assistant',
            'Quick access to AI assistant from toolbar.',
            settings.toolbarShortcuts?.showAIAgent ?? false,
            (value) => updateSetting('toolbarShortcuts', {
              ...settings.toolbarShortcuts,
              showAIAgent: value,
            })
          )}
          
          {renderToggleRow(
            'globe',
            '#00E5FF',
            'Show VPN Toggle',
            'Quick VPN on/off toggle in toolbar.',
            settings.toolbarShortcuts?.showVPNToggle ?? false,
            (value) => updateSetting('toolbarShortcuts', {
              ...settings.toolbarShortcuts,
              showVPNToggle: value,
            })
          )}
          
          {renderToggleRow(
            'shield',
            '#FFB800',
            'Show Ad-Blocker Status',
            'Show ad-blocking status indicator.',
            settings.toolbarShortcuts?.showAdBlockStatus ?? false,
            (value) => updateSetting('toolbarShortcuts', {
              ...settings.toolbarShortcuts,
              showAdBlockStatus: value,
            })
          )}
        </View>

        {/* Section: Address Bar Position */}
        {renderSectionHeader('ADDRESS BAR POSITION')}
        <View style={styles.section}>
          <View style={styles.positionToggleContainer}>
            <TouchableOpacity
              style={[
                styles.positionOption,
                settings.addressBarPosition === 'top' && styles.positionOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSetting('addressBarPosition', 'top');
              }}
            >
              <Ionicons 
                name="arrow-up-circle" 
                size={24} 
                color={settings.addressBarPosition === 'top' ? '#00FF88' : '#666'} 
              />
              <Text style={[
                styles.positionOptionText,
                settings.addressBarPosition === 'top' && styles.positionOptionTextActive,
              ]}>
                Top
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.positionOption,
                settings.addressBarPosition === 'bottom' && styles.positionOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSetting('addressBarPosition', 'bottom');
              }}
            >
              <Ionicons 
                name="arrow-down-circle" 
                size={24} 
                color={settings.addressBarPosition === 'bottom' ? '#00FF88' : '#666'} 
              />
              <Text style={[
                styles.positionOptionText,
                settings.addressBarPosition === 'bottom' && styles.positionOptionTextActive,
              ]}>
                Bottom
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.positionDescription}>
            Choose where the address bar appears on screen
          </Text>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerHeader}>DANGER ZONE</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearData}
            disabled={isClearing}
            activeOpacity={0.7}
          >
            {isClearing ? (
              <ActivityIndicator size="small" color="#FF4444" />
            ) : (
              <>
                <Ionicons name="trash" size={20} color="#FF4444" />
                <Text style={styles.dangerButtonText}>Clear Browsing Data</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerDescription}>
            Deletes history, cache, and cookies
          </Text>
        </View>

        {/* Section 3: General Browsing */}
        {renderSectionHeader('GENERAL BROWSING')}
        <View style={styles.section}>
          {renderSelectionRow(
            'search',
            '#F59E0B',
            'Default Search Engine',
            SEARCH_ENGINES.find(e => e.value === settings.defaultSearchEngine)?.label || 'Google',
            () => setShowSearchEngineModal(true)
          )}
          
          {renderToggleRow(
            'desktop',
            '#4ECDC4',
            'Request Desktop Site',
            'Always request desktop version of websites.',
            settings.requestDesktopSite,
            (value) => handleToggle('requestDesktopSite', value)
          )}
          
          {renderToggleRow(
            'flash',
            '#FFB800',
            'Predictive Caching',
            'Pre-load likely next pages for faster navigation.',
            settings.predictiveCaching,
            (value) => handleToggle('predictiveCaching', value)
          )}
        </View>

        {/* Reset Settings */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetSettings}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#888" />
          <Text style={styles.resetButtonText}>Reset All Settings</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>ACCESS Browser v1.0.0</Text>
          <Text style={styles.versionSubtext}>Built with AI-powered accessibility</Text>
        </View>
      </ScrollView>

      {/* Selection Modals */}
      {renderSelectionModal(
        showSearchEngineModal,
        () => setShowSearchEngineModal(false),
        'Default Search Engine',
        SEARCH_ENGINES,
        settings.defaultSearchEngine,
        (value) => updateSetting('defaultSearchEngine', value)
      )}

      {renderSelectionModal(
        showLanguageModal,
        () => setShowLanguageModal(false),
        'Captioning Language',
        CAPTIONING_LANGUAGES,
        settings.captioningLanguage,
        (value) => updateSetting('captioningLanguage', value)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  section: {
    backgroundColor: '#121212',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 3,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  dangerSection: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  dangerHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF4444',
    letterSpacing: 2,
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4444',
  },
  dangerDescription: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#888',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 8,
  },
  versionText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  versionSubtext: {
    fontSize: 11,
    color: '#444',
    marginTop: 4,
  },
  toolbarDescription: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#FFF',
  },
  modalOptionTextSelected: {
    color: '#00FF88',
    fontWeight: '600',
  },
});
