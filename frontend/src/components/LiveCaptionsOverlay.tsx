/**
 * Live Captions Overlay Component
 * 
 * Displays streaming captions with smooth animations, volume indicator,
 * and real-time feedback for audio capture and ONNX processing.
 * 
 * Visual States:
 * - Idle: Gray indicator, dormant
 * - Listening: Green pulsing indicator when recording
 * - Processing: Yellow flash when processing audio chunks
 * - Paused: Red indicator, mic muted
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Platform,
  Easing,
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
    volumeLevel,
    isMockMode,
    hasPermission,
    error,
  } = useLiveCaptions();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Volume indicator animation
  const volumeAnim = useRef(new Animated.Value(0)).current;
  
  // Pulse animation for status dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
  
  // Update volume animation
  useEffect(() => {
    Animated.timing(volumeAnim, {
      toValue: volumeLevel,
      duration: 100,
      useNativeDriver: false, // width can't use native driver
    }).start();
  }, [volumeLevel]);
  
  // Pulse animation for listening state
  useEffect(() => {
    if (status === 'listening' && isActive && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
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
  }, [status, isActive, isPaused]);

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
          {/* Animated status dot */}
          <Animated.View
            style={[
              styles.statusDot,
              { 
                backgroundColor: getStatusColor(),
                transform: [{ scale: status === 'listening' ? pulseAnim : 1 }],
              },
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
          {isMockMode && (
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>MOCK</Text>
            </View>
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
      
      {/* Volume Indicator Bar */}
      {isActive && !isPaused && (
        <View style={styles.volumeContainer}>
          <Animated.View 
            style={[
              styles.volumeBar,
              {
                width: volumeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: volumeLevel > 0.3 ? '#00FF88' : '#444',
              },
            ]}
          />
          <View style={styles.volumeThreshold} />
        </View>
      )}
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={14} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

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
              {error 
                ? 'Grant microphone permission to enable captions'
                : isPaused 
                  ? 'Mic muted. Tap to resume.' 
                  : 'Listening for audio...'
              }
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
      
      {/* Live indicator */}
      <View style={styles.footer}>
        <View style={styles.liveIndicator}>
          <Animated.View 
            style={[
              styles.liveDot,
              { 
                opacity: status === 'listening' ? pulseAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [1, 0.5],
                }) : 0.3,
              }
            ]} 
          />
          <Text style={[
            styles.liveText,
            { color: isActive && !isPaused ? '#00FF88' : '#666' }
          ]}>
            {isActive && !isPaused ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>
        {isMockMode && (
          <Text style={styles.mockInfoText}>
            Real STT requires native build
          </Text>
        )}
      </View>
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
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#00FF88',
    ...Platform.select({
      ios: {
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
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
  mockBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  mockBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 0.5,
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
  // Volume indicator
  volumeContainer: {
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  volumeBar: {
    height: '100%',
    borderRadius: 2,
  },
  volumeThreshold: {
    position: 'absolute',
    left: '10%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#666',
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 11,
    color: '#FF6B6B',
    marginLeft: 6,
  },
  captionScroll: {
    maxHeight: 80,
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
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4444',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  mockInfoText: {
    fontSize: 9,
    color: '#666',
    fontStyle: 'italic',
  },
});
