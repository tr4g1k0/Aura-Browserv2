import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium Glossy Color Palette - AURA BRANDING
const AURA_BLUE = '#00F2FF';  // Official Aura accent color
const AURA_BLUE_GLOW = 'rgba(0, 242, 255, 0.3)';
const DANGER_RED = '#FF4444';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#555555';
const GOLD = '#FFD700';
const GOLD_GLOW = 'rgba(255, 215, 0, 0.3)';

// Legacy alias for compatibility
const ELECTRIC_CYAN = AURA_BLUE;
const ELECTRIC_CYAN_GLOW = AURA_BLUE_GLOW;

interface BrowserMenuProps {
  visible: boolean;
  onClose: () => void;
  currentUrl: string;
  currentTitle: string;
  isBookmarked?: boolean;
  isDesktopMode?: boolean;
  isReaderMode?: boolean;
  onToggleBookmark?: () => void;
  onToggleDesktopMode?: () => void;
  onToggleReaderMode?: () => void;
  onOpenDownloads?: () => void;
  onDownloadAllLinks?: () => void;
  onFindInPage?: () => void;
  onBurnSite?: () => void;
  onAISummarize?: () => void;
  onKidsMode?: () => void;
}

/**
 * Premium Glossy Glassmorphic Command Center
 * 
 * NOW WIRED WITH:
 * - Native Share API
 * - Settings navigation via expo-router
 * - History/Library navigation
 * - Golden Rule: Menu dismisses BEFORE any action
 */
