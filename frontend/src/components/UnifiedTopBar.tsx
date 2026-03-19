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

// Premium color palette
const ELECTRIC_CYAN = '#00FFFF';
const AI_GOLD = '#FFD700';
const MUTED_GRAY = '#666666';
const INACTIVE_GRAY = '#888888';

interface UnifiedTopBarProps {
  onNavigate: (url: string) => void;
  onTabsPress: () => void;
  onSettingsPress: () => void;
  onAccessibilityPress: () => void;
  onLibraryPress: () => void;
  onShare?: () => void;
  currentUrl: string;
  currentTitle: string;
}

/**
 * Unified Navigation Bar - Premium 5-Icon Layout
 * 
 * THE CORE 5 (left to right):
 * 1. Search/Home (magnifying glass or house when on new tab)
 * 2. Library (History & Bookmarks)
 * 3. AI Agent (Sparkles - CENTER, slightly larger)
 * 4. Tabs ([n] square)
 * 5. Menu (⋮)
 * 
 * REMOVED from bar (moved to Menu):
 * - Share
 * - Bookmark Star
 * - Shield (Security Status)
 * 
 * Features:
 * - Clean floating glyphs (no background circles)
 * - Uniform muted gray icons, Electric Cyan when active
 * - AI Agent icon keeps distinct gold accent
 * - Glassmorphism with BlurView
 */
