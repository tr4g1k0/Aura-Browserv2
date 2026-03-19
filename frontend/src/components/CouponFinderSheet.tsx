import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const CYAN = '#00FFFF';
const GREEN = '#00C853';
const DARK_BG = '#0a0a0f';
const CARD_BG = 'rgba(255,255,255,0.05)';

interface CouponCode {
  code: string;
  description: string;
  successRate?: number;
  source?: string;
}

interface CouponFinderSheetProps {
  visible: boolean;
  onClose: () => void;
  domain: string;
  coupons: CouponCode[];
}

export const CouponFinderSheet: React.FC<CouponFinderSheetProps> = ({ visible, onClose, domain, coupons }) => {
  const insets = useSafeAreaInsets();
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  const handleCopy = async (code: string, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="ticket" size={22} color={CYAN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Coupon Codes Found</Text>
              <Text style={styles.subtitle}>{domain} • {coupons.length} code{coupons.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {coupons.map((coupon, idx) => (
              <View key={idx} style={styles.couponCard}>
                <View style={styles.couponLeft}>
                  <Text style={styles.couponCode}>{coupon.code}</Text>
                  <Text style={styles.couponDesc} numberOfLines={2}>{coupon.description}</Text>
                  {coupon.successRate !== undefined && (
                    <Text style={[styles.couponRate, { color: coupon.successRate >= 50 ? GREEN : '#FF8F00' }]}>
                      Works {coupon.successRate}% of the time
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.copyBtn, copiedIdx === idx && styles.copyBtnDone]}
                  onPress={() => handleCopy(coupon.code, idx)}
                >
                  <Ionicons name={copiedIdx === idx ? 'checkmark' : 'copy-outline'} size={16} color={copiedIdx === idx ? GREEN : CYAN} />
                  <Text style={[styles.copyBtnText, copiedIdx === idx && { color: GREEN }]}>
                    {copiedIdx === idx ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: DARK_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CYAN + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  couponLeft: { flex: 1 },
  couponCode: {
    fontSize: 16,
    fontWeight: '800',
    color: CYAN,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  couponDesc: { fontSize: 12, color: '#aaa', marginTop: 4 },
  couponRate: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CYAN + '15',
    borderWidth: 1,
    borderColor: CYAN + '33',
    marginLeft: 10,
  },
  copyBtnDone: {
    backgroundColor: GREEN + '15',
    borderColor: GREEN + '33',
  },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: CYAN },
});

// End of CouponFinderSheet
