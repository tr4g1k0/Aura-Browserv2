import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──
export interface TrackedProduct {
  id: string;
  title: string;
  url: string;
  siteName: string;
  imageUrl: string;
  currency: string;
  initialPrice: number;
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  lowestPriceDate: number;
  highestPriceDate: number;
  dateAdded: number;
  lastChecked: number;
  isTracking: boolean;
  category: string;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  price: number;
  currency: string;
  timestamp: number;
}

export interface SavingsRecord {
  productId: string;
  productTitle: string;
  savedAmount: number;
  originalPrice: number;
  dealPrice: number;
  timestamp: number;
}

const PRODUCTS_KEY = '@aura_price_tracker_products';
const HISTORY_KEY = '@aura_price_tracker_history';
const SAVINGS_KEY = '@aura_price_tracker_savings';

class PriceTrackerDB {
  private productsCache: TrackedProduct[] | null = null;
  private historyCache: PriceHistoryEntry[] | null = null;
  private savingsCache: SavingsRecord[] | null = null;

  // ── Products ──
  async getProducts(): Promise<TrackedProduct[]> {
    if (this.productsCache) return this.productsCache;
    try {
      const data = await AsyncStorage.getItem(PRODUCTS_KEY);
      this.productsCache = data ? JSON.parse(data) : [];
      return this.productsCache!;
    } catch { return []; }
  }

  async getProduct(id: string): Promise<TrackedProduct | null> {
    try {
      const products = await this.getProducts();
      return products.find(p => p.id === id) || null;
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get product:', error);
      return null;
    }
  }

  async getProductByUrl(url: string): Promise<TrackedProduct | null> {
    try {
      const products = await this.getProducts();
      // Normalize URL for comparison
      const normalizedUrl = this.normalizeUrl(url);
      return products.find(p => this.normalizeUrl(p.url) === normalizedUrl) || null;
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get product by URL:', error);
      return null;
    }
  }

  async saveProduct(product: TrackedProduct): Promise<void> {
    try {
      const products = await this.getProducts();
      const idx = products.findIndex(p => p.id === product.id);
      if (idx >= 0) products[idx] = product;
      else products.push(product);
      this.productsCache = products;
      await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to save product:', error);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      let products = await this.getProducts();
      products = products.filter(p => p.id !== id);
      this.productsCache = products;
      await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      // Also delete history
      let history = await this.getHistory();
      history = history.filter(h => h.productId !== id);
      this.historyCache = history;
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to delete product:', error);
    }
  }

  async getTrackedProducts(): Promise<TrackedProduct[]> {
    try {
      const products = await this.getProducts();
      return products.filter(p => p.isTracking);
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get tracked products:', error);
      return [];
    }
  }

  // ── Price History ──
  async getHistory(): Promise<PriceHistoryEntry[]> {
    if (this.historyCache) return this.historyCache;
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      this.historyCache = data ? JSON.parse(data) : [];
      return this.historyCache!;
    } catch { return []; }
  }

  async getProductHistory(productId: string, days?: number): Promise<PriceHistoryEntry[]> {
    const history = await this.getHistory();
    let filtered = history.filter(h => h.productId === productId);
    if (days) {
      const cutoff = Date.now() - days * 86400000;
      filtered = filtered.filter(h => h.timestamp >= cutoff);
    }
    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }

  async addPriceEntry(productId: string, price: number, currency: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const entry: PriceHistoryEntry = {
        id: `${productId}_${Date.now()}`,
        productId,
        price,
        currency,
        timestamp: Date.now(),
      };
      history.push(entry);
      this.historyCache = history;
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));

      // Update product stats
      const product = await this.getProduct(productId);
      if (product) {
        product.currentPrice = price;
        product.lastChecked = Date.now();
        if (price < product.lowestPrice) {
          product.lowestPrice = price;
          product.lowestPriceDate = Date.now();
        }
        if (price > product.highestPrice) {
          product.highestPrice = price;
          product.highestPriceDate = Date.now();
        }
        await this.saveProduct(product);
      }
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to add price entry:', error);
    }
  }

  // ── Savings ──
  async getSavings(): Promise<SavingsRecord[]> {
    if (this.savingsCache) return this.savingsCache;
    try {
      const data = await AsyncStorage.getItem(SAVINGS_KEY);
      this.savingsCache = data ? JSON.parse(data) : [];
      return this.savingsCache!;
    } catch { return []; }
  }

  async addSaving(record: SavingsRecord): Promise<void> {
    try {
      const savings = await this.getSavings();
      savings.push(record);
      this.savingsCache = savings;
      await AsyncStorage.setItem(SAVINGS_KEY, JSON.stringify(savings));
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to add saving:', error);
    }
  }

  async getTotalSavings(): Promise<number> {
    try {
      const savings = await this.getSavings();
      return savings.reduce((sum, s) => sum + s.savedAmount, 0);
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get total savings:', error);
      return 0;
    }
  }

  async getMonthSavings(monthOffset = 0): Promise<number> {
    try {
      const savings = await this.getSavings();
      const now = new Date();
      const targetMonth = now.getMonth() - monthOffset;
      const targetYear = now.getFullYear();
      return savings
        .filter(s => {
          const d = new Date(s.timestamp);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        })
        .reduce((sum, s) => sum + s.savedAmount, 0);
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get month savings:', error);
      return 0;
    }
  }

  // ── Flash Sale Detection ──
  async detectFlashSales(): Promise<TrackedProduct[]> {
    try {
      const products = await this.getTrackedProducts();
      const flashSales: TrackedProduct[] = [];
      for (const product of products) {
        const history = await this.getProductHistory(product.id, 1); // last 24h
        if (history.length >= 2) {
          const previousPrice = history[0].price;
          const drop = ((previousPrice - product.currentPrice) / previousPrice) * 100;
          if (drop >= 30) flashSales.push(product);
        }
      }
      return flashSales;
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to detect flash sales:', error);
      return [];
    }
  }

  // ── Stats ──
  async getStats(): Promise<{
    totalTracked: number;
    totalSavings: number;
    priceDrops: number;
    bestDeal: SavingsRecord | null;
  }> {
    try {
      const products = await this.getTrackedProducts();
      const savings = await this.getSavings();
      const priceDrops = products.filter(p => p.currentPrice < p.initialPrice).length;
      const bestDeal = savings.length > 0
        ? savings.reduce((max, s) => s.savedAmount > max.savedAmount ? s : max, savings[0])
        : null;
      return {
        totalTracked: products.length,
        totalSavings: savings.reduce((sum, s) => sum + s.savedAmount, 0),
        priceDrops,
        bestDeal,
      };
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to get stats:', error);
      return { totalTracked: 0, totalSavings: 0, priceDrops: 0, bestDeal: null };
    }
  }

  // ── Utilities ──
  generateProductId(url: string): string {
    // Create stable ID from URL
    const normalized = this.normalizeUrl(url);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `prod_${Math.abs(hash).toString(36)}`;
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      // Remove tracking params
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'tag', 'fbclid', 'gclid'].forEach(p => u.searchParams.delete(p));
      return u.origin + u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
    } catch { return url; }
  }

  // ── Clear all data ──
  async clearAll(): Promise<void> {
    try {
      this.productsCache = null;
      this.historyCache = null;
      this.savingsCache = null;
      await AsyncStorage.multiRemove([PRODUCTS_KEY, HISTORY_KEY, SAVINGS_KEY]);
    } catch (error) {
      console.error('[PriceTrackerDB] Failed to clear all data:', error);
    }
  }
}

export const priceTrackerDB = new PriceTrackerDB();
