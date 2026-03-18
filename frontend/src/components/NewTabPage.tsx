import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Color Palette
const ELECTRIC_CYAN = '#00FFFF';
const ELECTRIC_CYAN_GLOW = 'rgba(0, 255, 255, 0.15)';
const SHIELD_GREEN = '#00FF88';
const DEEP_BLACK = '#050508';
const GLASS_WHITE = 'rgba(255, 255, 255, 0.05)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.12)';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  onSearch: (query: string) => void;
}

// Get first letter of title for display
const getInitial = (title: string): string => {
  return title.charAt(0).toUpperCase();
};

// Generate a random color for new links
const getRandomColor = (): string => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// ============================================================
// IMMERSIVE BACKDROP - Deep gradient with Electric Cyan orb
// ============================================================
const ImmersiveBackdrop: React.FC = () => {
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    // Slow breathing animation for the orb
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
      {/* Base deep gradient */}
      <LinearGradient
        colors={[DEEP_BLACK, '#0A0A12', '#080810', DEEP_BLACK]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Electric Cyan Orb - Large, soft, centered glow */}
      <Animated.View style={[styles.cyanOrb, orbStyle]}>
        <LinearGradient
          colors={['rgba(0, 255, 255, 0.3)', 'rgba(0, 255, 255, 0.05)', 'transparent']}
          style={styles.orbGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Secondary ambient glow - Purple accent */}
      <View style={styles.purpleOrb}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.08)', 'transparent']}
          style={styles.orbGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Subtle noise texture overlay */}
      <View style={styles.noiseOverlay} />
    </View>
  );
};

