import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../src/context/SettingsContext';
import { SearchEngine } from '../src/hooks/useBrowserSettings';
import { useBrowserStore } from '../src/store/browserStore';

const ELECTRIC_CYAN = '#00FFFF';
const DANGER_RED = '#FF4466';
const DEEP_BG = '#0a0a0f';
const CARD_BG = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.1)';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.6)';
const TEXT_MUTED = 'rgba(255,255,255,0.35)';
const DIVIDER_COLOR = 'rgba(255,255,255,0.06)';

const SEARCH_ENGINE_NAMES: Record<string, string> = {
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
  brave: 'Brave',
  bing: 'Bing',
};

const THEME_NAMES: Record<string, string> = {
  system: 'System Default',
  light: 'Light',
  dark: 'Dark',
};

const FONT = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSetting, clearBrowsingData, isLoading } = useSettings();
  const [showSearchEngineModal, setShowSearchEngineModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Force dark background on Expo Router wrappers (web only)
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      setTimeout(() => {
        try {
          const allDivs = document.querySelectorAll('div');
          const lightBgs = ['rgb(242, 242, 242)', 'rgb(245, 247, 250)', 'rgb(255, 255, 255)', 'rgb(248, 248, 248)'];
          allDivs.forEach((div: any) => {
            const bg = window.getComputedStyle(div).backgroundColor;
            if (lightBgs.includes(bg)) div.style.backgroundColor = '#0a0a0f';
          });
        } catch (e) { /* non-critical */ }
      }, 50);
    }
  }, []);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleBurnData = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const doBurn = async () => {
      try {
        await clearBrowsingData();
        // Also clear browser store history and cached pages
        const store = useBrowserStore.getState();
        if (store.clearHistory) store.clearHistory();
        if (store.clearCachedPages) store.clearCachedPages();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (Platform.OS === 'web') {
          alert('All browsing data has been incinerated.');
        } else {
          Alert.alert('Data Burned', 'All browsing data has been incinerated.');
        }
      } catch (error) {
        console.error('[Settings] Burn failed:', error);
        Alert.alert('Error', 'Failed to burn data.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Permanently delete all history, cache, and cookies?')) await doBurn();
    } else {
      Alert.alert(
        'Burn Browsing Data',
        'This will permanently delete all browsing history, cache, and cookies. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Burn Everything', style: 'destructive', onPress: doBurn },
        ]
      );
    }
  };

  const handleToggle = (key: keyof typeof settings, val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSetting(key, !val);
  };

  const handleSearchEngineChange = (engine: SearchEngine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSetting('defaultSearchEngine', engine);
    setShowSearchEngineModal(false);
  };

  const handleThemeChange = (theme: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSetting('darkMode', theme !== 'light');
    setShowThemeModal(false);
  };

  // ── Glassmorphic Card ──
  const GlassCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.card} data-testid={`settings-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <View style={styles.cardGlow} />
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );

  // ── Switch Row ──
  const SwitchRow = ({ label, settingKey, subtitle }: { label: string; settingKey: keyof typeof settings; subtitle?: string }) => {
    const val = settings[settingKey] as boolean;
    return (
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
        <Switch
          value={val}
          onValueChange={() => handleToggle(settingKey, val)}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(0,255,255,0.5)' }}
          thumbColor={val ? ELECTRIC_CYAN : 'rgba(255,255,255,0.6)'}
          ios_backgroundColor="rgba(255,255,255,0.12)"
          data-testid={`toggle-${settingKey}`}
        />
      </View>
    );
  };

  // ── Chevron Row ──
  const ChevronRow = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.chevron}>
        <Text style={styles.chevronVal}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
      </View>
    </TouchableOpacity>
  );

  // ── Selection Modal ──
  const SelectionModal = ({ visible, onClose, title, options, selected, onSelect }: {
    visible: boolean; onClose: () => void; title: string;
    options: { key: string; label: string }[]; selected: string;
    onSelect: (key: string) => void;
  }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.modalOpt, selected === opt.key && styles.modalOptActive]}
              onPress={() => onSelect(opt.key)}
              data-testid={`modal-option-${opt.key}`}
            >
              <Text style={[styles.modalOptText, selected === opt.key && styles.modalOptTextActive]}>{opt.label}</Text>
              {selected === opt.key && <Ionicons name="checkmark-circle" size={20} color={ELECTRIC_CYAN} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TEXT_SECONDARY, fontSize: 16, ...FONT }}>Loading settings...</Text>
      </View>
    );
  }

  const currentTheme = settings.darkMode ? 'dark' : 'light';

  return (
    <View style={styles.container} data-testid="settings-container">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} data-testid="settings-back-btn">
          <Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ENGINE & AI */}
        <GlassCard title="ENGINE & AI">
          <ChevronRow
            label="Default Search Engine"
            value={SEARCH_ENGINE_NAMES[settings.defaultSearchEngine] || settings.defaultSearchEngine}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSearchEngineModal(true); }}
          />
          <View style={styles.divider} />
          <SwitchRow label="Local AI Assistant" settingKey="strictLocalAI" subtitle="Enable AI features in nav bar" />
        </GlassCard>

        {/* PRIVACY & SECURITY */}
        <GlassCard title="PRIVACY & SECURITY">
          <SwitchRow label="Ad & Tracker Shield" settingKey="aggressiveAdBlocking" subtitle="Block ads and trackers on all sites" />
          <View style={styles.divider} />
          <SwitchRow label="Strict Do Not Track" settingKey="doNotTrack" subtitle="Send DNT:1 header with all requests" />
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.burnBtn}
            onPress={handleBurnData}
            activeOpacity={0.8}
            data-testid="burn-data-btn"
          >
            <Ionicons name="flame" size={20} color={DANGER_RED} />
            <Text style={styles.burnText}>Burn Browsing Data</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* DISPLAY & ACCESSIBILITY */}
        <GlassCard title="DISPLAY & ACCESSIBILITY">
          <ChevronRow
            label="App Theme"
            value={THEME_NAMES[currentTheme] || 'Dark'}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowThemeModal(true); }}
          />
          <View style={styles.divider} />
          <SwitchRow label="Force Dark Web" settingKey="forceDarkWeb" subtitle="Force dark mode on all websites" />
          <View style={styles.divider} />
          <SwitchRow label="Force Enable Zoom" settingKey="forceZoom" subtitle="Override sites that block pinch-to-zoom" />
        </GlassCard>

        <Text style={styles.version}>Aura Browser v1.0</Text>
      </ScrollView>

      {/* Search Engine Modal */}
      <SelectionModal
        visible={showSearchEngineModal}
        onClose={() => setShowSearchEngineModal(false)}
        title="Default Search Engine"
        options={[
          { key: 'google', label: 'Google' },
          { key: 'duckduckgo', label: 'DuckDuckGo' },
          { key: 'brave', label: 'Brave' },
          { key: 'bing', label: 'Bing' },
        ]}
        selected={settings.defaultSearchEngine}
        onSelect={(key) => handleSearchEngineChange(key as SearchEngine)}
      />

      {/* Theme Modal */}
      <SelectionModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="App Theme"
        options={[
          { key: 'dark', label: 'Dark' },
          { key: 'light', label: 'Light' },
          { key: 'system', label: 'System Default' },
        ]}
        selected={currentTheme}
        onSelect={handleThemeChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DEEP_BG,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
    ...FONT,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Card
  card: {
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any,
    }),
  },
  cardGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0,255,255,0.15)',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: ELECTRIC_CYAN,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
    ...FONT,
  },
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 50,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    ...FONT,
  },
  rowSub: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 3,
    lineHeight: 16,
    ...FONT,
  },
  chevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronVal: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    ...FONT,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
    marginVertical: 2,
  },
  // Burn button
  burnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,68,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,102,0.25)',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 0 20px rgba(255,68,102,0.15)' } as any,
      ios: { shadowColor: DANGER_RED, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12 },
    }),
  },
  burnText: {
    fontSize: 15,
    fontWeight: '600',
    color: DANGER_RED,
    ...FONT,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#141418',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 20,
    ...FONT,
  },
  modalOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalOptActive: {
    backgroundColor: 'rgba(0,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.3)',
  },
  modalOptText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    ...FONT,
  },
  modalOptTextActive: {
    fontWeight: '600',
    color: ELECTRIC_CYAN,
  },
  modalClose: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    fontWeight: '500',
    ...FONT,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 20,
    letterSpacing: 0.5,
    ...FONT,
  },
});
