/**
 * ImageContextMenu — Aura Browser Custom Image Long-Press Menu
 *
 * A bottom-sheet style menu that replaces the default browser context menu
 * for images. Shows a preview of the image and action buttons:
 *  - Download Securely
 *  - Copy Image URL
 *  - Share Image
 *  - Aura Vision (Extract Text) — Coming Soon
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
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

interface ImageContextMenuProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onDownload: (url: string) => void;
}

interface MenuAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  color: string;
  onPress: () => void;
  testId: string;
}

export const ImageContextMenu: React.FC<ImageContextMenuProps> = ({
  visible,
  imageUrl,
  onClose,
  onDownload,
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

  const handleCopyUrl = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(imageUrl);
    dismiss();
  };

  const handleDownload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDownload(imageUrl);
    dismiss();
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Cannot share on this device.');
        return;
      }
      // Share the image URL (native share sheet will handle it)
      await Sharing.shareAsync(imageUrl, { dialogTitle: 'Share Image' });
    } catch {
      // Fallback: copy URL
      await Clipboard.setStringAsync(imageUrl);
    }
    dismiss();
  };

  const handleAuraVision = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Aura Vision', 'AI-powered text extraction coming soon.', [{ text: 'OK' }]);
    dismiss();
  };

  const actions: MenuAction[] = [
    {
      icon: 'download-outline',
      label: 'Download Securely',
      sublabel: 'Save to Aura Downloads',
      color: AURA_BLUE,
      onPress: handleDownload,
      testId: 'image-menu-download',
    },
    {
      icon: 'copy-outline',
      label: 'Copy Image URL',
      sublabel: 'Copy link to clipboard',
      color: TEXT_WHITE,
      onPress: handleCopyUrl,
      testId: 'image-menu-copy-url',
    },
    {
      icon: 'share-outline',
      label: 'Share Image',
      sublabel: 'Send via other apps',
      color: TEXT_WHITE,
      onPress: handleShare,
      testId: 'image-menu-share',
    },
    {
      icon: 'sparkles',
      label: 'Aura Vision',
      sublabel: 'Extract text from image',
      color: GOLD,
      onPress: handleAuraVision,
      testId: 'image-menu-aura-vision',
    },
  ];

  // Truncate URL for display
  const displayUrl = imageUrl.length > 60 ? imageUrl.substring(0, 57) + '...' : imageUrl;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismiss}
          data-testid="image-menu-backdrop"
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

        {/* Image Preview */}
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewUrl} numberOfLines={1}>{displayUrl}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.testId}
              style={styles.actionRow}
              onPress={action.onPress}
              activeOpacity={0.65}
              data-testid={action.testId}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}12` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionLabel, { color: action.color === GOLD ? GOLD : TEXT_WHITE }]}>
                  {action.label}
                </Text>
                {action.sublabel && (
                  <Text style={styles.actionSublabel}>{action.sublabel}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
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
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#1A1A24',
  },
  previewOverlay: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(10,10,15,0.85)',
  },
  previewUrl: {
    fontSize: 11,
    color: TEXT_MUTED,
    ...FONT_FAMILY,
  },
  actionsContainer: {
    paddingHorizontal: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
    ...FONT_FAMILY,
  },
  actionSublabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
    ...FONT_FAMILY,
  },
});

export default ImageContextMenu;
