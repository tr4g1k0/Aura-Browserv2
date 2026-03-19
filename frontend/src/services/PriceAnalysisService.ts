import { PriceHistoryEntry, TrackedProduct } from './PriceTrackerDB';

export interface DealScore {
  score: number; // 1-10
  label: string;
  color: string;
  isNew: boolean;
  reason: string;
}

export type BuyRecommendation = 
  | { type: 'buy_now'; title: string; subtitle: string; color: string; icon: string }
  | { type: 'wait'; title: string; subtitle: string; color: string; icon: string }
  | { type: 'uncertain'; title: string; subtitle: string; color: string; icon: string }
  | { type: 'rising'; title: string; subtitle: string; color: string; icon: string };

export interface PriceStats {
  allTimeLow: number;
  allTimeLowDate: number;
  allTimeHigh: number;
  allTimeHighDate: number;
  averagePrice: number;
  currentVsAverage: number; // positive = above avg, negative = below avg
  currentVsAveragePercent: number;
  daysTracked: number;
  priceChange7d: number;
  priceChange7dPercent: number;
  priceChange30d: number;
  priceChange30dPercent: number;
}

class PriceAnalysisService {

  calculateDealScore(product: TrackedProduct, history: PriceHistoryEntry[]): DealScore {
    if (history.length < 2) {
      return {
        score: 0,
        label: 'NEW',
        color: '#00FFFF',
        isNew: true,
        reason: 'Tracking started — collecting price data',
      };
    }

    const prices = history.map(h => h.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const current = product.currentPrice;
    const range = max - min || 1;

    // Score based on position in price range
    let score: number;
    if (range === 0) {
      score = 5; // Price hasn't changed
    } else {
      // 0 = at max (worst), 1 = at min (best)
      const position = 1 - ((current - min) / range);
      score = Math.round(1 + position * 9);
    }

    // Adjust based on comparison to average
    const vsAvg = ((avg - current) / avg) * 100;
    if (vsAvg > 20) score = Math.min(10, score + 1);
    if (vsAvg < -20) score = Math.max(1, score - 1);

    // Check proximity to all-time low (within 5%)
    const nearLow = ((current - min) / min) * 100;
    if (nearLow <= 5) score = Math.max(score, 9);
    if (current <= min) score = 10;

    score = Math.max(1, Math.min(10, score));

    let label: string, color: string;
    if (score >= 9) { label = 'Best Price!'; color = '#00C853'; }
    else if (score >= 7) { label = 'Good Deal'; color = '#2962FF'; }
    else if (score >= 4) { label = 'Average'; color = '#FF8F00'; }
    else { label = 'Bad Deal'; color = '#D50000'; }

    const reason = score >= 9
      ? `Price is ${vsAvg.toFixed(0)}% below average — near all-time low!`
      : score >= 7
      ? `Price is ${vsAvg.toFixed(0)}% below average`
      : score >= 4
      ? `Price is around the average range`
      : `Price is ${Math.abs(vsAvg).toFixed(0)}% above average`;

    return { score, label, color, isNew: false, reason };
  }

  calculateStats(product: TrackedProduct, history: PriceHistoryEntry[]): PriceStats {
    const prices = history.map(h => h.price);
    const timestamps = history.map(h => h.timestamp);

    const allTimeLow = prices.length ? Math.min(...prices) : product.currentPrice;
    const allTimeHigh = prices.length ? Math.max(...prices) : product.currentPrice;
    const allTimeLowIdx = prices.indexOf(allTimeLow);
    const allTimeHighIdx = prices.indexOf(allTimeHigh);
    const averagePrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : product.currentPrice;

    const current = product.currentPrice;
    const currentVsAverage = current - averagePrice;
    const currentVsAveragePercent = averagePrice > 0 ? ((current - averagePrice) / averagePrice) * 100 : 0;

    const daysTracked = timestamps.length >= 2
      ? Math.max(1, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 86400000))
      : 0;

    // 7-day change
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recent7d = history.filter(h => h.timestamp >= sevenDaysAgo);
    const priceChange7d = recent7d.length >= 2
      ? current - recent7d[0].price
      : 0;
    const priceChange7dPercent = recent7d.length >= 2 && recent7d[0].price > 0
      ? ((current - recent7d[0].price) / recent7d[0].price) * 100
      : 0;

    // 30-day change
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recent30d = history.filter(h => h.timestamp >= thirtyDaysAgo);
    const priceChange30d = recent30d.length >= 2
      ? current - recent30d[0].price
      : 0;
    const priceChange30dPercent = recent30d.length >= 2 && recent30d[0].price > 0
      ? ((current - recent30d[0].price) / recent30d[0].price) * 100
      : 0;

    return {
      allTimeLow,
      allTimeLowDate: timestamps[allTimeLowIdx] || product.dateAdded,
      allTimeHigh,
      allTimeHighDate: timestamps[allTimeHighIdx] || product.dateAdded,
      averagePrice,
      currentVsAverage,
      currentVsAveragePercent,
      daysTracked,
      priceChange7d,
      priceChange7dPercent,
      priceChange30d,
      priceChange30dPercent,
    };
  }