export const BrowserMenu: React.FC<BrowserMenuProps> = ({
  visible,
  onClose,
  currentUrl,
  currentTitle,
  isBookmarked = false,
  isDesktopMode = false,
  isReaderMode = false,
  onToggleBookmark,
  onToggleDesktopMode,
  onToggleReaderMode,
  onOpenDownloads,
  onDownloadAllLinks,
  onFindInPage,
  onBurnSite,
  onAISummarize,
  onKidsMode,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ============================================================
  // GOLDEN RULE: Close menu FIRST, then perform action
  // ============================================================

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Share pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Then trigger native share sheet
    try {
      const result = await Share.share({
        message: currentTitle ? `${currentTitle}\n${currentUrl}` : currentUrl,
        url: Platform.OS === 'ios' ? currentUrl : undefined, // iOS supports separate URL
        title: currentTitle || 'Share this page',
      });
      
      if (result.action === Share.sharedAction) {
        console.log('[Menu] Share completed');
      } else if (result.action === Share.dismissedAction) {
        console.log('[Menu] Share dismissed');
      }
    } catch (error: any) {
      console.error('[Menu] Share error:', error);
      Alert.alert('Share Failed', 'Unable to share this page. Please try again.');
    }
  };

  const handleBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('[Menu] Bookmark pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Then toggle bookmark
    onToggleBookmark?.();
  };

  const handleFind = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Find in Page pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Trigger Find in Page mode via callback
    onFindInPage?.();
  };

  const handleDesktopMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Desktop Mode pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Then toggle desktop mode
    onToggleDesktopMode?.();
  };

  const handleAISummarize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] AI Summarize pressed');
    
    // Call the parent handler which handles menu closing and drawer opening
    onAISummarize?.();
  };

  const handleReaderMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Reader Mode pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Toggle Reader Mode via callback
    onToggleReaderMode?.();
  };

  const handleBurnSite = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    console.log('[Menu] Burn This Site pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Trigger Burn Site via callback - parent handles the WebView injection
    onBurnSite?.();
  };

  const handleHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] History pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Then navigate to library/history
    router.push('/library');
  };

  const handleDownloads = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Downloads pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Open Downloads Modal via callback
    onOpenDownloads?.();
  };

  const handleDownloadAllLinks = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Download All Links pressed');
    onClose();
    onDownloadAllLinks?.();
  };

  const handleSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Menu] Settings pressed');
    
    // GOLDEN RULE: Close menu first
    onClose();
    
    // Then navigate to settings
    router.push('/settings');
  };

  const handleKidsMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('[Menu] Kids Mode pressed');
    onClose();
    onKidsMode?.();
  };

  // ============================================================
  // GLOSSY GLASS BUTTON - Polished look with internal shadows
  // ============================================================
  const GlassButton: React.FC<{
    icon: string;
    label: string;
    onPress: () => void;
    isActive?: boolean;
    activeColor?: string;
    glowColor?: string;
  }> = ({ icon, label, onPress, isActive = false, activeColor = ELECTRIC_CYAN, glowColor = ELECTRIC_CYAN_GLOW }) => (
    <TouchableOpacity
      style={styles.glassButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[
        styles.glassButtonOuter,
        isActive && { borderColor: activeColor }
      ]}>
        <LinearGradient
          colors={
            isActive 
              ? [`${activeColor}15`, `${activeColor}25`]
              : ['rgba(255,255,255,0.9)', 'rgba(240,240,240,0.95)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.glassButtonGradient}
        >
          <View style={styles.glassButtonHighlight} />
          <View style={[
            styles.glassButtonIconWrapper,
            isActive && { 
              ...Platform.select({
                ios: {
                  shadowColor: activeColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                },
              })
            }
          ]}>
            <Ionicons
              name={icon as any}
              size={22}
              color={isActive ? activeColor : TEXT_SECONDARY}
            />
          </View>
        </LinearGradient>
      </View>
      <Text style={[
        styles.glassButtonLabel,
        isActive && { color: activeColor, fontWeight: '600' }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // MENU ROW - Smart Tools & Navigation
  // ============================================================
  const MenuRow: React.FC<{
    icon: string;
    label: string;
    onPress: () => void;
    isDanger?: boolean;
    emoji?: string;
  }> = ({ icon, label, onPress, isDanger = false, emoji }) => (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.menuRowIconContainer,
        isDanger && styles.menuRowIconContainerDanger
      ]}>
        {emoji ? (
          <Text style={styles.menuEmoji}>{emoji}</Text>
        ) : (
          <Ionicons
            name={icon as any}
            size={18}
            color={isDanger ? DANGER_RED : TEXT_SECONDARY}
          />
        )}
      </View>
      <Text style={[
        styles.menuLabel,
        isDanger && styles.menuLabelDanger
      ]}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={isDanger ? 'rgba(255,68,68,0.5)' : 'rgba(0,0,0,0.2)'}
      />
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Glossy Glassmorphic Command Center */}
      <View style={[styles.menuContainer, { top: insets.top + 56 }]}>
        <View style={styles.shadowLayer} />
        
        <LinearGradient
          colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.92)', 'rgba(250,250,250,0.95)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.menuGradient}
        >
          <View style={styles.reflectiveEdgeTop} />
          <View style={styles.reflectiveEdgeLeft} />
          <View style={styles.innerGlow} />

          {/* ============================================================ */}
          {/* ZONE 1: QUICK ACTION GRID */}
          {/* ============================================================ */}
          <View style={styles.quickActionsContainer}>
            <GlassButton
              icon="share-outline"
              label="Share"
              onPress={handleShare}
            />
            <GlassButton
              icon={isBookmarked ? "star" : "star-outline"}
              label="Bookmark"
              onPress={handleBookmark}
              isActive={isBookmarked}
              activeColor={GOLD}
              glowColor={GOLD_GLOW}
            />
            <GlassButton
              icon="search-outline"
              label="Find"
              onPress={handleFind}
            />
            <GlassButton
              icon={isDesktopMode ? "desktop" : "desktop-outline"}
              label="Desktop"
              onPress={handleDesktopMode}
              isActive={isDesktopMode}
            />
          </View>

          {/* Glossy Divider */}
          <View style={styles.dividerContainer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerGradient}
            />
          </View>

          {/* ============================================================ */}
          {/* ZONE 2: SMART TOOLS */}
          {/* ============================================================ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMART TOOLS</Text>
            <MenuRow
              emoji="✨"
              icon=""
              label="AI Summarize"
              onPress={handleAISummarize}
            />
            <MenuRow
              emoji="📖"
              icon=""
              label="Reader Mode"
              onPress={handleReaderMode}
              isActive={isReaderMode}
            />
            <MenuRow
              emoji="🔥"
              icon=""
              label="Burn This Site"
              onPress={handleBurnSite}
              isDanger
            />
          </View>

          {/* Glossy Divider */}
          <View style={styles.dividerContainer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerGradient}
            />
          </View>

          {/* ============================================================ */}
          {/* ZONE 3: NAVIGATION GATEWAYS */}
          {/* ============================================================ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NAVIGATE</Text>
            <MenuRow
              icon="time-outline"
              label="History"
              onPress={handleHistory}
            />
            <MenuRow
              icon="download-outline"
              label="Downloads"
              onPress={handleDownloads}
            />
            <MenuRow
              icon="cloud-download-outline"
              label="Download All Links"
              onPress={handleDownloadAllLinks}
            />
            <MenuRow
              icon="settings-outline"
              label="Settings"
              onPress={handleSettings}
            />
            <MenuRow
              emoji="🛡️"
              icon=""
              label="Kids Mode"
              onPress={handleKidsMode}
            />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// ============================================================
// PREMIUM GLOSSY GLASSMORPHIC STYLES
// ============================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  menuContainer: {
    position: 'absolute',
    right: 12,
    width: SCREEN_WIDTH * 0.72,
    maxWidth: 300,
    borderRadius: 20,
    overflow: 'visible',
  },
  shadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  menuGradient: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  reflectiveEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    zIndex: 10,
  },
  reflectiveEdgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  glassButtonContainer: {
    alignItems: 'center',
    width: 60,
  },
  glassButtonOuter: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  glassButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glassButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  glassButtonIconWrapper: {
    zIndex: 1,
  },
  glassButtonLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  dividerContainer: {
    paddingHorizontal: 16,
    height: 1,
  },
  dividerGradient: {
    flex: 1,
  },
  section: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuRowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuRowIconContainerDanger: {
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  menuEmoji: {
    fontSize: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_DARK,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  menuLabelDanger: {
    color: DANGER_RED,
    fontWeight: '600',
  },
});

export default BrowserMenu;
