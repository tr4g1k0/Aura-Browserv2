/**
 * Privacy & AI Transparency Manifest Modal
 * 
 * Displays comprehensive privacy information about how the AI Agent
 * handles user data. Features a "Safety First" aesthetic with
 * secure AI visual indicators.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRIVACY_MANIFEST,
  clearAgentMemory,
  getAgentMemoryStats,
} from '../services/PrivacyService';
import * as Haptics from 'expo-haptics';

interface PrivacyManifestModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacyManifestModal: React.FC<PrivacyManifestModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  const [memoryStats, setMemoryStats] = useState(getAgentMemoryStats());
  const [clearingMemory, setClearingMemory] = useState(false);

  // Animate modal
  useEffect(() => {
    if (visible) {
      setMemoryStats(getAgentMemoryStats());
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Start glow animation
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();
      
      return () => glow.stop();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClearMemory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Clear Agent Memory',
      'This will erase all context the AI has gathered during this browsing session. The AI will start fresh with no knowledge of previously visited pages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Memory',
          style: 'destructive',
          onPress: async () => {
            setClearingMemory(true);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            clearAgentMemory();
            setMemoryStats(getAgentMemoryStats());
            
            setClearingMemory(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const renderSection = (section: typeof PRIVACY_MANIFEST.whatAISees) => (
    <Animated.View
      style={[
        styles.section,
        {
          borderColor: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [`${section.color}30`, `${section.color}60`],
          }),
          shadowColor: section.color,
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${section.color}20` }]}>
          <Ionicons name={section.icon as any} size={24} color={section.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: section.color }]}>
          {section.title}
        </Text>
      </View>
      
      <View style={styles.sectionContent}>
        {section.content.map((item, index) => (
          <View key={index} style={styles.bulletItem}>
            <View style={[styles.bulletDot, { backgroundColor: section.color }]} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'Just started';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.shieldIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Privacy & AI Transparency</Text>
                <Text style={styles.headerSubtitle}>How your data stays safe</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          {/* Secure AI Badge */}
          <Animated.View
            style={[
              styles.secureBadge,
              {
                borderColor: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#8B5CF640', '#8B5CF680'],
                }),
              },
            ]}
          >
            <Ionicons name="lock-closed" size={16} color="#8B5CF6" />
            <Text style={styles.secureBadgeText}>Secure AI • Local Processing</Text>
          </Animated.View>
          
          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderSection(PRIVACY_MANIFEST.whatAISees)}
            {renderSection(PRIVACY_MANIFEST.whatStaysLocal)}
            {renderSection(PRIVACY_MANIFEST.sensitiveData)}
            
            {/* Agent Memory Section */}
            <View style={styles.memorySection}>
              <View style={styles.memorySectionHeader}>
                <Ionicons name="brain-outline" size={20} color="#EC4899" />
                <Text style={styles.memorySectionTitle}>Agent Memory</Text>
              </View>
              
              {memoryStats.hasMemory ? (
                <View style={styles.memoryStats}>
                  <View style={styles.memoryStat}>
                    <Text style={styles.memoryStatValue}>{memoryStats.pagesCount}</Text>
                    <Text style={styles.memoryStatLabel}>Pages</Text>
                  </View>
                  <View style={styles.memoryStat}>
                    <Text style={styles.memoryStatValue}>{memoryStats.actionsCount}</Text>
                    <Text style={styles.memoryStatLabel}>Actions</Text>
                  </View>
                  <View style={styles.memoryStat}>
                    <Text style={styles.memoryStatValue}>
                      {formatDuration(memoryStats.sessionDuration)}
                    </Text>
                    <Text style={styles.memoryStatLabel}>Session</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noMemoryText}>
                  No active memory. The AI hasn't analyzed any pages yet.
                </Text>
              )}
              
              {/* Clear Memory Button */}
              <TouchableOpacity
                style={[
                  styles.clearMemoryButton,
                  !memoryStats.hasMemory && styles.clearMemoryButtonDisabled,
                ]}
                onPress={handleClearMemory}
                disabled={!memoryStats.hasMemory || clearingMemory}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={clearingMemory ? 'hourglass-outline' : 'trash-outline'}
                  size={18}
                  color={memoryStats.hasMemory ? '#EC4899' : '#666'}
                />
                <Text
                  style={[
                    styles.clearMemoryButtonText,
                    !memoryStats.hasMemory && styles.clearMemoryButtonTextDisabled,
                  ]}
                >
                  {clearingMemory ? 'Clearing...' : 'Clear Agent Memory'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Footer Note */}
            <View style={styles.footerNote}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.footerNoteText}>
                ACCESS Browser is committed to your privacy. All AI features
                are designed with privacy-first principles.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#8B5CF610',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContent: {
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#CCC',
    lineHeight: 20,
  },
  // Memory Section
  memorySection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EC489940',
  },
  memorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  memorySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EC4899',
  },
  memoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  memoryStat: {
    alignItems: 'center',
  },
  memoryStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  memoryStatLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  noMemoryText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  clearMemoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EC489960',
    backgroundColor: '#EC489910',
    gap: 8,
  },
  clearMemoryButtonDisabled: {
    borderColor: '#333',
    backgroundColor: 'transparent',
  },
  clearMemoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EC4899',
  },
  clearMemoryButtonTextDisabled: {
    color: '#666',
  },
  // Footer
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },
});