  getBuyRecommendation(product: TrackedProduct, history: PriceHistoryEntry[], stats: PriceStats): BuyRecommendation {
    if (history.length < 3) {
      return {
        type: 'uncertain',
        title: '📊 Not Enough Data Yet',
        subtitle: 'Aura will track this price and notify you of the best time to buy.',
        color: '#2962FF',
        icon: 'analytics-outline',
      };
    }

    const current = product.currentPrice;
    const nearLow = stats.allTimeLow > 0 ? ((current - stats.allTimeLow) / stats.allTimeLow) * 100 : 0;

    // Price rising fast (>15% in 7 days)
    if (stats.priceChange7dPercent > 15) {
      return {
        type: 'rising',
        title: '⚠️ Price is Rising Fast',
        subtitle: `Price increased ${Math.abs(stats.priceChange7dPercent).toFixed(0)}% in the last 7 days. Buy soon or wait for it to stabilize.`,
        color: '#D50000',
        icon: 'trending-up',
      };
    }

    // Near all-time low (within 5%)
    if (nearLow <= 5) {
      const dayRange = stats.daysTracked > 90 ? 90 : stats.daysTracked > 60 ? 60 : 30;
      return {
        type: 'buy_now',
        title: `✅ Buy Now — Best Price in ${dayRange} Days`,
        subtitle: `This is ${Math.abs(stats.currentVsAveragePercent).toFixed(0)}% below the average price. Prices usually go back up within a week.`,
        color: '#00C853',
        icon: 'checkmark-circle',
      };
    }

    // Price trending down
    if (stats.priceChange7dPercent < -5) {
      return {
        type: 'wait',
        title: '⏳ Wait — Price is Still Dropping',
        subtitle: `Price dropped ${Math.abs(stats.priceChange7dPercent).toFixed(0)}% this week. Wait for it to bottom out.`,
        color: '#FF8F00',
        icon: 'time-outline',
      };
    }

    // Below average — decent deal
    if (stats.currentVsAveragePercent < -10) {
      return {
        type: 'buy_now',
        title: '✅ Good Time to Buy',
        subtitle: `Currently ${Math.abs(stats.currentVsAveragePercent).toFixed(0)}% below average. This is a good price.`,
        color: '#00C853',
        icon: 'checkmark-circle',
      };
    }

    // Above average — wait
    if (stats.currentVsAveragePercent > 10) {
      return {
        type: 'wait',
        title: '⏳ Wait — Price is Above Average',
        subtitle: `Price is ${Math.abs(stats.currentVsAveragePercent).toFixed(0)}% above the average. Based on history, it may drop soon.`,
        color: '#FF8F00',
        icon: 'time-outline',
      };
    }

    // Around average
    return {
      type: 'uncertain',
      title: '📊 Price is Around Average',
      subtitle: 'The current price is typical. No strong buy or wait signal right now.',
      color: '#2962FF',
      icon: 'analytics-outline',
    };
  }

  // Generate sparkline data (normalized 0-1 for mini charts)
  getSparklineData(history: PriceHistoryEntry[], maxPoints: number = 20): number[] {
    if (history.length === 0) return [];
    if (history.length <= maxPoints) {
      const prices = history.map(h => h.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = max - min || 1;
      return prices.map(p => (p - min) / range);
    }
    // Downsample
    const step = history.length / maxPoints;
    const sampled: number[] = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(Math.floor(i * step), history.length - 1);
      sampled.push(history[idx].price);
    }
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const range = max - min || 1;
    return sampled.map(p => (p - min) / range);
  }
}

export const priceAnalysisService = new PriceAnalysisService();
