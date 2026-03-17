import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import { useVPNStore, useVPNConnection } from '../store/useVPNStore';
import * as Haptics from 'expo-haptics';

// VPN Status Colors matching NavigationBar
const VPN_COLORS = {
  disconnected: '#666666',
  connecting: '#FFB800',
  connected: '#00E5FF', // Electric Cyan
  disconnecting: '#FFB800',
  error: '#FF4444',
};

interface StatusBarProps {
  onAccessibilityPress: () => void;
}

/**
 * VPN Status Button Component
 * Shows animated globe icon based on VPN connection state
 */
const VPNStatusButton: React.FC = () => {
  const { state, isConnected, isConnecting, isDisconnecting, toggle } = useVPNConnection();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Initialize VPN store on mount
  useEffect(() => {
    useVPNStore.getState().initialize();
  }, []);
  
  // Pulse animation for connecting state
  useEffect(() => {
    if (isConnecting || isDisconnecting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnecting, isDisconnecting]);
  
  const iconColor = VPN_COLORS[state] || VPN_COLORS.disconnected;
  
  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await toggle();
    } catch (error) {
      console.log('[StatusBar] VPN toggle error:', error);
    }
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.toggleButton, 
        isConnected && styles.vpnActiveToggle,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Ionicons
          name={isConnected ? 'shield-checkmark' : 'globe'}
          size={20}
          color={iconColor}
        />
      </Animated.View>
      {isConnected && <View style={[styles.activeDot, { backgroundColor: '#00E5FF' }]} />}
      {isConnecting && (
        <View style={[styles.activeDot, { backgroundColor: '#FFB800' }]} />
      )}
    </TouchableOpacity>
  );
};

export const BrowserStatusBar: React.FC<StatusBarProps> = ({ onAccessibilityPress }) => {
  const insets = useSafeAreaInsets();
  const { settings, toggleAdblock } = useBrowserStore();

  const handleToggle = (toggle: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftSection}>
        {/* Ad Block Toggle */}
        <TouchableOpacity
          style={[styles.toggleButton, settings.adblockEnabled && styles.activeToggle]}
          onPress={() => handleToggle(toggleAdblock)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield"
            size={20}
            color={settings.adblockEnabled ? '#00FF88' : '#666'}
          />
          {settings.adblockEnabled && <View style={styles.activeDot} />}
        </TouchableOpacity>
        
        {/* VPN Toggle - Now uses VPN Store */}
        <VPNStatusButton />
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.browserName}>ACCESS</Text>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={onAccessibilityPress}
          activeOpacity={0.7}
        >
          <Ionicons name="accessibility" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#0D0D0D',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  browserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 3,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      },
    }),
  },
  toggleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeToggle: {
    backgroundColor: '#1A2A1A',
  },
  vpnActiveToggle: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF88',
  },
});
