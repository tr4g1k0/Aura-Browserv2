import { create } from 'zustand';
import { priceTrackerDB, TrackedProduct, PriceHistoryEntry, SavingsRecord } from '../services/PriceTrackerDB';
import { priceAnalysisService, DealScore, BuyRecommendation, PriceStats } from '../services/PriceAnalysisService';
import { priceNotificationService } from '../services/PriceNotificationService';

interface DetectedProduct {
  title: string;
  price: number;
  priceText: string;
  currency: string;
  imageUrl: string;
  siteName: string;
  url: string;
  hasCartButton: boolean;
}

interface PriceTrackerState {
  // Current page detection
  detectedProduct: DetectedProduct | null;
  isProductPage: boolean;
  isCheckoutPage: boolean;

  // Current product analysis
  currentDealScore: DealScore | null;
  currentStats: PriceStats | null;
  currentRecommendation: BuyRecommendation | null;
  currentHistory: PriceHistoryEntry[];
  isTracked: boolean;
  currentTrackedProduct: TrackedProduct | null;

  // UI state
  isSheetVisible: boolean;
  isPriceTrackerScreenVisible: boolean;
  selectedTimeRange: 30 | 60 | 90;

  // Global stats
  trackedProducts: TrackedProduct[];
  totalSavings: number;
  priceDropCount: number;
  bestDeal: SavingsRecord | null;

  // Coupon
  checkoutDomain: string;

