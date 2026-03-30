import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private devicePushToken: string | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and get the **native** device push token (FCM on Android)
   */
  public async registerForPushNotificationsAsync(userId: string): Promise<string | null> {
    // Skip push registration on web – Expo web requires VAPID config
    if (Platform.OS === 'web') {
      console.warn('Skipping push notification registration on web (no VAPID key configured).');
      return null;
    }

    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications');
      return null;
    }

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return null;
      }

      // Get the **device** push token (this is the FCM token on Android)
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      const tokenValue = typeof devicePushToken.data === 'string' ? devicePushToken.data : String(devicePushToken.data);

      this.devicePushToken = tokenValue;
      console.log('Device Push Token (FCM):', this.devicePushToken);

      // Store FCM token in Supabase so the Edge Function can send via FCM
      await this.saveTokenToSupabase(userId, this.devicePushToken);

      // Configure Android channel for notifications
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6C63FF',
          sound: 'default',
        });
      }

      return this.devicePushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Save the push token to Supabase user_tokens table
   */
  private async saveTokenToSupabase(userId: string, token: string): Promise<void> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from('user_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single();

      if (existingToken) {
        // Update existing token
        const { error } = await supabase
          .from('user_tokens')
          .update({
            fcm_token: token,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('platform', platform);

        if (error) {
          console.error('Error updating token in Supabase:', error);
        } else {
          console.log('Token updated in Supabase');
        }
      } else {
        // Insert new token
        const { error } = await supabase
          .from('user_tokens')
          .insert({
            user_id: userId,
            fcm_token: token,
            platform: platform,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error saving token to Supabase:', error);
        } else {
          console.log('Token saved to Supabase');
        }
      }
    } catch (error) {
      console.error('Error in saveTokenToSupabase:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  public setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listener for notifications received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on a notification
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });
  }

  /**
   * Get the current device push token (FCM)
   */
  public getDevicePushToken(): string | null {
    return this.devicePushToken;
  }

  /**
   * Send a local notification (for testing)
   */
  public async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Cancel all scheduled notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get notification badge count
   */
  public async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set notification badge count
   */
  public async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Send push notification via Supabase Edge Function
   */
  public async sendPushNotification(
    toUserId: string,
    title: string,
    body: string,
    data?: { chatId?: string; chatName?: string; senderName?: string; [key: string]: any }
  ): Promise<void> {
    try {
      console.log('📤 Calling Edge Function send-push-notification for user:', toUserId);
      console.log('📤 Notification payload:', { toUserId, title, body, data });

      const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          toUserId,
          title,
          body,
          data: data || {},
        },
      });

      if (error) {
        console.error('❌ Error calling push notification Edge Function:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ Push notification Edge Function response:', result);
        console.log('✅ Push notification sent successfully to user:', toUserId);
      }
    } catch (error) {
      console.error('❌ Exception sending push notification:', error);
      console.error('❌ Exception details:', JSON.stringify(error, null, 2));
    }
  }
}

export default NotificationService.getInstance();
