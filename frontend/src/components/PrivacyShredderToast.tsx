import React, { useRef } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';

export const PrivacyShredderToast = () => {
  const { toastMessage, hideToast } = useBrowserStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (toastMessage) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
        Animated.delay(2400),
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 300, useNativeDriver: true,
        }),
      ]).start(() => hideToast());
    }
  }, [toastMessage]);

  if (!toastMessage) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 100,
        left: 20, right: 20,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        opacity: fadeAnim,
        transform: [{
          translateY: fadeAnim.interpolate({
            inputRange: [0, 1], outputRange: [20, 0],
          }),
        }],
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.3)',
        ...Platform.select({
          ios: { shadowColor: '#00FF88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
          android: { elevation: 8 },
        }),
      }}
      data-testid="privacy-shredder-toast"
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0, 255, 136, 0.2)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="checkmark-circle" size={24} color="#00FF88" />
      </View>
      <Text style={{
        flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600',
        ...Platform.select({
          ios: { fontFamily: 'System' },
          android: { fontFamily: 'Roboto' },
          web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
        }),
      }}>
        {toastMessage}
      </Text>
    </Animated.View>
  );
};
