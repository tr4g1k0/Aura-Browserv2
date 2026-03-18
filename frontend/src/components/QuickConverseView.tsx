/**
 * Quick Converse View
 * 
 * Full-screen split-screen interface for face-to-face communication.
 * Top half shows incoming speech transcription.
 * Bottom half allows the user to type and speak their response.
 * 
 * Designed for accessibility - deaf/hard-of-hearing users can communicate
 * face-to-face by positioning the phone between themselves and another person.
 */

import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

// Colors
const DEEP_BLACK = '#121212';
const ELECTRIC_CYAN = '#00FFFF';
const PURE_WHITE = '#FFFFFF';
const GLASS_BG = 'rgba(255, 255, 255, 0.05)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.1)';

interface QuickConverseViewProps {
  visible: boolean;
  onClose: () => void;
}

export const QuickConverseView: React.FC<QuickConverseViewProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [transcript, setTranscript] = useState<string>('');
  const [responseText, setResponseText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Pulse animation for listening indicator
  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible]);

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

  // Demo: Simulate incoming transcript (replace with real STT)
  useEffect(() => {
    if (visible && !transcript) {
      // Initial placeholder
      setTranscript('');
      
      // Simulate incoming speech after 2 seconds (demo mode)
      const demoTimeout = setTimeout(() => {
        const demoMessages = [
          "Hello! How can I help you today?",
          "I see you're using the Quick Converse feature.",
          "Just type your response below and tap 'Speak' to reply.",
        ];
        
        let messageIndex = 0;
        const interval = setInterval(() => {
          if (messageIndex < demoMessages.length) {
            setTranscript(prev => {
              const newText = prev ? `${prev}\n\n${demoMessages[messageIndex]}` : demoMessages[messageIndex];
              // Auto-scroll to bottom
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
              return newText;
            });
            messageIndex++;
          } else {
            clearInterval(interval);
          }
        }, 3000);

        return () => clearInterval(interval);
      }, 2000);

      return () => clearTimeout(demoTimeout);
    }
  }, [visible]);

  /**
   * Handle speaking the response text
   */
  const handleSpeak = async () => {
    if (!responseText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
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
    // Stop any ongoing speech
    Speech.stop();
    setIsSpeaking(false);
    setTranscript('');
    setResponseText('');
    onClose();
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
          <Animated.View 
            style={[
              styles.listeningDot,
              { transform: [{ scale: pulseAnim }] }
            ]}
          />
          <Text style={styles.sectionLabel}>LISTENING</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcript ? (
            <Text style={styles.transcriptText}>{transcript}</Text>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="ear-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.placeholderText}>
                Listening...
              </Text>
              <Text style={styles.placeholderSubtext}>
                (Position phone toward speaker)
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ============================================================ */}
      {/* DIVIDER - Electric Cyan Glow Line */}
      {/* ============================================================ */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerGlow} />
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
          <Ionicons name="chatbubble-outline" size={18} color={ELECTRIC_CYAN} />
          <Text style={styles.sectionLabel}>YOUR RESPONSE</Text>
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
            autoFocus={visible}
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

      {/* Demo Mode Badge */}
      <View style={styles.demoBadge}>
        <Text style={styles.demoBadgeText}>DEMO MODE</Text>
      </View>
    </View>
  );
};

/**
 * ============================================================
 * TRANSCRIPTION BRIDGE (Architecture for Real STT)
 * ============================================================
 * 
 * For production speech-to-text in the top half, integrate:
 * 
 * 1. expo-av Audio recording with streaming
 * 2. Local STT model (Whisper.cpp via ONNX)
 * 3. Or cloud STT (Google Speech-to-Text, Azure)
 * 
 * Example:
 * ```typescript
 * const startTranscription = async () => {
 *   const recording = await Audio.Recording.createAsync({...});
 *   // Stream audio chunks to STT engine
 *   whisper.onTranscript((text) => {
 *     setTranscript(prev => prev + ' ' + text);
 *   });
 * };
 * ```
 */

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
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 2,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
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
  placeholderSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 8,
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
    backgroundColor: ELECTRIC_CYAN,
    marginHorizontal: 24,
    borderRadius: 1,
  },
  dividerGlow: {
    position: 'absolute',
    top: -4,
    left: 24,
    right: 24,
    height: 12,
    backgroundColor: ELECTRIC_CYAN,
    opacity: 0.3,
    borderRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: ELECTRIC_CYAN,
        shadowOffset: { width: 0, height: 0 },
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

  // Demo Badge
  demoBadge: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 1,
  },
});

export default QuickConverseView;
