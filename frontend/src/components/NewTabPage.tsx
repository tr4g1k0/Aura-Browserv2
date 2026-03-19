import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePrivacy } from '../context/PrivacyContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';
import { useBrowserStore, QuickLink } from '../store/browserStore';

// Conditionally import CameraView for QR scanning
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const CameraModule = require('expo-camera');
    CameraView = CameraModule.CameraView;
    useCameraPermissions = CameraModule.useCameraPermissions;
  } catch (e) {
    console.log('expo-camera not available');
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Color Palette - AURA BRANDING
const AURA_BLUE = '#00F2FF';  // Official Aura accent color
const AURA_BLUE_GLOW = 'rgba(0, 242, 255, 0.15)';
const SHIELD_GREEN = '#00FF88';
const DEEP_BLACK = '#050508';
const DEEP_INDIGO = '#0A0A0F';  // Aura background
const GLASS_WHITE = 'rgba(255, 255, 255, 0.05)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.12)';
const MUTED_GRAY = '#888888';
const OFFLINE_GRAY = '#666666';

// Legacy alias for compatibility
const ELECTRIC_CYAN = AURA_BLUE;
const ELECTRIC_CYAN_GLOW = AURA_BLUE_GLOW;

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  onSearch: (query: string) => void;
  onOpenMenu?: () => void;
  onAISummarize?: () => void;
  onAccessibility?: () => void;
}

// Get first letter of title for display
const getInitial = (title: string): string => {
  return title.charAt(0).toUpperCase();
};

// Check if input looks like a URL
const isLikelyUrl = (input: string): boolean => {
  const trimmed = input.trim().toLowerCase();
  // Has no spaces and contains a dot (likely a domain)
  if (!trimmed.includes(' ') && trimmed.includes('.')) {
    return true;
  }
  // Starts with http:// or https://
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }
  // Common TLDs
  const tlds = ['.com', '.org', '.net', '.io', '.co', '.dev', '.app', '.ai'];
  return tlds.some(tld => trimmed.endsWith(tld));
};

// Format URL with https if needed
const formatUrl = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

// Get search URL based on engine
const getSearchUrl = (query: string, engine: string): string => {
  const encodedQuery = encodeURIComponent(query);
  switch (engine) {
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encodedQuery}`;
    case 'bing':
      return `https://www.bing.com/search?q=${encodedQuery}`;
    case 'google':
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
};

// Extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
};

