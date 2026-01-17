import { Platform } from 'react-native';
import { firebaseService } from './firebaseService';
import { Notification } from '@/types';

// Safely import Expo Notifications to avoid crashes in Expo Go
let Notifications: any;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('Expo Notifications not available/supported in this environment');
}

// Only configure if available
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

class NotificationService {
  private expoPushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    if (!Notifications) return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.expoPushToken = token;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async registerAndSavePushToken(userId: string): Promise<string | null> {
    const token = await this.registerForPushNotifications();
    if (token) {
      await firebaseService.savePushToken(userId, token);
    }
    return token;
  }

  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    if (!Notifications) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.log('Error sending local notification:', error);
    }
  }

  async sendNotificationToUser(
    userId: string,
    title: string,
    message: string,
    type: Notification['type'] = 'general',
    data?: any
  ): Promise<void> {
    await firebaseService.createNotification({
      userId,
      title,
      message,
      type,
      read: false,
    });

    if (this.expoPushToken && Notifications) {
      await this.sendLocalNotification(title, message, data);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    await firebaseService.markNotificationAsRead(notificationId);
  }

  setupNotificationListeners(
    onNotificationReceived: (notification: any) => void,
    onNotificationTapped: (response: any) => void
  ): () => void {
    if (!Notifications) return () => { };

    const receivedListener = Notifications.addNotificationReceivedListener(
      onNotificationReceived
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      onNotificationTapped
    );

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Sends a push notification to all admins/managers.
   * Uses Expo Push API directly via fetch to work without Cloud Functions.
   */
  async sendPushToAdmins(title: string, body: string, data: any = {}): Promise<void> {
    try {
      const tokens = await firebaseService.getAdminTokens();
      if (tokens.length === 0) {
        console.log('No admin tokens found for push notification.');
        return;
      }

      console.log(`Sending push to ${tokens.length} admins: ${title}`);

      // Expo Push Endpoint
      const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

      // Construct messages
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
      }));

      // Send requests
      // Note: For production with many tokens, we should chunk this (max 100 per request).
      // But for admins only, it's unlikely to exceed 100 limit.
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log('Push result:', JSON.stringify(result));
    } catch (error) {
      console.error('Error sending push to admins:', error);
    }
  }
}

export const notificationService = new NotificationService();
