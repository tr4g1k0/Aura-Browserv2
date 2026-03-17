import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Quick Links data with minimalist white logos
const QUICK_LINKS = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com',
    icon: 'logo-google',
    color: '#4285F4',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org',
    icon: 'book-outline',
    color: '#636466',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    icon: 'logo-youtube',
    color: '#FF0000',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com',
    icon: 'shield-checkmark',
    color: '#DE5833',
  },
];

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  onSearch: (query: string) => void;
}

// Animated Quick Link Tile Component
const QuickLinkTile: React.FC<{
  link: typeof QUICK_LINKS[0];
  index: number;
  onPress: (url: string) => void;
}> = ({ link, index, onPress }) => {
  const scale = useSharedValue(0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    // Staggered bounce animation on mount
    scale.value = withDelay(
      index * 100 + 300,
      withSpring(1, {
        damping: 12,
        stiffness: 150,
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value * (1 - pressed.value * 0.05) },
        { translateY: interpolate(scale.value, [0, 1], [20, 0]) },
      ],
      opacity: scale.value,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: pressed.value * 0.6,
      transform: [{ scale: 1 + pressed.value * 0.1 }],
    };
  });

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(link.url);
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View style={[styles.quickLinkWrapper, animatedStyle]}>
      {/* Glow effect behind the tile */}
      <Animated.View style={[styles.quickLinkGlow, { backgroundColor: link.color }, glowStyle]} />
      
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.quickLinkTouchable}
      >
        {isWeb ? (
          <View style={styles.quickLinkTile}>
            <View style={styles.quickLinkIconContainer}>
              <Ionicons name={link.icon as any} size={28} color="#FFF" />
            </View>
            <Text style={styles.quickLinkLabel}>{link.name}</Text>
          </View>
        ) : (
          <BlurView tint="dark" intensity={40} style={styles.quickLinkTile}>
            <View style={styles.quickLinkIconContainer}>
              <Ionicons name={link.icon as any} size={28} color="#FFF" />
            </View>
            <Text style={styles.quickLinkLabel}>{link.name}</Text>
          </BlurView>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Animated Search Bar Component
const AnimatedSearchBar: React.FC<{
  onSubmit: (text: string) => void;
  placeholder: string;
}> = ({ onSubmit, placeholder }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const focusScale = useSharedValue(1);
  const focusWidth = useSharedValue(0);

  const handleFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFocused(true);
    focusScale.value = withSpring(1.02, { damping: 15, stiffness: 150 });
    focusWidth.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    focusWidth.value = withSpring(0, { damping: 15, stiffness: 150 });
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
      onSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: focusScale.value }],
    };
  });

  const animatedBorderStyle = useAnimatedStyle(() => {
    return {
      borderColor: `rgba(0, 255, 136, ${focusWidth.value * 0.6})`,
      borderWidth: interpolate(focusWidth.value, [0, 1], [1, 2]),
    };
  });

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(600).springify()}
      style={[styles.searchBarWrapper, animatedContainerStyle]}
    >
      {isWeb ? (
        <Animated.View style={[styles.searchBarContainer, animatedBorderStyle]}>
          <Ionicons
            name="search"
            size={20}
            color={isFocused ? '#00FF88' : '#888'}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={inputValue}
            onChangeText={setInputValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSubmit}
            placeholder={placeholder}
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {inputValue.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setInputValue('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <BlurView tint="dark" intensity={50} style={styles.searchBarBlur}>
          <Animated.View style={[styles.searchBarInner, animatedBorderStyle]}>
            <Ionicons
              name="search"
              size={20}
              color={isFocused ? '#00FF88' : '#888'}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              value={inputValue}
              onChangeText={setInputValue}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onSubmitEditing={handleSubmit}
              placeholder={placeholder}
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
            />
            {inputValue.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setInputValue('');
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </BlurView>
      )}
    </Animated.View>
  );
};

// Animated Mesh Gradient Background
const AnimatedMeshGradient: React.FC = () => {
  const gradientPosition = useSharedValue(0);

  useEffect(() => {
    // Slow, continuous animation for the gradient
    gradientPosition.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(gradientPosition.value, [0, 1], [-50, 50]);
    const translateY = interpolate(gradientPosition.value, [0, 1], [-30, 30]);
    return {
      transform: [{ translateX }, { translateY }],
    };
  });

  return (
    <View style={styles.gradientContainer}>
      {/* Base dark gradient */}
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#050505']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Animated mesh overlay - deep purple */}
      <Animated.View style={[styles.meshLayer, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(88, 28, 135, 0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.5 }] }]}
        />
      </Animated.View>
      
      {/* Animated mesh overlay - dark green */}
      <Animated.View style={[styles.meshLayer, { transform: [{ rotate: '45deg' }] }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(0, 100, 50, 0.12)', 'transparent']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.8 }] }]}
        />
      </Animated.View>
      
      {/* Accent glow at center */}
      <View style={styles.centerGlow} />
    </View>
  );
};

export const NewTabPage: React.FC<NewTabPageProps> = ({ onNavigate, onSearch }) => {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();

  // Get search engine name for placeholder
  const searchEngineName = settings.defaultSearchEngine === 'duckduckgo' 
    ? 'DuckDuckGo' 
    : settings.defaultSearchEngine === 'bing' 
      ? 'Bing' 
      : 'Google';

  const handleSearch = (query: string) => {
    onSearch(query);
  };

  const handleQuickLinkPress = (url: string) => {
    onNavigate(url);
  };

  return (
    <View style={styles.container}>
      {/* Animated Mesh Gradient Background */}
      <AnimatedMeshGradient />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        {/* Logo / Branding */}
        <Animated.View 
          entering={FadeIn.delay(0).duration(800)}
          style={styles.brandingContainer}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={48} color="#00FF88" />
          </View>
          <Text style={styles.brandTitle}>ACCESS</Text>
          <Text style={styles.brandSubtitle}>Private & Intelligent Browsing</Text>
        </Animated.View>

        {/* Search Bar */}
        <AnimatedSearchBar
          onSubmit={handleSearch}
          placeholder={`Search with ${searchEngineName} or enter URL`}
        />

        {/* Quick Links Section */}
        <Animated.View 
          entering={FadeIn.delay(200).duration(600)}
          style={styles.quickLinksSection}
        >
          <Text style={styles.quickLinksTitle}>Quick Links</Text>
          <View style={styles.quickLinksGrid}>
            {QUICK_LINKS.map((link, index) => (
              <QuickLinkTile
                key={link.id}
                link={link}
                index={index}
                onPress={handleQuickLinkPress}
              />
            ))}
          </View>
        </Animated.View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Status Footer */}
        <Animated.View 
          entering={FadeIn.delay(600).duration(800)}
          style={styles.statusFooter}
        >
          <Text style={styles.statusText}>
            ACCESS Browser v1.0 | Local AI Enabled
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Gradient Background Styles
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  meshLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  centerGlow: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 255, 136, 0.03)',
    ...Platform.select({
      ios: {
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 100,
      },
      android: {},
      web: {},
    }),
  },
  // Content Styles
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  // Branding Styles
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 4,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 1,
  },
  // Search Bar Styles
  searchBarWrapper: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 48,
  },
  searchBarBlur: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 30,
    height: 56,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    height: '100%',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Quick Links Styles
  quickLinksSection: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  quickLinksTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  quickLinkWrapper: {
    position: 'relative',
  },
  quickLinkGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 16,
    opacity: 0,
  },
  quickLinkTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickLinkTile: {
    width: 80,
    height: 88,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  quickLinkIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLinkLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#AAA',
    textAlign: 'center',
  },
  // Footer Styles
  spacer: {
    flex: 1,
  },
  statusFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statusText: {
    fontSize: 11,
    color: '#444',
    letterSpacing: 1,
    ...Platform.select({
      ios: { fontFamily: 'Menlo' },
      android: { fontFamily: 'monospace' },
      web: { fontFamily: 'Monaco, "Courier New", monospace' },
    }),
  },
});

export default NewTabPage;
