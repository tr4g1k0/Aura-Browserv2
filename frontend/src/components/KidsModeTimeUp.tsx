/**
 * Kids Mode Time Up Screen
 * Shown when daily time limit is reached
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface Props {
  childName?: string;
  onExitRequest: () => void;
}

const KidsModeTimeUpComponent: React.FC<Props> = ({ childName, onExitRequest }) => {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#11998e', '#38ef7d']}
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
    >
      <View style={styles.content} data-testid="kids-time-up-screen">
        <View style={styles.clockContainer}>
          <Ionicons name="alarm-outline" size={72} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Time's Up!</Text>
        <Text style={styles.subtitle}>
          {childName ? `Great job today, ${childName}! ` : ''}
          Your screen time for today is finished.{'\n'}
          Time to do something fun offline!
        </Text>

        <View style={styles.suggestionsCard}>
          <SuggestionRow icon="book-outline" text="Read a book" />
          <SuggestionRow icon="color-palette-outline" text="Draw a picture" />
          <SuggestionRow icon="football-outline" text="Play outside" />
          <SuggestionRow icon="people-outline" text="Spend time with family" />
        </View>

        <Text style={styles.helpText}>Come back tomorrow!</Text>

        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onExitRequest(); }}
          activeOpacity={0.8}
          data-testid="kids-time-up-exit-btn"
        >
          <Ionicons name="log-out-outline" size={18} color="#11998e" />
          <Text style={styles.exitBtnText}>Exit Kids Mode (PIN required)</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const SuggestionRow = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.suggRow}>
    <Ionicons name={icon as any} size={22} color="#FFFFFF" />
    <Text style={styles.suggText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  clockContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  subtitle: { fontSize: 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 26, marginBottom: 32 },
  suggestionsCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, padding: 20, width: '100%', gap: 16, marginBottom: 32,
  },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  helpText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24 },
  exitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
  },
  exitBtnText: { fontSize: 16, fontWeight: '700', color: '#11998e' },
});

export const KidsModeTimeUp = memo(KidsModeTimeUpComponent);
export default KidsModeTimeUp;