// ============================================================
// IMMERSIVE BACKDROP - Deep gradient with Electric Cyan orb
// ============================================================
const ImmersiveBackdrop: React.FC = () => {
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const orbStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseValue.value, [0, 1], [1, 1.15]);
    const opacity = interpolate(pulseValue.value, [0, 1], [0.08, 0.15]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={styles.backdropContainer}>
      <LinearGradient
        colors={[DEEP_BLACK, '#0A0A12', '#080810', DEEP_BLACK]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View style={[styles.cyanOrb, orbStyle]}>
        <LinearGradient
          colors={['rgba(0, 255, 255, 0.3)', 'rgba(0, 255, 255, 0.05)', 'transparent']}
          style={styles.orbGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <View style={styles.purpleOrb}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.08)', 'transparent']}
          style={styles.orbGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <View style={styles.noiseOverlay} />
    </View>
  );
};

// ============================================================
// AI SHIELD STATUS WIDGET - Wired to strictLocalAI setting
// ============================================================
const AIShieldStatus: React.FC<{ isAIActive: boolean }> = ({ isAIActive }) => {
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    if (isAIActive) {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseValue.value = withTiming(0.5, { duration: 300 });
    }
  }, [isAIActive]);

  const dotStyle = useAnimatedStyle(() => {
    const scale = isAIActive ? interpolate(pulseValue.value, [0, 1], [1, 1.3]) : 1;
    const opacity = isAIActive ? interpolate(pulseValue.value, [0, 1], [0.7, 1]) : 0.5;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const isWeb = Platform.OS === 'web';
  const dotColor = isAIActive ? SHIELD_GREEN : OFFLINE_GRAY;
  // AURA BRANDING: Updated status text
  const statusText = isAIActive ? 'Aura Active' : 'AI Offline';
  const subText = 'Shielding your data';

  return (
    <Animated.View 
      entering={FadeIn.delay(400).duration(600)}
      style={styles.shieldStatusContainer}
    >
      {isWeb ? (
        <View style={styles.shieldStatusPill}>
          <View style={styles.shieldStatusHighlight} />
          <Animated.View style={[styles.statusDot, { backgroundColor: dotColor }, dotStyle]} />
          <Text style={[styles.shieldStatusText, { color: dotColor }]}>{statusText}</Text>
          <View style={styles.shieldDivider} />
          <Ionicons name="shield-checkmark" size={14} color={dotColor} />
          <Text style={styles.shieldStatusSubtext}>{subText}</Text>
        </View>
      ) : (
        <BlurView tint="dark" intensity={40} style={styles.shieldStatusPill}>
          <View style={styles.shieldStatusHighlight} />
          <Animated.View style={[styles.statusDot, { backgroundColor: dotColor }, dotStyle]} />
          <Text style={[styles.shieldStatusText, { color: dotColor }]}>{statusText}</Text>
          <View style={styles.shieldDivider} />
          <Ionicons name="shield-checkmark" size={14} color={dotColor} />
          <Text style={styles.shieldStatusSubtext}>{subText}</Text>
        </BlurView>
      )}
    </Animated.View>
  );
};

// ============================================================
// AURA BREATHING LOGO - Slow pulsing animation giving "alive" effect
// ============================================================
const AuraBreathingLogo: React.FC = () => {
  const breatheValue = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Slow breathing animation - 4 seconds per cycle
    breatheValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    
    // Glow pulse animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => {
    const scale = interpolate(breatheValue.value, [0, 1], [1, 1.08]);
    return {
      transform: [{ scale }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(breatheValue.value, [0, 1], [1, 1.3]);
    return {
      opacity: glowOpacity.value,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.logoContainer}>
      {/* Outer breathing glow */}
      <Animated.View style={[styles.logoGlowOuter, glowStyle]} />
      {/* Inner glow */}
      <View style={styles.logoGlow} />
      {/* Breathing icon */}
      <Animated.View style={logoStyle}>
        <Ionicons name="shield-checkmark" size={56} color={SHIELD_GREEN} />
      </Animated.View>
    </View>
  );
};

// ============================================================
// QUICK LINK ORB - Circular glassmorphic tile
// ============================================================
const QuickLinkOrb: React.FC<{
  link: QuickLink;
  index: number;
  onPress: (url: string) => void;
  onLongPress: (link: QuickLink) => void;
}> = ({ link, index, onPress, onLongPress }) => {
  const scale = useSharedValue(0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 80 + 500,
      withSpring(1, { damping: 14, stiffness: 120 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * (1 - pressed.value * 0.08) },
      { translateY: interpolate(scale.value, [0, 1], [30, 0]) },
    ],
    opacity: scale.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * 0.8,
    transform: [{ scale: 1 + pressed.value * 0.15 }],
  }));

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 250 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(link.url);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(link);
  };

  const isWeb = Platform.OS === 'web';
  const linkColor = link.color || SHIELD_GREEN;

  return (
    <Animated.View style={[styles.orbWrapper, animatedStyle]}>
      <Animated.View style={[styles.orbGlowEffect, { backgroundColor: linkColor }, glowStyle]} />
      
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={styles.orbTouchable}
      >
        {isWeb ? (
          <View style={styles.orbTile}>
            <View style={styles.orbHighlight} />
            <View style={[styles.orbIconContainer, { backgroundColor: `${linkColor}15` }]}>
              {link.icon ? (
                <Ionicons name={link.icon as any} size={26} color="#FFF" />
              ) : (
                <Text style={[styles.orbInitial, { color: linkColor }]}>
                  {getInitial(link.title)}
                </Text>
              )}
            </View>
            <Text style={styles.orbLabel} numberOfLines={1}>{link.title}</Text>
          </View>
        ) : (
          <BlurView tint="dark" intensity={30} style={styles.orbTile}>
            <View style={styles.orbHighlight} />
            <View style={[styles.orbIconContainer, { backgroundColor: `${linkColor}15` }]}>
              {link.icon ? (
                <Ionicons name={link.icon as any} size={26} color="#FFF" />
              ) : (
                <Text style={[styles.orbInitial, { color: linkColor }]}>
                  {getInitial(link.title)}
                </Text>
              )}
            </View>
            <Text style={styles.orbLabel} numberOfLines={1}>{link.title}</Text>
          </BlurView>
        )}
      </Pressable>
    </Animated.View>
  );
};

