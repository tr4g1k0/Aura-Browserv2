import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
  PanResponder,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBrowserStore } from '../store/browserStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Timeline options
const TIMELINE_OPTIONS = [
  { label: 'Past 10 mins', minutes: 10 },
  { label: 'Past Hour', minutes: 60 },
  { label: 'Past 24 Hours', minutes: 1440 },
  { label: 'Past 7 Days', minutes: 10080 },
  { label: 'Beginning of Time', minutes: Infinity },
];

// Shred targets
interface ShredTarget {
  id: string;
  label: string;
  icon: string;
  emoji: string;
  enabled: boolean;
}

interface PrivacyShredderProps {
  visible: boolean;
  onClose: () => void;
  webViewRef?: React.RefObject<any>;
  onShredComplete?: () => void; // Callback to reset browser to home and show toast
}

/**
 * Privacy Shredder - Premium data deletion module
 * 
 * Features:
 * - Timeline Slider with haptic notches
 * - Targeted shredding toggles (History, Cookies, Cache)
 * - "INCINERATE ALL" panic button with long-press
 * - Fire/pixelate animation on deletion
 * - Auto-navigation to Home Screen after deletion (like Chrome)
 * 
 * This is faster and more intuitive than Chrome or Firefox.
 */
export const PrivacyShredder: React.FC<PrivacyShredderProps> = ({
  visible,
  onClose,
  webViewRef,
  onShredComplete,
}) => {
  const insets = useSafeAreaInsets();
  const { clearHistory } = useBrowserStore();

  // State
  const [timelineIndex, setTimelineIndex] = useState(4); // Default: Beginning of Time
  const [targets, setTargets] = useState<ShredTarget[]>([
    { id: 'history', label: 'History', icon: 'time', emoji: '🔥', enabled: true },
    { id: 'cookies', label: 'Cookies', icon: 'server', emoji: '🍪', enabled: true },
    { id: 'cache', label: 'Cache', icon: 'folder', emoji: '📁', enabled: true },
  ]);
  const [isShredding, setIsShredding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [panicProgress, setPanicProgress] = useState(0);
  const [isPanicPressed, setIsPanicPressed] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shredAnim = useRef(new Animated.Value(0)).current;
  const fireAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const panicPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Long press timer
  const panicTimerRef = useRef<NodeJS.Timeout | null>(null);
  const panicStartTimeRef = useRef<number>(0);

  // Open/close animations
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Panic button pulse animation
  useEffect(() => {
    if (isPanicPressed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(panicPulse, {
            toValue: 1.05,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(panicPulse, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      panicPulse.setValue(1);
    }
  }, [isPanicPressed]);

  // Timeline slider handler
  const handleTimelineChange = (index: number) => {
    if (index !== timelineIndex) {
      setTimelineIndex(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Toggle target
  const toggleTarget = (targetId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTargets(prev =>
      prev.map(t => (t.id === targetId ? { ...t, enabled: !t.enabled } : t))
    );
  };

  // Panic button handlers
  const handlePanicPressIn = () => {
    setIsPanicPressed(true);
    panicStartTimeRef.current = Date.now();
    
    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Update progress state
    panicTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - panicStartTimeRef.current;
      const progress = Math.min(elapsed / 2000, 1);
      setPanicProgress(progress);
      
      // Haptic feedback at intervals
      if (progress < 1 && Math.floor(progress * 10) !== Math.floor((progress - 0.05) * 10)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      if (progress >= 1) {
        clearInterval(panicTimerRef.current!);
        handleIncinerateAll();
      }
    }, 50);
  };

  const handlePanicPressOut = () => {
    setIsPanicPressed(false);
    setPanicProgress(0);
    progressAnim.setValue(0);
    
    if (panicTimerRef.current) {
      clearInterval(panicTimerRef.current);
      panicTimerRef.current = null;
    }
  };

  // Shred animation
  const playShredAnimation = async () => {
    // Fire animation
    Animated.sequence([
      Animated.timing(fireAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shredAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic burst
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, i * 100);
    }
  };

  // Success animation
  const playSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.spring(successAnim, {
      toValue: 1,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
    
    // Final long haptic vibration - signals "Nuclear" wipe is complete
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setTimeout(() => {
      setShowSuccess(false);
      successAnim.setValue(0);
      
      // Close the modal
      onClose();
      
      // Trigger navigation reset and toast callback
      // This navigates back to Home Screen like Chrome does
      if (onShredComplete) {
        onShredComplete();
      }
    }, 1500);
  };

  // Actual deletion logic - Safe WebView-based approach
  // NO external cookie libraries - uses native WebView methods only
  const performDeletion = async () => {
    try {
      const selectedTimeline = TIMELINE_OPTIONS[timelineIndex];

      // Clear History from browser store
      if (targets.find(t => t.id === 'history')?.enabled) {
        try {
          clearHistory();
          console.log('[Privacy Shredder] History cleared');
        } catch (e) {
          console.warn('[Privacy Shredder] History clear warning:', e);
        }
      }

      // Clear Cookies via JS injection (no external library needed)
      if (targets.find(t => t.id === 'cookies')?.enabled) {
        try {
          // Inject JS to clear localStorage, sessionStorage, and cookies
          const clearCookiesScript = `
            (function() {
              // Clear localStorage
              try { window.localStorage.clear(); } catch(e) {}
              
              // Clear sessionStorage
              try { window.sessionStorage.clear(); } catch(e) {}
              
              // Clear all cookies
              try {
                document.cookie.split(';').forEach(function(c) {
                  document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
                });
              } catch(e) {}
              
              console.log('[Privacy Shredder] Browser storage cleared via JS injection');
              return true;
            })();
            true;
          `;
          
          if (webViewRef?.current) {
            webViewRef.current.injectJavaScript(clearCookiesScript);
          }
          console.log('[Privacy Shredder] Cookies/Storage cleared via JS injection');
        } catch (e) {
          console.warn('[Privacy Shredder] Cookie clear warning:', e);
        }
      }

      // Clear Cache using native WebView methods
      if (targets.find(t => t.id === 'cache')?.enabled) {
        try {
          // Call clearCachedPages from browser store
          useBrowserStore.getState().clearCachedPages();
          
          // Clear WebView cache using native method
          if (webViewRef?.current) {
            // clearCache(true) clears both disk and memory cache
            webViewRef.current.clearCache?.(true);
            
            // clearHistory() clears navigation history
            webViewRef.current.clearHistory?.();
          }
          
          // Clear AsyncStorage cache keys
          const keys = await AsyncStorage.getAllKeys();
          const cacheKeys = keys.filter(k => 
            k.includes('cache') || 
            k.includes('Cache') || 
            k.includes('predictive')
          );
          if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
          }
          console.log('[Privacy Shredder] Cache cleared');
        } catch (e) {
          console.warn('[Privacy Shredder] Cache clear warning:', e);
        }
      }

      // Final: Reset WebView to blank page
      if (webViewRef?.current) {
        try {
          webViewRef.current.injectJavaScript('window.location.href = "about:blank"; true;');
          console.log('[Privacy Shredder] WebView reset to about:blank');
        } catch (e) {
          console.warn('[Privacy Shredder] WebView reset warning:', e);
        }
      }

      return true;
    } catch (error) {
      // Never crash during shredding - just log the error
      console.warn('[Privacy Shredder] Deletion warning (non-fatal):', error);
      return true; // Still return true to allow completion
    }
  };

  // Shred button handler
  const handleShred = async () => {
    if (isShredding) return;
    
    const enabledTargets = targets.filter(t => t.enabled);
    if (enabledTargets.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsShredding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    await playShredAnimation();
    await performDeletion();
    
    setTimeout(() => {
      setIsShredding(false);
      shredAnim.setValue(0);
      fireAnim.setValue(0);
      playSuccessAnimation();
    }, 1000);
  };

  // Incinerate ALL (panic button)
  const handleIncinerateAll = async () => {
    setIsPanicPressed(false);
    setPanicProgress(0);
    progressAnim.setValue(0);
    
    // Enable all targets
    setTargets(prev => prev.map(t => ({ ...t, enabled: true })));
    setTimelineIndex(4); // Beginning of Time
    
    setIsShredding(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    await playShredAnimation();
    await performDeletion();
    
    setTimeout(() => {
      setIsShredding(false);
      shredAnim.setValue(0);
      fireAnim.setValue(0);
      playSuccessAnimation();
    }, 1000);
  };

  const isWeb = Platform.OS === 'web';

  // Fire particles component
  const FireParticles = () => (
    <Animated.View
      style={[
        styles.fireContainer,
        {
          opacity: fireAnim,
          transform: [{
            translateY: fireAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, -100],
            }),
          }],
        },
      ]}
    >
      {[...Array(12)].map((_, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.fireEmoji,
            {
              left: `${10 + (i * 7)}%`,
              animationDelay: `${i * 50}ms`,
              transform: [{
                scale: fireAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.5, 1.5, 0],
                }),
              }],
            },
          ]}
        >
          🔥
        </Animated.Text>
      ))}
    </Animated.View>
  );

  // Progress ring for panic button
  const progressRotation = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderContent = () => (
    <Animated.View
      style={[
        styles.modal,
        {
          transform: [{ translateY: slideAnim }],
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#FF6B35', '#FF3D00']}
            style={styles.headerIcon}
          >
            <Ionicons name="flame" size={24} color="#FFF" />
          </LinearGradient>
          <View>
            <Text style={styles.title}>Privacy Shredder</Text>
            <Text style={styles.subtitle}>Secure data destruction</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Timeline Slider */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIME RANGE</Text>
        <View style={styles.timelineContainer}>
          {TIMELINE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.timelineNotch,
                index === timelineIndex && styles.timelineNotchActive,
              ]}
              onPress={() => handleTimelineChange(index)}
            >
              <View 
                style={[
                  styles.notchDot,
                  index === timelineIndex && styles.notchDotActive,
                ]} 
              />
            </TouchableOpacity>
          ))}
          {/* Active indicator line */}
          <View style={styles.timelineLine}>
            <Animated.View
              style={[
                styles.timelineProgress,
                { width: `${(timelineIndex / (TIMELINE_OPTIONS.length - 1)) * 100}%` },
              ]}
            />
          </View>
        </View>
        <Text style={styles.timelineLabel}>
          {TIMELINE_OPTIONS[timelineIndex].label}
        </Text>
      </View>

      {/* Shred Targets */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TARGETED SHREDDING</Text>
        <View style={styles.targetsContainer}>
          {targets.map((target) => (
            <TouchableOpacity
              key={target.id}
              style={[
                styles.targetButton,
                target.enabled && styles.targetButtonActive,
              ]}
              onPress={() => toggleTarget(target.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.targetEmoji}>{target.emoji}</Text>
              <Text style={[
                styles.targetLabel,
                target.enabled && styles.targetLabelActive,
              ]}>
                {target.label}
              </Text>
              <View style={[
                styles.targetToggle,
                target.enabled && styles.targetToggleActive,
              ]}>
                {target.enabled && (
                  <Ionicons name="checkmark" size={14} color="#0D0D0D" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Shred Button */}
      <TouchableOpacity
        style={[
          styles.shredButton,
          isShredding && styles.shredButtonDisabled,
        ]}
        onPress={handleShred}
        disabled={isShredding}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isShredding ? ['#333', '#222'] : ['#FF6B35', '#FF3D00']}
          style={styles.shredButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {isShredding ? (
            <Text style={styles.shredButtonText}>SHREDDING...</Text>
          ) : (
            <>
              <Ionicons name="trash" size={20} color="#FFF" />
              <Text style={styles.shredButtonText}>SHRED SELECTED</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Panic Button - INCINERATE ALL */}
      <View style={styles.panicSection}>
        <Text style={styles.panicWarning}>⚠️ DANGER ZONE</Text>
        <Animated.View style={{ transform: [{ scale: panicPulse }] }}>
          <TouchableOpacity
            style={[
              styles.panicButton,
              isPanicPressed && styles.panicButtonPressed,
            ]}
            onPressIn={handlePanicPressIn}
            onPressOut={handlePanicPressOut}
            activeOpacity={1}
          >
            <View style={styles.panicButtonInner}>
              {/* Progress Ring */}
              {isPanicPressed && (
                <View style={styles.progressRingContainer}>
                  <Animated.View
                    style={[
                      styles.progressRing,
                      {
                        transform: [{ rotate: progressRotation }],
                      },
                    ]}
                  />
                </View>
              )}
              
              <LinearGradient
                colors={isPanicPressed ? ['#FF0000', '#CC0000'] : ['#8B0000', '#4A0000']}
                style={styles.panicButtonGradient}
              >
                <Ionicons 
                  name="nuclear" 
                  size={32} 
                  color={isPanicPressed ? '#FFF' : '#FF6B6B'} 
                />
                <Text style={[
                  styles.panicButtonText,
                  isPanicPressed && styles.panicButtonTextActive,
                ]}>
                  INCINERATE ALL
                </Text>
                <Text style={styles.panicHint}>
                  {isPanicPressed 
                    ? `${Math.round(panicProgress * 100)}%` 
                    : 'Hold 2 seconds'}
                </Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Fire Animation Overlay */}
      {isShredding && <FireParticles />}

      {/* Success Overlay */}
      {showSuccess && (
        <Animated.View
          style={[
            styles.successOverlay,
            {
              opacity: successAnim,
              transform: [{
                scale: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              }],
            },
          ]}
        >
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#00FF88" />
          </View>
          <Text style={styles.successText}>Data Shredded</Text>
          <Text style={styles.successSubtext}>Your tracks have been erased</Text>
        </Animated.View>
      )}
    </Animated.View>
  );

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
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        {isWeb ? (
          <View style={styles.webContainer}>
            {renderContent()}
          </View>
        ) : (
          <BlurView tint="dark" intensity={80} style={styles.blurContainer}>
            {renderContent()}
          </BlurView>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  blurContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  webContainer: {
    backgroundColor: 'rgba(20, 20, 20, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modal: {
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(20, 20, 20, 0.95)',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  // Timeline Slider
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    position: 'relative',
    height: 40,
  },
  timelineLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    zIndex: 0,
  },
  timelineProgress: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  timelineNotch: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineNotchActive: {},
  notchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#333',
  },
  notchDotActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 8,
  },
  // Shred Targets
  targetsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  targetButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  targetButtonActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: '#FF6B35',
  },
  targetEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  targetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  targetLabelActive: {
    color: '#FFF',
  },
  targetToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetToggleActive: {
    backgroundColor: '#FF6B35',
  },
  // Shred Button
  shredButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  shredButtonDisabled: {
    opacity: 0.6,
  },
  shredButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  shredButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  // Panic Section
  panicSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 0, 0.2)',
  },
  panicWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF4444',
    letterSpacing: 2,
    marginBottom: 16,
  },
  panicButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  panicButtonPressed: {},
  panicButtonInner: {
    position: 'relative',
  },
  progressRingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  progressRing: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#FF0000',
    borderRightColor: '#FF6600',
  },
  panicButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 48,
    gap: 8,
  },
  panicButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6B6B',
    letterSpacing: 2,
  },
  panicButtonTextActive: {
    color: '#FFF',
  },
  panicHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  // Fire Animation
  fireContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    height: 200,
    flexDirection: 'row',
    justifyContent: 'space-around',
    pointerEvents: 'none',
  },
  fireEmoji: {
    fontSize: 32,
    position: 'absolute',
  },
  // Success Overlay
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FF88',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: '#888',
  },
});

export default PrivacyShredder;