  // Actions
  setDetectedProduct: (product: DetectedProduct | null) => void;
  setCheckoutDetected: (domain: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
  setTimeRange: (range: 30 | 60 | 90) => void;
  trackProduct: () => Promise<void>;
  stopTracking: (productId: string) => Promise<void>;
  refreshCurrentProduct: () => Promise<void>;
  loadTrackedProducts: () => Promise<void>;
  loadStats: () => Promise<void>;
  clearAll: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const usePriceTrackerStore = create<PriceTrackerState>((set, get) => ({
  // State
  detectedProduct: null,
  isProductPage: false,
  isCheckoutPage: false,
  currentDealScore: null,
  currentStats: null,
  currentRecommendation: null,
  currentHistory: [],
  isTracked: false,
  currentTrackedProduct: null,
  isSheetVisible: false,
  isPriceTrackerScreenVisible: false,
  selectedTimeRange: 30,
  trackedProducts: [],
  totalSavings: 0,
  priceDropCount: 0,
  bestDeal: null,
  checkoutDomain: '',

  // Actions
  setDetectedProduct: async (product: DetectedProduct | null) => {
    if (!product) {
      set({ detectedProduct: null, isProductPage: false, currentDealScore: null, currentStats: null, currentRecommendation: null, currentHistory: [], isTracked: false, currentTrackedProduct: null });
      return;
    }

    set({ detectedProduct: product, isProductPage: true });

    // Check if already tracked
    const existing = await priceTrackerDB.getProductByUrl(product.url);
    if (existing) {
      // Update current price + notify on price drops
      if (existing.currentPrice !== product.price) {
        const previousPrice = existing.currentPrice;
        await priceTrackerDB.addPriceEntry(existing.id, product.price, product.currency);

        // Price drop notification
        if (product.price < previousPrice) {
          const dropPercent = ((previousPrice - product.price) / previousPrice) * 100;
          if (dropPercent >= 30) {
            // Flash sale!
            priceNotificationService.notifyFlashSale(
              existing.title, product.price, previousPrice, product.currency, dropPercent, product.url
            );
          } else if (dropPercent >= 5) {
            priceNotificationService.notifyPriceDrop(
              existing.title, product.price, previousPrice, product.currency, product.url
            );
          }

          // Record savings
          await priceTrackerDB.addSaving({
            productId: existing.id,
            productTitle: existing.title,
            savedAmount: previousPrice - product.price,
            originalPrice: previousPrice,
            dealPrice: product.price,
            timestamp: Date.now(),
          });
        }
      }
      const updatedProduct = await priceTrackerDB.getProduct(existing.id);
      const history = await priceTrackerDB.getProductHistory(existing.id);
      const dealScore = priceAnalysisService.calculateDealScore(updatedProduct!, history);
      const stats = priceAnalysisService.calculateStats(updatedProduct!, history);
      const recommendation = priceAnalysisService.getBuyRecommendation(updatedProduct!, history, stats);

      set({
        isTracked: true,
        currentTrackedProduct: updatedProduct,
        currentHistory: history,
        currentDealScore: dealScore,
        currentStats: stats,
        currentRecommendation: recommendation,
      });
    } else {
      // Not tracked yet — show NEW badge
      set({
        isTracked: false,
        currentTrackedProduct: null,
        currentHistory: [],
        currentDealScore: { score: 0, label: 'NEW', color: '#00FFFF', isNew: true, reason: 'Start tracking to see the deal score' },
        currentStats: null,
        currentRecommendation: null,
      });
    }
  },

  setCheckoutDetected: (domain: string) => {
    set({ isCheckoutPage: true, checkoutDomain: domain });
  },

  openSheet: () => set({ isSheetVisible: true }),
  closeSheet: () => set({ isSheetVisible: false }),
  setTimeRange: (range) => set({ selectedTimeRange: range }),

  trackProduct: async () => {
    const { detectedProduct } = get();
    if (!detectedProduct) return;

    const id = priceTrackerDB.generateProductId(detectedProduct.url);
    const product: TrackedProduct = {
      id,
      title: detectedProduct.title,
      url: detectedProduct.url,
      siteName: detectedProduct.siteName,
      imageUrl: detectedProduct.imageUrl,
      currency: detectedProduct.currency,
      initialPrice: detectedProduct.price,
      currentPrice: detectedProduct.price,
      lowestPrice: detectedProduct.price,
      highestPrice: detectedProduct.price,
      lowestPriceDate: Date.now(),
      highestPriceDate: Date.now(),
      dateAdded: Date.now(),
      lastChecked: Date.now(),
      isTracking: true,
      category: guessCategoryFromUrl(detectedProduct.url),
    };

    await priceTrackerDB.saveProduct(product);
    await priceTrackerDB.addPriceEntry(id, detectedProduct.price, detectedProduct.currency);

    const history = await priceTrackerDB.getProductHistory(id);
    const dealScore = priceAnalysisService.calculateDealScore(product, history);
    const stats = priceAnalysisService.calculateStats(product, history);
    const recommendation = priceAnalysisService.getBuyRecommendation(product, history, stats);

    set({
      isTracked: true,
      currentTrackedProduct: product,
      currentHistory: history,
      currentDealScore: dealScore,
      currentStats: stats,
      currentRecommendation: recommendation,
    });

    // Reload list
    await get().loadTrackedProducts();
  },

  stopTracking: async (productId: string) => {
    await priceTrackerDB.deleteProduct(productId);
    set({ isTracked: false, currentTrackedProduct: null, currentDealScore: null });
    await get().loadTrackedProducts();
    await get().loadStats();
  },

  refreshCurrentProduct: async () => {
    const { currentTrackedProduct, selectedTimeRange } = get();
    if (!currentTrackedProduct) return;
    const history = await priceTrackerDB.getProductHistory(currentTrackedProduct.id, selectedTimeRange);
    const allHistory = await priceTrackerDB.getProductHistory(currentTrackedProduct.id);
    const dealScore = priceAnalysisService.calculateDealScore(currentTrackedProduct, allHistory);
    const stats = priceAnalysisService.calculateStats(currentTrackedProduct, allHistory);
    const recommendation = priceAnalysisService.getBuyRecommendation(currentTrackedProduct, allHistory, stats);
    set({ currentHistory: history, currentDealScore: dealScore, currentStats: stats, currentRecommendation: recommendation });
  },

  loadTrackedProducts: async () => {
    const products = await priceTrackerDB.getTrackedProducts();
    set({ trackedProducts: products });
  },

  loadStats: async () => {
    const statsData = await priceTrackerDB.getStats();
    set({
      totalSavings: statsData.totalSavings,
      priceDropCount: statsData.priceDrops,
      bestDeal: statsData.bestDeal,
    });
  },

  clearAll: async () => {
    await priceTrackerDB.clearAll();
    set({
      detectedProduct: null,
      isProductPage: false,
      currentDealScore: null,
      currentStats: null,
      currentRecommendation: null,
      currentHistory: [],
      isTracked: false,
      currentTrackedProduct: null,
      trackedProducts: [],
      totalSavings: 0,
      priceDropCount: 0,
      bestDeal: null,
    });
  },

  initialize: async () => {
    await get().loadTrackedProducts();
    await get().loadStats();
    // Initialize notifications (no-op on web)
    priceNotificationService.initialize();
  },
}));

// Helper: guess product category from URL
function guessCategoryFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('electronic') || lower.includes('computer') || lower.includes('phone') || lower.includes('laptop') || lower.includes('tv')) return 'Electronics';
  if (lower.includes('cloth') || lower.includes('fashion') || lower.includes('shoe') || lower.includes('apparel')) return 'Fashion';
  if (lower.includes('book') || lower.includes('kindle')) return 'Books';
  if (lower.includes('home') || lower.includes('kitchen') || lower.includes('furniture')) return 'Home';
  if (lower.includes('sport') || lower.includes('outdoor') || lower.includes('fitness')) return 'Sports';
  if (lower.includes('beauty') || lower.includes('health') || lower.includes('personal')) return 'Beauty';
  if (lower.includes('toy') || lower.includes('game') || lower.includes('kid')) return 'Toys & Games';
  return 'Other';
}
