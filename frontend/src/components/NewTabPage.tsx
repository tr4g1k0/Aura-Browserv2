import React, { useEffect, useState, useRef, useCallback } from 'react';
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

const { width: SW, height: SH } = Dimensions.get('window');

// ── PREMIUM PALETTE ──
const DEEP_BG = '#050508';
const SHIELD_GREEN = '#00FF88';
const AURA_TEAL = '#00FFD0';
const AURA_CYAN = '#00F2FF';
const GLASS_BG = 'rgba(255,255,255,0.05)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const GLASS_BORDER_LIT = 'rgba(255,255,255,0.14)';
const TEXT_DIM = 'rgba(255,255,255,0.45)';
const TEXT_SOFT = 'rgba(255,255,255,0.65)';
const FONT_STACK = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif' },
}) as any;

// ── Utility fns (unchanged) ──
const getInitial = (t: string) => t.charAt(0).toUpperCase();
const isLikelyUrl = (s: string) => {
  const t = s.trim().toLowerCase();
  if (!t.includes(' ') && t.includes('.')) return true;
  if (t.startsWith('http://') || t.startsWith('https://')) return true;
  return ['.com','.org','.net','.io','.co','.dev','.app','.ai'].some(x => t.endsWith(x));
};
const formatUrl = (s: string) => {
  const t = s.trim();
  return t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`;
};
const getSearchUrl = (q: string, e: string) => {
  const eq = encodeURIComponent(q);
  switch (e) {
    case 'duckduckgo': return `https://duckduckgo.com/?q=${eq}`;
    case 'bing': return `https://www.bing.com/search?q=${eq}`;
    default: return `https://duckduckgo.com/?q=${eq}`;
  }
};
const extractDomain = (url: string) => {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
};

// ================================================================
// 1. LIVING AURORA BACKDROP – animated glow + floating particles
// ================================================================
const LivingAuroraBackdrop: React.FC = () => {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
  }, []);

  const tealGlow = useAnimatedStyle(() => {
    const tx = interpolate(drift.value, [0, 1], [-20, 20]);
    const ty = interpolate(drift.value, [0, 1], [-10, 10]);
    return { transform: [{ translateX: tx }, { translateY: ty }] };
  });
  const blueGlow = useAnimatedStyle(() => {
    const tx = interpolate(drift.value, [0, 1], [15, -15]);
    const ty = interpolate(drift.value, [0, 1], [10, -5]);
    return { transform: [{ translateX: tx }, { translateY: ty }] };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[DEEP_BG, '#07070C', '#060609', DEEP_BG]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
      {/* Teal glow behind shield */}
      <Animated.View style={[{
        position: 'absolute', top: SH * 0.02, left: SW * 0.15, width: SW * 0.7, height: SW * 0.7,
        borderRadius: SW * 0.35, backgroundColor: 'rgba(0,255,150,0.055)',
      }, Platform.OS === 'web' ? { boxShadow: '0 0 120px 60px rgba(0,255,150,0.04)' } as any : {}, tealGlow]} />
      {/* Blue glow bottom */}
      <Animated.View style={[{
        position: 'absolute', bottom: SH * 0.05, left: -SW * 0.1, width: SW * 0.6, height: SW * 0.6,
        borderRadius: SW * 0.3, backgroundColor: 'rgba(0,100,255,0.035)',
      }, Platform.OS === 'web' ? { boxShadow: '0 0 100px 50px rgba(0,100,255,0.03)' } as any : {}, blueGlow]} />
      <Animated.View style={[{
        position: 'absolute', bottom: SH * 0.12, right: -SW * 0.15, width: SW * 0.5, height: SW * 0.5,
        borderRadius: SW * 0.25, backgroundColor: 'rgba(80,60,200,0.03)',
      }, blueGlow]} />
      {/* Floating particles */}
      {PARTICLES.map((p, i) => <FloatingParticle key={i} {...p} />)}
    </View>
  );
};

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  left: Math.random() * SW,
  size: 2 + Math.random() * 1.5,
  delay: i * 800,
  duration: 7000 + Math.random() * 5000,
  color: i % 3 === 0 ? 'rgba(0,255,136,0.5)' : i % 3 === 1 ? 'rgba(0,210,200,0.4)' : 'rgba(0,180,255,0.35)',
}));

