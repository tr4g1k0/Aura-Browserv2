import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../src/context/SettingsContext';
import { SearchEngine } from '../src/hooks/useBrowserSettings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Glossy Color Palette
const ELECTRIC_CYAN = '#00FFFF';
const DANGER_RED = '#FF4444';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#666666';
const TEXT_MUTED = '#999999';

// Search Engine Display Names
const SEARCH_ENGINE_NAMES: Record<SearchEngine, string> = {
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  bing: 'Bing',
};

/**
 * Premium Settings Screen - Glossy Glassmorphic Design
 * 
 * NOW WIRED TO GLOBAL CONTEXT:
 * - All settings persist to AsyncStorage
 * - Changes reflect immediately across the app
 * - Burn button clears browsing data
 */
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // GLOBAL SETTINGS CONTEXT - Wired to AsyncStorage
  const { settings, updateSetting, clearBrowsingData, isLoading } = useSettings();

  // Modal states for selectors
  const [showSearchEngineModal, setShowSearchEngineModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // ============================================================
  // HANDLERS
  // ============================================================
  
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleBurnData = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // Confirm before burning
    if (Platform.OS === 'web') {
      if (window.confirm('This will permanently delete all browsing history, cache, and cookies. Continue?')) {
        await performBurn();
      }
    } else {
      Alert.alert(
        'Burn Browsing Data',
        'This will permanently delete all browsing history, cache, and cookies. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Burn Everything', 
            style: 'destructive',
            onPress: performBurn
          },
        ]
      );
    }
  };

  const performBurn = async () => {
    try {
      await clearBrowsingData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (Platform.OS === 'web') {
        alert('All browsing data has been burned. You have a clean slate.');
      } else {
        Alert.alert('Success', 'All browsing data has been burned. You have a clean slate.');
      }
    } catch (error) {
      console.error('[Settings] Failed to burn data:', error);
      if (Platform.OS === 'web') {
        alert('Failed to burn browsing data. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to burn browsing data. Please try again.');
      }
    }
  };

  const handleSearchEnginePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSearchEngineModal(true);
  };

  const handleThemePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Theme is currently fixed to dark mode
    if (Platform.OS === 'web') {
      alert('Theme is currently set to Dark Mode for optimal viewing.');
    } else {
      Alert.alert('App Theme', 'Theme is currently set to Dark Mode for optimal viewing.');
    }
  };

  const handleToggle = (key: keyof typeof settings, currentValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSetting(key, !currentValue);
  };

  const handleSearchEngineChange = (engine: SearchEngine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSetting('defaultSearchEngine', engine);
    setShowSearchEngineModal(false);
  };

  // ============================================================
  // GLASSMORPHIC CARD COMPONENT
  // ============================================================
  
  const GlossyCard: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
    <View style={styles.cardOuterContainer}>
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.reflectiveEdge} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          {children}
        </View>
      </LinearGradient>
    </View>
  );

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderSwitchRow = (
    label: string,
    settingKey: keyof typeof settings,
    subtitle?: string
  ) => {
    const value = settings[settingKey] as boolean;
    return (
      <View style={styles.row}>
        <View style={styles.rowTextContainer}>
          <Text style={styles.rowLabel}>{label}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.switchContainer}>
          <Switch
            value={value}
            onValueChange={() => handleToggle(settingKey, value)}
            trackColor={{ false: 'rgba(0,0,0,0.1)', true: ELECTRIC_CYAN }}
            thumbColor={value ? '#FFFFFF' : '#F8F8F8'}
            ios_backgroundColor="rgba(0,0,0,0.1)"
            style={styles.switch}
          />
          {value && <View style={styles.switchSpecular} pointerEvents="none" />}
        </View>
      </View>
    );
  };

  const renderChevronRow = (
    label: string,
    value: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.chevronContainer}>
        <Text style={styles.chevronValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
      </View>
    </TouchableOpacity>
  );

  // ============================================================
  // SEARCH ENGINE SELECTOR MODAL
  // ============================================================
  
  const renderSearchEngineModal = () => {
    if (!showSearchEngineModal) return null;
    
    return (
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          onPress={() => setShowSearchEngineModal(false)}
          activeOpacity={1}
        />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Default Search Engine</Text>
          
          {(['google', 'duckduckgo', 'bing'] as SearchEngine[]).map((engine) => (
            <TouchableOpacity
              key={engine}
              style={[
                styles.modalOption,
                settings.defaultSearchEngine === engine && styles.modalOptionActive
              ]}
              onPress={() => handleSearchEngineChange(engine)}
            >
              <Text style={[
                styles.modalOptionText,
                settings.defaultSearchEngine === engine && styles.modalOptionTextActive
              ]}>
                {SEARCH_ENGINE_NAMES[engine]}
              </Text>
              {settings.defaultSearchEngine === engine && (
                <Ionicons name="checkmark-circle" size={22} color={ELECTRIC_CYAN} />
              )}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowSearchEngineModal(false)}
          >
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Glossy Radial Background */}
      <LinearGradient
        colors={['#E8ECF0', '#F5F7FA', '#FFFFFF', '#F0F4F8']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <View style={styles.backButtonGlass}>
            <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================ */}
        {/* CARD 1: ENGINE & AI */}
        {/* ============================================================ */}
        <GlossyCard title="Engine & AI">
          {renderChevronRow(
            'Default Search Engine', 
            SEARCH_ENGINE_NAMES[settings.defaultSearchEngine], 
            handleSearchEnginePress
          )}
          <View style={styles.divider} />
          {renderSwitchRow('Local AI Assistant', 'strictLocalAI')}
        </GlossyCard>

        {/* ============================================================ */}
        {/* CARD 2: PRIVACY & SECURITY */}
        {/* ============================================================ */}
        <GlossyCard title="Privacy & Security">
          {renderSwitchRow('Ad & Tracker Shield', 'aggressiveAdBlocking')}
          <View style={styles.divider} />
          {renderSwitchRow('Strict Do Not Track', 'doNotTrack')}
          <View style={styles.divider} />
          
          {/* Burn Browsing Data - Glossy Danger Button */}
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleBurnData}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(255,68,68,0.15)', 'rgba(255,68,68,0.25)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.dangerButtonGradient}
            >
              <Ionicons name="flame" size={20} color={DANGER_RED} />
              <Text style={styles.dangerButtonText}>Burn Browsing Data</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlossyCard>

        {/* ============================================================ */}
        {/* CARD 3: DISPLAY & ACCESSIBILITY */}
        {/* ============================================================ */}
        <GlossyCard title="Display & Accessibility">
          {renderChevronRow('App Theme', 'System Default', handleThemePress)}
          <View style={styles.divider} />
          {renderSwitchRow(
            'Force Dark Web',
            'forceDarkWeb',
            'Attempts to force dark mode on all sites'
          )}
          <View style={styles.divider} />
          {renderSwitchRow(
            'Force Enable Zoom',
            'forceZoom',
            'Override sites that block pinch-to-zoom'
          )}
        </GlossyCard>

        {/* Version Footer */}
        <Text style={styles.versionText}>Aura Browser v1.0</Text>
      </ScrollView>

      {/* Search Engine Modal */}
      {renderSearchEngineModal()}
    </View>
  );
}

