/**
 * Kids Mode Setup Modal
 * 
 * First-time setup wizard for Kids Mode:
 * - Set 4-digit PIN
 * - Enter child's name (optional)
 * - Choose age group
 * - Set time limit
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useKidsModeStore, AgeGroup, TimeLimit } from '../store/useKidsModeStore';

// Colors
const KIDS_PURPLE = '#667eea';
const KIDS_BLUE = '#764ba2';
const KIDS_GREEN = '#11998e';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.7)';

interface KidsModeSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSetupComplete: () => void;
}

const AGE_GROUPS: { value: AgeGroup; label: string; description: string; icon: string }[] = [
  { value: 'little-kids', label: 'Little Kids', description: 'Ages 4-7 • Safe sites only', icon: '🧒' },
  { value: 'kids', label: 'Kids', description: 'Ages 8-12 • Filtered browsing', icon: '👦' },
  { value: 'teens', label: 'Teens', description: 'Ages 13-17 • Light filtering', icon: '🧑' },
];

const TIME_LIMITS: { value: TimeLimit; label: string }[] = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 'unlimited', label: 'Unlimited' },
];

const KidsModeSetupModalComponent: React.FC<KidsModeSetupModalProps> = ({
  visible,
  onClose,
  onSetupComplete,
}) => {
  const insets = useSafeAreaInsets();
  const setupKidsMode = useKidsModeStore((s) => s.setupKidsMode);

  // Setup state
  const [step, setStep] = useState(1); // 1: PIN, 2: Name, 3: Age Group, 4: Time Limit
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [childName, setChildName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('kids');
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(60);
  const [error, setError] = useState('');

  const totalSteps = 4;

  const handlePinChange = useCallback((text: string) => {
    // Only allow digits, max 4
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
  }, []);

  const handleConfirmPinChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setConfirmPin(digits);
    setError('');
  }, []);

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 1) {
      if (pin.length !== 4) {
        setError('Please enter a 4-digit PIN');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (confirmPin !== pin) {
        setError('PINs do not match');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      // Complete setup
      try {
        await setupKidsMode({
          childName: childName.trim(),
          ageGroup,
          timeLimit,
          customAllowedSites: [],
          customBlockedSites: [],
        }, pin);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSetupComplete();
      } catch (err) {
        setError('Failed to save settings');
      }
    }
  }, [step, pin, confirmPin, childName, ageGroup, timeLimit, setupKidsMode, onSetupComplete]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      setStep(step - 1);
      setError('');
    } else {
      onClose();
    }
  }, [step, onClose]);

  const resetState = useCallback(() => {
    setStep(1);
    setPin('');
    setConfirmPin('');
    setChildName('');
    setAgeGroup('kids');
    setTimeLimit(60);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={[KIDS_PURPLE, KIDS_BLUE]}
        style={styles.gradientContainer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
              >
                <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={24} color={TEXT_WHITE} />
              </TouchableOpacity>
              
              <View style={styles.stepIndicator}>
                {[1, 2, 3, 4].map((s) => (
                  <View
                    key={s}
                    style={[
                      styles.stepDot,
                      s <= step && styles.stepDotActive,
                    ]}
                  />
                ))}
              </View>
              
              <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {/* Step 1: Create PIN */}
              {step === 1 && (
                <View style={styles.stepContent}>
                  <Text style={styles.emoji}>🔐</Text>
                  <Text style={styles.title}>Create Parent PIN</Text>
                  <Text style={styles.subtitle}>
                    This 4-digit PIN will be required to exit Kids Mode or change settings
                  </Text>
                  
                  <View style={styles.pinContainer}>
                    <TextInput
                      style={styles.pinInput}
                      value={pin}
                      onChangeText={handlePinChange}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      placeholder="• • • •"
                      placeholderTextColor={TEXT_MUTED}
                      autoFocus
                    />
                    <View style={styles.pinDots}>
                      {[0, 1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.pinDot,
                            i < pin.length && styles.pinDotFilled,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Step 2: Confirm PIN */}
              {step === 2 && (
                <View style={styles.stepContent}>
                  <Text style={styles.emoji}>✅</Text>
                  <Text style={styles.title}>Confirm Your PIN</Text>
                  <Text style={styles.subtitle}>
                    Enter your PIN again to confirm
                  </Text>
                  
                  <View style={styles.pinContainer}>
                    <TextInput
                      style={styles.pinInput}
                      value={confirmPin}
                      onChangeText={handleConfirmPinChange}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      placeholder="• • • •"
                      placeholderTextColor={TEXT_MUTED}
                      autoFocus
                    />
                    <View style={styles.pinDots}>
                      {[0, 1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.pinDot,
                            i < confirmPin.length && styles.pinDotFilled,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Step 3: Child Info & Age Group */}
              {step === 3 && (
                <View style={styles.stepContent}>
                  <Text style={styles.emoji}>👋</Text>
                  <Text style={styles.title}>Who's Using Kids Mode?</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Child's Name (optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={childName}
                      onChangeText={setChildName}
                      placeholder="Enter name for personalization"
                      placeholderTextColor={TEXT_MUTED}
                      autoCapitalize="words"
                    />
                  </View>
                  
                  <Text style={styles.inputLabel}>Age Group</Text>
                  {AGE_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group.value}
                      style={[
                        styles.ageGroupOption,
                        ageGroup === group.value && styles.ageGroupOptionSelected,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAgeGroup(group.value);
                      }}
                    >
                      <Text style={styles.ageGroupEmoji}>{group.icon}</Text>
                      <View style={styles.ageGroupInfo}>
                        <Text style={styles.ageGroupLabel}>{group.label}</Text>
                        <Text style={styles.ageGroupDesc}>{group.description}</Text>
                      </View>
                      {ageGroup === group.value && (
                        <Ionicons name="checkmark-circle" size={24} color={TEXT_WHITE} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Step 4: Time Limit */}
              {step === 4 && (
                <View style={styles.stepContent}>
                  <Text style={styles.emoji}>⏰</Text>
                  <Text style={styles.title}>Set Daily Screen Time</Text>
                  <Text style={styles.subtitle}>
                    Choose how long Kids Mode can be used each day
                  </Text>
                  
                  <View style={styles.timeLimitOptions}>
                    {TIME_LIMITS.map((limit) => (
                      <TouchableOpacity
                        key={String(limit.value)}
                        style={[
                          styles.timeLimitOption,
                          timeLimit === limit.value && styles.timeLimitOptionSelected,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTimeLimit(limit.value);
                        }}
                      >
                        <Text style={[
                          styles.timeLimitLabel,
                          timeLimit === limit.value && styles.timeLimitLabelSelected,
                        ]}>
                          {limit.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* Next Button */}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {step === totalSteps ? 'Start Kids Mode' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={KIDS_PURPLE} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepDotActive: {
    backgroundColor: TEXT_WHITE,
    width: 24,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 20,
  },
  stepContent: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  pinContainer: {
    alignItems: 'center',
  },
  pinInput: {
    fontSize: 32,
    color: TEXT_WHITE,
    textAlign: 'center',
    letterSpacing: 16,
    padding: 16,
    width: 200,
    position: 'absolute',
    opacity: 0,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 20,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TEXT_WHITE,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: TEXT_WHITE,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: TEXT_WHITE,
    width: '100%',
  },
  ageGroupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
  },
  ageGroupOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: TEXT_WHITE,
  },
  ageGroupEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  ageGroupInfo: {
    flex: 1,
  },
  ageGroupLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  ageGroupDesc: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  timeLimitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  timeLimitOption: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  timeLimitOptionSelected: {
    backgroundColor: TEXT_WHITE,
  },
  timeLimitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  timeLimitLabelSelected: {
    color: KIDS_PURPLE,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TEXT_WHITE,
    paddingVertical: 18,
    borderRadius: 30,
    gap: 8,
    marginTop: 20,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: KIDS_PURPLE,
  },
});

export const KidsModeSetupModal = memo(KidsModeSetupModalComponent);

export default KidsModeSetupModal;
