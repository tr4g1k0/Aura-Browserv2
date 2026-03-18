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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Glossy Color Palette
const ELECTRIC_CYAN = '#00FFFF';
const DANGER_RED = '#FF4444';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#666666';
const TEXT_MUTED = '#999999';

/**
 * Premium Settings Screen - Glossy Glassmorphic Design
 * 
 * Features:
 * - Radial gradient background for depth
 * - Opalescent glass cards with LinearGradient
 * - Reflective top/left edge highlights
 * - Deep glossy shadows
 * - Electric Cyan accent switches
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
    console.log('[Settings] Burn Browsing Data triggered');
  };

  const handleSearchEnginePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Settings] Search Engine selector pressed');
  };

  const handleThemePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Settings] Theme selector pressed');
  };

  const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, currentValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(!currentValue);
  };

  // ============================================================
  // GLASSMORPHIC CARD COMPONENT
  // ============================================================
  
  const GlossyCard: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
    <View style={styles.cardOuterContainer}>
      {/* Opalescent Glass Background */}
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Reflective Edge Highlight */}
        <View style={styles.reflectiveEdge} />
        
        {/* Card Content */}
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
    value: boolean,
    onToggle: () => void,
    subtitle?: string
  ) => (
    <View style={styles.row}>
      <View style={styles.rowTextContainer}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {/* Glossy Switch with Specular Thumb */}
      <View style={styles.switchContainer}>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(0,0,0,0.1)', true: ELECTRIC_CYAN }}
          thumbColor={value ? '#FFFFFF' : '#F8F8F8'}
          ios_backgroundColor="rgba(0,0,0,0.1)"
          style={styles.switch}
        />
        {/* Specular highlight overlay on thumb (visual only) */}
        {value && <View style={styles.switchSpecular} pointerEvents="none" />}
      </View>
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
    <View style={styles.container}>
      {/* Glossy Radial Background */}
      <LinearGradient
        colors={['#E8ECF0', '#F5F7FA', '#FFFFFF', '#F0F4F8']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Subtle Radial Overlay for Depth */}
      <View style={styles.radialOverlay} />

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
          {renderChevronRow('Default Search Engine', 'Google', handleSearchEnginePress)}
          <View style={styles.divider} />
          {renderSwitchRow(
            'Local AI Assistant',
            localAIAssistant,
            () => toggleSwitch(setLocalAIAssistant, localAIAssistant)
          )}
        </GlossyCard>

        {/* ============================================================ */}
        {/* CARD 2: PRIVACY & SECURITY */}
        {/* ============================================================ */}
        <GlossyCard title="Privacy & Security">
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
        </GlossyCard>

        {/* Version Footer */}
        <Text style={styles.versionText}>ACCESS Browser v1.0</Text>
      </ScrollView>
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
  // Radial Overlay for Depth Effect
  radialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated radial gradient using opacity
    opacity: 0.3,
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
  // ============================================================
  // GLOSSY CARD STYLES
  // ============================================================
  cardOuterContainer: {
    marginBottom: 20,
    borderRadius: 20,
    // Deep Glossy Shadows
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
    // Reflective Edge - Top and Left highlight
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
    // Text shadow for glossy effect
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  // Switch Container for Specular Effect
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
    // Specular highlight glow
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