// ============================================================
// GLOSSY GLASSMORPHIC STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonGlass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_DARK,
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
  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Card Styles
  cardOuterContainer: {
    marginBottom: 20,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardGradient: {
    borderRadius: 20,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255,255,255,1)',
    borderLeftColor: 'rgba(255,255,255,1)',
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderRightColor: 'rgba(0,0,0,0.05)',
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  reflectiveEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Row Styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 52,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_DARK,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  rowSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 4,
    lineHeight: 18,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Switch Container
  switchContainer: {
    position: 'relative',
  },
  switch: {
    transform: [{ scale: 0.95 }],
  },
  switchSpecular: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 7 : 4,
    right: Platform.OS === 'ios' ? 8 : 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
    }),
  },
  // Chevron Row
  chevronContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronValue: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 4,
  },
  // Danger Button
  dangerButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  dangerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DANGER_RED,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  modalOptionActive: {
    backgroundColor: 'rgba(0,255,255,0.1)',
    borderWidth: 1,
    borderColor: ELECTRIC_CYAN,
  },
  modalOptionText: {
    fontSize: 16,
    color: TEXT_DARK,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalOptionTextActive: {
    fontWeight: '600',
    color: TEXT_DARK,
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '500',
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
    color: TEXT_MUTED,
    marginTop: 20,
    letterSpacing: 0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
});
