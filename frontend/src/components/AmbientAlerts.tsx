import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBrowserStore } from '../store/browserStore';
import * as Haptics from 'expo-haptics';

export const AmbientAlerts: React.FC = () => {
  const { ambientAlerts, settings, clearAmbientAlerts } = useBrowserStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (ambientAlerts.length > 0 && settings.ambientAwarenessEnabled) {
      // Haptic feedback for new alerts
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => clearAmbientAlerts());
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [ambientAlerts, settings.ambientAwarenessEnabled]);

  if (!settings.ambientAwarenessEnabled || ambientAlerts.length === 0) {
    return null;
  }

  const latestAlert = ambientAlerts[ambientAlerts.length - 1];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="ear" size={20} color="#FFB800" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>AMBIENT SOUND DETECTED</Text>
        <Text style={styles.alertText} numberOfLines={2}>
          {latestAlert}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(30, 25, 0, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB800',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 18,
  },
});
