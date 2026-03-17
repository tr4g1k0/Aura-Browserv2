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
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import { useSettings } from '../context/SettingsContext';
import { useVPNConnection, useVPNStore } from '../store/useVPNStore';
import * as Haptics from 'expo-haptics';

interface UnifiedTopBarProps {
  onNavigate: (url: string) => void;
  onTabsPress: () => void;
  onSettingsPress: () => void;
  onAccessibilityPress: () => void;
  onLibraryPress: () => void;
  currentUrl: string;
  currentTitle: string;
}

/**
 * Unified Top Bar - Single sleek row combining all browser controls
 * 
 * Layout (left to right):
 * 1. Shield Icon (Adblock/Privacy status)
 * 2. URL/Search Input (flex: 1, fills available space)
 * 3. Bookmark Star Icon (Electric Cyan when bookmarked)
 * 4. Tab Counter Button
 * 5. Library Icon (Bookmarks & History)
 * 6. 3-Dot Menu
 * 
 * Features:
 * - Minimal vertical footprint
 * - Glassmorphism with BlurView
 * - No back/forward arrows (cleaner look)
 * - No ACCESS text title
 */
export const UnifiedTopBar: React.FC<UnifiedTopBarProps> = ({
  onNavigate,
  onTabsPress,
  onSettingsPress,
  onAccessibilityPress,
  onLibraryPress,
  currentUrl,
  currentTitle,
}) => {
  const insets = useSafeAreaInsets();
  const { 
    tabs,
    ghostTabs,
    isGhostMode, 
    isLoading, 
    settings: browserSettings, 
    toggleAdblock,
    isBookmarked,
    toggleBookmark,
    addToHistory,
  } = useBrowserStore();
  const { settings } = useSettings();
  const { isConnected: vpnConnected, isConnecting, state: vpnState } = useVPNConnection();

  // Get current tabs based on Ghost Mode
  const currentTabs = isGhostMode ? ghostTabs : tabs;
  const tabCount = currentTabs.length;

  // Ghost Mode color theme - Deep Crimson (#2A0000) for visual feedback
  const colors = {
    accent: isGhostMode ? '#9B59B6' : '#00FF88',
    accentSecondary: isGhostMode ? '#8E44AD' : '#00E5FF',
    searchBackground: isGhostMode ? '#2A0000' : '#1A1A1A',
    borderColor: isGhostMode ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    barBackground: isGhostMode ? 'rgba(42, 0, 0, 0.95)' : 'rgba(13, 13, 13, 0.95)',
  };
  
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize VPN store
  useEffect(() => {
    useVPNStore.getState().initialize();
  }, []);

  // Pulse animation for shield when adblock is active
  useEffect(() => {
    if (isConnecting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    }
  }, [isConnecting]);

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

  const handleSearchFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFocused(true);
    setInputValue(currentUrl);
  };

  const handleShieldPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    toggleAdblock();
  };

  const getDisplayUrl = () => {
    if (isFocused) return inputValue;
    if (!currentUrl || currentUrl === 'about:blank' || currentUrl === 'about:newtab') {
      return '';
    }
    try {
      const url = new URL(currentUrl);
      return url.hostname.replace('www.', '');
    } catch {
      return currentUrl;
    }
  };

  // Determine shield state - shows privacy/adblock status
  const isProtected = browserSettings.adblockEnabled || vpnConnected || isGhostMode;
  const shieldColor = isGhostMode ? '#9B59B6' : vpnConnected ? '#00E5FF' : browserSettings.adblockEnabled ? '#00FF88' : '#555';

  const isWeb = Platform.OS === 'web';

  const renderContent = () => (
    <View style={[styles.contentWrapper, { paddingTop: insets.top + 6 }]}>
      <View style={styles.mainRow}>
        {/* Shield Icon - Privacy/Adblock Status */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            isProtected && styles.iconButtonActive,
          ]}
          onPress={handleShieldPress}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: isConnecting ? pulseAnim : 1 }] }}>
            <Ionicons 
              name={isProtected ? "shield-checkmark" : "shield-outline"} 
              size={20} 
              color={shieldColor} 
            />
          </Animated.View>
          {isProtected && <View style={[styles.statusDot, { backgroundColor: shieldColor }]} />}
        </TouchableOpacity>

        {/* URL/Search Input - Takes all available space */}
        <View style={styles.searchContainer}>
          <View style={[
            styles.searchBar, 
            { backgroundColor: colors.searchBackground },
            isFocused && [styles.searchBarFocused, { borderColor: colors.accent }]
          ]}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.searchIcon} />
            ) : (
              <Ionicons 
                name={isGhostMode ? "eye-off-outline" : "search"} 
                size={16} 
                color={isFocused ? colors.accent : '#666'} 
                style={styles.searchIcon} 
              />
            )}
            
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={isFocused ? inputValue : getDisplayUrl()}
              onChangeText={setInputValue}
              onFocus={handleSearchFocus}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={handleSubmit}
              placeholder="Search or enter URL"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
            />

            {isFocused && inputValue.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setInputValue('');
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={16} color="#555" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bookmark Star Icon - Electric Cyan when bookmarked */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            isBookmarked(currentUrl) && styles.bookmarkActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleBookmark(currentUrl, currentTitle);
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isBookmarked(currentUrl) ? "star" : "star-outline"} 
            size={20} 
            color={isBookmarked(currentUrl) ? "#00E5FF" : "#888"} 
          />
        </TouchableOpacity>

        {/* Toolbar Shortcuts - Conditionally rendered based on settings */}
        {settings.toolbarShortcuts?.showLiveCaptioning && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onAccessibilityPress();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="mic" size={18} color="#00FF88" />
          </TouchableOpacity>
        )}

        {settings.toolbarShortcuts?.showAIAgent && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              // AI Agent action
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={18} color="#FFD700" />
          </TouchableOpacity>
        )}

        {settings.toolbarShortcuts?.showVPNToggle && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              // VPN toggle action - toggle via store
              useVPNStore.getState().toggle();
            }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={vpnConnected ? "shield" : "shield-outline"} 
              size={18} 
              color={vpnConnected ? "#00E5FF" : "#888"} 
            />
          </TouchableOpacity>
        )}

        {settings.toolbarShortcuts?.showAdBlockStatus && (
          <View style={styles.iconButton}>
            <Ionicons name="ban" size={16} color={browserSettings.adblockEnabled ? "#FF6B6B" : "#555"} />
          </View>
        )}

        {/* Tab Counter Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTabsPress();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.tabSquare}>
            <Text style={styles.tabCount}>{tabCount > 99 ? '∞' : tabCount}</Text>
          </View>
        </TouchableOpacity>

        {/* Library Icon (Bookmarks & History) */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLibraryPress();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="library-outline" size={20} color="#888" />
        </TouchableOpacity>

        {/* 3-Dot Menu */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSettingsPress();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Web fallback - no BlurView
  if (isWeb) {
    return (
      <View style={[styles.webContainer, { backgroundColor: colors.barBackground }]}>
        {renderContent()}
      </View>
    );
  }

  // Native - use BlurView for glassmorphism
  return (
    <BlurView tint={isGhostMode ? "default" : "dark"} intensity={80} style={[styles.blurContainer, isGhostMode && styles.blurContainerGhost]}>
      {renderContent()}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  // Containers
  blurContainer: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurContainerGhost: {
    backgroundColor: 'rgba(42, 0, 0, 0.5)',
    borderBottomColor: 'rgba(155, 89, 182, 0.3)',
  },
  webContainer: {
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contentWrapper: {
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  // Main row layout
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Icon buttons - consistent sizing
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  bookmarkActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // Search bar - expands to fill space
  searchContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 10,
  },
  searchBarFocused: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.5)',
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
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Tab counter
  tabSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
  },
  // Menu button - slightly narrower
  menuButton: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default UnifiedTopBar;
