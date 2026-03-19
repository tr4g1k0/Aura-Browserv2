/**
 * Kids Mode Browser
 * Full-screen colorful overlay that replaces the main browser when kids mode is active.
 * Features: safe sites grid, search bar, timer, animated background, mascot
 */

import React, { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, Dimensions, Platform, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKidsModeStore } from '../store/useKidsModeStore';
import { kidsContentFilter } from '../services/KidsContentFilter';

const { width: SCREEN_W } = Dimensions.get('window');

// Bright kid-friendly palette
const PURPLE = '#667eea';
const BLUE = '#5B86E5';
const GREEN = '#38ef7d';
const PINK = '#FF6B9D';
const ORANGE = '#FFA07A';
const YELLOW = '#FFD93D';
const CYAN = '#00D2FF';
const TEXT_WHITE = '#FFFFFF';

interface Props {
  onNavigate: (url: string) => void;
  onShowExitModal: () => void;
}

// Animated floating bubble
const FloatingBubble = memo(({ delay, size, left, color }: { delay: number; size: number; left: number; color: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animate = () => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 6000 + Math.random() * 4000,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => animate());
    };
    animate();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height + size, -size * 2] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.6, 0.6, 0] });
  return (
    <Animated.View
      style={{
        position: 'absolute', left, width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity, transform: [{ translateY }],
      }}
    />
  );
});

