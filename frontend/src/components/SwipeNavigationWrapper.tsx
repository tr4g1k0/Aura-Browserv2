import React, { useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Edge zone width - swipes must start within this many pixels from the edge
const EDGE_THRESHOLD = 30;

// Minimum horizontal distance to trigger navigation
const MIN_SWIPE_DISTANCE = 80;

// Maximum vertical movement allowed (to distinguish from scrolling)
const MAX_VERTICAL_MOVEMENT = 100;

interface SwipeNavigationWrapperProps {
  children: React.ReactNode;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  enabled?: boolean;
}

/**
 * SwipeNavigationWrapper - Android Edge Swipe Navigation
 * 
 * Wraps WebView to enable Safari-style edge swipe navigation on Android.
 * On iOS, this is a pass-through since WebView handles gestures natively.
 * 
 * Features:
 * - Only triggers from screen edges (within EDGE_THRESHOLD pixels)
 * - Requires minimum horizontal swipe distance
 * - Ignores vertical scrolling gestures
 * - Provides haptic feedback on navigation
 * - Shows visual indicator during swipe
 */
export const SwipeNavigationWrapper: React.FC<SwipeNavigationWrapperProps> = ({
  children,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  enabled = true,
}) => {
  // iOS uses native WebView gestures, no wrapper needed
  if (Platform.OS === 'ios' || !enabled) {
    return <>{children}</>;
  }

  // Android-specific gesture handling
  const swipeIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const swipeIndicatorPosition = useRef(new Animated.Value(0)).current;
  const swipeDirection = useRef<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const isValidEdgeSwipe = useRef(false);

  const showIndicator = (direction: 'left' | 'right') => {
    swipeDirection.current = direction;
    swipeIndicatorPosition.setValue(direction === 'right' ? 0 : SCREEN_WIDTH - 50);
    Animated.timing(swipeIndicatorOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const hideIndicator = () => {
    Animated.timing(swipeIndicatorOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
    swipeDirection.current = null;
  };

  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY, x } = event.nativeEvent;
    
    // Check if this is a valid edge swipe
    if (!isValidEdgeSwipe.current) {
      return;
    }

    // If too much vertical movement, cancel the gesture
    if (Math.abs(translationY) > MAX_VERTICAL_MOVEMENT) {
      isValidEdgeSwipe.current = false;
      hideIndicator();
      return;
    }

    // Right swipe from left edge (go back)
    if (startX.current <= EDGE_THRESHOLD && translationX > 20 && canGoBack) {
      if (swipeDirection.current !== 'right') {
        showIndicator('right');
      }
    }
    // Left swipe from right edge (go forward)
    else if (startX.current >= SCREEN_WIDTH - EDGE_THRESHOLD && translationX < -20 && canGoForward) {
      if (swipeDirection.current !== 'left') {
        showIndicator('left');
      }
    }
    else {
      hideIndicator();
    }
  }, [canGoBack, canGoForward]);

  const onHandlerStateChange = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { state, translationX, translationY, x } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      // Store the starting X position
      startX.current = x;
      
      // Check if swipe started from a valid edge
      const isLeftEdge = x <= EDGE_THRESHOLD;
      const isRightEdge = x >= SCREEN_WIDTH - EDGE_THRESHOLD;
      isValidEdgeSwipe.current = isLeftEdge || isRightEdge;
    }
    
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      hideIndicator();
      
      if (!isValidEdgeSwipe.current) {
        return;
      }

      // Check if vertical movement was excessive
      if (Math.abs(translationY) > MAX_VERTICAL_MOVEMENT) {
        isValidEdgeSwipe.current = false;
        return;
      }

      // Right swipe from left edge - Go Back
      if (startX.current <= EDGE_THRESHOLD && 
          translationX >= MIN_SWIPE_DISTANCE && 
          canGoBack) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onGoBack();
      }
      // Left swipe from right edge - Go Forward
      else if (startX.current >= SCREEN_WIDTH - EDGE_THRESHOLD && 
               translationX <= -MIN_SWIPE_DISTANCE && 
               canGoForward) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onGoForward();
      }

      isValidEdgeSwipe.current = false;
    }
  }, [canGoBack, canGoForward, onGoBack, onGoForward]);

  return (
    <View style={styles.container}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-15, 15]}
        activeOffsetY={[-MAX_VERTICAL_MOVEMENT, MAX_VERTICAL_MOVEMENT]}
      >
        <View style={styles.gestureContainer}>
          {children}
        </View>
      </PanGestureHandler>

      {/* Back Swipe Indicator (left edge) */}
      <Animated.View
        style={[
          styles.swipeIndicator,
          styles.swipeIndicatorLeft,
          {
            opacity: swipeIndicatorOpacity,
            transform: [{ translateX: swipeIndicatorPosition }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.indicatorArrow}>
          <View style={[styles.arrowLine, styles.arrowLineTop]} />
          <View style={[styles.arrowLine, styles.arrowLineBottom]} />
        </View>
      </Animated.View>

      {/* Forward Swipe Indicator (right edge) */}
      <Animated.View
        style={[
          styles.swipeIndicator,
          styles.swipeIndicatorRight,
          {
            opacity: swipeIndicatorOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.indicatorArrow, styles.indicatorArrowRight]}>
          <View style={[styles.arrowLine, styles.arrowLineTop, styles.arrowLineTopRight]} />
          <View style={[styles.arrowLine, styles.arrowLineBottom, styles.arrowLineBottomRight]} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  swipeIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    width: 50,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 8,
  },
  swipeIndicatorLeft: {
    left: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  swipeIndicatorRight: {
    right: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  indicatorArrow: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorArrowRight: {
    transform: [{ rotate: '180deg' }],
  },
  arrowLine: {
    position: 'absolute',
    width: 12,
    height: 3,
    backgroundColor: '#00FF88',
    borderRadius: 2,
  },
  arrowLineTop: {
    transform: [{ rotate: '-45deg' }, { translateY: -4 }],
  },
  arrowLineBottom: {
    transform: [{ rotate: '45deg' }, { translateY: 4 }],
  },
  arrowLineTopRight: {
    transform: [{ rotate: '45deg' }, { translateY: -4 }],
  },
  arrowLineBottomRight: {
    transform: [{ rotate: '-45deg' }, { translateY: 4 }],
  },
});

export default SwipeNavigationWrapper;