const FloatingParticle = React.memo(({ left, size, delay, duration, color }: typeof PARTICLES[0]) => {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(prog.value, [0, 1], [SH + 20, -40]) }],
    opacity: interpolate(prog.value, [0, 0.1, 0.8, 1], [0, 0.7, 0.7, 0]),
  }));
  return <Animated.View style={[{ position: 'absolute', left, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
});

// ================================================================
// 2. HERO SHIELD – iconic shield with radar ripples
// ================================================================
const HeroShield: React.FC = () => {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withSequence(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.06]) }],
  }));
  const innerGlow = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.65]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.15]) }],
  }));
  const outerGlow = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.12, 0.25]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.25]) }],
  }));

  return (
    <Animated.View entering={FadeIn.delay(100).duration(800).springify()} style={s.shieldWrap}>
      {/* Outermost pulse glow */}
      <Animated.View style={[s.shieldGlow3, outerGlow]} />
      {/* Outer glow */}
      <Animated.View style={[s.shieldGlow2, outerGlow]} />
      {/* Inner glow */}
      <Animated.View style={[s.shieldGlow1, innerGlow]} />
      {/* Radar ripples */}
      <RadarRipple delay={0} />
      <RadarRipple delay={600} />
      <RadarRipple delay={1200} />
      {/* Shield icon */}
      <Animated.View style={[s.shieldIcon, iconStyle]}>
        <Ionicons name="shield-checkmark" size={64} color={SHIELD_GREEN} />
      </Animated.View>
    </Animated.View>
  );
};

const RadarRipple = React.memo(({ delay }: { delay: number }) => {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(prog.value, [0, 1], [0.8, 2]) }],
    opacity: interpolate(prog.value, [0, 0.2, 1], [0.25, 0.15, 0]),
    borderColor: 'rgba(0,255,136,0.2)',
  }));
  return <Animated.View style={[s.radarRing, style]} />;
});

// ================================================================
// 3. STATUS BAR PILL
// ================================================================
const StatusBarPill: React.FC<{ isAIActive: boolean }> = ({ isAIActive }) => {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isAIActive) {
      pulse.value = withRepeat(withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
    }
  }, [isAIActive]);
  const dotGlow = useAnimatedStyle(() => ({
    opacity: isAIActive ? interpolate(pulse.value, [0, 1], [0.4, 1]) : 0.3,
    transform: [{ scale: isAIActive ? interpolate(pulse.value, [0, 1], [1, 1.5]) : 1 }],
  }));
  const dotColor = isAIActive ? SHIELD_GREEN : '#666';
  const statusText = isAIActive ? 'Aura Active' : 'AI Offline';

  return (
    <Animated.View entering={FadeIn.delay(500).duration(600)} style={s.pillWrap}>
      <View style={s.pill}>
        <View style={s.pillHighlight} />
        <View style={s.pillDotWrap}>
          <Animated.View style={[s.pillDotGlow, { backgroundColor: dotColor }, dotGlow]} />
          <View style={[s.pillDot, { backgroundColor: dotColor }]} />
        </View>
        <Text style={[s.pillText, { color: dotColor }]}>{statusText}</Text>
        <View style={s.pillDivider} />
        <Ionicons name="shield-checkmark" size={14} color={dotColor} />
        <Text style={s.pillSub}>Shielding your data</Text>
      </View>
    </Animated.View>
  );
};

