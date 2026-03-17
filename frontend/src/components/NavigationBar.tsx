import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import * as Haptics from 'expo-haptics';

interface NavigationBarProps {
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onTabsPress: () => void;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onTabsPress,
  currentUrl,
  canGoBack,
  canGoForward,
}) => {
  const insets = useSafeAreaInsets();
  const { tabs, isLoading } = useBrowserStore();
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(currentUrl);
    }
  }, [currentUrl, isFocused]);

  const handleSubmit = () => {
    Keyboard.dismiss();
    let url = inputValue.trim();
    
    if (!url) return;
    
    // Check if it's a search query or URL
    if (!url.includes('.') || url.includes(' ')) {
      // Treat as search query
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    onNavigate(url);
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

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.controlButton, !canGoBack && styles.disabledButton]}
          onPress={() => handleButtonPress(onBack)}
          disabled={!canGoBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={canGoBack ? '#FFF' : '#444'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !canGoForward && styles.disabledButton]}
          onPress={() => handleButtonPress(onForward)}
          disabled={!canGoForward}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={24} color={canGoForward ? '#FFF' : '#444'} />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#00FF88" style={styles.searchIcon} />
          ) : (
            <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
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
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => handleButtonPress(onRefresh)}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabsButton}
          onPress={() => handleButtonPress(onTabsPress)}
          activeOpacity={0.7}
        >
          <View style={styles.tabsIconContainer}>
            <Ionicons name="copy-outline" size={20} color="#FFF" />
            <View style={styles.tabCountBadge}>
              <Ionicons name="ellipse" size={14} color="#00FF88" />
            </View>
          </View>
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
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  tabsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsIconContainer: {
    position: 'relative',
  },
  tabCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
});
