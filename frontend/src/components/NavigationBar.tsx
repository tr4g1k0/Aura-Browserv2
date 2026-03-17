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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import { useVPNStore, useVPNConnection } from '../store/useVPNStore';
import * as Haptics from 'expo-haptics';

// VPN Status Colors
const VPN_COLORS = {
  disconnected: '#666666',
  connecting: '#FFB800',
  connected: '#00E5FF', // Electric Cyan as specified
  disconnecting: '#FFB800',
  error: '#FF4444',
};

interface NavigationBarProps {
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onTabsPress: () => void;
  onSettingsPress: () => void;
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * VPN Status Indicator Component
 * Shows animated globe icon based on VPN connection state
 */
const VPNIndicator: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { state, isConnected, isConnecting, isDisconnecting } = useVPNConnection();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Initialize VPN store
  useEffect(() => {
    useVPNStore.getState().initialize();
  }, []);
  
  // Pulse animation for connecting state
  useEffect(() => {
    if (isConnecting || isDisconnecting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      // Also add subtle rotation during connecting
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotate.start();
      
      return () => {
        pulse.stop();
        rotate.stop();
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
      };
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isConnecting, isDisconnecting]);
  
  const iconColor = VPN_COLORS[state] || VPN_COLORS.disconnected;
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <TouchableOpacity
      style={[
        styles.vpnButton,
        isConnected && styles.vpnButtonActive,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Animated.View
        style={{
          transform: [
            { scale: pulseAnim },
            { rotate: isConnecting ? spin : '0deg' },
          ],
        }}
      >
        <Ionicons 
          name={isConnected ? 'shield-checkmark' : 'globe-outline'} 
          size={20} 
          color={iconColor} 
        />
      </Animated.View>
      {/* Connection status dot */}
      {isConnected && (
        <View style={styles.vpnStatusDot} />
      )}
    </TouchableOpacity>
  );
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onTabsPress,
  onSettingsPress,
  currentUrl,
  canGoBack,
  canGoForward,
}) => {
  const insets = useSafeAreaInsets();
  const { tabs, isLoading } = useBrowserStore();
  const { toggle: toggleVPN, state: vpnState } = useVPNConnection();
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
    const input = inputValue.trim();
    
    if (!input) return;
    
    // Pass raw input to parent's onNavigate handler
    // The parent uses parseUrlInput utility for proper URL/search parsing
    onNavigate(input);
    setIsFocused(false);
  };

  const handleButtonPress = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  const handleVPNPress = async () => {
    try {
      await toggleVPN();
    } catch (error) {
      console.log('[NavigationBar] VPN toggle error:', error);
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

        {/* VPN Indicator */}
        <VPNIndicator onPress={handleVPNPress} />

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

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => handleButtonPress(onSettingsPress)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color="#888" />
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
  // VPN Button styles
  vpnButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vpnButtonActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  vpnStatusDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
