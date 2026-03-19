import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AISummarizerDrawerProps {
  visible: boolean;
  summaryText: string;
  isCopied: boolean;
  bottomInset: number;
  onClose: () => void;
  onCopy: () => void;
}

export const AISummarizerDrawer = ({
  visible,
  summaryText,
  isCopied,
  bottomInset,
  onClose,
  onCopy,
}: AISummarizerDrawerProps) => {
  const isLoading = summaryText.includes('Scanning') || summaryText.includes('Generating') || summaryText.includes('Analyzing');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { paddingBottom: Math.max(bottomInset, 24) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.topHighlight} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={24} color="#00FFFF" />
              <Text style={styles.title}>AI Page Summary</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
              data-testid="ai-drawer-close-btn"
            >
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {summaryText ? (
              <View style={styles.summaryBox}>
                {!isLoading && (
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={onCopy}
                    activeOpacity={0.7}
                    data-testid="ai-copy-btn"
                  >
                    <Ionicons
                      name={isCopied ? 'checkmark' : 'copy-outline'}
                      size={16}
                      color={isCopied ? '#00FF88' : '#00FFFF'}
                    />
                    <Text style={[styles.copyButtonText, isCopied && { color: '#00FF88' }]}>
                      {isCopied ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.summaryText}>{summaryText}</Text>
                {isLoading && (
                  <View style={styles.loadingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Navigate to a webpage and tap the AI button to generate a summary.
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClose}
            activeOpacity={0.8}
            data-testid="ai-drawer-action-btn"
          >
            <Text style={styles.actionText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const FONT_FAMILY = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    minHeight: 320,
    maxHeight: '70%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 24 },
      android: { elevation: 24 },
      web: { boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)' },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#00FFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: { shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5,
    ...FONT_FAMILY,
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: {
    height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 16,
  },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 16 },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  copyButton: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, gap: 6, zIndex: 10,
  },
  copyButtonText: {
    fontSize: 12, fontWeight: '600', color: '#00FFFF',
    ...FONT_FAMILY,
  },
  summaryText: {
    fontSize: 16, lineHeight: 26, color: '#DDDDDD',
    ...FONT_FAMILY,
  },
  emptyText: {
    fontSize: 15, color: '#888888', textAlign: 'center', paddingVertical: 40,
    ...FONT_FAMILY,
  },
  loadingDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 20, gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FFFF', opacity: 0.5 },
  dot1: { opacity: 1 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 0.4 },
  actionButton: {
    backgroundColor: '#00FFFF', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  actionText: {
    fontSize: 16, fontWeight: '700', color: '#0A0A0A', letterSpacing: 0.5,
    ...FONT_FAMILY,
  },
});
