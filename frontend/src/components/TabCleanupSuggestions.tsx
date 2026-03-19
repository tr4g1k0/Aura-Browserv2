/**
 * Tab Cleanup Suggestions
 * 
 * Shows a banner when user has 10+ tabs suggesting cleanup
 * Displays stale tabs (not visited in 3+ days) for review
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Tab } from '../store/browserStore';

const AURA_CYAN = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';
const CARD_DARK = '#1A1A1E';
const DEEP_INDIGO = '#0A0A0F';
const SUCCESS_GREEN = '#10B981';
const WARNING_AMBER = '#F59E0B';

interface TabCleanupSuggestionsProps {
  tabs: Tab[];
  staleTabIds: string[];
  onCloseTabs: (tabIds: string[]) => void;
  onDismiss: () => void;
}

const TabCleanupSuggestionsComponent: React.FC<TabCleanupSuggestionsProps> = ({
  tabs,
  staleTabIds,
  onCloseTabs,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set(staleTabIds));

  const staleTabs = tabs.filter((t) => staleTabIds.includes(t.id));

  const handleToggleTab = useCallback((tabId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTabIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tabId)) {
        newSet.delete(tabId);
      } else {
        newSet.add(tabId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTabIds(new Set(staleTabIds));
  }, [staleTabIds]);

  const handleDeselectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTabIds(new Set());
  }, []);

  const handleCloseSelected = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCloseTabs(Array.from(selectedTabIds));
    setModalVisible(false);
    onDismiss();
  }, [selectedTabIds, onCloseTabs, onDismiss]);

  const handleOpenModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(true);
  }, []);

  if (tabs.length < 10 || staleTabIds.length === 0) return null;

  return (
    <>
      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="sparkles" size={20} color={WARNING_AMBER} />
        </View>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>
            You have {tabs.length} tabs open
          </Text>
          <Text style={styles.bannerSubtitle}>
            {staleTabIds.length} tab{staleTabIds.length > 1 ? 's' : ''} not visited in 3+ days
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cleanupButton}
          onPress={handleOpenModal}
          activeOpacity={0.7}
        >
          <Text style={styles.cleanupButtonText}>Clean Up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>

      {/* Cleanup Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={50} tint="dark" style={styles.modalBlur}>
            <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 16 }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Clean Up Tabs</Text>
                  <Text style={styles.modalSubtitle}>
                    {staleTabs.length} tab{staleTabs.length > 1 ? 's' : ''} not visited recently
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={TEXT_WHITE} />
                </TouchableOpacity>
              </View>

              {/* Select All / Deselect All */}
              <View style={styles.selectionControls}>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={handleSelectAll}
                >
                  <Ionicons name="checkbox" size={18} color={AURA_CYAN} />
                  <Text style={styles.selectionButtonText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={handleDeselectAll}
                >
                  <Ionicons name="square-outline" size={18} color={TEXT_MUTED} />
                  <Text style={styles.selectionButtonText}>Deselect All</Text>
                </TouchableOpacity>
              </View>

              {/* Tab List */}
              <ScrollView style={styles.tabList} showsVerticalScrollIndicator={false}>
                {staleTabs.map((tab) => {
                  const isSelected = selectedTabIds.has(tab.id);
                  let hostname = '';
                  try {
                    hostname = new URL(tab.url).hostname;
                  } catch {
                    hostname = tab.url;
                  }

                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.tabItem, isSelected && styles.tabItemSelected]}
                      onPress={() => handleToggleTab(tab.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.checkboxContainer}>
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? AURA_CYAN : TEXT_MUTED}
                        />
                      </View>
                      <View style={styles.tabItemContent}>
                        <View style={styles.tabItemFavicon}>
                          <Ionicons name="globe-outline" size={16} color={TEXT_MUTED} />
                        </View>
                        <View style={styles.tabItemInfo}>
                          <Text style={styles.tabItemTitle} numberOfLines={1}>
                            {tab.title || 'Untitled'}
                          </Text>
                          <Text style={styles.tabItemUrl} numberOfLines={1}>
                            {hostname}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.closeTabsButton,
                    selectedTabIds.size === 0 && styles.closeTabsButtonDisabled,
                  ]}
                  onPress={handleCloseSelected}
                  disabled={selectedTabIds.size === 0}
                >
                  <Ionicons name="trash" size={18} color={TEXT_WHITE} />
                  <Text style={styles.closeTabsButtonText}>
                    Close {selectedTabIds.size} Tab{selectedTabIds.size !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: WARNING_AMBER,
    marginTop: 2,
  },
  cleanupButton: {
    backgroundColor: WARNING_AMBER,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  cleanupButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: DEEP_INDIGO,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: DEEP_INDIGO,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  modalSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionControls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  tabList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_DARK,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  tabItemSelected: {
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 255, 0.4)',
    backgroundColor: 'rgba(0, 242, 255, 0.1)',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  tabItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItemFavicon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tabItemInfo: {
    flex: 1,
  },
  tabItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  tabItemUrl: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CARD_DARK,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  closeTabsButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    gap: 8,
  },
  closeTabsButtonDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  closeTabsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
});

export const TabCleanupSuggestions = memo(TabCleanupSuggestionsComponent);

export default TabCleanupSuggestions;