// ============================================================
// ADD BUTTON ORB - Dashed border with transparent background
// ============================================================
const AddButtonOrb: React.FC<{
  index: number;
  onPress: () => void;
}> = ({ index, onPress }) => {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 80 + 500,
      withSpring(1, { damping: 14, stiffness: 120 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.orbWrapper, animatedStyle]}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.8}
        style={styles.orbTouchable}
      >
        <View style={styles.addOrbTile}>
          <View style={styles.addOrbIconContainer}>
            <Ionicons name="add" size={28} color="rgba(255, 255, 255, 0.6)" />
          </View>
          <Text style={styles.addOrbLabel}>Add</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// PRIVACY METRICS DASHBOARD - Glassmorphic Monolith
// ============================================================
const PrivacyMetricsDashboard: React.FC = () => {
  // Get real metrics from Privacy Context
  const { adsBlockedCount, trackersBlockedCount } = usePrivacy();

  // Format numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <Animated.View 
      entering={FadeIn.delay(400).duration(600)}
      style={styles.metricsDashboard}
    >
      {/* Header - Status Indicator */}
      <View style={styles.metricsHeader}>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDotGlow} />
          <View style={styles.statusDot} />
        </View>
        <Text style={styles.statusText}>AURA SHIELD ACTIVE</Text>
      </View>

      {/* Metrics Grid - Each column takes exactly 33.3% */}
      <View style={styles.metricsGrid}>
        {/* Column 1: Trackers Blocked */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>
            {formatNumber(trackersBlockedCount)}
          </Text>
          <Text style={styles.metricLabel}>Trackers Blocked</Text>
        </View>

        {/* Column 2: Ads Stopped */}
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>
            {formatNumber(adsBlockedCount)}
          </Text>
          <Text style={styles.metricLabel}>Ads Stopped</Text>
        </View>

        {/* Column 3: Connection Status */}
        <View style={styles.metricColumn}>
          <Text style={[styles.metricValue, styles.metricValueCyan]}>
            Secure
          </Text>
          <Text style={styles.metricLabel}>Connection</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================================
// QR SCANNER MODAL
// ============================================================
const QRScannerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
}> = ({ visible, onClose, onScan }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && Platform.OS !== 'web' && useCameraPermissions) {
      (async () => {
        try {
          const { status } = await require('expo-camera').Camera.requestCameraPermissionsAsync();
          setHasPermission(status === 'granted');
        } catch (e) {
          console.log('Camera permission error:', e);
          setHasPermission(false);
        }
      })();
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Check if the scanned data is a URL
    if (data.startsWith('http://') || data.startsWith('https://') || isLikelyUrl(data)) {
      onScan(formatUrl(data));
      onClose();
    } else {
      Alert.alert(
        'QR Code Scanned',
        `Content: ${data}\n\nThis doesn't appear to be a URL. Would you like to search for it?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
          { 
            text: 'Search', 
            onPress: () => {
              onScan(getSearchUrl(data, 'google'));
              onClose();
            }
          },
        ]
      );
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.qrModalOverlay}>
          <Pressable style={styles.qrModalBackdrop} onPress={handleClose} />
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>QR Scanner</Text>
            <Text style={styles.qrModalText}>QR scanning is not available on web.</Text>
            <TouchableOpacity style={styles.qrCloseButton} onPress={handleClose}>
              <Text style={styles.qrCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!CameraView) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.qrModalOverlay}>
          <Pressable style={styles.qrModalBackdrop} onPress={handleClose} />
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>QR Scanner</Text>
            <Text style={styles.qrModalText}>Camera not available. Please install expo-camera.</Text>
            <TouchableOpacity style={styles.qrCloseButton} onPress={handleClose}>
              <Text style={styles.qrCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.qrScannerContainer}>
        {hasPermission === null ? (
          <View style={styles.qrLoadingContainer}>
            <Text style={styles.qrLoadingText}>Requesting camera permission...</Text>
          </View>
        ) : hasPermission === false ? (
          <View style={styles.qrLoadingContainer}>
            <Ionicons name="camera-outline" size={48} color={MUTED_GRAY} />
            <Text style={styles.qrLoadingText}>Camera permission denied</Text>
            <Text style={styles.qrSubText}>Please enable camera access in settings</Text>
            <TouchableOpacity style={styles.qrCloseButton} onPress={handleClose}>
              <Text style={styles.qrCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            <View style={styles.qrOverlay}>
              <View style={styles.qrHeader}>
                <TouchableOpacity onPress={handleClose} style={styles.qrBackButton}>
                  <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.qrHeaderTitle}>Scan QR Code</Text>
                <View style={{ width: 44 }} />
              </View>
              <View style={styles.qrFrameContainer}>
                <View style={styles.qrFrame}>
                  <View style={[styles.qrCorner, styles.qrCornerTL]} />
                  <View style={[styles.qrCorner, styles.qrCornerTR]} />
                  <View style={[styles.qrCorner, styles.qrCornerBL]} />
                  <View style={[styles.qrCorner, styles.qrCornerBR]} />
                </View>
              </View>
              <Text style={styles.qrInstructions}>Point your camera at a QR code</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

// ============================================================
// FLOATING ISLAND DOCK - Full navigation with all icons
// ============================================================
const FloatingIslandDock: React.FC<{
  onSearch: (query: string) => void;
  onNavigate: (url: string) => void;
  searchEngineName: string;
  defaultSearchEngine: string;
  currentUrl?: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onHome: () => void;
  onLibrary: () => void;
  onAISummarize: () => void;
  onAccessibility: () => void;
  onTabs: () => void;
  onMenu: () => void;
  onQRScan: () => void;
}> = ({ 
  onSearch, 
  onNavigate,
  searchEngineName, 
  defaultSearchEngine,
  currentUrl,
  isBookmarked,
  onToggleBookmark,
  onHome,
  onLibrary,
  onAISummarize,
  onAccessibility,
  onTabs,
  onMenu,
  onQRScan,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const focusScale = useSharedValue(1);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFocused(true);
    focusScale.value = withSpring(1.02, { damping: 15, stiffness: 150 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    
    if (isLikelyUrl(trimmed)) {
      // Navigate to URL
      onNavigate(formatUrl(trimmed));
    } else {
      // Search using default search engine
      onSearch(getSearchUrl(trimmed, defaultSearchEngine));
    }
    setInputValue('');
  };

  const handleVoiceSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      '🎤 Voice Search',
      'Dictation keyboard activated. Tap the microphone on your keyboard to speak.',
      [{ text: 'OK' }]
    );
    // Focus the input to bring up the keyboard (which has dictation)
    inputRef.current?.focus();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
  }));

  const isWeb = Platform.OS === 'web';
  const displayUrl = currentUrl ? extractDomain(currentUrl) : searchEngineName;

  return (
    <Animated.View 
      entering={FadeInUp.delay(600).duration(500).springify()}
      style={[
        styles.floatingDockContainer,
        { marginBottom: Math.max(insets.bottom, 20) + 10 }
      ]}
    >
      <Animated.View style={[styles.floatingDockWrapper, animatedStyle]}>
        {isWeb ? (
          <View style={styles.floatingDock}>
            <View style={styles.dockHighlight} />
            <View style={styles.dockContent}>
              {/* Search Input */}
              <View style={styles.dockSearchContainer}>
                <Ionicons 
                  name="search" 
                  size={20} 
                  color={isFocused ? ELECTRIC_CYAN : '#666'} 
                  style={styles.dockSearchIcon}
                />
                <TextInput
                  ref={inputRef}
                  style={styles.dockSearchInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmitEditing={handleSubmit}
                  placeholder={`Search or enter URL`}
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  selectionColor={ELECTRIC_CYAN}
                />
                {inputValue.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setInputValue('')}
                    style={styles.dockClearButton}
                  >
                    <Ionicons name="close-circle" size={18} color="#555" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.dockDivider} />

              {/* Voice Search */}
              <TouchableOpacity style={styles.dockIconButton} onPress={handleVoiceSearch}>
                <Ionicons name="mic-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* QR Scanner */}
              <TouchableOpacity style={styles.dockIconButton} onPress={onQRScan}>
                <Ionicons name="qr-code-outline" size={20} color={MUTED_GRAY} />
              </TouchableOpacity>
            </View>

            {/* Navigation Row */}
            <View style={styles.dockNavRow}>
              {/* Home */}
              <TouchableOpacity style={styles.navIconButton} onPress={onHome}>
                <Ionicons name="home-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* Bookmark */}
              <TouchableOpacity style={styles.navIconButton} onPress={onToggleBookmark}>
                <Ionicons 
                  name={isBookmarked ? "star" : "star-outline"} 
                  size={22} 
                  color={isBookmarked ? ELECTRIC_CYAN : MUTED_GRAY} 
                />
              </TouchableOpacity>

              {/* Accessibility */}
              <TouchableOpacity style={styles.navIconButton} onPress={onAccessibility}>
                <Ionicons name="accessibility-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* AI Summarize */}
              <TouchableOpacity style={styles.navIconButton} onPress={onAISummarize}>
                <Ionicons name="sparkles-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* Tabs */}
              <TouchableOpacity style={styles.navIconButton} onPress={onTabs}>
                <View style={styles.tabsIconContainer}>
                  <Text style={styles.tabsIconText}>1</Text>
                </View>
              </TouchableOpacity>

              {/* Menu */}
              <TouchableOpacity style={styles.navIconButton} onPress={onMenu}>
                <Ionicons name="ellipsis-vertical" size={20} color={MUTED_GRAY} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <BlurView tint="dark" intensity={60} style={styles.floatingDock}>
            <View style={styles.dockHighlight} />
            <View style={styles.dockContent}>
              {/* Search Input */}
              <View style={styles.dockSearchContainer}>
                <Ionicons 
                  name="search" 
                  size={20} 
                  color={isFocused ? ELECTRIC_CYAN : '#666'} 
                  style={styles.dockSearchIcon}
                />
                <TextInput
                  ref={inputRef}
                  style={styles.dockSearchInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmitEditing={handleSubmit}
                  placeholder={`Search or enter URL`}
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  selectionColor={ELECTRIC_CYAN}
                />
                {inputValue.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setInputValue('')}
                    style={styles.dockClearButton}
                  >
                    <Ionicons name="close-circle" size={18} color="#555" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.dockDivider} />

              {/* Voice Search */}
              <TouchableOpacity style={styles.dockIconButton} onPress={handleVoiceSearch}>
                <Ionicons name="mic-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* QR Scanner */}
              <TouchableOpacity style={styles.dockIconButton} onPress={onQRScan}>
                <Ionicons name="qr-code-outline" size={20} color={MUTED_GRAY} />
              </TouchableOpacity>
            </View>

            {/* Navigation Row */}
            <View style={styles.dockNavRow}>
              {/* Home */}
              <TouchableOpacity style={styles.navIconButton} onPress={onHome}>
                <Ionicons name="home-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* Bookmark */}
              <TouchableOpacity style={styles.navIconButton} onPress={onToggleBookmark}>
                <Ionicons 
                  name={isBookmarked ? "star" : "star-outline"} 
                  size={22} 
                  color={isBookmarked ? ELECTRIC_CYAN : MUTED_GRAY} 
                />
              </TouchableOpacity>

              {/* Accessibility */}
              <TouchableOpacity style={styles.navIconButton} onPress={onAccessibility}>
                <Ionicons name="accessibility-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* AI Summarize */}
              <TouchableOpacity style={styles.navIconButton} onPress={onAISummarize}>
                <Ionicons name="sparkles-outline" size={22} color={MUTED_GRAY} />
              </TouchableOpacity>

              {/* Tabs */}
              <TouchableOpacity style={styles.navIconButton} onPress={onTabs}>
                <View style={styles.tabsIconContainer}>
                  <Text style={styles.tabsIconText}>1</Text>
                </View>
              </TouchableOpacity>

              {/* Menu */}
              <TouchableOpacity style={styles.navIconButton} onPress={onMenu}>
                <Ionicons name="ellipsis-vertical" size={20} color={MUTED_GRAY} />
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </Animated.View>
    </Animated.View>
  );
};

// ============================================================
// ADD LINK MODAL - Premium glassmorphic modal
// ============================================================
const AddLinkModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, url: string) => void;
}> = ({ visible, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      Alert.alert('Error', 'Please enter a site name.');
      return;
    }
    if (!trimmedUrl) {
      Alert.alert('Error', 'Please enter a URL.');
      return;
    }
    if (!isLikelyUrl(trimmedUrl) && !trimmedUrl.includes('.')) {
      Alert.alert('Invalid URL', 'Please enter a valid website URL (e.g., google.com)');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(trimmedTitle, formatUrl(trimmedUrl));
    setTitle('');
    setUrl('');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    onClose();
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        
        {isWeb ? (
          <View style={styles.modalContent}>
            <View style={styles.modalHighlight} />
            <Text style={styles.modalTitle}>Add Quick Link</Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>Site Name</Text>
              <TextInput
                style={styles.modalInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., GitHub"
                placeholderTextColor="#555"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>URL</Text>
              <TextInput
                style={styles.modalInput}
                value={url}
                onChangeText={setUrl}
                placeholder="e.g., github.com"
                placeholderTextColor="#555"
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <BlurView tint="dark" intensity={80} style={styles.modalContent}>
            <View style={styles.modalHighlight} />
            <Text style={styles.modalTitle}>Add Quick Link</Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>Site Name</Text>
              <TextInput
                style={styles.modalInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., GitHub"
                placeholderTextColor="#555"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>URL</Text>
              <TextInput
                style={styles.modalInput}
                value={url}
                onChangeText={setUrl}
                placeholder="e.g., github.com"
                placeholderTextColor="#555"
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================================
// MAIN NEW TAB PAGE COMPONENT
// ============================================================
export const NewTabPage: React.FC<NewTabPageProps> = ({ onNavigate, onSearch, onOpenMenu, onAISummarize, onAccessibility }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { 
    quickLinks, 
    addQuickLink, 
    removeQuickLink,
    bookmarks,
    toggleBookmark,
    isBookmarked,
    tabs,
  } = useBrowserStore();
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [qrScannerVisible, setQRScannerVisible] = useState(false);

  // AI Active status based on strictLocalAI setting
  const isAIActive = settings.strictLocalAI;

  const searchEngineName = settings.defaultSearchEngine === 'duckduckgo' 
    ? 'DuckDuckGo' 
    : settings.defaultSearchEngine === 'bing' 
      ? 'Bing' 
      : 'Google';

  const handleQuickLinkPress = (url: string) => {
    onNavigate(url);
  };

  const handleQuickLinkLongPress = (link: QuickLink) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Delete "${link.title}" shortcut?`);
      if (confirmed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        removeQuickLink(link.id);
      }
    } else {
      Alert.alert(
        'Delete Shortcut',
        `Do you want to delete "${link.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              removeQuickLink(link.id);
            },
          },
        ]
      );
    }
  };

  const handleAddLink = (title: string, url: string) => {
    addQuickLink(title, url);
  };

  const handleHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Already on home/new tab page, could refresh or do nothing
    Alert.alert('Home', 'You are already on the Home screen.');
  };

  const handleToggleBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // On new tab page, nothing to bookmark
    Alert.alert('Bookmark', 'Navigate to a website first to bookmark it.');
  };

  const handleLibrary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/library');
  };

  const handleAISummarize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Call parent handler if provided, otherwise show alert
    if (onAISummarize) {
      onAISummarize();
    } else {
      Alert.alert(
        '✨ AI Summarize',
        'Navigate to a website first to get an AI-powered summary of the page content.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTabs = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/tabs-manager');
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Call parent handler to open BrowserMenu
    if (onOpenMenu) {
      onOpenMenu();
    } else {
      // Fallback to settings
      router.push('/settings');
    }
  };

  const handleAccessibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Call parent handler to open AccessibilityModal
    if (onAccessibility) {
      onAccessibility();
    } else {
      Alert.alert('Accessibility', 'Accessibility features are available when browsing.');
    }
  };

  const handleQRScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQRScannerVisible(true);
  };

  const handleQRScanned = (url: string) => {
    setQRScannerVisible(false);
    onNavigate(url);
  };

  return (
    <View style={styles.container}>
      {/* Immersive Backdrop with Aura Blue Orb */}
      <ImmersiveBackdrop />

      {/* Main Content */}
      <View style={[styles.content, { paddingTop: insets.top + 30 }]}>
        
        {/* AURA SHIELD DASHBOARD - Top Section */}
        <Animated.View 
          entering={FadeIn.delay(100).duration(800)}
          style={styles.brandingContainer}
        >
          {/* Premium Breathing Logo */}
          <AuraBreathingLogo />
          
          {/* Brand Title - AURA with wide kerning */}
          <Text style={styles.brandTitle}>AURA</Text>
          
          {/* AI Shield Status Widget - Wired to strictLocalAI */}
          <AIShieldStatus isAIActive={isAIActive} />
        </Animated.View>

        {/* FLOATING QUICK LINK ORBS - Middle Section */}
        <Animated.View 
          entering={FadeIn.delay(300).duration(600)}
          style={styles.quickLinksSection}
        >
          <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickLinksScrollContent}
            style={styles.quickLinksScroll}
          >
            {quickLinks.map((link, index) => (
              <QuickLinkOrb
                key={link.id}
                link={link}
                index={index}
                onPress={handleQuickLinkPress}
                onLongPress={handleQuickLinkLongPress}
              />
            ))}
            <AddButtonOrb
              index={quickLinks.length}
              onPress={() => setAddModalVisible(true)}
            />
          </ScrollView>
        </Animated.View>

        {/* PRIVACY METRICS DASHBOARD - Glassmorphic Monolith */}
        <PrivacyMetricsDashboard />

        {/* FLOATING ISLAND DOCK - Bottom Section */}
        <FloatingIslandDock 
          onSearch={onSearch}
          onNavigate={onNavigate}
          searchEngineName={searchEngineName}
          defaultSearchEngine={settings.defaultSearchEngine}
          isBookmarked={false}
          onToggleBookmark={handleToggleBookmark}
          onHome={handleHome}
          onLibrary={handleLibrary}
          onAISummarize={handleAISummarize}
          onTabs={handleTabs}
          onMenu={handleMenu}
          onQRScan={handleQRScan}
        />
      </View>

      {/* Add Quick Link Modal */}
      <AddLinkModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={handleAddLink}
      />

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQRScannerVisible(false)}
        onScan={handleQRScanned}
      />
    </View>
  );
};

// ============================================================
// STYLES - Premium Glassmorphic Design System
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEEP_BLACK,
  },

  // ============== BACKDROP ==============
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  cyanOrb: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.1,
    left: SCREEN_WIDTH * 0.5 - SCREEN_WIDTH * 0.6,
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH * 0.6,
  },
  purpleOrb: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.2,
    right: -SCREEN_WIDTH * 0.3,
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    opacity: 0.5,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    backgroundColor: '#FFF',
  },

  // ============== CONTENT ==============
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    justifyContent: 'space-evenly',
  },

  // ============== BRANDING ==============
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    position: 'relative',
  },
  logoGlowOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 242, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: AURA_BLUE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
    }),
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: SHIELD_GREEN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
      },
    }),
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 18,  // Wide kerning for modern look
    marginBottom: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },

  // ============== AI SHIELD STATUS ==============
  shieldStatusContainer: {
    marginTop: 4,
  },
  shieldStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: GLASS_WHITE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    position: 'relative',
  },
  shieldStatusHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  shieldStatusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shieldDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  shieldStatusSubtext: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
  },

  // ============== QUICK LINKS SECTION ==============
  quickLinksSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2.5,
    marginBottom: 20,
  },
  quickLinksScroll: {
    width: '100%',
  },
  quickLinksScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  // Keep orbsGrid for backwards compatibility but no longer used
  orbsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 360,
  },

  // ============== ORB TILES ==============
  orbWrapper: {
    position: 'relative',
  },
  orbGlowEffect: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 28,
    opacity: 0,
  },
  orbTouchable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  orbTile: {
    width: 76,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_WHITE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    position: 'relative',
  },
  orbHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  orbIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  orbLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#AAA',
    textAlign: 'center',
    maxWidth: 66,
  },
  orbInitial: {
    fontSize: 22,
    fontWeight: '700',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },

  // ============== ADD BUTTON ORB ==============
  addOrbGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'transparent',
    opacity: 0,
  },
  addOrbTile: {
    width: 76,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    position: 'relative',
  },
  addOrbHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    backgroundColor: 'transparent',
  },
  addOrbIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addOrbLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // ============== PRIVACY METRICS DASHBOARD ==============
  metricsDashboard: {
    alignSelf: 'center',
    width: '90%',
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    marginRight: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SHIELD_GREEN,
    opacity: 0.4,
    ...Platform.select({
      ios: {
        shadowColor: SHIELD_GREEN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      web: {
        boxShadow: `0 0 10px ${SHIELD_GREEN}`,
      },
    }),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SHIELD_GREEN,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#666',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  metricValueCyan: {
    color: AURA_BLUE,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },

  // ============== FLOATING ISLAND DOCK ==============
  floatingDockContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  floatingDockWrapper: {
    width: '100%',
  },
  floatingDock: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  dockHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 10,
  },
  dockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
  },
  dockSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockSearchIcon: {
    marginRight: 10,
  },
  dockSearchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: '100%',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        outlineStyle: 'none',
      },
    }),
  },
  dockClearButton: {
    padding: 4,
    marginLeft: 4,
  },
  dockDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 12,
  },
  dockIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // Navigation Row in Dock
  dockNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  navIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: MUTED_GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED_GRAY,
  },

  // ============== SPACER ==============
  flexSpacer: {
    flex: 1,
    minHeight: 40,
  },

  // ============== MODAL ==============
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'rgba(25, 25, 30, 0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderBottomWidth: 0,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 24,
      },
      web: {
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  modalHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 28,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modalInput: {
    backgroundColor: GLASS_WHITE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 14,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: GLASS_WHITE,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: ELECTRIC_CYAN,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
  },
  modalSaveText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
  },

  // ============== QR SCANNER ==============
  qrModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  qrModalContent: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    backgroundColor: 'rgba(25, 25, 30, 0.95)',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  qrModalText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrCloseButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: ELECTRIC_CYAN,
  },
  qrCloseButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
  },
  qrScannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  qrLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DEEP_BLACK,
    padding: 24,
  },
  qrLoadingText: {
    fontSize: 18,
    color: '#FFF',
    marginTop: 16,
    textAlign: 'center',
  },
  qrSubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  qrBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  qrFrameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: ELECTRIC_CYAN,
    borderWidth: 4,
  },
  qrCornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  qrCornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  qrCornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  qrCornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  qrInstructions: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
});

export default NewTabPage;
