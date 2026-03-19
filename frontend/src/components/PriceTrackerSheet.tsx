import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePriceTrackerStore } from '../store/usePriceTrackerStore';
import { priceAnalysisService } from '../services/PriceAnalysisService';
import * as Haptics from 'expo-haptics';
import { LineChart } from 'react-native-chart-kit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

const CYAN = '#00FFFF';
const GREEN = '#00C853';
const RED = '#FF4444';
const ORANGE = '#FF8F00';
const BLUE = '#2962FF';
const DARK_BG = '#0a0a0f';
const CARD_BG = 'rgba(255,255,255,0.05)';

export const PriceTrackerSheet: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    isSheetVisible, closeSheet,
    detectedProduct, currentTrackedProduct, isTracked,
    currentDealScore, currentStats, currentRecommendation,
    currentHistory, selectedTimeRange, setTimeRange,
    trackProduct, stopTracking, refreshCurrentProduct,
  } = usePriceTrackerStore();

  useEffect(() => {
    if (isSheetVisible && isTracked) {
      refreshCurrentProduct();
    }
  }, [isSheetVisible, selectedTimeRange]);

  const product = currentTrackedProduct || (detectedProduct ? {
    title: detectedProduct.title,
    currentPrice: detectedProduct.price,
    currency: detectedProduct.currency,
    siteName: detectedProduct.siteName,
    imageUrl: detectedProduct.imageUrl,
    url: detectedProduct.url,
  } : null);

  const chartData = useMemo(() => {
    if (currentHistory.length < 2) return null;
    const prices = currentHistory.map(h => h.price);
    const labels = currentHistory.map(h => {
      const d = new Date(h.timestamp);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    // Show max ~8 labels
    const step = Math.max(1, Math.floor(labels.length / 8));
    const displayLabels = labels.map((l, i) => i % step === 0 ? l : '');
    return { labels: displayLabels, datasets: [{ data: prices, strokeWidth: 2 }] };
  }, [currentHistory]);

  const formatPrice = (price: number, currency?: string) => {
    const sym = currency || product?.currency || '$';
    return `${sym}${price.toFixed(2)}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleTrack = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await trackProduct();
  }, [trackProduct]);

  const handleStopTracking = useCallback(async () => {
    if (currentTrackedProduct) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await stopTracking(currentTrackedProduct.id);
      closeSheet();
    }
  }, [currentTrackedProduct, stopTracking, closeSheet]);

  const handleShare = useCallback(async () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = currentStats
      ? `🏷️ ${product.title}\n💰 Now: ${formatPrice(product.currentPrice)}\n📉 Low: ${formatPrice(currentStats.allTimeLow)}\n📈 High: ${formatPrice(currentStats.allTimeHigh)}\n\nFound with Aura Browser 👻`
      : `🏷️ ${product.title}\n💰 ${formatPrice(product.currentPrice)}\n\nFound with Aura Browser 👻`;
    await Share.share({ message: msg });
  }, [product, currentStats]);

  const handleGoogleCompare = useCallback(() => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(product.title)}`;
    closeSheet();
    // Navigate via store's navigation (we'll dispatch this)
    (globalThis as any).__auraPriceCompareUrl = searchUrl;
    setTimeout(() => {
      const event = new CustomEvent('aura-navigate', { detail: { url: searchUrl } });
      if (typeof document !== 'undefined') document.dispatchEvent(event);
    }, 100);
  }, [product, closeSheet]);

  if (!product) return null;

  return (
    <Modal visible={isSheetVisible} animationType="slide" transparent statusBarTranslucent>
      <View style={[styles.overlay]}>
        <TouchableOpacity style={styles.backdrop} onPress={closeSheet} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImage, styles.placeholderImage]}>
                    <Ionicons name="pricetag" size={24} color={CYAN} />
                  </View>
                )}
                <View style={styles.headerInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  <Text style={styles.siteName}>{(product as any).siteName || ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Price & Deal Score */}
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.currentPrice}>{formatPrice(product.currentPrice)}</Text>
                {currentStats && (
                  <Text style={[styles.priceChange, { color: currentStats.currentVsAveragePercent <= 0 ? GREEN : RED }]}>
                    {currentStats.currentVsAveragePercent <= 0 ? '↓' : '↑'} {Math.abs(currentStats.currentVsAveragePercent).toFixed(1)}% vs avg
                  </Text>
                )}
              </View>
              {currentDealScore && (
                <View style={[styles.dealScoreBadge, { backgroundColor: currentDealScore.color + '22', borderColor: currentDealScore.color }]}>
                  <Text style={[styles.dealScoreNumber, { color: currentDealScore.color }]}>
                    {currentDealScore.isNew ? 'NEW' : currentDealScore.score}
                  </Text>
                  <Text style={[styles.dealScoreLabel, { color: currentDealScore.color }]}>
                    {currentDealScore.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Track / Stop Tracking Button */}
            {!isTracked ? (
              <TouchableOpacity style={styles.trackButton} onPress={handleTrack} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={18} color="#000" />
                <Text style={styles.trackButtonText}>Start Tracking Price</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                  <Ionicons name="share-outline" size={18} color={CYAN} />
                  <Text style={styles.actionBtnText}>Share Deal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleGoogleCompare}>
                  <Ionicons name="search-outline" size={18} color={CYAN} />
                  <Text style={styles.actionBtnText}>Compare Prices</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: RED + '44' }]} onPress={handleStopTracking}>
                  <Ionicons name="eye-off-outline" size={18} color={RED} />
                  <Text style={[styles.actionBtnText, { color: RED }]}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Price History Chart */}
            {chartData && currentHistory.length >= 2 && (
              <View style={styles.chartSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Price History</Text>
                  <View style={styles.timeRangeRow}>
                    {([30, 60, 90] as const).map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.timeRangeBtn, selectedTimeRange === r && styles.timeRangeBtnActive]}
                        onPress={() => { Haptics.selectionAsync(); setTimeRange(r); }}
                      >
                        <Text style={[styles.timeRangeText, selectedTimeRange === r && styles.timeRangeTextActive]}>{r}d</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <LineChart
                  data={chartData}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: DARK_BG,
                    backgroundGradientTo: DARK_BG,
                    decimalCount: 2,
                    color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
                    labelColor: () => '#666',
                    propsForDots: { r: '3', strokeWidth: '1', stroke: CYAN },
                    propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.05)' },
                    fillShadowGradientFrom: CYAN,
                    fillShadowGradientTo: 'transparent',
                    fillShadowGradientFromOpacity: 0.3,
                    fillShadowGradientToOpacity: 0,
                  }}
                  bezier
                  style={styles.chart}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  fromZero={false}
                />
              </View>
            )}

            {/* Stats Cards */}
            {currentStats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>All-Time Low</Text>
                  <Text style={[styles.statValue, { color: GREEN }]}>{formatPrice(currentStats.allTimeLow)}</Text>
                  <Text style={styles.statDate}>{formatDate(currentStats.allTimeLowDate)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>All-Time High</Text>
                  <Text style={[styles.statValue, { color: RED }]}>{formatPrice(currentStats.allTimeHigh)}</Text>
                  <Text style={styles.statDate}>{formatDate(currentStats.allTimeHighDate)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Average Price</Text>
                  <Text style={styles.statValue}>{formatPrice(currentStats.averagePrice)}</Text>
                  <Text style={styles.statDate}>{currentStats.daysTracked} days tracked</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>7-Day Change</Text>
                  <Text style={[styles.statValue, { color: currentStats.priceChange7dPercent <= 0 ? GREEN : RED }]}>
                    {currentStats.priceChange7dPercent <= 0 ? '↓' : '↑'} {Math.abs(currentStats.priceChange7dPercent).toFixed(1)}%
                  </Text>
                  <Text style={styles.statDate}>{currentStats.priceChange7d <= 0 ? '-' : '+'}{formatPrice(Math.abs(currentStats.priceChange7d))}</Text>
                </View>
              </View>
            )}

            {/* Buy Recommendation */}
            {currentRecommendation && (
              <View style={[styles.recommendationCard, { borderColor: currentRecommendation.color + '44' }]}>
                <View style={[styles.recIconContainer, { backgroundColor: currentRecommendation.color + '22' }]}>
                  <Ionicons name={currentRecommendation.icon as any} size={24} color={currentRecommendation.color} />
                </View>
                <View style={styles.recContent}>
                  <Text style={styles.recTitle}>{currentRecommendation.title}</Text>
                  <Text style={styles.recSubtitle}>{currentRecommendation.subtitle}</Text>
                </View>
              </View>
            )}

            {/* Compare Prices Prompt */}
            {isTracked && (
              <TouchableOpacity style={styles.compareCard} onPress={handleGoogleCompare} activeOpacity={0.8}>
                <Ionicons name="globe-outline" size={20} color={CYAN} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.compareTitle}>Compare Prices Across Stores</Text>
                  <Text style={styles.compareSubtitle}>Search Google Shopping for better deals</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#666" />
              </TouchableOpacity>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: DARK_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: CARD_BG,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },
  siteName: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
  },
  priceChange: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  dealScoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealScoreNumber: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  dealScoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYAN,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    backgroundColor: CARD_BG,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CYAN,
  },
  chartSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CYAN,
    letterSpacing: 1,
  },
  timeRangeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timeRangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: CARD_BG,
  },
  timeRangeBtnActive: {
    backgroundColor: CYAN + '22',
    borderWidth: 1,
    borderColor: CYAN,
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  timeRangeTextActive: {
    color: CYAN,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  statCard: {
    width: (SCREEN_WIDTH - 48) / 2 - 4,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  statDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
  },
  recIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recContent: {
    flex: 1,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  recSubtitle: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
  },
  compareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.12)',
  },
  compareTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  compareSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
