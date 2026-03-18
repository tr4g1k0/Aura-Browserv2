import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Premium color palette
const ELECTRIC_CYAN = '#00FFFF';
const DANGER_RED = '#FF4444';
const CARD_BG = '#1A1A1A';
const SURFACE_BG = '#0D0D0D';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#888888';
const TEXT_MUTED = '#555555';
const BORDER_COLOR = 'rgba(255, 255, 255, 0.08)';

/**
 * Premium Settings Screen
 * 
 * Clean, card-based design with Electric Cyan accents.
 * Currently using local state for UI testing.
 * Will be wired to AsyncStorage later.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ============================================================
  // LOCAL STATE (for UI testing - will wire to AsyncStorage later)
  // ============================================================
  
  // Engine & AI
  const [localAIAssistant, setLocalAIAssistant] = useState(true);
  
  // Privacy & Security
  const [adTrackerShield, setAdTrackerShield] = useState(true);
  const [strictDoNotTrack, setStrictDoNotTrack] = useState(false);
  
  // Display & Accessibility
  const [forceDarkWeb, setForceDarkWeb] = useState(false);
  const [forceEnableZoom, setForceEnableZoom] = useState(true);

  // ============================================================
  // HANDLERS
  // ============================================================
  
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleBurnData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // TODO: Wire to Privacy Shredder
    console.log('[Settings] Burn Browsing Data triggered');
  };

  const handleSearchEnginePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open search engine selector
    console.log('[Settings] Search Engine selector pressed');
  };

  const handleThemePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open theme selector
    console.log('[Settings] Theme selector pressed');
  };

  const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, currentValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(!currentValue);
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderCardTitle = (title: string) => (
    <Text style={styles.cardTitle}>{title}</Text>
  );

  const renderSwitchRow = (
    label: string,
    value: boolean,
    onToggle: () => void,
    subtitle?: string
  ) => (
    <View style={styles.row}>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: ELECTRIC_CYAN }}
        thumbColor="#FFF"
        ios_backgroundColor="#333"
      />
    </View>
  );

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
  // MAIN RENDER
  // ============================================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
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
        <View style={styles.card}>
          {renderCardTitle('Engine & AI')}
          
          {renderChevronRow('Default Search Engine', 'Google', handleSearchEnginePress)}
          
          <View style={styles.divider} />
          
          {renderSwitchRow(
            'Local AI Assistant',
            localAIAssistant,
            () => toggleSwitch(setLocalAIAssistant, localAIAssistant)
          )}
        </View>

        {/* ============================================================ */}
        {/* CARD 2: PRIVACY & SECURITY */}
        {/* ============================================================ */}
        <View style={styles.card}>
          {renderCardTitle('Privacy & Security')}
          
          {renderSwitchRow(
            'Ad & Tracker Shield',
            adTrackerShield,
            () => toggleSwitch(setAdTrackerShield, adTrackerShield)
          )}
          
          <View style={styles.divider} />
          
          {renderSwitchRow(
            'Strict Do Not Track',
            strictDoNotTrack,
            () => toggleSwitch(setStrictDoNotTrack, strictDoNotTrack)
          )}
          
          <View style={styles.divider} />
          
          {/* Burn Browsing Data - Danger Button */}
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleBurnData}
            activeOpacity={0.8}
          >
            <Ionicons name="flame" size={20} color={DANGER_RED} />
            <Text style={styles.dangerButtonText}>Burn Browsing Data</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* CARD 3: DISPLAY & ACCESSIBILITY */}
        {/* ============================================================ */}
        <View style={styles.card}>
          {renderCardTitle('Display & Accessibility')}
          
          {renderChevronRow('App Theme', 'System Default', handleThemePress)}
          
          <View style={styles.divider} />
          
          {renderSwitchRow(
            'Force Dark Web',
            forceDarkWeb,
            () => toggleSwitch(setForceDarkWeb, forceDarkWeb),
            'Attempts to force dark mode on all sites'
          )}
          
          <View style={styles.divider} />
          
          {renderSwitchRow(
            'Force Enable Zoom',
            forceEnableZoom,
            () => toggleSwitch(setForceEnableZoom, forceEnableZoom),
            'Override sites that block pinch-to-zoom'
          )}
        </View>

        {/* Version Footer */}
        <Text style={styles.versionText}>ACCESS Browser v1.0</Text>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE_BG,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_COLOR,
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
    color: TEXT_PRIMARY,
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
    paddingTop: 20,
  },
  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    minHeight: 48,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_PRIMARY,
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_COLOR,
    marginVertical: 4,
  },
  // Danger Button
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
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
