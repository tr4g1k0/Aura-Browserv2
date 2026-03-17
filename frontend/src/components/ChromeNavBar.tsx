/**
 * Chrome-Style Navigation Bar
 * 
 * Clean, minimalist toolbar with only essential items:
 * - Back/Forward navigation
 * - Central Search/URL bar
 * - Tab Switcher
 * 
 * Optional quick action icons based on user settings.
 * Supports top or bottom positioning.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import { useVPNStore, useVPNConnection } from '../store/useVPNStore';
import { ToolbarShortcuts } from '../hooks/useBrowserSettings';
import * as Haptics from 'expo-haptics';

interface ChromeNavBarProps {
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onTabsPress: () => void;
  onSettingsPress: () => void;
  onLiveCaptionsToggle?: () => void;
  onAIAgentPress?: () => void;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  toolbarShortcuts: ToolbarShortcuts;
  liveCaptionsActive?: boolean;
  position?: 'top' | 'bottom';
}

// VPN Status Colors
const VPN_COLORS = {
  disconnected: '#666666',
  connecting: '#FFB800',
  connected: '#00E5FF',
  disconnecting: '#FFB800',
  error: '#FF4444',
};

export const ChromeNavBar: React.FC<ChromeNavBarProps> = ({
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onTabsPress,
  onSettingsPress,
  onLiveCaptionsToggle,
  onAIAgentPress,
  currentUrl,
  canGoBack,
  canGoForward,
  toolbarShortcuts,
  liveCaptionsActive = false,
  position = 'bottom',
}) => {
  const insets = useSafeAreaInsets();
  const { tabs, isLoading, settings } = useBrowserStore();
  const vpnConnection = useVPNConnection();
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
  // Animation for quick actions
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize VPN store
  useEffect(() => {
    useVPNStore.getState().initialize();
  }, []);

  // Sync input with current URL when not focused
  useEffect(() => {
    if (!isFocused) {
      setInputValue(currentUrl);
    }
  }, [currentUrl, isFocused]);

  // Pulse animation for active captions
  useEffect(() => {
    if (liveCaptionsActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [liveCaptionsActive]);

  const handleSubmit = () => {
    Keyboard.dismiss();
    const input = inputValue.trim();
    if (!input) return;
    onNavigate(input);
    setIsFocused(false);
  };

  const handleButtonPress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  const getDisplayUrl = () => {
    if (isFocused) return inputValue;
    try {
      const url = new URL(currentUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return currentUrl;
    }
  };

  const handleVPNToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await vpnConnection.toggle();
    } catch (error) {
      console.log('[ChromeNavBar] VPN toggle error:', error);
    }
  };

  // Count visible shortcuts
  const visibleShortcutsCount = Object.values(toolbarShortcuts).filter(Boolean).length;

  return (
    <View
      style={[
        styles.container,
        position === 'top' 
          ? { paddingTop: insets.top + 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }
          : { paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
      ]}
    >
      {/* Quick Actions Row (if any shortcuts enabled) */}
      {visibleShortcutsCount > 0 && (
        <View style={styles.quickActionsRow}>
          {/* Live Captioning */}
          {toolbarShortcuts.showLiveCaptioning && (
            <Animated.View style={{ transform: [{ scale: liveCaptionsActive ? pulseAnim : 1 }] }}>
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  liveCaptionsActive && styles.quickActionButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onLiveCaptionsToggle?.();
                }}
              >
                <Feather 
                  name="type" 
                  size={16} 
                  color={liveCaptionsActive ? '#00FF88' : '#888'} 
                />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* AI Agent */}
          {toolbarShortcuts.showAIAgent && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAIAgentPress?.();
              }}
            >
              <Feather name="cpu" size={16} color="#888" />
            </TouchableOpacity>
          )}

          {/* VPN Toggle */}
          {toolbarShortcuts.showVPNToggle && (
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                vpnConnection.isConnected && styles.quickActionButtonVPN,
              ]}
              onPress={handleVPNToggle}
            >
              <Feather 
                name="globe" 
                size={16} 
                color={VPN_COLORS[vpnConnection.state] || '#888'} 
              />
            </TouchableOpacity>
          )}

          {/* Ad-Block Status */}
          {toolbarShortcuts.showAdBlockStatus && (
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                settings.adblockEnabled && styles.quickActionButtonActive,
              ]}
              onPress={() => handleButtonPress(onSettingsPress)}
            >
              <Feather 
                name="shield" 
                size={16} 
                color={settings.adblockEnabled ? '#00FF88' : '#888'} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Toolbar */}
      <View style={styles.mainToolbar}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={() => handleButtonPress(onBack)}
          disabled={!canGoBack}
          activeOpacity={0.6}
        >
          <Feather name="chevron-left" size={22} color={canGoBack ? '#FFF' : '#444'} />
        </TouchableOpacity>

        {/* Forward Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={() => handleButtonPress(onForward)}
          disabled={!canGoForward}
          activeOpacity={0.6}
        >
          <Feather name="chevron-right" size={22} color={canGoForward ? '#FFF' : '#444'} />
        </TouchableOpacity>

        {/* Search/URL Bar - Chrome Style */}
        <View style={styles.searchContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#00FF88" style={styles.searchIcon} />
          ) : (
            <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
          )}
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={isFocused ? inputValue : getDisplayUrl()}
            onChangeText={setInputValue}
            onFocus={() => {
              setIsFocused(true);
              setInputValue(currentUrl);
            }}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={handleSubmit}
            placeholder="Search or enter URL"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {isFocused && inputValue.length > 0 && (
            <TouchableOpacity
              onPress={() => setInputValue('')}
              style={styles.clearButton}
            >
              <Feather name="x" size={16} color="#666" />
            </TouchableOpacity>
          )}
          {!isFocused && (
            <TouchableOpacity
              onPress={() => handleButtonPress(onRefresh)}
              style={styles.refreshButton}
            >
              <Feather name="refresh-cw" size={14} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Switcher */}
        <TouchableOpacity
          style={styles.tabsButton}
          onPress={() => handleButtonPress(onTabsPress)}
          activeOpacity={0.6}
        >
          <View style={styles.tabsIconContainer}>
            <View style={styles.tabsSquare}>
              <Feather name="square" size={16} color="#FFF" />
            </View>
            {tabs.length > 1 && (
              <View style={styles.tabCountBadge}>
                <Ionicons name="ellipse" size={8} color="#00FF88" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Settings (minimal) */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => handleButtonPress(onSettingsPress)}
          activeOpacity={0.6}
        >
          <Feather name="more-vertical" size={18} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 12,
  },
  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 12,
  },
  quickActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButtonActive: {
    backgroundColor: '#1A2A1A',
    borderWidth: 1,
    borderColor: '#00FF8840',
  },
  quickActionButtonVPN: {
    backgroundColor: '#1A2A2A',
    borderWidth: 1,
    borderColor: '#00E5FF40',
  },
  // Main Toolbar
  mainToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  // Chrome-style Search Bar
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 25,
    height: 44,
    paddingHorizontal: 14,
    marginHorizontal: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  refreshButton: {
    padding: 6,
    marginLeft: 4,
  },
  tabsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsIconContainer: {
    position: 'relative',
  },
  tabsSquare: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChromeNavBar;
