/**
 * Tab Undo Snackbar
 * 
 * Shows a snackbar at the bottom when a tab is closed
 * with an "Undo" button to restore it within 5 seconds
 */

import React, { useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AURA_CYAN = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const CARD_DARK = '#1A1A1E';

interface TabUndoSnackbarProps {
  visible: boolean;
  tabTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
  bottomOffset?: number;
}

const TabUndoSnackbarComponent: React.FC<TabUndoSnackbarProps> = ({
  visible,
  tabTitle,
  onUndo,
  onDismiss,
  bottomOffset = 100,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(SCREEN_WIDTH - 48)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show/hide animation
  useEffect(() => {
    if (visible) {
      // Reset progress
      progressWidth.setValue(SCREEN_WIDTH - 48);
      
      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Start countdown progress bar (5 seconds)
      Animated.timing(progressWidth, {
        toValue: 0,
        duration: 5000,
        useNativeDriver: false, // Width animation needs JS driver
      }).start();

      // Auto-dismiss after 5 seconds
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 5000);
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onDismiss();
  }, [onDismiss]);

  const handleUndo = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUndo();
  }, [onUndo]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset + insets.bottom,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.snackbar}>
        {/* Progress bar at bottom */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              { width: progressWidth },
            ]}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </View>
          
          <Text style={styles.message} numberOfLines={1}>
            Tab closed
          </Text>

          <TouchableOpacity
            style={styles.undoButton}
            onPress={handleUndo}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo" size={16} color={AURA_CYAN} />
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2000,
  },
  snackbar: {
    backgroundColor: CARD_DARK,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
  },
  progressBar: {
    height: '100%',
    backgroundColor: AURA_CYAN,
    borderRadius: 1.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  iconContainer: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    color: AURA_CYAN,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const TabUndoSnackbar = memo(TabUndoSnackbarComponent);

export default TabUndoSnackbar;