export const UnifiedTopBar: React.FC<UnifiedTopBarProps> = ({
  onNavigate,
  onTabsPress,
  onSettingsPress,
  onAccessibilityPress,
  onLibraryPress,
  onShare,
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
    isBookmarked,
  } = useBrowserStore();
  const { settings } = useSettings();
  const { isConnected: vpnConnected, isConnecting } = useVPNConnection();

  // Get current tabs based on Ghost Mode
  const currentTabs = isGhostMode ? ghostTabs : tabs;
  const tabCount = currentTabs.length;

  // Ghost Mode color theme
  const colors = {
    accent: isGhostMode ? '#9B59B6' : ELECTRIC_CYAN,
    searchBackground: isGhostMode ? '#2A0000' : '#1A1A1A',
    borderColor: isGhostMode ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    barBackground: isGhostMode ? 'rgba(42, 0, 0, 0.95)' : 'rgba(13, 13, 13, 0.95)',
  };
  
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Initialize VPN store
  useEffect(() => {
    useVPNStore.getState().initialize();
  }, []);

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

  // Check if on new tab page
  const isNewTabPage = !currentUrl || currentUrl === 'about:blank' || currentUrl === 'about:newtab';

  // Determine if we're showing shield status in URL bar
  const isProtected = browserSettings.adblockEnabled || vpnConnected || isGhostMode;
  const shieldColor = isGhostMode ? '#9B59B6' : vpnConnected ? '#00E5FF' : browserSettings.adblockEnabled ? '#00FF88' : '#555';

  const isWeb = Platform.OS === 'web';

  const renderContent = () => (
    <View style={[styles.contentWrapper, { paddingTop: insets.top + 8 }]}>
      {/* URL Bar Row */}
      <View style={styles.urlBarRow}>
        {/* Shield inside URL bar (left) */}
        <View style={[
          styles.urlBar, 
          { backgroundColor: colors.searchBackground },
          isFocused && [styles.urlBarFocused, { borderColor: colors.accent }]
        ]}>
          {/* Shield Status Indicator (inside bar) */}
          {isProtected && !isFocused && (
            <View style={styles.shieldInBar}>
              <Ionicons 
                name="shield-checkmark" 
                size={14} 
                color={shieldColor} 
              />
            </View>
          )}
          
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.searchIcon} />
          ) : (
            <Ionicons 
              name={isGhostMode ? "eye-off-outline" : "search"} 
              size={16} 
              color={isFocused ? colors.accent : MUTED_GRAY} 
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

          {/* Bookmark Star (inside bar, right side) */}
          {!isFocused && currentUrl && !isNewTabPage && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                useBrowserStore.getState().toggleBookmark(currentUrl, currentTitle);
              }}
              style={styles.bookmarkInBar}
            >
              <Ionicons 
                name={isBookmarked(currentUrl) ? "star" : "star-outline"} 
                size={16} 
                color={isBookmarked(currentUrl) ? ELECTRIC_CYAN : MUTED_GRAY} 
              />
            </TouchableOpacity>
          )}

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

      {/* ============================================================ */}
      {/* THE CORE 5 - Premium Bottom Navigation */}
      {/* Clean floating glyphs with uniform spacing */}
      {/* ============================================================ */}
      <View style={styles.core5Row}>
        {/* 1. Search/Home */}
        <TouchableOpacity
          style={styles.navIcon}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (isNewTabPage) {
              // Focus the search bar
              inputRef.current?.focus();
            } else {
              // Navigate to home/new tab - use empty string to show HomeScreen
              onNavigate('');
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isNewTabPage ? "search" : "home-outline"} 
            size={22} 
            color={isNewTabPage ? colors.accent : INACTIVE_GRAY} 
          />
        </TouchableOpacity>

        {/* 2. Library (History & Bookmarks) */}
        <TouchableOpacity
          style={styles.navIcon}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLibraryPress();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="library-outline" size={22} color={INACTIVE_GRAY} />
        </TouchableOpacity>

        {/* 3. AI Agent - CENTER, LARGER, DISTINCT ACCENT */}
        <TouchableOpacity
          style={styles.navIconCenter}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAccessibilityPress();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={26} color={AI_GOLD} />
        </TouchableOpacity>

        {/* 4. Tabs Counter */}
        <TouchableOpacity
          style={styles.navIcon}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTabsPress();
          }}
          activeOpacity={0.7}
        >
          <View style={[
            styles.tabSquare,
            isGhostMode && styles.tabSquareGhost
          ]}>
            <Text style={[
              styles.tabCount,
              isGhostMode && styles.tabCountGhost
            ]}>
              {tabCount > 99 ? '∞' : tabCount}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 5. Menu (⋮) */}
        <TouchableOpacity
          style={styles.navIcon}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSettingsPress();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={INACTIVE_GRAY} />
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
    <BlurView 
      tint={isGhostMode ? "default" : "dark"} 
      intensity={80} 
      style={[styles.blurContainer, isGhostMode && styles.blurContainerGhost]}
    >
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
    paddingBottom: 8,      // Reduced from 12 for slimmer bar
    paddingHorizontal: 12, // Reduced from 16 for tighter layout
  },
  // URL Bar Row
  urlBarRow: {
    marginBottom: 8,       // Reduced from 12 for slimmer bar
  },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    height: 38,            // Reduced from 40 for slimmer bar
    paddingHorizontal: 10, // Reduced from 12 for tighter layout
  },
  urlBarFocused: {
    backgroundColor: '#222',
    borderWidth: 1,
  },
  shieldInBar: {
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: '100%',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  bookmarkInBar: {
    padding: 6,
    marginLeft: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  // ============================================================
  // THE CORE 5 - Premium Navigation Row (Compact)
  // ============================================================
  core5Row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 2,    // Reduced from 4 for slimmer bar
  },
  // Standard nav icons - NO background, clean floating glyphs
  navIcon: {
    width: 44,             // Reduced from 48
    height: 38,            // Reduced from 44
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Center AI icon - Slightly larger touch target
  navIconCenter: {
    width: 52,             // Reduced from 56
    height: 42,            // Reduced from 48
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tab counter square
  tabSquare: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: INACTIVE_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSquareGhost: {
    borderColor: '#9B59B6',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: INACTIVE_GRAY,
  },
  tabCountGhost: {
    color: '#9B59B6',
  },
});

export default UnifiedTopBar;
