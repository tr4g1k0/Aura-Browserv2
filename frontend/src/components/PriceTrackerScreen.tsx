import React, { useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePriceTrackerStore } from '../store/usePriceTrackerStore';
import { priceTrackerDB, TrackedProduct, PriceHistoryEntry } from '../services/PriceTrackerDB';
import { priceAnalysisService, DealScore } from '../services/PriceAnalysisService';
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
}

export const PriceTrackerScreen: React.FC<{ visible: boolean; onClose: () => void; onNavigate?: (url: string) => void }> = ({ visible, onClose, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const {
    trackedProducts, totalSavings, priceDropCount, bestDeal,
    loadTrackedProducts, loadStats, openSheet,
  } = usePriceTrackerStore();

  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('all');
  const [cardDataMap, setCardDataMap] = React.useState<Map<string, ProductCardData>>(new Map());

  useEffect(() => {
    if (visible) {
      loadTrackedProducts();
      loadStats();
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
        map.set(product.id, { product, history, dealScore, sparkline });
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

  const formatPrice = (price: number, currency?: string) => `${currency || '$'}${price.toFixed(2)}`;

  const renderSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const width = 80;
    const height = 28;
    const stepX = width / (data.length - 1);
    // Build SVG-like path using Views (since we're avoiding SVG deps for this component)
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
        style={styles.productCard}
        onPress={() => handleProductPress(product)}
        activeOpacity={0.8}
      >
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

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={(e) => { e.stopPropagation?.(); handleStopTracking(product.id); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={RED} />
            <Text style={styles.stopBtnText}>Stop Tracking</Text>
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

        {/* Savings Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="pricetags" size={18} color={CYAN} />
            <Text style={styles.summaryValue}>{trackedProducts.length}</Text>
            <Text style={styles.summaryLabel}>Tracked</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardHighlight]}>
            <Ionicons name="wallet" size={18} color={GREEN} />
            <Text style={[styles.summaryValue, { color: GREEN }]}>${totalSavings.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Saved</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="trending-down" size={18} color={ORANGE} />
            <Text style={styles.summaryValue}>{priceDropCount}</Text>
            <Text style={styles.summaryLabel}>Drops</Text>
          </View>
        </View>

        {totalSavings > 0 && (
          <View style={styles.motivationBar}>
            <Ionicons name="sparkles" size={14} color={CYAN} />
            <Text style={styles.motivationText}>Aura has saved you ${totalSavings.toFixed(0)} so far. Keep tracking!</Text>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {[
            { key: 'all' as FilterTab, label: 'All' },
            { key: 'drops' as FilterTab, label: 'Price Drops' },
            { key: 'watching' as FilterTab, label: 'Watching' },
            { key: 'best' as FilterTab, label: 'Best Deals' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(tab.key); }}
            >
              <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Product List */}
        <ScrollView style={styles.productList} showsVerticalScrollIndicator={false}>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color="#333" />
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all' ? 'No products tracked yet' : 'No products match this filter'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'all' ? 'Visit any shopping site and Aura will detect prices automatically' : 'Try a different filter'}
              </Text>
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
  motivationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
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
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
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
    fontSize: 12,
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#444',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
