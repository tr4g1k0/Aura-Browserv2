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

// Premium color palette
const ELECTRIC_CYAN = '#00FFFF';
const DANGER_RED = '#FF4444';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#666666';
const GOLD = '#FFD700';

interface BrowserMenuProps {
  visible: boolean;
  onClose: () => void;
  // Props for state display (UI only for now)
  isBookmarked?: boolean;
  isDesktopMode?: boolean;
}

/**
 * Premium Glassmorphic Action Menu
 * 
 * Visual Layout:
 * - Zone 1: Quick Action Grid (Share, Bookmark, Find, Desktop)
 * - Zone 2: Smart Tools (AI Summarize, Reader Mode, Burn This Site)
 * - Zone 3: Navigation Gateways (History, Downloads, Settings)
 * 
 * Currently: UI-only, all actions close the modal
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
  // QUICK ACTION ICON BUTTON
  // ============================================================
  const QuickActionButton: React.FC<{
    icon: string;
    label: string;
    onPress: () => void;
    isActive?: boolean;
    activeColor?: string;
  }> = ({ icon, label, onPress, isActive = false, activeColor = ELECTRIC_CYAN }) => (
    <TouchableOpacity
      style={styles.quickActionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.quickActionIconContainer,
        isActive && { backgroundColor: `${activeColor}20` }
      ]}>
        <Ionicons
          name={icon as any}
          size={22}
          color={isActive ? activeColor : TEXT_SECONDARY}
        />
      </View>
      <Text style={[
        styles.quickActionLabel,
        isActive && { color: activeColor }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // MENU ROW ITEM
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
      {emoji ? (
        <Text style={styles.menuEmoji}>{emoji}</Text>
      ) : (
        <Ionicons
          name={icon as any}
          size={20}
          color={isDanger ? DANGER_RED : TEXT_SECONDARY}
          style={styles.menuIcon}
        />
      )}
      <Text style={[
        styles.menuLabel,
        isDanger && styles.menuLabelDanger
      ]}>
        {label}
      </Text>
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
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Glassmorphic Menu Container */}
      <View style={[styles.menuContainer, { top: insets.top + 56 }]}>
        {/* Opalescent Glass Background */}
        <LinearGradient
          colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.menuGradient}
        >
          {/* Reflective Edge Highlight */}
          <View style={styles.reflectiveEdgeTop} />
          <View style={styles.reflectiveEdgeLeft} />

          {/* ============================================================ */}
          {/* ZONE 1: QUICK ACTION GRID */}
          {/* ============================================================ */}
          <View style={styles.quickActionsContainer}>
            <QuickActionButton
              icon="share-outline"
              label="Share"
              onPress={() => handlePress('Share')}
            />
            <QuickActionButton
              icon={isBookmarked ? "star" : "star-outline"}
              label="Bookmark"
              onPress={() => handlePress('Bookmark')}
              isActive={isBookmarked}
              activeColor={GOLD}
            />
            <QuickActionButton
              icon="search-outline"
              label="Find"
              onPress={() => handlePress('Find in Page')}
            />
            <QuickActionButton
              icon={isDesktopMode ? "desktop" : "desktop-outline"}
              label="Desktop"
              onPress={() => handlePress('Desktop Mode')}
              isActive={isDesktopMode}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* ============================================================ */}
          {/* ZONE 2: SMART TOOLS */}
          {/* ============================================================ */}
          <View style={styles.section}>
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

          {/* Divider */}
          <View style={styles.divider} />

          {/* ============================================================ */}
          {/* ZONE 3: NAVIGATION GATEWAYS */}
          {/* ============================================================ */}
          <View style={styles.section}>
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
// GLASSMORPHIC STYLES
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  // Menu Container - Floating near top right
  menuContainer: {
    position: 'absolute',
    right: 12,
    width: SCREEN_WIDTH * 0.65,
    maxWidth: 280,
    borderRadius: 16,
    overflow: 'hidden',
    // Deep Glossy Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  menuGradient: {
    borderRadius: 16,
    overflow: 'hidden',
    // Subtle border for the glass effect
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  // Reflective Edge Highlights
  reflectiveEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  reflectiveEdgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  // ============================================================
  // ZONE 1: QUICK ACTIONS
  // ============================================================
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  quickActionButton: {
    alignItems: 'center',
    minWidth: 56,
  },
  quickActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
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
  // DIVIDER
  // ============================================================
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 16,
  },
  // ============================================================
  // MENU SECTIONS
  // ============================================================
  section: {
    paddingVertical: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIcon: {
    width: 28,
    textAlign: 'center',
    marginRight: 12,
  },
  menuEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_DARK,
    flex: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  menuLabelDanger: {
    color: DANGER_RED,
  },
});

export default BrowserMenu;
