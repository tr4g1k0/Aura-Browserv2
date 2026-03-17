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
 * Chrome-style Navigation Bar
 * A clean, minimalist toolbar with:
 * - Back/Forward navigation
 * - Rounded search/URL bar with dynamic shortcut icons
 * - Tab switcher
 * 
 * Shortcut icons are dynamically rendered based on user settings
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
    onNavigate(input);
    setIsFocused(false);
  };

  const handleButtonPress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  const handleVPNPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await toggleVPN();
    } catch (error) {
      console.log('[ChromeNav] VPN toggle error:', error);
    }
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

  // Determine padding based on position
  const containerPadding = position === 'top' 
    ? { paddingTop: insets.top + 8, paddingBottom: 12 }
    : { paddingBottom: insets.bottom + 8, paddingTop: 12 };

  // Check if any shortcuts are enabled
  const hasShortcuts = shortcuts.showLiveCaptioning || 
                       shortcuts.showAIAgent || 
                       shortcuts.showVPNToggle || 
                       shortcuts.showAdBlockStatus;

  return (
    <View style={[
      styles.container, 
      containerPadding,
      position === 'top' && styles.containerTop,
    ]}>
      {/* Main Controls Row */}
      <View style={styles.mainRow}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={() => handleButtonPress(onBack)}
          disabled={!canGoBack}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-back" 
            size={22} 
            color={canGoBack ? '#FFF' : '#444'} 
          />
        </TouchableOpacity>

        {/* Forward Button */}
        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={() => handleButtonPress(onForward)}
          disabled={!canGoForward}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-forward" 
            size={22} 
            color={canGoForward ? '#FFF' : '#444'} 
          />
        </TouchableOpacity>

        {/* Search/URL Bar */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
            {/* Loading or Search Icon */}
            {isLoading ? (
              <ActivityIndicator size="small" color="#00FF88" style={styles.searchIcon} />
            ) : (
              <Ionicons name="search" size={16} color="#666" style={styles.searchIcon} />
            )}
            
            {/* URL Input */}
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

            {/* Inline Shortcut Icons */}
            {!isFocused && hasShortcuts && (
              <View style={styles.shortcutsContainer}>
                {/* Ad-Blocker Status */}
                {shortcuts.showAdBlockStatus && settings.aggressiveAdBlocking && (
                  <TouchableOpacity 
                    style={styles.shortcutIcon}
                    onPress={() => handleButtonPress(onSettingsPress)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="shield-checkmark" size={14} color="#00FF88" />
                  </TouchableOpacity>
                )}

                {/* VPN Toggle */}
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

                {/* Live Captioning */}
                {shortcuts.showLiveCaptioning && (
                  <TouchableOpacity 
                    style={[
                      styles.shortcutIcon,
                      liveCaptionsActive && styles.shortcutIconActive,
                    ]}
                    onPress={() => handleButtonPress(onLiveCaptionsPress)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="text" 
                      size={14} 
                      color={liveCaptionsActive ? "#00FF88" : "#888"} 
                    />
                  </TouchableOpacity>
                )}

                {/* AI Agent */}
                {shortcuts.showAIAgent && (
                  <TouchableOpacity 
                    style={styles.shortcutIcon}
                    onPress={() => handleButtonPress(onAIAgentPress)}
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
                onPress={() => setInputValue('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Switcher Button */}
        <TouchableOpacity
          style={styles.tabsButton}
          onPress={() => handleButtonPress(onTabsPress)}
          activeOpacity={0.7}
        >
          <View style={styles.tabsIconWrapper}>
            <View style={styles.tabsSquare}>
              <Text style={styles.tabsCount}>{tabCount > 99 ? '99+' : tabCount}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* More/Settings Button */}
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => handleButtonPress(onSettingsPress)}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingHorizontal: 8,
  },
  containerTop: {
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  searchBarContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    height: 44,
    paddingHorizontal: 14,
  },
  searchBarFocused: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#00FF88',
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
  shortcutsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#333',
  },
  shortcutIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutIconActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  tabsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
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
