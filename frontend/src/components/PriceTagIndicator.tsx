import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePriceTrackerStore } from '../store/usePriceTrackerStore';
import * as Haptics from 'expo-haptics';

const CYAN = '#00FFFF';

/**
 * Small floating price tag icon that appears in the URL bar area
 * when a product page is detected. Tapping opens the PriceTrackerSheet.
 */
export const PriceTagIndicator: React.FC<{ bottomOffset?: number }> = ({ bottomOffset = 100 }) => {
  const isProductPage = usePriceTrackerStore(s => s.isProductPage);
  const currentDealScore = usePriceTrackerStore(s => s.currentDealScore);
  const openSheet = usePriceTrackerStore(s => s.openSheet);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isProductPage) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }).start();
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isProductPage]);

  if (!isProductPage) return null;

  const color = currentDealScore?.color || CYAN;
  const scoreText = currentDealScore?.isNew ? '•' : currentDealScore?.score?.toString() || '';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, { borderColor: color + '66' }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          openSheet();
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="pricetag" size={16} color={color} />
        {scoreText ? (
          <View style={[styles.scoreDot, { backgroundColor: color }]}>
            <Text style={styles.scoreText}>{scoreText}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 90,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  scoreDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
});
