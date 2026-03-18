/**
 * Quick Converse View
 * 
 * Full-screen split-screen interface for face-to-face communication.
 * Top half shows incoming speech transcription using native STT.
 * Bottom half allows the user to type and speak their response.
 * 
 * Designed for accessibility - deaf/hard-of-hearing users can communicate
 * face-to-face by positioning the phone between themselves and another person.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Animated,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

// Conditionally import Speech Recognition for native platforms
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;

if (Platform.OS !== 'web') {
  try {
    const SpeechRecognition = require('@jamsch/expo-speech-recognition');
    ExpoSpeechRecognitionModule = SpeechRecognition.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = SpeechRecognition.useSpeechRecognitionEvent;
  } catch (e) {
    console.log('[QuickConverse] expo-speech-recognition not available');
  }
}

// Colors
const DEEP_BLACK = '#121212';
const ELECTRIC_CYAN = '#00FFFF';
const PURE_WHITE = '#FFFFFF';
const LISTENING_GREEN = '#00FF88';
const GLASS_BG = 'rgba(255, 255, 255, 0.05)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.1)';

interface QuickConverseViewProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * ============================================================
 * LISTENING INDICATOR - Pulsing cyan dot when mic is active
 * ============================================================
 */
const ListeningIndicator: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.4,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.3);
    }
  }, [isActive]);

  return (
    <View style={styles.listeningIndicatorContainer}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.listeningIndicatorOuter,
          {
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
            backgroundColor: isActive ? ELECTRIC_CYAN : 'rgba(255,255,255,0.2)',
          },
        ]}
      />
      {/* Inner solid dot */}
      <View
        style={[
          styles.listeningIndicatorInner,
          {
            backgroundColor: isActive ? ELECTRIC_CYAN : 'rgba(255,255,255,0.4)',
          },
        ]}
      />
    </View>
  );
};

/**
 * ============================================================
 * MAIN QUICK CONVERSE VIEW
 * ============================================================
 */