// Safe site card
const SiteTile = memo(({ name, icon, color, onPress }: { name: string; icon: string; color: string; onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.siteTile, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
    data-testid={`kids-site-${name.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <Text style={styles.siteTileIcon}>{icon}</Text>
    <Text style={styles.siteTileName} numberOfLines={2}>{name}</Text>
  </TouchableOpacity>
));

const KidsModeBrowserComponent: React.FC<Props> = ({ onNavigate, onShowExitModal }) => {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');

  const config = useKidsModeStore(s => s.config);
  const todayUsageMinutes = useKidsModeStore(s => s.todayUsageMinutes);
  const sessionStartTime = useKidsModeStore(s => s.sessionStartTime);
  const isTimeLimitReached = useKidsModeStore(s => s.isTimeLimitReached);

  // Live timer
  const [liveMinutes, setLiveMinutes] = useState(0);
  useEffect(() => {
    const update = () => {
      let total = todayUsageMinutes;
      if (sessionStartTime) total += Math.floor((Date.now() - sessionStartTime) / 60000);
      setLiveMinutes(total);
    };
    update();
    const interval = setInterval(update, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [todayUsageMinutes, sessionStartTime]);

  const remainingMinutes = useMemo(() => {
    if (config.timeLimit === 'unlimited') return null;
    return Math.max(0, config.timeLimit - liveMinutes);
  }, [config.timeLimit, liveMinutes]);

  const formatRemaining = (mins: number | null) => {
    if (mins === null) return null;
    if (mins <= 0) return "0:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m}m`;
  };

  const safeSites = useMemo(() => kidsContentFilter.getSafeSites(config.ageGroup), [config.ageGroup]);

  const tileColors = [PURPLE, BLUE, GREEN, PINK, ORANGE, CYAN, '#9B59B6', '#E74C3C'];

  const handleSearch = useCallback(() => {
    const q = searchText.trim();
    if (!q) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Use Kiddle for little kids, DuckDuckGo SafeSearch for others
    const searchUrl = config.ageGroup === 'little-kids'
      ? `https://www.kiddle.co/s.php?q=${encodeURIComponent(q)}`
      : `https://duckduckgo.com/?q=${encodeURIComponent(q)}&kp=1`;
    setSearchText('');
    onNavigate(searchUrl);
  }, [searchText, config.ageGroup, onNavigate]);

  const handleSitePress = useCallback((url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate(url);
  }, [onNavigate]);

  const greeting = config.childName ? `Hi ${config.childName}!` : 'Hi there!';

  // Bubble config
  const bubbles = useMemo(() => {
    const colors = ['rgba(102,126,234,0.3)', 'rgba(56,239,125,0.25)', 'rgba(255,107,157,0.25)', 'rgba(0,210,255,0.25)', 'rgba(255,217,61,0.25)'];
    return Array.from({ length: 12 }, (_, i) => ({
      key: i,
      delay: i * 500,
      size: 20 + Math.random() * 40,
      left: Math.random() * SCREEN_W,
      color: colors[i % colors.length],
    }));
  }, []);

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#11998e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Animated bubbles background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {bubbles.map(b => (
          <FloatingBubble key={b.key} delay={b.delay} size={b.size} left={b.left} color={b.color} />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with mascot */}
        <View style={styles.headerRow}>
          <View style={styles.mascot} data-testid="kids-mascot">
            <Ionicons name="shield-checkmark" size={36} color={TEXT_WHITE} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.greeting} data-testid="kids-greeting">{greeting}</Text>
            <Text style={styles.subtitle}>Stay Safe Online</Text>
          </View>
          {/* Timer badge */}
          {remainingMinutes !== null && (
            <View style={[styles.timerBadge, remainingMinutes <= 5 && styles.timerBadgeWarning]} data-testid="kids-timer">
              <Ionicons name="time-outline" size={14} color={TEXT_WHITE} />
              <Text style={styles.timerText}>{formatRemaining(remainingMinutes)}</Text>
            </View>
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(102,126,234,0.8)" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            placeholder={config.ageGroup === 'little-kids' ? 'Search with Kiddle...' : 'Search safely...'}
            placeholderTextColor="rgba(0,0,0,0.35)"
            returnKeyType="search"
            autoCapitalize="none"
            data-testid="kids-search-input"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleSearch} data-testid="kids-search-btn">
              <View style={styles.searchGoBtn}>
                <Ionicons name="arrow-forward" size={18} color={TEXT_WHITE} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Safe Sites Grid */}
        <Text style={styles.sectionLabel}>Safe Places to Explore</Text>
        <View style={styles.tilesGrid}>
          {safeSites.map((site, i) => (
            <SiteTile
              key={site.url}
              name={site.name}
              icon={site.icon}
              color={tileColors[i % tileColors.length]}
              onPress={() => handleSitePress(site.url)}
            />
          ))}
        </View>

        {/* Age group info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={TEXT_WHITE} />
          <Text style={styles.infoText}>
            {config.ageGroup === 'little-kids'
              ? 'Only approved safe sites are available'
              : config.ageGroup === 'kids'
              ? 'Browsing with content filtering active'
              : 'Browsing with adult content blocked'}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={onShowExitModal}
          activeOpacity={0.8}
          data-testid="kids-exit-btn"
        >
          <Ionicons name="log-out-outline" size={20} color={TEXT_WHITE} />
          <Text style={styles.exitBtnText}>Exit Kids Mode</Text>
        </TouchableOpacity>
        <View style={styles.kidsModeIndicator} data-testid="kids-mode-indicator">
          <Ionicons name="shield-checkmark" size={18} color={GREEN} />
          <Text style={styles.kidsModeIndicatorText}>Kids Mode</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const TILE_SIZE = (SCREEN_W - 60) / 3;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  mascot: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 24, fontWeight: '800', color: TEXT_WHITE },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  timerBadgeWarning: { backgroundColor: 'rgba(255,107,107,0.6)' },
  timerText: { fontSize: 14, fontWeight: '700', color: TEXT_WHITE },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 28, gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  searchInput: { flex: 1, fontSize: 16, color: '#1a1a2e', paddingVertical: 12 },
  searchGoBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center',
  },

  // Sites grid
  sectionLabel: { fontSize: 18, fontWeight: '700', color: TEXT_WHITE, marginBottom: 14 },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  siteTile: {
    width: TILE_SIZE, height: TILE_SIZE,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    padding: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  siteTileIcon: { fontSize: 32, marginBottom: 6 },
  siteTileName: { fontSize: 12, fontWeight: '700', color: TEXT_WHITE, textAlign: 'center' },

  // Info card
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 16, borderRadius: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 16, paddingTop: 12,
  },
  exitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  exitBtnText: { fontSize: 14, fontWeight: '600', color: TEXT_WHITE },
  kidsModeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kidsModeIndicatorText: { fontSize: 13, fontWeight: '600', color: GREEN },
});

export const KidsModeBrowser = memo(KidsModeBrowserComponent);
export default KidsModeBrowser;
