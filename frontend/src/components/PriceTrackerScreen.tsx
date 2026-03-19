import React, { useEffect, useCallback, useMemo, useRef } from 'react';
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
  Image,
  Share,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePriceTrackerStore } from '../store/usePriceTrackerStore';
import { priceTrackerDB, TrackedProduct, PriceHistoryEntry } from '../services/PriceTrackerDB';
import { priceAnalysisService, DealScore, PriceStats } from '../services/PriceAnalysisService';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CYAN = '#00FFFF';
const GREEN = '#00C853';
const RED = '#FF4444';
const ORANGE = '#FF8F00';
const BLUE = '#2962FF';
const DARK_BG = '#0a0a0f';
const CARD_BG = 'rgba(255,255,255,0.05)';

type FilterTab = 'all' | 'drops' | 'watching' | 'best';

interface ProductCardData {
  product: TrackedProduct;
  history: PriceHistoryEntry[];
  dealScore: DealScore;
  sparkline: number[];
  stats: PriceStats | null;
  isFlashSale: boolean;
  recommendation: string;
}

// ══════════════════════════════════════════
// ANIMATED SAVINGS COUNTER
// ══════════════════════════════════════════
const AnimatedCounter: React.FC<{ value: number; prefix?: string; color?: string }> = ({ value, prefix = '$', color = '#fff' }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const displayValue = animValue.interpolate({
    inputRange: [0, value || 1],
    outputRange: ['0', String(Math.round(value))],
    extrapolate: 'clamp',
  });

  return (
    <Animated.Text style={[styles.summaryValue, { color }]}>
      {prefix}{Math.round(value)}
    </Animated.Text>
  );
};

