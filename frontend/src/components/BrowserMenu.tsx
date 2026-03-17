import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBrowserStore } from '../store/browserStore';

interface BrowserMenuProps {
  visible: boolean;
  onClose: () => void;
  onReadAloud: () => void;
  onStopReading: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  onNewTab: () => void;
  onShare: () => void;
  onToggleGhostMode: () => void;
  onToggleDesktopMode: () => void;
  isReading: boolean;
  isGhostMode: boolean;
  isDesktopMode: boolean;
}

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  isActive?: boolean;
  activeColor?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icon, 
  label, 
  onPress, 
  color = '#FFF',
  isActive = false,
  activeColor = '#00FF88'
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.menuItem, isActive && styles.menuItemActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuItemIcon, isActive && { backgroundColor: `${activeColor}20` }]}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={isActive ? activeColor : color} 
        />
      </View>
      <Text style={[styles.menuItemLabel, isActive && { color: activeColor }]}>
        {label}
      </Text>
      {isActive && (
        <View style={[styles.activeIndicator, { backgroundColor: activeColor }]} />
      )}
    </TouchableOpacity>
  );
};

/**
 * BrowserMenu - 3-dot menu with browser options
 * 
 * Features:
 * - Read Page Aloud (TTS)
 * - Stop Reading (when TTS active)
 * - Refresh page
 * - New Tab
 * - Share
 * - Settings
 */
export const BrowserMenu: React.FC<BrowserMenuProps> = ({
  visible,
  onClose,
  onReadAloud,
  onStopReading,
  onSettings,
  onRefresh,
  onNewTab,
  onShare,
  onToggleGhostMode,
  onToggleDesktopMode,
  isReading,
  isGhostMode,
  isDesktopMode,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  // Ghost Mode colors
  const accentColor = isGhostMode ? '#9B59B6' : '#00FF88';

  const isWeb = Platform.OS === 'web';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View style={[styles.backdropInner, { opacity: fadeAnim }]} />
      </Pressable>

      {/* Menu */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            top: insets.top + 60,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {isWeb ? (
          <View style={[styles.menuContent, isGhostMode && styles.menuContentGhost]}>
            {/* Ghost Mode Toggle - Prominent at top */}
            <MenuItem
              icon={isGhostMode ? "eye-off" : "eye-off-outline"}
              label={isGhostMode ? "Exit Ghost Mode" : "Enter Ghost Mode"}
              onPress={() => {
                onToggleGhostMode();
                handleClose();
              }}
              isActive={isGhostMode}
              activeColor="#9B59B6"
              color="#9B59B6"
            />

            <View style={styles.divider} />

            {/* TTS Read Aloud / Stop Reading */}
            {isReading ? (
              <MenuItem
                icon="stop-circle"
                label="Stop Reading"
                onPress={() => {
                  onStopReading();
                  handleClose();
                }}
                isActive={true}
                activeColor="#FF6B6B"
              />
            ) : (
              <MenuItem
                icon="volume-high"
                label="Read Page Aloud"
                onPress={() => {
                  onReadAloud();
                  handleClose();
                }}
                color="#888"
              />
            )}

            <View style={styles.divider} />

            {/* Refresh */}
            <MenuItem
              icon="refresh"
              label="Refresh Page"
              onPress={() => {
                onRefresh();
                handleClose();
              }}
              color="#888"
            />

            {/* New Tab */}
            <MenuItem
              icon="add-circle-outline"
              label="New Tab"
              onPress={() => {
                onNewTab();
                handleClose();
              }}
              color="#888"
            />

            {/* Share */}
            <MenuItem
              icon="share-outline"
              label="Share Page"
              onPress={() => {
                onShare();
                handleClose();
              }}
              color="#888"
            />

            {/* Desktop Mode Toggle */}
            <MenuItem
              icon={isDesktopMode ? "phone-portrait-outline" : "desktop-outline"}
              label={isDesktopMode ? "Request Mobile Site" : "Request Desktop Site"}
              onPress={() => {
                onToggleDesktopMode();
                handleClose();
              }}
              isActive={isDesktopMode}
              activeColor="#00E5FF"
              color="#888"
            />

            <View style={styles.divider} />

            {/* Settings */}
            <MenuItem
              icon="settings-outline"
              label="Settings"
              onPress={() => {
                onSettings();
                handleClose();
              }}
              color="#888"
            />
          </View>
        ) : (
          <BlurView tint="dark" intensity={80} style={[styles.menuContent, isGhostMode && styles.menuContentGhost]}>
            {/* Ghost Mode Toggle - Prominent at top */}
            <MenuItem
              icon={isGhostMode ? "eye-off" : "eye-off-outline"}
              label={isGhostMode ? "Exit Ghost Mode" : "Enter Ghost Mode"}
              onPress={() => {
                onToggleGhostMode();
                handleClose();
              }}
              isActive={isGhostMode}
              activeColor="#9B59B6"
              color="#9B59B6"
            />

            <View style={styles.divider} />

            {/* TTS Read Aloud / Stop Reading */}
            {isReading ? (
              <MenuItem
                icon="stop-circle"
                label="Stop Reading"
                onPress={() => {
                  onStopReading();
                  handleClose();
                }}
                isActive={true}
                activeColor="#FF6B6B"
              />
            ) : (
              <MenuItem
                icon="volume-high"
                label="Read Page Aloud"
                onPress={() => {
                  onReadAloud();
                  handleClose();
                }}
                color="#888"
              />
            )}

            <View style={styles.divider} />

            {/* Refresh */}
            <MenuItem
              icon="refresh"
              label="Refresh Page"
              onPress={() => {
                onRefresh();
                handleClose();
              }}
              color="#888"
            />

            {/* New Tab */}
            <MenuItem
              icon="add-circle-outline"
              label="New Tab"
              onPress={() => {
                onNewTab();
                handleClose();
              }}
              color="#888"
            />

            {/* Share */}
            <MenuItem
              icon="share-outline"
              label="Share Page"
              onPress={() => {
                onShare();
                handleClose();
              }}
              color="#888"
            />

            {/* Desktop Mode Toggle */}
            <MenuItem
              icon={isDesktopMode ? "phone-portrait-outline" : "desktop-outline"}
              label={isDesktopMode ? "Request Mobile Site" : "Request Desktop Site"}
              onPress={() => {
                onToggleDesktopMode();
                handleClose();
              }}
              isActive={isDesktopMode}
              activeColor="#00E5FF"
              color="#888"
            />

            <View style={styles.divider} />

            {/* Settings */}
            <MenuItem
              icon="settings-outline"
              label="Settings"
              onPress={() => {
                onSettings();
                handleClose();
              }}
              color="#888"
            />
          </BlurView>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropInner: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    right: 12,
    minWidth: 200,
    maxWidth: 280,
    zIndex: 1000,
  },
  menuContent: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {},
    }),
  },
  menuContentGhost: {
    backgroundColor: 'rgba(42, 0, 0, 0.95)',
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 6,
    marginHorizontal: 16,
  },
});

export default BrowserMenu;