// ============================================================
// AI SHIELD STATUS WIDGET - Glassmorphic pill badge
// ============================================================
const AIShieldStatus: React.FC = () => {
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    // Subtle pulse for the status indicator
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseValue.value, [0, 1], [1, 1.3]);
    const opacity = interpolate(pulseValue.value, [0, 1], [0.7, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View 
      entering={FadeIn.delay(400).duration(600)}
      style={styles.shieldStatusContainer}
    >
      {isWeb ? (
        <View style={styles.shieldStatusPill}>
          <View style={styles.shieldStatusHighlight} />
          <Animated.View style={[styles.statusDot, dotStyle]} />
          <Text style={styles.shieldStatusText}>AI Active</Text>
          <View style={styles.shieldDivider} />
          <Ionicons name="shield-checkmark" size={14} color={SHIELD_GREEN} />
          <Text style={styles.shieldStatusSubtext}>Shielding your data</Text>
        </View>
      ) : (
        <BlurView tint="dark" intensity={40} style={styles.shieldStatusPill}>
          <View style={styles.shieldStatusHighlight} />
          <Animated.View style={[styles.statusDot, dotStyle]} />
          <Text style={styles.shieldStatusText}>AI Active</Text>
          <View style={styles.shieldDivider} />
          <Ionicons name="shield-checkmark" size={14} color={SHIELD_GREEN} />
          <Text style={styles.shieldStatusSubtext}>Shielding your data</Text>
        </BlurView>
      )}
    </Animated.View>
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
      {/* Glow effect */}
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
// ADD BUTTON ORB - Electric Cyan glowing circle
// ============================================================
const AddButtonOrb: React.FC<{
  index: number;
  onPress: () => void;
}> = ({ index, onPress }) => {
  const scale = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      index * 80 + 500,
      withSpring(1, { damping: 14, stiffness: 120 })
    );
    
    // Continuous subtle glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.3, 0.6]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.1]) }],
  }));

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View style={[styles.orbWrapper, animatedStyle]}>
      {/* Cyan glow effect */}
      <Animated.View style={[styles.addOrbGlow, glowStyle]} />
      
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.8}
        style={styles.orbTouchable}
      >
        {isWeb ? (
          <View style={styles.addOrbTile}>
            <View style={styles.addOrbHighlight} />
            <View style={styles.addOrbIconContainer}>
              <Ionicons name="add" size={32} color={ELECTRIC_CYAN} />
            </View>
            <Text style={styles.addOrbLabel}>Add</Text>
          </View>
        ) : (
          <BlurView tint="dark" intensity={30} style={styles.addOrbTile}>
            <View style={styles.addOrbHighlight} />
            <View style={styles.addOrbIconContainer}>
              <Ionicons name="add" size={32} color={ELECTRIC_CYAN} />
            </View>
            <Text style={styles.addOrbLabel}>Add</Text>
          </BlurView>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// FLOATING ISLAND DOCK - Dynamic Island style bottom nav
// ============================================================
const FloatingIslandDock: React.FC<{
  onSearch: (query: string) => void;
  searchEngineName: string;
}> = ({ onSearch, searchEngineName }) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const focusScale = useSharedValue(1);
  const insets = useSafeAreaInsets();

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
    if (inputValue.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();
      onSearch(inputValue.trim());
      setInputValue('');
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
  }));

  const isWeb = Platform.OS === 'web';

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
                  style={styles.dockSearchInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmitEditing={handleSubmit}
                  placeholder={`Search ${searchEngineName}`}
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
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

              {/* Divider */}
              <View style={styles.dockDivider} />

              {/* Voice Search Button */}
              <TouchableOpacity 
                style={styles.dockIconButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="mic-outline" size={22} color="#888" />
              </TouchableOpacity>

              {/* Camera/QR Button */}
              <TouchableOpacity 
                style={styles.dockIconButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="qr-code-outline" size={20} color="#888" />
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
                  style={styles.dockSearchInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmitEditing={handleSubmit}
                  placeholder={`Search ${searchEngineName}`}
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
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

              {/* Divider */}
              <View style={styles.dockDivider} />

              {/* Voice Search Button */}
              <TouchableOpacity 
                style={styles.dockIconButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="mic-outline" size={22} color="#888" />
              </TouchableOpacity>

              {/* Camera/QR Button */}
              <TouchableOpacity 
                style={styles.dockIconButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="qr-code-outline" size={20} color="#888" />
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
    if (title.trim() && url.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSave(title.trim(), url.trim());
      setTitle('');
      setUrl('');
      onClose();
    }
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
      animationType="fade"
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
              <TouchableOpacity
                style={[styles.modalSaveButton, (!title.trim() || !url.trim()) && styles.modalSaveButtonDisabled]}
                onPress={handleSave}
                disabled={!title.trim() || !url.trim()}
              >
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
              <TouchableOpacity
                style={[styles.modalSaveButton, (!title.trim() || !url.trim()) && styles.modalSaveButtonDisabled]}
                onPress={handleSave}
                disabled={!title.trim() || !url.trim()}
              >
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
export const NewTabPage: React.FC<NewTabPageProps> = ({ onNavigate, onSearch }) => {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { quickLinks, addQuickLink, removeQuickLink } = useBrowserStore();
  
  const [addModalVisible, setAddModalVisible] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* Immersive Backdrop with Electric Cyan Orb */}
      <ImmersiveBackdrop />

      {/* Main Content */}
      <View style={[styles.content, { paddingTop: insets.top + 30 }]}>
        
        {/* ============================================================ */}
        {/* AI SHIELD DASHBOARD - Top Section */}
        {/* ============================================================ */}
        <Animated.View 
          entering={FadeIn.delay(100).duration(800)}
          style={styles.brandingContainer}
        >
          {/* Premium Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <Ionicons name="shield-checkmark" size={56} color={SHIELD_GREEN} />
          </View>
          
          {/* Brand Title */}
          <Text style={styles.brandTitle}>ACCESS</Text>
          
          {/* AI Shield Status Widget */}
          <AIShieldStatus />
        </Animated.View>

        {/* ============================================================ */}
        {/* FLOATING QUICK LINK ORBS - Middle Section */}
        {/* ============================================================ */}
        <Animated.View 
          entering={FadeIn.delay(300).duration(600)}
          style={styles.quickLinksSection}
        >
          <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
          <View style={styles.orbsGrid}>
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
          </View>
        </Animated.View>

        {/* Spacer to push dock to bottom */}
        <View style={styles.flexSpacer} />

        {/* ============================================================ */}
        {/* FLOATING ISLAND DOCK - Bottom Section */}
        {/* ============================================================ */}
        <FloatingIslandDock 
          onSearch={onSearch}
          searchEngineName={searchEngineName}
        />
      </View>

      {/* Add Quick Link Modal */}
      <AddLinkModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={handleAddLink}
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
  },

  // ============== BRANDING ==============
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 48,
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
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 8,
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
    backgroundColor: SHIELD_GREEN,
    marginRight: 8,
  },
  shieldStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: SHIELD_GREEN,
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
    backgroundColor: ELECTRIC_CYAN,
    opacity: 0.3,
  },
  addOrbTile: {
    width: 76,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  addOrbHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
  },
  addOrbIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addOrbLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ELECTRIC_CYAN,
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

  // ============== SPACER ==============
  flexSpacer: {
    flex: 1,
    minHeight: 40,
  },

  // ============== MODAL ==============
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    backgroundColor: 'rgba(25, 25, 30, 0.95)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.6,
        shadowRadius: 32,
      },
      android: {
        elevation: 24,
      },
      web: {
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
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
});

export default NewTabPage;