// ══════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════
export const PriceTrackerScreen: React.FC<{ visible: boolean; onClose: () => void; onNavigate?: (url: string) => void }> = ({ visible, onClose, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const {
    trackedProducts, totalSavings, priceDropCount, bestDeal,
    loadTrackedProducts, loadStats,
  } = usePriceTrackerStore();

  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('all');
  const [cardDataMap, setCardDataMap] = React.useState<Map<string, ProductCardData>>(new Map());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      loadTrackedProducts();
      loadStats();
      // Pulse animation for flash sale badges
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible]);

  // Load history and scores for all products
  useEffect(() => {
    if (!visible || trackedProducts.length === 0) return;
    const loadAll = async () => {
      const map = new Map<string, ProductCardData>();
      for (const product of trackedProducts) {
        const history = await priceTrackerDB.getProductHistory(product.id);
        const dealScore = priceAnalysisService.calculateDealScore(product, history);
        const sparkline = priceAnalysisService.getSparklineData(history, 15);
        const stats = history.length >= 2 ? priceAnalysisService.calculateStats(product, history) : null;

        // Flash sale: 30%+ drop in recent history
        let isFlashSale = false;
        if (history.length >= 2) {
          const recent = history.slice(-5);
          const prev = recent[0].price;
          const drop = ((prev - product.currentPrice) / prev) * 100;
          if (drop >= 30) isFlashSale = true;
        }

        // Quick recommendation
        let recommendation = '';
        if (history.length < 3) {
          recommendation = 'Tracking started...';
        } else if (stats) {
          const rec = priceAnalysisService.getBuyRecommendation(product, history, stats);
          recommendation = rec.title;
        }

        map.set(product.id, { product, history, dealScore, sparkline, stats, isFlashSale, recommendation });
      }
      setCardDataMap(map);
    };
    loadAll();
  }, [visible, trackedProducts]);

  const filteredProducts = useMemo(() => {
    let list = trackedProducts;
    switch (activeFilter) {
      case 'drops':
        list = list.filter(p => p.currentPrice < p.initialPrice);
        break;
      case 'watching':
        list = list.filter(p => p.isTracking);
        break;
      case 'best':
        list = list.filter(p => {
          const data = cardDataMap.get(p.id);
          return data && !data.dealScore.isNew && data.dealScore.score >= 7;
        });
        break;
    }
    return list;
  }, [trackedProducts, activeFilter, cardDataMap]);

  const flashSaleCount = useMemo(() => {
    let count = 0;
    cardDataMap.forEach(d => { if (d.isFlashSale) count++; });
    return count;
  }, [cardDataMap]);

  const handleProductPress = useCallback((product: TrackedProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onNavigate) {
      onClose();
      onNavigate(product.url);
    }
  }, [onNavigate, onClose]);

  const handleStopTracking = useCallback(async (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await priceTrackerDB.deleteProduct(productId);
    loadTrackedProducts();
    loadStats();
  }, [loadTrackedProducts, loadStats]);

  const handleShareDeal = useCallback(async (product: TrackedProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const data = cardDataMap.get(product.id);
    const priceDiff = product.initialPrice - product.currentPrice;
    const priceDiffPercent = product.initialPrice > 0 ? (priceDiff / product.initialPrice) * 100 : 0;

    let msg = `🏷️ Deal Alert!\n\n`;
    msg += `${product.title}\n`;
    if (priceDiff > 0) {
      msg += `💰 NOW: ${product.currency}${product.currentPrice.toFixed(2)}\n`;
      msg += `~~Was: ${product.currency}${product.initialPrice.toFixed(2)}~~\n`;
      msg += `🔥 Save ${product.currency}${priceDiff.toFixed(2)} (${priceDiffPercent.toFixed(0)}% OFF)\n`;
    } else {
      msg += `💰 Price: ${product.currency}${product.currentPrice.toFixed(2)}\n`;
    }
    if (data?.stats) {
      msg += `📊 All-time low: ${product.currency}${data.stats.allTimeLow.toFixed(2)}\n`;
    }
    if (data?.dealScore && !data.dealScore.isNew) {
      msg += `⭐ Deal Score: ${data.dealScore.score}/10 (${data.dealScore.label})\n`;
    }
    msg += `\n🔗 ${product.url}\n`;
    msg += `\nFound with Aura Browser 👻\nDownload Aura for free price tracking!`;

    await Share.share({ message: msg });
  }, [cardDataMap]);

  const formatPrice = (price: number, currency?: string) => `${currency || '$'}${price.toFixed(2)}`;

  const renderSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const width = 80;
    const height = 28;
    const stepX = width / (data.length - 1);
    return (
      <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {data.map((val, i) => (
          <View
            key={i}
            style={{
              width: Math.max(2, stepX - 1),
              height: Math.max(2, val * height),
              backgroundColor: color + '88',
              marginRight: 1,
              borderRadius: 1,
            }}
          />
        ))}
      </View>
    );
  };

  const renderProductCard = (product: TrackedProduct) => {
    const data = cardDataMap.get(product.id);
    const priceDiff = product.currentPrice - product.initialPrice;
    const priceDiffPercent = product.initialPrice > 0 ? (priceDiff / product.initialPrice) * 100 : 0;
    const isDown = priceDiff < 0;

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.productCard, data?.isFlashSale && styles.flashSaleCard]}
        onPress={() => handleProductPress(product)}
        activeOpacity={0.8}
      >
        {/* Flash Sale Badge */}
        {data?.isFlashSale && (
          <Animated.View style={[styles.flashSaleBadge, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.flashSaleText}>⚡ FLASH SALE</Text>
          </Animated.View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Ionicons name="pricetag" size={18} color={CYAN} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={2}>{product.title}</Text>
              <Text style={styles.cardSite}>{product.siteName}</Text>
            </View>
          </View>
          {data && !data.dealScore.isNew && (
            <View style={[styles.miniScoreBadge, { backgroundColor: data.dealScore.color + '22', borderColor: data.dealScore.color }]}>
              <Text style={[styles.miniScoreText, { color: data.dealScore.color }]}>{data.dealScore.score}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>{formatPrice(product.currentPrice, product.currency)}</Text>
            <Text style={[styles.cardPriceChange, { color: isDown ? GREEN : priceDiff === 0 ? '#888' : RED }]}>
              {isDown ? '↓' : priceDiff === 0 ? '—' : '↑'} {formatPrice(Math.abs(priceDiff), product.currency)} ({Math.abs(priceDiffPercent).toFixed(0)}%{isDown ? ' drop' : priceDiff === 0 ? '' : ' rise'})
            </Text>
          </View>
          {data && data.sparkline.length > 0 && (
            <View style={styles.sparklineContainer}>
              {renderSparkline(data.sparkline, isDown ? GREEN : priceDiff === 0 ? CYAN : RED)}
            </View>
          )}
        </View>

        {/* Recommendation Line */}
        {data?.recommendation ? (
          <View style={styles.recLine}>
            <Ionicons name="bulb-outline" size={12} color={ORANGE} />
            <Text style={styles.recLineText} numberOfLines={1}>{data.recommendation}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={(e) => { e.stopPropagation?.(); handleShareDeal(product); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={14} color={CYAN} />
            <Text style={styles.shareBtnText}>Share Deal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={(e) => { e.stopPropagation?.(); handleStopTracking(product.id); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={RED} />
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Price Tracker</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Savings Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="pricetags" size={18} color={CYAN} />
            <AnimatedCounter value={trackedProducts.length} prefix="" color="#fff" />
            <Text style={styles.summaryLabel}>Tracked</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <Ionicons name="wallet" size={18} color={GREEN} />
            <AnimatedCounter value={totalSavings} prefix="$" color={GREEN} />
            <Text style={styles.summaryLabel}>Saved</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-down" size={18} color={ORANGE} />
            <AnimatedCounter value={priceDropCount} prefix="" color="#fff" />
            <Text style={styles.summaryLabel}>Drops</Text>
          </View>
        </View>

        {/* Best Deal Ever */}
        {bestDeal && (
          <View style={styles.bestDealBar}>
            <Ionicons name="trophy" size={14} color="#FFD700" />
            <Text style={styles.bestDealText}>
              Best deal: Saved ${bestDeal.savedAmount.toFixed(0)} on {bestDeal.productTitle.substring(0, 30)}...
            </Text>
          </View>
        )}

        {/* Flash Sale Alert */}
        {flashSaleCount > 0 && (
          <Animated.View style={[styles.flashAlert, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.flashAlertText}>
              ⚡ {flashSaleCount} Flash Sale{flashSaleCount > 1 ? 's' : ''} detected!
            </Text>
          </Animated.View>
        )}

        {/* Motivational Message */}
        {totalSavings > 0 && (
          <View style={styles.motivationBar}>
            <Ionicons name="sparkles" size={14} color={CYAN} />
            <Text style={styles.motivationText}>Aura has saved you ${totalSavings.toFixed(0)} so far. Keep tracking!</Text>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {[
            { key: 'all' as FilterTab, label: 'All', icon: 'list-outline' },
            { key: 'drops' as FilterTab, label: 'Price Drops', icon: 'trending-down-outline' },
            { key: 'watching' as FilterTab, label: 'Watching', icon: 'eye-outline' },
            { key: 'best' as FilterTab, label: 'Best Deals', icon: 'star-outline' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(tab.key); }}
            >
              <Ionicons name={tab.icon as any} size={12} color={activeFilter === tab.key ? CYAN : '#888'} />
              <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Product List */}
        <ScrollView style={styles.productList} showsVerticalScrollIndicator={false}>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="pricetag-outline" size={48} color="#333" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all' ? 'No products tracked yet' : 'No products match this filter'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'all' ? 'Visit any shopping site and Aura will detect prices automatically' : 'Try a different filter'}
              </Text>
              {activeFilter === 'all' && (
                <View style={styles.emptyTips}>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                    <Text style={styles.tipText}>Works on Amazon, Walmart, Best Buy & more</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                    <Text style={styles.tipText}>Auto-detects product pages</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                    <Text style={styles.tipText}>100% private — all data stays on your device</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            filteredProducts.map(p => renderProductCard(p))
          )}
          <View style={{ height: insets.bottom + 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryCardHighlight: {
    borderColor: GREEN + '33',
    backgroundColor: GREEN + '08',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  bestDealBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFD70010',
    borderWidth: 1,
    borderColor: '#FFD70022',
    gap: 8,
  },
  bestDealText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
    flex: 1,
  },
  flashAlert: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: RED + '15',
    borderWidth: 1,
    borderColor: RED + '44',
    alignItems: 'center',
  },
  flashAlertText: {
    fontSize: 13,
    fontWeight: '800',
    color: RED,
    letterSpacing: 0.5,
  },
  motivationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: CYAN + '08',
    borderWidth: 1,
    borderColor: CYAN + '22',
    gap: 8,
  },
  motivationText: {
    fontSize: 12,
    fontWeight: '600',
    color: CYAN,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CARD_BG,
  },
  filterTabActive: {
    backgroundColor: CYAN + '18',
    borderWidth: 1,
    borderColor: CYAN + '44',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
  },
  filterTabTextActive: {
    color: CYAN,
  },
  productList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  productCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  flashSaleCard: {
    borderColor: RED + '44',
    backgroundColor: RED + '08',
  },
  flashSaleBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: RED,
    zIndex: 10,
  },
  flashSaleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  cardImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  cardSite: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  miniScoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  miniScoreText: {
    fontSize: 14,
    fontWeight: '900',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  cardPriceRow: {
    flex: 1,
  },
  cardPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  cardPriceChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sparklineContainer: {
    marginLeft: 12,
    justifyContent: 'flex-end',
  },
  recLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  recLineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CYAN,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  stopBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: RED,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#444',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyTips: {
    marginTop: 24,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});
