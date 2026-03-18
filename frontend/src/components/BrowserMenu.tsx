import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium Glossy Color Palette
const ELECTRIC_CYAN = '#00FFFF';
const ELECTRIC_CYAN_GLOW = 'rgba(0, 255, 255, 0.3)';
const DANGER_RED = '#FF4444';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#555555';
const GOLD = '#FFD700';
const GOLD_GLOW = 'rgba(255, 215, 0, 0.3)';

interface BrowserMenuProps {
  visible: boolean;
  onClose: () => void;
  isBookmarked?: boolean;
  isDesktopMode?: boolean;
}

/**
 * Premium Glossy Glassmorphic Command Center
 * 
 * Visual Features:
 * - Opalescent glass container with deep milky gradient
 * - Stark white reflective edge highlights
 * - Deep realistic shadows for 3D depth
 * - Polished glass buttons with internal shadows
 * - Electric Cyan glow accents on active states
 */
export const BrowserMenu: React.FC<BrowserMenuProps> = ({
  visible,
  onClose,
  isBookmarked = false,
  isDesktopMode = false,
}) => {
  const insets = useSafeAreaInsets();

  const handlePress = (action: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`[Menu] ${action} pressed`);
    onClose();
  };

  const handleDangerPress = (action: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    console.log(`[Menu] ${action} pressed`);
    onClose();
  };

  // ============================================================
  // GLOSSY GLASS BUTTON - Polished look with internal shadows
  // ============================================================
  const GlassButton: React.FC<{
    icon: string;
    label: string;
    onPress: () => void;
    isActive?: boolean;
    activeColor?: string;
    glowColor?: string;
  }> = ({ icon, label, onPress, isActive = false, activeColor = ELECTRIC_CYAN, glowColor = ELECTRIC_CYAN_GLOW }) => (
    <TouchableOpacity
      style={styles.glassButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Glass Button with Gradient */}
      <View style={[
        styles.glassButtonOuter,
        isActive && { borderColor: activeColor }
      ]}>
        <LinearGradient
          colors={
            isActive 
              ? [`${activeColor}15`, `${activeColor}25`]
              : ['rgba(255,255,255,0.9)', 'rgba(240,240,240,0.95)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.glassButtonGradient}
        >
          {/* Inner highlight for polished glass effect */}
          <View style={styles.glassButtonHighlight} />
          
          {/* Icon with potential glow */}
          <View style={[
            styles.glassButtonIconWrapper,
            isActive && { 
              ...Platform.select({
                ios: {
                  shadowColor: activeColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                },
              })
            }
          ]}>
            <Ionicons
              name={icon as any}
              size={22}
              color={isActive ? activeColor : TEXT_SECONDARY}
            />
          </View>
        </LinearGradient>
      </View>
      
      {/* Label */}
      <Text style={[
        styles.glassButtonLabel,
        isActive && { color: activeColor, fontWeight: '600' }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // MENU ROW - Smart Tools & Navigation
  // ============================================================
  const MenuRow: React.FC<{
    icon: string;
    label: string;
    onPress: () => void;
    isDanger?: boolean;
    emoji?: string;
  }> = ({ icon, label, onPress, isDanger = false, emoji }) => (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.menuRowIconContainer,
        isDanger && styles.menuRowIconContainerDanger
      ]}>
        {emoji ? (
          <Text style={styles.menuEmoji}>{emoji}</Text>
        ) : (
          <Ionicons
            name={icon as any}
            size={18}
            color={isDanger ? DANGER_RED : TEXT_SECONDARY}
          />
        )}
      </View>
      <Text style={[
        styles.menuLabel,
        isDanger && styles.menuLabelDanger
      ]}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={isDanger ? 'rgba(255,68,68,0.5)' : 'rgba(0,0,0,0.2)'}
      />
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop with subtle blur effect simulation */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Glossy Glassmorphic Command Center */}
      <View style={[styles.menuContainer, { top: insets.top + 56 }]}>
        {/* Deep Shadow Layer */}
        <View style={styles.shadowLayer} />
        
        {/* Opalescent Glass Panel */}
        <LinearGradient
          colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.92)', 'rgba(250,250,250,0.95)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.menuGradient}
        >
          {/* Reflective Edge - Stark White Highlight */}
          <View style={styles.reflectiveEdgeTop} />
          <View style={styles.reflectiveEdgeLeft} />
          
          {/* Subtle inner glow */}
          <View style={styles.innerGlow} />

          {/* ============================================================ */}
          {/* ZONE 1: QUICK ACTION GRID - Polished Glass Buttons */}
          {/* ============================================================ */}
          <View style={styles.quickActionsContainer}>
            <GlassButton
              icon="share-outline"
              label="Share"
              onPress={() => handlePress('Share')}
            />
            <GlassButton
              icon={isBookmarked ? "star" : "star-outline"}
              label="Bookmark"
              onPress={() => handlePress('Bookmark')}
              isActive={isBookmarked}
              activeColor={GOLD}
              glowColor={GOLD_GLOW}
            />
            <GlassButton
              icon="search-outline"
              label="Find"
              onPress={() => handlePress('Find in Page')}
            />
            <GlassButton
              icon={isDesktopMode ? "desktop" : "desktop-outline"}
              label="Desktop"
              onPress={() => handlePress('Desktop Mode')}
              isActive={isDesktopMode}
            />
          </View>

          {/* Glossy Divider */}
          <View style={styles.dividerContainer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerGradient}
            />
          </View>

          {/* ============================================================ */}
          {/* ZONE 2: SMART TOOLS */}
          {/* ============================================================ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMART TOOLS</Text>
            <MenuRow
              emoji="✨"
              icon=""
              label="AI Summarize"
              onPress={() => handlePress('AI Summarize')}
            />
            <MenuRow
              emoji="📖"
              icon=""
              label="Reader Mode"
              onPress={() => handlePress('Reader Mode')}
            />
            <MenuRow
              emoji="🔥"
              icon=""
              label="Burn This Site"
              onPress={() => handleDangerPress('Burn This Site')}
              isDanger
            />
          </View>

          {/* Glossy Divider */}
          <View style={styles.dividerContainer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerGradient}
            />
          </View>

          {/* ============================================================ */}
          {/* ZONE 3: NAVIGATION GATEWAYS */}
          {/* ============================================================ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NAVIGATE</Text>
            <MenuRow
              icon="time-outline"
              label="History"
              onPress={() => handlePress('History')}
            />
            <MenuRow
              icon="download-outline"
              label="Downloads"
              onPress={() => handlePress('Downloads')}
            />
            <MenuRow
              icon="settings-outline"
              label="Settings"
              onPress={() => handlePress('Settings')}
            />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// ============================================================
// PREMIUM GLOSSY GLASSMORPHIC STYLES
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  // ============================================================
  // MAIN CONTAINER - Deep Shadows & Positioning
  // ============================================================
  menuContainer: {
    position: 'absolute',
    right: 12,
    width: SCREEN_WIDTH * 0.72,
    maxWidth: 300,
    borderRadius: 20,
    overflow: 'visible',
  },
  shadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    // Deep glossy shadows for realistic depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  menuGradient: {
    borderRadius: 20,
    overflow: 'hidden',
    // Subtle outer border
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  // ============================================================
  // REFLECTIVE EDGES - Stark White Highlights
  // ============================================================
  reflectiveEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    zIndex: 10,
  },
  reflectiveEdgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
  },
  // ============================================================
  // ZONE 1: GLASS BUTTON GRID
  // ============================================================
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  glassButtonContainer: {
    alignItems: 'center',
    width: 60,
  },
  glassButtonOuter: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    // Inner shadow simulation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  glassButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glassButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  glassButtonIconWrapper: {
    zIndex: 1,
  },
  glassButtonLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // ============================================================
  // DIVIDER - Glossy gradient divider
  // ============================================================
  dividerContainer: {
    paddingHorizontal: 16,
    height: 1,
  },
  dividerGradient: {
    flex: 1,
  },
  // ============================================================
  // SECTIONS
  // ============================================================
  section: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // ============================================================
  // MENU ROW
  // ============================================================
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuRowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuRowIconContainerDanger: {
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  menuEmoji: {
    fontSize: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_DARK,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  menuLabelDanger: {
    color: DANGER_RED,
    fontWeight: '600',
  },
});

export default BrowserMenu;
