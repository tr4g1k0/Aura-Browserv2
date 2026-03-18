import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../store/browserStore';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

// Premium Color Palette
const ELECTRIC_CYAN = '#00FFFF';
const CAPTION_GREEN = '#00FF88';
const AMBIENT_ORANGE = '#FFB800';
const CONVERSE_BLUE = '#00A3FF';
const GLASS_BG = 'rgba(255, 255, 255, 0.05)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.1)';

interface AccessibilityModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: () => void;
  delay?: number;
}

// ============================================================
// FEATURE CARD - Premium glassmorphic toggle card
// ============================================================
const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onValueChange,
  delay = 0,
}) => {
  const isWeb = Platform.OS === 'web';
  const iconBgColor = `${iconColor}15`;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange();
  };

  const cardContent = (
    <>
      {/* Icon Container */}
      <View style={[styles.cardIcon, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>

      {/* Switch */}
      <Switch
        value={value}
        onValueChange={handleToggle}
        trackColor={{ false: '#333', true: ELECTRIC_CYAN }}
        thumbColor="#FFF"
        ios_backgroundColor="#333"
      />
    </>
  );

  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={styles.cardWrapper}
    >
      {isWeb ? (
        <View style={styles.card}>
          <View style={styles.cardHighlight} />
          {cardContent}
        </View>
      ) : (
        <BlurView tint="dark" intensity={20} style={styles.card}>
          <View style={styles.cardHighlight} />
          {cardContent}
        </BlurView>
      )}
    </Animated.View>
  );
};

// ============================================================
// MAIN ACCESSIBILITY MODAL
// ============================================================
export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const {
    settings,
    toggleLiveCaptioning,
    toggleAmbientAwareness,
    toggleQuickConverse,
  } = useBrowserStore();

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const modalContent = (
    <>
      {/* Top Cyan Highlight Border */}
      <View style={styles.topHighlight} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="accessibility" size={24} color={ELECTRIC_CYAN} />
          </View>
          <Text style={styles.title}>Accessibility Engine</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Break down real-world communication barriers with AI-powered features.
      </Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Feature Cards */}
      <View style={styles.cardsContainer}>
        {/* Card 1: Live Captioning */}
        <FeatureCard
          icon="text"
          iconColor={CAPTION_GREEN}
          title="Live Captioning"
          subtitle="Generate real-time text overlays for any audio playing through the browser."
          value={settings.liveCaptioningEnabled}
          onValueChange={toggleLiveCaptioning}
          delay={100}
        />

        {/* Card 2: Ambient Awareness */}
        <FeatureCard
          icon="ear"
          iconColor={AMBIENT_ORANGE}
          title="Ambient Awareness"
          subtitle="Listen for environmental sounds and translate them into visual alerts and haptic feedback."
          value={settings.ambientAwarenessEnabled}
          onValueChange={toggleAmbientAwareness}
          delay={200}
        />

        {/* Card 3: Quick Converse */}
        <FeatureCard
          icon="chatbubbles"
          iconColor={CONVERSE_BLUE}
          title="Quick Converse"
          subtitle="Activate an instant split-screen communication board to speak face-to-face."
          value={settings.quickConverseEnabled}
          onValueChange={toggleQuickConverse}
          delay={300}
        />
      </View>

      {/* Privacy Footer */}
      <Animated.View 
        entering={FadeIn.delay(400).duration(500)}
        style={styles.privacyFooter}
      >
        <View style={styles.privacyIconContainer}>
          <Ionicons name="shield-checkmark" size={16} color="#555" />
        </View>
        <Text style={styles.privacyText}>
          Audio is processed locally on your device. No data is sent to external servers.
        </Text>
      </Animated.View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable 
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 24) + 10 }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {isWeb ? (
            <View style={styles.contentWrapper}>
              {modalContent}
            </View>
          ) : (
            <BlurView tint="dark" intensity={40} style={styles.contentWrapper}>
              {modalContent}
            </BlurView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ============================================================
// STYLES - Premium Glassmorphic Design
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  contentWrapper: {
    backgroundColor: 'rgba(20, 20, 25, 0.98)',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
      web: {
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: ELECTRIC_CYAN,
    ...Platform.select({
      ios: {
        shadowColor: ELECTRIC_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
    }),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
    marginBottom: 20,
    marginLeft: 52,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  divider: {
    height: 1,
    backgroundColor: GLASS_BORDER,
    marginBottom: 20,
  },

  // Cards Container
  cardsContainer: {
    gap: 12,
  },

  // Individual Card
  cardWrapper: {
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#777',
    lineHeight: 17,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },

  // Privacy Footer
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  privacyIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(85, 85, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  privacyText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    flex: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
});

export default AccessibilityModal;
