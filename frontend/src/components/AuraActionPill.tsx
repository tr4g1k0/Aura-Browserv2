/**
 * AuraActionPill — Floating Text Selection Action Bar
 *
 * A frosted-glass horizontal pill that slides up from the bottom when
 * text is selected in the WebView. Four actions:
 *  - Clean Copy (clipboard)
 *  - Insight (AI placeholder)
 *  - Flashcard (full-screen card)
 *  - Share (native share sheet)
 *
 * Also contains the Flashcard modal (48pt centered bold text).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Alert,
  Share,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Colors
const PILL_BG = 'rgba(10, 10, 15, 0.92)';
const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';
const GOLD = '#FFD700';
const DEEP_INDIGO = '#0A0A0F';
const CARD_BG = '#111118';

interface AuraActionPillProps {
  visible: boolean;
  selectedText: string;
  onDismiss: () => void;
}

// ============================================================
// FLASHCARD MODAL
// ============================================================
const FlashcardModal: React.FC<{
  visible: boolean;
  text: string;
  onClose: () => void;
}> = ({ visible, text, onClose }) => {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 160 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.flashcardBackdrop}
        activeOpacity={1}
        onPress={onClose}
        data-testid="flashcard-backdrop"
      >
        <StatusBar barStyle="light-content" />
        <Animated.View
          style={[
            styles.flashcardContainer,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.flashcardInner}>
            <Text style={styles.flashcardText} adjustsFontSizeToFit numberOfLines={8}>
              {text}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.flashcardCloseBtn, { top: insets.top + 16 }]}
            onPress={onClose}
            data-testid="flashcard-close-btn"
          >
            <Ionicons name="close" size={28} color={TEXT_WHITE} />
          </TouchableOpacity>
          <Text style={[styles.flashcardHint, { bottom: insets.bottom + 20 }]}>Tap anywhere to dismiss</Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================
// AURA ACTION PILL
// ============================================================
export const AuraActionPill: React.FC<AuraActionPillProps> = ({
  visible,
  selectedText,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [showFlashcard, setShowFlashcard] = useState(false);

  useEffect(() => {
    if (visible && selectedText.length > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 180,
          mass: 0.7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, selectedText]);

  const handleCopy = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(selectedText);
    onDismiss();
  };

  const handleInsight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Insight',
      'AI-powered insight coming soon.',
      [{ text: 'OK' }]
    );
  };

  const handleFlashcard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowFlashcard(true);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: selectedText });
    } catch {
      // User cancelled
    }
    onDismiss();
  };

  if (!visible && !showFlashcard) return null;

  const actions = [
    { icon: 'copy-outline' as const, label: 'Copy', color: TEXT_WHITE, onPress: handleCopy, testId: 'pill-copy' },
    { icon: 'sparkles' as const, label: 'Insight', color: GOLD, onPress: handleInsight, testId: 'pill-insight' },
    { icon: 'albums-outline' as const, label: 'Flashcard', color: AURA_BLUE, onPress: handleFlashcard, testId: 'pill-flashcard' },
    { icon: 'share-outline' as const, label: 'Share', color: TEXT_WHITE, onPress: handleShare, testId: 'pill-share' },
  ];

  return (
    <>
      <Animated.View
        style={[
          styles.pillWrapper,
          {
            bottom: insets.bottom + 70,
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={styles.pill} data-testid="aura-action-pill">
          {actions.map((action, idx) => (
            <React.Fragment key={action.testId}>
              <TouchableOpacity
                style={styles.pillButton}
                onPress={action.onPress}
                activeOpacity={0.65}
                data-testid={action.testId}
              >
                <Ionicons name={action.icon} size={20} color={action.color} />
                <Text style={[styles.pillLabel, action.color !== TEXT_WHITE && { color: action.color }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
              {idx < actions.length - 1 && <View style={styles.pillDivider} />}
            </React.Fragment>
          ))}
        </View>
      </Animated.View>

      <FlashcardModal
        visible={showFlashcard}
        text={selectedText}
        onClose={() => setShowFlashcard(false)}
      />
    </>
  );
};

// ============================================================
// STYLES
// ============================================================
const FONT_FAMILY = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

const styles = StyleSheet.create({
  // Pill
  pillWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 900,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_BG,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 242, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      } as any,
    }),
  },
  pillButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: 0.3,
    ...FONT_FAMILY,
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Flashcard
  flashcardBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashcardContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashcardInner: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 48,
    marginHorizontal: 24,
    maxWidth: SCREEN_WIDTH - 48,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: AURA_BLUE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 32,
      },
      android: { elevation: 20 },
    }),
  },
  flashcardText: {
    fontSize: 48,
    fontWeight: '800',
    color: TEXT_WHITE,
    textAlign: 'center',
    lineHeight: 56,
    ...FONT_FAMILY,
  },
  flashcardCloseBtn: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashcardHint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 12,
    color: TEXT_MUTED,
    ...FONT_FAMILY,
  },
});

export default AuraActionPill;
