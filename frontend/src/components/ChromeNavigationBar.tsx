import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import { useSettings } from '../context/SettingsContext';
import { useVPNConnection } from '../store/useVPNStore';
import * as Haptics from 'expo-haptics';

interface ChromeNavigationBarProps {
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onTabsPress: () => void;
  onSettingsPress: () => void;
  onLiveCaptionsPress: () => void;
  onAIAgentPress: () => void;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  liveCaptionsActive?: boolean;
  position?: 'top' | 'bottom';
}

/**
 * Chrome-style Navigation Bar with Glassmorphism
 * 
 * Features:
 * - Frosted glass effect using BlurView
 * - Back/Forward navigation with Light haptic feedback
 * - Rounded search/URL bar with dynamic shortcut icons
 * - Tab switcher with Light haptic feedback
 * - Heavy haptic feedback for system toggles (VPN, AI, Captions)
 */
export const ChromeNavigationBar: React.FC<ChromeNavigationBarProps> = ({
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onTabsPress,
  onSettingsPress,
  onLiveCaptionsPress,
  onAIAgentPress,
  currentUrl,
  canGoBack,
  canGoForward,
  liveCaptionsActive = false,
  position = 'bottom',
}) => {
  const insets = useSafeAreaInsets();
  const { tabs, isLoading } = useBrowserStore();
  const { settings } = useSettings();
  const { toggle: toggleVPN, isConnected: vpnConnected } = useVPNConnection();
  
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Toolbar shortcut visibility from settings
  const shortcuts = settings.toolbarShortcuts || {
    showLiveCaptioning: false,
    showAIAgent: false,
    showVPNToggle: false,
    showAdBlockStatus: false,
  };

  useEffect(() => {
    if (!isFocused) {
      setInputValue(currentUrl);
    }
  }, [currentUrl, isFocused]);

  const handleSubmit = () => {
    Keyboard.dismiss();
    const input = inputValue.trim();
    if (!input) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate(input);
    setIsFocused(false);
  };

  /**
   * Light Impact Haptic - for everyday navigation actions
   * Used for: Back, Forward, Tabs, Search bar tap, Settings
   */
  const handleLightPress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  /**
   * Heavy Impact Haptic - for critical system toggles
   * Used for: VPN toggle, Live Captioning toggle, AI Agent activation
   * Feels like flipping a heavy mechanical switch
   */
  const handleHeavyPress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    action();
  };

  /**
   * Handle VPN toggle with Heavy haptic feedback
   */
  const handleVPNPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await toggleVPN();
    } catch (error) {
      console.log('[ChromeNav] VPN toggle error:', error);
    }
  };

  /**
   * Handle Live Captions toggle with Heavy haptic feedback
   */
  const handleLiveCaptionsToggle = () => {
    handleHeavyPress(onLiveCaptionsPress);
  };

  /**
   * Handle AI Agent activation with Heavy haptic feedback
   */
  const handleAIAgentPress = () => {
    handleHeavyPress(onAIAgentPress);
  };

  /**
   * Handle search bar focus with Light haptic feedback
   */
  const handleSearchFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFocused(true);
    setInputValue(currentUrl);
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

  // Count active tabs
  const tabCount = tabs.length;

  // Determine padding based on position and safe area
  const containerPadding = position === 'top' 
    ? { paddingTop: insets.top + 8, paddingBottom: 12 }
    : { paddingBottom: insets.bottom + 8, paddingTop: 12 };

  // Check if any shortcuts are enabled
  const hasShortcuts = shortcuts.showLiveCaptioning || 
                       shortcuts.showAIAgent || 
                       shortcuts.showVPNToggle || 
                       shortcuts.showAdBlockStatus;

  // BlurView is not supported on web, use fallback
  const isWeb = Platform.OS === 'web';

  const renderContent = () => (
    <View style={[styles.contentWrapper, containerPadding]}>
      {/* Main Controls Row */}
      <View style={styles.mainRow}>
        {/* Back Button - Light Haptic */}
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={() => handleLightPress(onBack)}
          disabled={!canGoBack}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-back" 
            size={22} 
            color={canGoBack ? '#FFF' : '#555'} 
          />
        </TouchableOpacity>

        {/* Forward Button - Light Haptic */}
        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={() => handleLightPress(onForward)}
          disabled={!canGoForward}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-forward" 
            size={22} 
            color={canGoForward ? '#FFF' : '#555'} 
          />
        </TouchableOpacity>

        {/* Search/URL Bar - Light Haptic on focus */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
            {/* Loading or Search Icon */}
            {isLoading ? (
              <ActivityIndicator size="small" color="#00FF88" style={styles.searchIcon} />
            ) : (
              <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
            )}
            
            {/* URL Input */}
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={isFocused ? inputValue : getDisplayUrl()}
              onChangeText={setInputValue}
              onFocus={handleSearchFocus}
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

            {/* Inline Shortcut Icons */}
            {!isFocused && hasShortcuts && (
              <View style={styles.shortcutsContainer}>
                {/* Ad-Blocker Status - Light Haptic (info only) */}
                {shortcuts.showAdBlockStatus && settings.aggressiveAdBlocking && (
                  <TouchableOpacity 
                    style={styles.shortcutIcon}
                    onPress={() => handleLightPress(onSettingsPress)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="shield-checkmark" size={14} color="#00FF88" />
                  </TouchableOpacity>
                )}

                {/* VPN Toggle - Heavy Haptic (system toggle) */}
                {shortcuts.showVPNToggle && (
                  <TouchableOpacity 
                    style={[
                      styles.shortcutIcon,
                      vpnConnected && styles.shortcutIconActive,
                    ]}
                    onPress={handleVPNPress}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={vpnConnected ? "shield" : "globe-outline"} 
                      size={14} 
                      color={vpnConnected ? "#00E5FF" : "#888"} 
                    />
                  </TouchableOpacity>
                )}

                {/* Live Captioning - Heavy Haptic (system toggle) */}
                {shortcuts.showLiveCaptioning && (
                  <TouchableOpacity 
                    style={[
                      styles.shortcutIcon,
                      liveCaptionsActive && styles.shortcutIconActive,
                    ]}
                    onPress={handleLiveCaptionsToggle}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="text" 
                      size={14} 
                      color={liveCaptionsActive ? "#00FF88" : "#888"} 
                    />
                  </TouchableOpacity>
                )}

                {/* AI Agent - Heavy Haptic (system activation) */}
                {shortcuts.showAIAgent && (
                  <TouchableOpacity 
                    style={styles.shortcutIcon}
                    onPress={handleAIAgentPress}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="sparkles" size={14} color="#A78BFA" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Clear Button when focused */}
            {isFocused && inputValue.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setInputValue('');
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Switcher Button - Light Haptic */}
        <TouchableOpacity
          style={styles.tabsButton}
          onPress={() => handleLightPress(onTabsPress)}
          activeOpacity={0.7}
        >
          <View style={styles.tabsIconWrapper}>
            <View style={styles.tabsSquare}>
              <Text style={styles.tabsCount}>{tabCount > 99 ? '99+' : tabCount}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* More/Settings Button - Light Haptic */}
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => handleLightPress(onSettingsPress)}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#AAA" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Web fallback - use solid background
  if (isWeb) {
    return (
      <View style={[
        styles.webFallbackContainer,
        position === 'top' ? styles.containerTop : styles.containerBottom,
      ]}>
        {renderContent()}
      </View>
    );
  }

  // Native - use BlurView for glassmorphism
  return (
    <BlurView
      tint="dark"
      intensity={85}
      style={[
        styles.blurContainer,
        position === 'top' ? styles.containerTop : styles.containerBottom,
      ]}
    >
      {renderContent()}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  // Glassmorphism container with BlurView
  blurContainer: {
    overflow: 'hidden',
  },
  // Web fallback container
  webFallbackContainer: {
    backgroundColor: 'rgba(13, 13, 13, 0.92)',
  },
  // Position-specific styles
  containerBottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  containerTop: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Content wrapper inside blur
  contentWrapper: {
    paddingHorizontal: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Navigation buttons with subtle glass effect
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  // Search bar with frosted appearance
  searchBarContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBarFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#00FF88',
    borderWidth: 1.5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    height: '100%',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // Shortcut icons container
  shortcutsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
  },
  shortcutIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutIconActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 255, 136, 0.4)',
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Tabs button with glass effect
  tabsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  moreButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChromeNavigationBar;
