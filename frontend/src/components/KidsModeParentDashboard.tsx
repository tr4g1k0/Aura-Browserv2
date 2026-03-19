/**
 * Kids Mode Parent Dashboard
 * Activity report, site management, time settings — all PIN-protected
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKidsModeStore, TimeLimit, AgeGroup } from '../store/useKidsModeStore';

const KIDS_PURPLE = '#667eea';
const KIDS_BLUE = '#764ba2';
const KIDS_GREEN = '#11998e';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.7)';
const CARD_BG = 'rgba(255,255,255,0.12)';

interface Props { visible: boolean; onClose: () => void; }

type Tab = 'report' | 'sites' | 'settings';

const TIME_OPTIONS: { value: TimeLimit; label: string }[] = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 'unlimited', label: 'No limit' },
];

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: 'little-kids', label: 'Little Kids (4-7)' },
  { value: 'kids', label: 'Kids (8-12)' },
  { value: 'teens', label: 'Teens (13-17)' },
];

const ParentDashboardComponent: React.FC<Props> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('report');
  const [newAllowed, setNewAllowed] = useState('');
  const [newBlocked, setNewBlocked] = useState('');

  const config = useKidsModeStore(s => s.config);
  const getTodayReport = useKidsModeStore(s => s.getTodayReport);
  const updateConfig = useKidsModeStore(s => s.updateConfig);
  const addAllowedSite = useKidsModeStore(s => s.addAllowedSite);
  const removeAllowedSite = useKidsModeStore(s => s.removeAllowedSite);
  const addBlockedSite = useKidsModeStore(s => s.addBlockedSite);
  const removeBlockedSite = useKidsModeStore(s => s.removeBlockedSite);
  const extendTime = useKidsModeStore(s => s.extendTime);
  const clearHistory = useKidsModeStore(s => s.clearHistory);

  const report = useMemo(() => getTodayReport(), [getTodayReport, visible]);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleAddAllowed = useCallback(() => {
    if (!newAllowed.trim()) return;
    addAllowedSite(newAllowed.trim());
    setNewAllowed('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newAllowed, addAllowedSite]);

  const handleAddBlocked = useCallback(() => {
    if (!newBlocked.trim()) return;
    addBlockedSite(newBlocked.trim());
    setNewBlocked('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newBlocked, addBlockedSite]);

  const handleExtendTime = useCallback(() => {
    Alert.alert('Extend Time', 'Add 30 minutes to today\'s limit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Extend', onPress: () => { extendTime(30); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  }, [extendTime]);

  const handleClearHistory = useCallback(() => {
    Alert.alert('Clear Activity', 'Clear all activity history for today?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { clearHistory(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  }, [clearHistory]);

  // Report Tab
  const ReportTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>Today's Activity</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#38ef7d" />
          <Text style={styles.statValue}>{formatTime(report.totalTimeMinutes)}</Text>
          <Text style={styles.statLabel}>Screen Time</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="globe-outline" size={24} color="#667eea" />
          <Text style={styles.statValue}>{report.sitesVisited.length}</Text>
          <Text style={styles.statLabel}>Sites Visited</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="shield-outline" size={24} color="#FF6B6B" />
          <Text style={styles.statValue}>{report.blockedAttempts}</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </View>
      </View>

      {report.sitesVisited.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sites Visited</Text>
          {report.sitesVisited.map((site, i) => (
            <View key={i} style={styles.siteRow}>
              <Ionicons name="globe-outline" size={16} color={TEXT_MUTED} />
              <Text style={styles.siteText} numberOfLines={1}>{site}</Text>
            </View>
          ))}
        </View>
      )}

      {report.entries.filter(e => e.wasBlocked).length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: '#FF6B6B' }]}>Blocked Attempts</Text>
          {report.entries.filter(e => e.wasBlocked).map((entry, i) => (
            <View key={i} style={styles.siteRow}>
              <Ionicons name="close-circle" size={16} color="#FF6B6B" />
              <Text style={[styles.siteText, { color: '#FF6B6B' }]} numberOfLines={1}>{entry.url}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.dangerBtn} onPress={handleClearHistory} data-testid="kids-clear-history">
        <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
        <Text style={styles.dangerBtnText}>Clear History</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Sites Tab
  const SitesTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>Allowed Sites</Text>
      <Text style={styles.sectionDesc}>These sites are always accessible</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newAllowed}
          onChangeText={setNewAllowed}
          placeholder="example.com"
          placeholderTextColor={TEXT_MUTED}
          autoCapitalize="none"
          data-testid="kids-add-allowed-input"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddAllowed} data-testid="kids-add-allowed-btn">
          <Ionicons name="add" size={22} color={TEXT_WHITE} />
        </TouchableOpacity>
      </View>
      {config.customAllowedSites.map((site, i) => (
        <View key={i} style={styles.siteItem}>
          <Ionicons name="checkmark-circle" size={18} color="#38ef7d" />
          <Text style={styles.siteItemText} numberOfLines={1}>{site}</Text>
          <TouchableOpacity onPress={() => removeAllowedSite(site)}>
            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      ))}
      {config.customAllowedSites.length === 0 && (
        <Text style={styles.emptyText}>No custom allowed sites</Text>
      )}

      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, { color: '#FF6B6B' }]}>Blocked Sites</Text>
      <Text style={styles.sectionDesc}>These sites are always blocked</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newBlocked}
          onChangeText={setNewBlocked}
          placeholder="example.com"
          placeholderTextColor={TEXT_MUTED}
          autoCapitalize="none"
          data-testid="kids-add-blocked-input"
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#FF6B6B' }]} onPress={handleAddBlocked} data-testid="kids-add-blocked-btn">
          <Ionicons name="add" size={22} color={TEXT_WHITE} />
        </TouchableOpacity>
      </View>
      {config.customBlockedSites.map((site, i) => (
        <View key={i} style={styles.siteItem}>
          <Ionicons name="ban" size={18} color="#FF6B6B" />
          <Text style={styles.siteItemText} numberOfLines={1}>{site}</Text>
          <TouchableOpacity onPress={() => removeBlockedSite(site)}>
            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      ))}
      {config.customBlockedSites.length === 0 && (
        <Text style={styles.emptyText}>No custom blocked sites</Text>
      )}
    </ScrollView>
  );

  // Settings Tab
  const SettingsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <Text style={styles.sectionTitle}>Age Group</Text>
      <View style={styles.optionsGrid}>
        {AGE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionChip, config.ageGroup === opt.value && styles.optionChipActive]}
            onPress={() => { updateConfig({ ageGroup: opt.value }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.optionChipText, config.ageGroup === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Daily Time Limit</Text>
      <View style={styles.optionsGrid}>
        {TIME_OPTIONS.map(opt => (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.optionChip, config.timeLimit === opt.value && styles.optionChipActive]}
            onPress={() => { updateConfig({ timeLimit: opt.value }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.optionChipText, config.timeLimit === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Child's Name</Text>
      <TextInput
        style={styles.nameInput}
        value={config.childName}
        onChangeText={(text) => updateConfig({ childName: text })}
        placeholder="Enter name"
        placeholderTextColor={TEXT_MUTED}
        data-testid="kids-child-name-input"
      />

      <TouchableOpacity style={styles.extendBtn} onPress={handleExtendTime} data-testid="kids-extend-time-btn">
        <Ionicons name="add-circle-outline" size={20} color={TEXT_WHITE} />
        <Text style={styles.extendBtnText}>Extend Time (+30 min)</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} data-testid="kids-parent-close">
              <Ionicons name="arrow-back" size={24} color={TEXT_WHITE} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Parent Dashboard</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {(['report', 'sites', 'settings'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabItem, tab === t && styles.tabItemActive]}
                onPress={() => { setTab(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                data-testid={`kids-parent-tab-${t}`}
              >
                <Ionicons
                  name={t === 'report' ? 'bar-chart' : t === 'sites' ? 'globe' : 'cog'}
                  size={18}
                  color={tab === t ? TEXT_WHITE : TEXT_MUTED}
                />
                <Text style={[styles.tabItemText, tab === t && styles.tabItemTextActive]}>
                  {t === 'report' ? 'Report' : t === 'sites' ? 'Sites' : 'Settings'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {tab === 'report' && <ReportTab />}
          {tab === 'sites' && <SitesTab />}
          {tab === 'settings' && <SettingsTab />}
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TEXT_WHITE },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabItemActive: { backgroundColor: 'rgba(102,126,234,0.5)' },
  tabItemText: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED },
  tabItemTextActive: { color: TEXT_WHITE },
  tabContent: { paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: TEXT_WHITE, marginBottom: 8, marginTop: 8 },
  sectionDesc: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: CARD_BG, borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: TEXT_WHITE },
  statLabel: { fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT_WHITE, marginBottom: 12 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  siteText: { fontSize: 14, color: TEXT_MUTED, flex: 1 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.15)', paddingVertical: 14, borderRadius: 16, marginTop: 16 },
  dangerBtnText: { fontSize: 15, fontWeight: '600', color: '#FF6B6B' },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: TEXT_WHITE },
  addBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: KIDS_PURPLE, alignItems: 'center', justifyContent: 'center' },
  siteItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  siteItemText: { flex: 1, fontSize: 15, color: TEXT_WHITE },
  emptyText: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', paddingVertical: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 24 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  optionChip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24 },
  optionChipActive: { backgroundColor: KIDS_PURPLE },
  optionChipText: { fontSize: 14, fontWeight: '600', color: TEXT_MUTED },
  optionChipTextActive: { color: TEXT_WHITE },
  nameInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: TEXT_WHITE, marginBottom: 24 },
  extendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: KIDS_GREEN, paddingVertical: 16, borderRadius: 24, marginTop: 8 },
  extendBtnText: { fontSize: 16, fontWeight: '700', color: TEXT_WHITE },
});

export const KidsModeParentDashboard = memo(ParentDashboardComponent);
export default KidsModeParentDashboard;
