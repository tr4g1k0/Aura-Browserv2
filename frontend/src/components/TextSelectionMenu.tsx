/**
 * TextSelectionMenu — Aura Browser Custom Text Selection Menu
 *
 * A bottom-sheet that replaces the default text-selection popup.
 * Shows a truncated preview of the selected text and 4 action tools:
 *  - Explain (AI — Coming Soon)
 *  - Summarize (AI — Coming Soon)
 *  - Secure Search (DuckDuckGo)
 *  - Copy
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Colors — Aura aesthetic
const DEEP_INDIGO = '#0A0A0F';
const CARD_BG = '#141419';
const BORDER_GLOW = 'rgba(0, 242, 255, 0.12)';
const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#8B8FA3';
const GOLD = '#FFD700';

interface TextSelectionMenuProps {
  visible: boolean;
  selectedText: string;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

interface ToolAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  testId: string;
}

export const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({
  visible,
  selectedText,
  onClose,
  onNavigate,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleExplain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Explain', 'AI-powered explanation coming soon.', [{ text: 'OK' }]);
    dismiss();
  };

  const handleSummarize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Summarize', 'AI-powered summarization coming soon.', [{ text: 'OK' }]);
    dismiss();
  };

  const handleSecureSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const query = encodeURIComponent(selectedText);
    onNavigate(`https://duckduckgo.com/?q=${query}`);
    dismiss();
  };

  const handleCopy = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(selectedText);
    dismiss();
  };

  // Truncate preview text
  const previewText = selectedText.length > 80
    ? `"${selectedText.substring(0, 77)}..."`
    : `"${selectedText}"`;

  const tools: ToolAction[] = [
    { icon: 'sparkles', label: 'Explain', color: GOLD, onPress: handleExplain, testId: 'text-menu-explain' },
    { icon: 'list-outline', label: 'Summarize', color: AURA_BLUE, onPress: handleSummarize, testId: 'text-menu-summarize' },
    { icon: 'shield-checkmark-outline', label: 'Secure Search', color: '#10B981', onPress: handleSecureSearch, testId: 'text-menu-secure-search' },
    { icon: 'copy-outline', label: 'Copy', color: TEXT_WHITE, onPress: handleCopy, testId: 'text-menu-copy' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
          data-testid="text-menu-backdrop"
        />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Selected text preview */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Selected</Text>
          <Text style={styles.previewText} numberOfLines={2}>{previewText}</Text>
        </View>

        {/* Tools Grid — 2x2 */}
        <View style={styles.toolsGrid}>
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.testId}
              style={styles.toolCard}
              onPress={tool.onPress}
              activeOpacity={0.65}
              data-testid={tool.testId}
            >
              <View style={[styles.toolIconCircle, { backgroundColor: `${tool.color}12` }]}>
                <Ionicons name={tool.icon} size={24} color={tool.color} />
              </View>
              <Text style={[styles.toolLabel, tool.color === GOLD && { color: GOLD }]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
};

const FONT_FAMILY = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DEEP_INDIGO,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: BORDER_GLOW,
    ...Platform.select({
      ios: {
        shadowColor: AURA_BLUE,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
    }),
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  previewContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
    ...FONT_FAMILY,
  },
  previewText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    fontStyle: 'italic',
    ...FONT_FAMILY,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  toolCard: {
    width: '47%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  toolIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_WHITE,
    ...FONT_FAMILY,
  },
});

export default TextSelectionMenu;
