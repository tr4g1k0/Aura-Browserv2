/**
 * Price Tracker Notification Service
 * 
 * Handles push notifications for:
 * - Price drop alerts
 * - Flash sale alerts
 * - Best time to buy alerts
 * - Weekly savings reports
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

class PriceTrackerNotificationService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized || Platform.OS === 'web') return;

    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('[PriceNotifications] Permission not granted');
        return;
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        } as Notifications.NotificationBehavior),
      });

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('price-drops', {
          name: 'Price Drops',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FFFF',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('flash-sales', {
          name: 'Flash Sales',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF4444',
          sound: 'default',
        });
      }

      this.initialized = true;
      console.log('[PriceNotifications] Initialized');
    } catch (e) {
      console.log('[PriceNotifications] Init error:', e);
    }
  }

  async notifyPriceDrop(
    productTitle: string,
    currentPrice: number,
    previousPrice: number,
    currency: string,
    productUrl: string,
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    const savings = previousPrice - currentPrice;
    const savingsPercent = ((savings / previousPrice) * 100).toFixed(0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📉 Price Drop Alert`,
        body: `${productTitle.substring(0, 50)}... dropped to ${currency}${currentPrice.toFixed(2)} (was ${currency}${previousPrice.toFixed(2)}) — Save ${currency}${savings.toFixed(2)} (${savingsPercent}% off)`,
        data: { type: 'price_drop', url: productUrl },
        ...(Platform.OS === 'android' && { channelId: 'price-drops' }),
      },
      trigger: null, // Immediate
    });
  }

  async notifyFlashSale(
    productTitle: string,
    currentPrice: number,
    previousPrice: number,
    currency: string,
    dropPercent: number,
    productUrl: string,
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 FLASH SALE DETECTED`,
        body: `${productTitle.substring(0, 50)}... dropped ${dropPercent.toFixed(0)}%! Now ${currency}${currentPrice.toFixed(2)} (was ${currency}${previousPrice.toFixed(2)})`,
        data: { type: 'flash_sale', url: productUrl },
        ...(Platform.OS === 'android' && { channelId: 'flash-sales' }),
      },
      trigger: null,
    });
  }

  async notifyBestTimeToBuy(
    productTitle: string,
    currentPrice: number,
    currency: string,
    productUrl: string,
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Best Time to Buy`,
        body: `${productTitle.substring(0, 50)}... is at a historically low price: ${currency}${currentPrice.toFixed(2)}. Buy now before it goes up!`,
        data: { type: 'best_time', url: productUrl },
        ...(Platform.OS === 'android' && { channelId: 'price-drops' }),
      },
      trigger: null,
    });
  }

  async notifyWeeklySavings(
    totalSaved: number,
    priceDrops: number,
    currency: string,
  ): Promise<void> {
    if (Platform.OS === 'web' || totalSaved <= 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📊 Weekly Savings Report`,
        body: `This week Aura saved you ${currency}${totalSaved.toFixed(0)} across ${priceDrops} price drop${priceDrops !== 1 ? 's' : ''}! Keep tracking for more savings.`,
        data: { type: 'weekly_report' },
        ...(Platform.OS === 'android' && { channelId: 'price-drops' }),
      },
      trigger: null,
    });
  }
}

export const priceNotificationService = new PriceTrackerNotificationService();
