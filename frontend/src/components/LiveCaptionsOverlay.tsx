// Live Captions Overlay Component
// Displays streaming captions with smooth animations

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLiveCaptions, CaptionWord } from '../hooks/useLiveCaptions';
import * as Haptics from 'expo-haptics';

interface LiveCaptionsOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export const LiveCaptionsOverlay: React.FC<LiveCaptionsOverlayProps> = ({
  visible,
  onClose,
}) => {
  const {
    captionText,
    words,
    isActive,
    isPaused,
    start,
    stop,
    togglePause,
    clear,
    status,
    confidence,
  } = useLiveCaptions();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      // Start captions when visible
      start();
      
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
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        stop();
        clear();
      });
    }
  }, [visible]);

  // Auto-scroll to end when new words arrive
  useEffect(() => {
    if (scrollViewRef.current && words.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [words.length]);

  const handleTogglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePause();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening': return '#00FF88';
      case 'processing': return '#FFB800';
      case 'paused': return '#FF6B6B';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'listening': return 'Listening';
      case 'processing': return 'Processing';
      case 'paused': return 'Paused';
      default: return 'Idle';
    }
  };

  if (!visible) return null;

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor() },
              status === 'listening' && styles.pulseDot,
            ]}
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          {confidence > 0 && (
            <Text style={styles.confidenceText}>
              {Math.round(confidence * 100)}%
            </Text>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isPaused && styles.controlButtonActive,
            ]}
            onPress={handleTogglePause}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPaused ? 'mic-off' : 'mic'}
              size={18}
              color={isPaused ? '#FF6B6B' : '#FFF'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Caption Text */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.captionScroll}
        contentContainerStyle={styles.captionContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.captionText}>
          {captionText || (
            <Text style={styles.placeholderText}>
              {isPaused ? 'Mic muted. Tap to resume.' : 'Listening for audio...'}
            </Text>
          )}
          {/* Blinking cursor */}
          {isActive && !isPaused && (
            <BlinkingCursor />
          )}
        </Text>
      </ScrollView>

      {/* Word animation indicator */}
      {words.length > 0 && (
        <View style={styles.wordIndicator}>
          <AnimatedWord word={words[words.length - 1]} />
        </View>
      )}
    </Animated.View>
  );
};

// Blinking cursor component
const BlinkingCursor: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, []);

  return (
    <Animated.Text style={[styles.cursor, { opacity }]}>|</Animated.Text>
  );
};

// Animated word component
const AnimatedWord: React.FC<{ word: CaptionWord }> = ({ word }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out after a moment
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 500);

    return () => clearTimeout(timeout);
  }, [word.id]);

  return (
    <Animated.View
      style={[
        styles.animatedWord,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <Text style={styles.animatedWordText}>{word.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 16,
    padding: 12,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#00FF88',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pulseDot: {
    // Pulse animation handled via Animated
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confidenceText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#2A1A1A',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionScroll: {
    maxHeight: 100,
  },
  captionContent: {
    paddingVertical: 4,
  },
  captionText: {
    fontSize: 16,
    color: '#FFF',
    lineHeight: 24,
    fontWeight: '400',
  },
  placeholderText: {
    color: '#666',
    fontStyle: 'italic',
  },
  cursor: {
    color: '#00FF88',
    fontWeight: '300',
  },
  wordIndicator: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  animatedWord: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  animatedWordText: {
    fontSize: 12,
    color: '#00FF88',
    fontWeight: '600',
  },
});