export const QuickConverseView: React.FC<QuickConverseViewProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  
  // Response State
  const [responseText, setResponseText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Refs
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animation values
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // ============================================================
  // SPEECH RECOGNITION EVENT HANDLERS (Native only)
  // ============================================================
  
  // Handle speech recognition results
  if (Platform.OS !== 'web' && useSpeechRecognitionEvent) {
    useSpeechRecognitionEvent('result', (event: any) => {
      if (event.results && event.results.length > 0) {
        const result = event.results[event.results.length - 1];
        if (result && result.length > 0) {
          const recognizedText = result[0].transcript;
          
          if (event.isFinal) {
            // Final result - append to transcript
            setTranscript(prev => {
              const newText = prev ? `${prev} ${recognizedText}` : recognizedText;
              // Auto-scroll after adding text
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
              return newText;
            });
            setPartialTranscript('');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else {
            // Partial result - show in real-time
            setPartialTranscript(recognizedText);
          }
        }
      }
    });

    useSpeechRecognitionEvent('start', () => {
      console.log('[QuickConverse] Speech recognition started');
      setIsListening(true);
      setRecognitionError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    useSpeechRecognitionEvent('end', () => {
      console.log('[QuickConverse] Speech recognition ended');
      // If we want continuous listening, restart here
      if (visible && isListening) {
        // Small delay before restarting to prevent rapid cycling
        setTimeout(() => {
          startListening();
        }, 500);
      }
    });

    useSpeechRecognitionEvent('error', (event: any) => {
      console.error('[QuickConverse] Speech recognition error:', event.error);
      setRecognitionError(event.error);
      
      // Don't show error for "no-speech" - just keep listening
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  }

  /**
   * Request microphone permissions and start listening
   */
  const startListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web fallback - show demo mode
      setRecognitionError('Speech recognition requires native app');
      return;
    }

    if (!ExpoSpeechRecognitionModule) {
      setRecognitionError('Speech recognition not available');
      return;
    }

    try {
      // Request permissions
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (!result.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Quick Converse needs microphone access to transcribe speech. Please enable it in Settings.',
          [{ text: 'OK' }]
        );
        setRecognitionError('Microphone permission denied');
        return;
      }

      // Start recognition with continuous mode
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true, // Get partial results word-by-word
        maxAlternatives: 1,
        continuous: true, // Keep listening
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: ['Quick Converse', 'accessibility'],
      });

      setIsListening(true);
      setRecognitionError(null);
      console.log('[QuickConverse] Started listening...');
      
    } catch (error: any) {
      console.error('[QuickConverse] Failed to start recognition:', error);
      setRecognitionError(error.message || 'Failed to start');
      setIsListening(false);
    }
  }, [visible]);

  /**
   * Stop listening and clean up
   */
  const stopListening = useCallback(() => {
    if (Platform.OS !== 'web' && ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
        console.log('[QuickConverse] Stopped listening');
      } catch (error) {
        console.error('[QuickConverse] Error stopping recognition:', error);
      }
    }
    setIsListening(false);
    setPartialTranscript('');
  }, []);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // ============================================================
  // LIFECYCLE EFFECTS
  // ============================================================

  // Auto-start listening when view becomes visible
  useEffect(() => {
    if (visible) {
      // Small delay to let the view render first
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Clean up when closing
      stopListening();
      setTranscript('');
      setPartialTranscript('');
      setResponseText('');
      setRecognitionError(null);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      Speech.stop();
    };
  }, []);

  // Glow animation for speak button
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  // Auto-scroll when transcript changes
  useEffect(() => {
    if (transcript || partialTranscript) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcript, partialTranscript]);

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle speaking the response text
   */
  const handleSpeak = async () => {
    if (!responseText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Pause listening while speaking to avoid feedback
    const wasListening = isListening;
    if (wasListening) {
      stopListening();
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSpeaking(true);
    Keyboard.dismiss();

    try {
      await Speech.speak(responseText, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setIsSpeaking(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Resume listening after speaking
          if (wasListening) {
            setTimeout(() => startListening(), 500);
          }
        },
        onStopped: () => {
          setIsSpeaking(false);
        },
        onError: () => {
          setIsSpeaking(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      });
    } catch (error) {
      console.error('[QuickConverse] Speech error:', error);
      setIsSpeaking(false);
    }
  };

  /**
   * Handle closing the view
   */
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // CRITICAL: Stop microphone to protect privacy
    stopListening();
    
    // Stop any ongoing TTS
    Speech.stop();
    setIsSpeaking(false);
    
    // Clear all state
    setTranscript('');
    setPartialTranscript('');
    setResponseText('');
    setRecognitionError(null);
    
    onClose();
  };

  /**
   * Clear transcript
   */
  const handleClearTranscript = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscript('');
    setPartialTranscript('');
  };

  /**
   * Clear response text
   */
  const handleClearResponse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResponseText('');
    inputRef.current?.focus();
  };

  if (!visible) return null;

  const isWeb = Platform.OS === 'web';
  const displayText = transcript + (partialTranscript ? (transcript ? ' ' : '') + partialTranscript : '');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 16 }]}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        {isWeb ? (
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={28} color={PURE_WHITE} />
          </View>
        ) : (
          <BlurView tint="dark" intensity={40} style={styles.closeButtonInner}>
            <Ionicons name="close" size={28} color={PURE_WHITE} />
          </BlurView>
        )}
      </TouchableOpacity>

      {/* ============================================================ */}
      {/* TOP HALF - Transcription View */}
      {/* Shows what is being said to the user */}
      {/* ============================================================ */}
      <View style={styles.topHalf}>
        <View style={styles.sectionHeader}>
          {/* Listening Indicator with tap to toggle */}
          <TouchableOpacity 
            onPress={toggleListening}
            style={styles.listeningToggle}
            activeOpacity={0.7}
          >
            <ListeningIndicator isActive={isListening} />
            <Text style={[
              styles.sectionLabel,
              isListening && styles.sectionLabelActive
            ]}>
              {isListening ? 'LISTENING' : 'TAP TO LISTEN'}
            </Text>
          </TouchableOpacity>
          
          {/* Clear transcript button */}
          {displayText.length > 0 && (
            <TouchableOpacity
              onPress={handleClearTranscript}
              style={styles.clearTranscriptButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {displayText ? (
            <View>
              <Text style={styles.transcriptText}>
                {transcript}
                {partialTranscript && (
                  <Text style={styles.partialTranscript}> {partialTranscript}</Text>
                )}
              </Text>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons 
                name={isListening ? "mic" : "ear-outline"} 
                size={48} 
                color={isListening ? ELECTRIC_CYAN : "rgba(255,255,255,0.3)"} 
              />
              <Text style={[
                styles.placeholderText,
                isListening && styles.placeholderTextActive
              ]}>
                {isListening ? 'Listening...' : 'Tap to start listening'}
              </Text>
              <Text style={styles.placeholderSubtext}>
                {isListening 
                  ? '(Position phone toward speaker)' 
                  : recognitionError || '(Microphone permission required)'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ============================================================ */}
      {/* DIVIDER - Electric Cyan Glow Line */}
      {/* ============================================================ */}
      <View style={styles.dividerContainer}>
        <View style={[
          styles.dividerLine,
          isListening && styles.dividerLineActive
        ]} />
        <View style={[
          styles.dividerGlow,
          isListening && styles.dividerGlowActive
        ]} />
      </View>

      {/* ============================================================ */}
      {/* BOTTOM HALF - Response View */}
      {/* For the user to type and speak their reply */}
      {/* ============================================================ */}
      <KeyboardAvoidingView
        style={styles.bottomHalf}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.responseHeaderLeft}>
            <Ionicons name="chatbubble-outline" size={18} color={ELECTRIC_CYAN} />
            <Text style={styles.sectionLabel}>YOUR RESPONSE</Text>
          </View>
        </View>

        <View style={styles.responseInputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.responseInput}
            value={responseText}
            onChangeText={setResponseText}
            placeholder="Type your message here..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            textAlignVertical="top"
            selectionColor={ELECTRIC_CYAN}
          />

          {/* Clear Button */}
          {responseText.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearResponse}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Speak Button with Cyan Glow */}
        <TouchableOpacity
          style={[
            styles.speakButton,
            isSpeaking && styles.speakButtonActive,
            { marginBottom: Math.max(insets.bottom, 20) }
          ]}
          onPress={handleSpeak}
          activeOpacity={0.8}
          disabled={isSpeaking}
        >
          <Animated.View
            style={[
              styles.speakButtonGlow,
              { opacity: glowAnim }
            ]}
          />
          <View style={styles.speakButtonContent}>
            <Ionicons
              name={isSpeaking ? "volume-high" : "volume-medium-outline"}
              size={28}
              color={isSpeaking ? DEEP_BLACK : ELECTRIC_CYAN}
            />
            <Text style={[
              styles.speakButtonText,
              isSpeaking && styles.speakButtonTextActive
            ]}>
              {isSpeaking ? 'Speaking...' : 'Speak'}
            </Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Status Badge */}
      {isWeb && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>WEB PREVIEW - USE EXPO GO FOR STT</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DEEP_BLACK,
    zIndex: 10000,
  },

  // Close Button
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
  closeButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 2,
    marginLeft: 10,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  sectionLabelActive: {
    color: ELECTRIC_CYAN,
  },
  
  // Listening Toggle
  listeningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Listening Indicator
  listeningIndicatorContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningIndicatorOuter: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  listeningIndicatorInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Clear Transcript Button
  clearTranscriptButton: {
    padding: 8,
  },

  // Response Header
  responseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Top Half - Transcription
  topHalf: {
    flex: 1,
    paddingTop: 60,
  },
  transcriptScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  transcriptContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  transcriptText: {
    fontSize: 32,
    fontWeight: '700',
    color: PURE_WHITE,
    lineHeight: 44,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  partialTranscript: {
    color: 'rgba(0, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  placeholderTextActive: {
    color: ELECTRIC_CYAN,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },

  // Divider
  dividerContainer: {
    height: 4,
    position: 'relative',
    marginVertical: 8,
  },
  dividerLine: {
    height: 2,
    backgroundColor: 'rgba(0, 255, 255, 0.5)',
    marginHorizontal: 24,
    borderRadius: 1,
  },
  dividerLineActive: {
    backgroundColor: ELECTRIC_CYAN,
  },
  dividerGlow: {
    position: 'absolute',
    top: -4,
    left: 24,
    right: 24,
    height: 12,
    backgroundColor: ELECTRIC_CYAN,
    opacity: 0.2,
    borderRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: ELECTRIC_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
    }),
  },
  dividerGlowActive: {
    opacity: 0.4,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
    }),
  },

  // Bottom Half - Response
  bottomHalf: {
    flex: 1,
  },
  responseInputContainer: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    position: 'relative',
    overflow: 'hidden',
  },
  responseInput: {
    flex: 1,
    fontSize: 20,
    color: PURE_WHITE,
    padding: 20,
    paddingTop: 20,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },

  // Speak Button
  speakButton: {
    marginHorizontal: 24,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: ELECTRIC_CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  speakButtonActive: {
    backgroundColor: ELECTRIC_CYAN,
    borderColor: ELECTRIC_CYAN,
  },
  speakButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ELECTRIC_CYAN,
  },
  speakButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  speakButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  speakButtonTextActive: {
    color: DEEP_BLACK,
  },

  // Status Badge
  statusBadge: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -90 }],
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 1,
  },
});

export default QuickConverseView;