// ================================================================
// 4. QUICK ACCESS SECTION
// ================================================================
const QuickAccessCard: React.FC<{
  link: QuickLink; index: number; onPress: (url: string) => void; onLongPress: (l: QuickLink) => void;
}> = React.memo(({ link, index, onPress, onLongPress }) => {
  const enter = useSharedValue(0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(index * 80 + 600, withSpring(1, { damping: 14, stiffness: 120 }));
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: enter.value * (1 - pressed.value * 0.06) },
      { translateY: interpolate(enter.value, [0, 1], [25, 0]) },
    ],
    opacity: enter.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * 0.6,
  }));
  const color = link.color || SHIELD_GREEN;
  return (
    <Animated.View style={[s.qaCardWrap, aStyle]}>
      <Animated.View style={[s.qaCardGlow, { backgroundColor: color }, glowStyle]} />
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(link.url); }}
        onPressIn={() => { pressed.value = withTiming(1, { duration: 80 }); }}
        onPressOut={() => { pressed.value = withTiming(0, { duration: 200 }); }}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress(link); }}
        delayLongPress={500}
        style={s.qaCardTouch}
      >
        <View style={s.qaCard}>
          <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
          <View style={[s.qaIconWrap, { backgroundColor: `${color}18` }]}>
            {link.icon ? (
              <Ionicons name={link.icon as any} size={30} color="#FFF" />
            ) : (
              <Text style={[s.qaInitial, { color }]}>{getInitial(link.title)}</Text>
            )}
          </View>
          <Text style={s.qaLabel} numberOfLines={1}>{link.title}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const AddQuickButton: React.FC<{ index: number; onPress: () => void }> = React.memo(({ index, onPress }) => {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(index * 80 + 600, withSpring(1, { damping: 14, stiffness: 120 }));
  }, []);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: enter.value }], opacity: enter.value }));
  return (
    <Animated.View style={[s.qaCardWrap, aStyle]}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={s.qaCardTouch}>
        <View style={s.qaAddCard}>
          <Ionicons name="add" size={28} color="rgba(255,255,255,0.5)" />
          <Text style={s.qaAddLabel}>Add</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ================================================================
// 5. AURA SHIELD PANEL – premium glass card
// ================================================================
const ShieldPanel: React.FC = () => {
  const { adsBlockedCount, trackersBlockedCount } = usePrivacy();
  const [dispTrackers, setDispTrackers] = useState(0);
  const [dispAds, setDispAds] = useState(0);

  // Animate numbers counting up
  useEffect(() => {
    const steps = 20;
    const dt = 40;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const ratio = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - ratio, 3);
      setDispTrackers(Math.round(trackersBlockedCount * ease));
      setDispAds(Math.round(adsBlockedCount * ease));
      if (step >= steps) clearInterval(iv);
    }, dt);
    return () => clearInterval(iv);
  }, [trackersBlockedCount, adsBlockedCount]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, []);
  const dotGlow = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.8]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(700).duration(600).springify()} style={s.panel}>
      {/* Green accent top line */}
      <LinearGradient
        colors={['transparent', 'rgba(0,255,136,0.5)', 'rgba(0,255,136,0.5)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={s.panelAccentLine}
      />
      {/* Header */}
      <View style={s.panelHeader}>
        <View style={s.panelDotWrap}>
          <Animated.View style={[s.panelDotGlow, dotGlow]} />
          <View style={s.panelDot} />
        </View>
        <Text style={s.panelTitle}>AURA SHIELD ACTIVE</Text>
      </View>
      {/* Stats row */}
      <View style={s.panelStats}>
        <View style={s.panelStat}>
          <Text style={s.panelStatNum}>{dispTrackers.toLocaleString()}</Text>
          <Text style={s.panelStatLabel}>Trackers Blocked</Text>
        </View>
        <View style={s.panelDividerV} />
        <View style={s.panelStat}>
          <Text style={s.panelStatNum}>{dispAds.toLocaleString()}</Text>
          <Text style={s.panelStatLabel}>Ads Stopped</Text>
        </View>
        <View style={s.panelDividerV} />
        <View style={s.panelStat}>
          <Text style={[s.panelStatNum, s.panelSecure]}>Secure</Text>
          <Text style={s.panelStatLabel}>Connection</Text>
        </View>
      </View>
      {/* Footer */}
      <View style={s.panelFooter}>
        <Ionicons name="time-outline" size={12} color={TEXT_DIM} />
        <Text style={s.panelFooterText}>Protected since today</Text>
      </View>
    </Animated.View>
  );
};

// ================================================================
// 6. SEARCH BAR – cycling placeholder, frosted pill
// ================================================================
const PLACEHOLDERS = ['Search privately...', 'Where to next?', 'Aura protects your search...', 'Enter URL or search...'];

const SearchBarSection: React.FC<{
  onSearch: (q: string) => void; onNavigate: (u: string) => void;
  defaultSearchEngine: string; onQRScan: () => void;
}> = React.memo(({ onSearch, onNavigate, defaultSearchEngine, onQRScan }) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const phStyle = useAnimatedStyle(() => ({ opacity: 1 }));
  const focusGlow = useSharedValue(0);
  useEffect(() => {
    focusGlow.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: isFocused ? 'rgba(0,255,200,0.45)' : GLASS_BORDER_LIT,
  }));

  const handleSubmit = () => {
    const t = input.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    if (isLikelyUrl(t)) onNavigate(formatUrl(t));
    else onSearch(getSearchUrl(t, defaultSearchEngine));
    setInput('');
  };

  return (
    <Animated.View entering={FadeInUp.delay(900).duration(500).springify()} style={s.searchWrap}>
      <Animated.View style={[s.searchPill, borderStyle]}>
        <Ionicons name="search" size={18} color={isFocused ? AURA_TEAL : TEXT_DIM} style={{ marginRight: 10 }} />
        <View style={{ flex: 1, position: 'relative', justifyContent: 'center' }}>
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            value={input}
            onChangeText={setInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={handleSubmit}
            placeholder=""
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            selectionColor={AURA_TEAL}
            data-testid="home-search-input"
          />
          {input.length === 0 && !isFocused && (
            <Animated.Text style={[s.searchPlaceholder, phStyle]} pointerEvents="none">
              {PLACEHOLDERS[placeholderIdx]}
            </Animated.Text>
          )}
          {input.length === 0 && isFocused && (
            <Text style={s.searchPlaceholder} pointerEvents="none">Search or enter URL</Text>
          )}
        </View>
        {input.length > 0 && (
          <TouchableOpacity onPress={() => setInput('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={TEXT_DIM} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); inputRef.current?.focus(); }} style={s.searchIconBtn}>
          <Ionicons name="mic-outline" size={20} color={TEXT_SOFT} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onQRScan} style={s.searchIconBtn}>
          <Ionicons name="qr-code-outline" size={18} color={TEXT_SOFT} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

// ================================================================
// 7. BOTTOM NAV BAR
// ================================================================
const BottomNav: React.FC<{
  onHome: () => void; onBookmarks: () => void; onAI: () => void; onTabs: () => void; onMenu: () => void;
  tabCount: number;
}> = React.memo(({ onHome, onBookmarks, onAI, onTabs, onMenu, tabCount }) => {
  const [active, setActive] = useState(0);
  const insets = useSafeAreaInsets();

  const NavBtn = ({ idx, icon, label, onPress, badge }: {
    idx: number; icon: string; label: string; onPress: () => void; badge?: number;
  }) => {
    const pressed = useSharedValue(0);
    const isActive = idx === active;
    const color = isActive ? AURA_TEAL : TEXT_DIM;
    const pStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 - pressed.value * 0.15 }],
    }));
    return (
      <Animated.View style={[s.navBtnWrap, pStyle]}>
        {isActive && <View style={s.navActiveBar} />}
        <Pressable
          onPressIn={() => { pressed.value = withSpring(1, { damping: 10, stiffness: 300 }); }}
          onPressOut={() => { pressed.value = withSpring(0, { damping: 10, stiffness: 300 }); }}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActive(idx); onPress(); }}
          style={s.navBtn}
        >
          {badge ? (
            <View style={s.navTabBadge}>
              <Text style={s.navTabText}>{badge}</Text>
            </View>
          ) : (
            <Ionicons name={icon as any} size={22} color={color} />
          )}
          {isActive && <View style={s.navActiveDot} />}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Animated.View entering={FadeInUp.delay(1000).duration(400)} style={[s.navBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={s.navBarBorder} />
      <View style={s.navBarRow}>
        <NavBtn idx={0} icon="home-outline" label="Home" onPress={onHome} />
        <NavBtn idx={1} icon="star-outline" label="Bookmarks" onPress={onBookmarks} />
        <NavBtn idx={2} icon="sparkles-outline" label="AI" onPress={onAI} />
        <NavBtn idx={3} icon="layers-outline" label="Tabs" onPress={onTabs} badge={tabCount} />
        <NavBtn idx={4} icon="ellipsis-vertical" label="Menu" onPress={onMenu} />
      </View>
    </Animated.View>
  );
});

// ================================================================
// MODALS (kept from original)
// ================================================================
const AddLinkModal: React.FC<{ visible: boolean; onClose: () => void; onSave: (t: string, u: string) => void }> = ({ visible, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const handleSave = () => {
    const tt = title.trim(), tu = url.trim();
    if (!tt) { Alert.alert('Error', 'Please enter a site name.'); return; }
    if (!tu) { Alert.alert('Error', 'Please enter a URL.'); return; }
    if (!isLikelyUrl(tu) && !tu.includes('.')) { Alert.alert('Invalid URL', 'Please enter a valid website URL (e.g., google.com)'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(tt, formatUrl(tu));
    setTitle(''); setUrl(''); onClose();
  };
  const handleClose = () => { setTitle(''); setUrl(''); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
        <Pressable style={s.modalBackdrop} onPress={handleClose} />
        <View style={s.modalContent}>
          <Text style={s.modalTitle}>Add Quick Link</Text>
          <View style={s.modalInputWrap}><Text style={s.modalInputLabel}>NAME</Text>
            <TextInput style={s.modalInput} value={title} onChangeText={setTitle} placeholder="e.g. Reddit" placeholderTextColor="#555" /></View>
          <View style={s.modalInputWrap}><Text style={s.modalInputLabel}>URL</Text>
            <TextInput style={s.modalInput} value={url} onChangeText={setUrl} placeholder="e.g. reddit.com" placeholderTextColor="#555" autoCapitalize="none" keyboardType="url" /></View>
          <View style={s.modalBtns}>
            <TouchableOpacity style={s.modalCancel} onPress={handleClose}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.modalSave} onPress={handleSave}><Text style={s.modalSaveText}>Add</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const QRScannerModal: React.FC<{ visible: boolean; onClose: () => void; onScan: (u: string) => void }> = ({ visible, onClose, onScan }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  useEffect(() => {
    if (visible && Platform.OS !== 'web' && useCameraPermissions) {
      (async () => { try { const { status } = await require('expo-camera').Camera.requestCameraPermissionsAsync(); setHasPermission(status === 'granted'); } catch { setHasPermission(false); } })();
    }
  }, [visible]);
  const handleClose = () => { setScanned(false); onClose(); };
  if (Platform.OS === 'web' || !CameraView) {
    return (<Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.qrOverlay}><Pressable style={s.modalBackdrop} onPress={handleClose} />
        <View style={s.qrContent}><Text style={s.qrTitle}>QR Scanner</Text><Text style={s.qrText}>QR scanning requires a mobile device.</Text>
          <TouchableOpacity style={s.qrBtn} onPress={handleClose}><Text style={s.qrBtnText}>Close</Text></TouchableOpacity></View></View>
    </Modal>);
  }
  return (<Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {hasPermission ? (<>
        <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : ({ data }: { data: string }) => {
            if (scanned) return; setScanned(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (data.startsWith('http') || isLikelyUrl(data)) { onScan(formatUrl(data)); onClose(); }
            else { Alert.alert('QR Code', data, [{ text: 'Search', onPress: () => { onScan(getSearchUrl(data, 'google')); onClose(); } }, { text: 'Cancel', onPress: () => setScanned(false) }]); }
          }} />
        <View style={{ position: 'absolute', top: 60, left: 16 }}>
          <TouchableOpacity onPress={handleClose} style={s.qrCloseCircle}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
        </View>
      </>) : (<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>{hasPermission === null ? 'Requesting camera...' : 'Camera permission denied'}</Text>
        <TouchableOpacity style={[s.qrBtn, { marginTop: 20 }]} onPress={handleClose}><Text style={s.qrBtnText}>Close</Text></TouchableOpacity>
      </View>)}
    </View>
  </Modal>);
};

// ================================================================
// MAIN PAGE COMPONENT
// ================================================================
const NewTabPageComponent: React.FC<NewTabPageProps> = ({
  onNavigate, onSearch, onOpenMenu, onAISummarize, onAccessibility,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { quickLinks, addQuickLink, removeQuickLink, isBookmarked, tabs } = useBrowserStore();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const isAIActive = settings.strictLocalAI;
  const searchEngineName = settings.defaultSearchEngine === 'duckduckgo' ? 'DuckDuckGo' : settings.defaultSearchEngine === 'bing' ? 'Bing' : 'Google';

  const handleLinkLongPress = useCallback((link: QuickLink) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${link.title}" shortcut?`)) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); removeQuickLink(link.id); }
    } else {
      Alert.alert('Delete Shortcut', `Delete "${link.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); removeQuickLink(link.id); } }]);
    }
  }, [removeQuickLink]);

  interface NewTabPageProps {
    onNavigate: (url: string) => void;
    onSearch: (query: string) => void;
    onOpenMenu?: () => void;
    onAISummarize?: () => void;
    onAccessibility?: () => void;
  }

  return (
    <View style={s.container} data-testid="home-screen">
      <LivingAuroraBackdrop />

      <View style={[s.content, { paddingTop: insets.top + 20 }]}>
        {/* HERO SHIELD */}
        <HeroShield />

        {/* AURA Title */}
        <Animated.Text entering={FadeIn.delay(300).duration(600)} style={s.brandTitle}>A U R A</Animated.Text>

        {/* Status Pill */}
        <StatusBarPill isAIActive={isAIActive} />

        {/* QUICK ACCESS */}
        <Animated.View entering={FadeIn.delay(550).duration(600)} style={s.qaSection}>
          <Text style={s.qaTitle}>QUICK ACCESS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qaScroll}>
            {quickLinks.map((link, i) => (
              <QuickAccessCard key={link.id} link={link} index={i} onPress={onNavigate} onLongPress={handleLinkLongPress} />
            ))}
            <AddQuickButton index={quickLinks.length} onPress={() => setAddModalVisible(true)} />
          </ScrollView>
        </Animated.View>

        {/* SHIELD PANEL */}
        <ShieldPanel />

        {/* SEARCH BAR */}
        <SearchBarSection
          onSearch={onSearch}
          onNavigate={onNavigate}
          defaultSearchEngine={settings.defaultSearchEngine}
          onQRScan={() => setQrVisible(true)}
        />
      </View>

      {/* BOTTOM NAV */}
      <BottomNav
        onHome={() => {}}
        onBookmarks={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/library'); }}
        onAI={() => { onAISummarize?.() || Alert.alert('AI Summarize', 'Navigate to a page first.'); }}
        onTabs={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/tabs-manager'); }}
        onMenu={() => { onOpenMenu?.() || router.push('/settings'); }}
        tabCount={tabs?.length || 1}
      />

      <AddLinkModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} onSave={(t, u) => addQuickLink(t, u)} />
      <QRScannerModal visible={qrVisible} onClose={() => setQrVisible(false)} onScan={(u) => { setQrVisible(false); onNavigate(u); }} />
    </View>
  );
};

// ================================================================
// STYLES
// ================================================================
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DEEP_BG },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 90 },

  // ── Shield ──
  shieldWrap: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  shieldIcon: { zIndex: 5 },
  shieldGlow1: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,255,136,0.12)',
    ...Platform.select({
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
      web: { boxShadow: '0 0 30px 15px rgba(0,255,136,0.15)' } as any,
    }),
  },
  shieldGlow2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(0,255,136,0.05)',
    ...Platform.select({
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 40 },
      web: { boxShadow: '0 0 50px 25px rgba(0,255,136,0.08)' } as any,
    }),
  },
  shieldGlow3: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(0,255,136,0.02)',
    ...Platform.select({
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 80 },
      web: { boxShadow: '0 0 80px 40px rgba(0,255,136,0.04)' } as any,
    }),
  },
  radarRing: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5, borderColor: 'rgba(0,255,136,0.2)',
  },

  // ── Brand ──
  brandTitle: {
    fontSize: 36, fontWeight: '700', color: '#FFF', letterSpacing: 14, marginBottom: 12,
    ...FONT_STACK,
    ...Platform.select({
      web: { textShadow: '0 0 20px rgba(255,255,255,0.15)' } as any,
      ios: { shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 10 } as any,
    }),
  },

  // ── Pill ──
  pillWrap: { marginBottom: 24 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden', position: 'relative',
    ...Platform.select({ web: { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any }),
  },
  pillHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  pillDotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillDotGlow: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  pillText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, ...FONT_STACK },
  pillDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  pillSub: { fontSize: 12, color: '#777', marginLeft: 6, ...FONT_STACK },

  // ── Quick Access ──
  qaSection: { width: '100%', alignItems: 'center' },
  qaTitle: { fontSize: 11, fontWeight: '700', color: AURA_TEAL, letterSpacing: 2.5, marginBottom: 16, opacity: 0.7 },
  qaScroll: { paddingHorizontal: 4, paddingRight: 24, alignItems: 'center', gap: 14 },
  qaCardWrap: { position: 'relative' },
  qaCardGlow: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderRadius: 20, opacity: 0 },
  qaCardTouch: { borderRadius: 20, overflow: 'hidden' },
  qaCard: {
    width: 78, height: 92, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: GLASS_BORDER,
    overflow: 'hidden', position: 'relative',
  },
  qaIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  qaLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 68, ...FONT_STACK },
  qaInitial: { fontSize: 22, fontWeight: '700', ...FONT_STACK },
  qaAddCard: {
    width: 78, height: 92, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)',
  },
  qaAddLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 4, ...FONT_STACK },

  // ── Shield Panel ──
  panel: {
    width: '100%', borderRadius: 20, overflow: 'hidden', position: 'relative',
    backgroundColor: 'rgba(0,255,136,0.03)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)',
    padding: 20, marginVertical: 6,
    ...Platform.select({
      web: { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any,
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.06, shadowRadius: 16 },
    }),
  },
  panelAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  panelDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  panelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SHIELD_GREEN },
  panelDotGlow: {
    position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: SHIELD_GREEN,
    ...Platform.select({
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
      web: { boxShadow: `0 0 10px ${SHIELD_GREEN}` } as any,
    }),
  },
  panelTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 2.5, color: 'rgba(0,255,136,0.85)', ...FONT_STACK },
  panelStats: { flexDirection: 'row', width: '100%' },
  panelStat: { flex: 1, alignItems: 'center' },
  panelStatNum: {
    fontSize: 26, fontWeight: '800', color: '#FFF', marginBottom: 4,
    ...FONT_STACK,
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] as any },
      web: { fontVariantNumeric: 'tabular-nums' } as any,
    }),
  },
  panelSecure: {
    color: SHIELD_GREEN, fontSize: 22,
    ...Platform.select({
      web: { textShadow: `0 0 12px ${SHIELD_GREEN}` } as any,
      ios: { shadowColor: SHIELD_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 } as any,
    }),
  },
  panelStatLabel: { fontSize: 10, fontWeight: '500', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: 0.5, ...FONT_STACK },
  panelDividerV: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'center' },
  panelFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  panelFooterText: { fontSize: 11, color: TEXT_DIM, ...FONT_STACK },

  // ── Search ──
  searchWrap: { width: '100%' },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: GLASS_BORDER_LIT,
    paddingHorizontal: 18,
    ...Platform.select({
      web: { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any,
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
    }),
  },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: 15, height: '100%',
    ...FONT_STACK,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  searchPlaceholder: {
    position: 'absolute', left: 0, top: 0, bottom: 0, lineHeight: 52,
    fontSize: 15, color: TEXT_DIM, ...FONT_STACK,
  },
  searchIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // ── Bottom Nav ──
  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    backgroundColor: 'rgba(5,5,8,0.88)',
    ...Platform.select({
      web: { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any,
    }),
  },
  navBarBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  navBarRow: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8 },
  navBtnWrap: { alignItems: 'center', width: 48, position: 'relative' },
  navBtn: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center' },
  navActiveBar: {
    position: 'absolute', top: -8, width: 24, height: 2, borderRadius: 1,
    backgroundColor: AURA_TEAL,
    ...Platform.select({
      web: { boxShadow: `0 0 8px ${AURA_TEAL}` } as any,
      ios: { shadowColor: AURA_TEAL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
    }),
  },
  navActiveDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: AURA_TEAL, marginTop: 2,
    ...Platform.select({
      web: { boxShadow: `0 0 6px ${AURA_TEAL}` } as any,
    }),
  },
  navTabBadge: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: AURA_TEAL,
    alignItems: 'center', justifyContent: 'center',
  },
  navTabText: { fontSize: 12, fontWeight: '700', color: AURA_TEAL, ...FONT_STACK },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: {
    width: '100%', backgroundColor: 'rgba(20,20,25,0.95)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, borderWidth: 1, borderColor: GLASS_BORDER, borderBottomWidth: 0,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 28, textAlign: 'center', ...FONT_STACK },
  modalInputWrap: { marginBottom: 20 },
  modalInputLabel: { fontSize: 11, fontWeight: '700', color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  modalInput: {
    backgroundColor: GLASS_BG, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: GLASS_BORDER, ...FONT_STACK,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, gap: 14 },
  modalCancel: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: GLASS_BG, alignItems: 'center', borderWidth: 1, borderColor: GLASS_BORDER },
  modalCancelText: { color: '#888', fontSize: 16, fontWeight: '600' },
  modalSave: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: AURA_CYAN, alignItems: 'center' },
  modalSaveText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },

  // ── QR ──
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrContent: { width: SW - 48, maxWidth: 400, backgroundColor: 'rgba(20,20,25,0.95)', borderRadius: 28, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: GLASS_BORDER },
  qrTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  qrText: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 24 },
  qrBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, backgroundColor: AURA_CYAN },
  qrBtnText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  qrCloseCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});

export const NewTabPage = React.memo(NewTabPageComponent);
export default NewTabPage;
