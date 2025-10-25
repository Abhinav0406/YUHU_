// Enhanced Notification Service with Supabase Push Notifications Support
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private isInitialized = false;
  private fcmToken: string | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
      // Request permissions
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'granted') {
        // Register with Apple / Google to receive push via APNS/FCM
        await PushNotifications.register();
        console.log('Push notifications registered successfully');
      } else {
        console.log('Push notification permission denied');
        return;
      }

      // On success, we should be able to receive notifications
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        this.fcmToken = token.value;
        // Send this token to your backend server
        this.sendTokenToServer(token.value);
      });

      // Some issue with our setup and push will not work
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Show us the notification payload if the app is open when we receive a notification
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received: ', notification);
        // Handle notification when app is in foreground
        this.handleForegroundNotification(notification);
      });

      // Method called when tapping on a notification
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('Push notification action performed', notification.actionId, notification.inputValue);
        // Handle notification tap
        this.handleNotificationTap(notification);
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return;
      }

      // Store FCM token in Supabase database
      const { error } = await supabase
        .from('user_tokens')
        .upsert({
          user_id: user.id,
          fcm_token: token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing FCM token:', error);
      } else {
        console.log('FCM token stored in Supabase successfully');
      }
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // Handle notification when app is in foreground
    // You can show an in-app notification or update UI
    console.log('Handling foreground notification:', notification);
  }

  private handleNotificationTap(notification: ActionPerformed): void {
    // Handle notification tap
    // Navigate to specific chat or perform action
    console.log('Handling notification tap:', notification);
    
    // Example: Navigate to specific chat
    if (notification.notification.data?.chatId) {
      // Navigate to chat
      window.location.href = `/chat/${notification.notification.data.chatId}`;
    }
  }

  public getFCMToken(): string | null {
    return this.fcmToken;
  }

  public async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    
    try {
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus.receive === 'granted';
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    
    try {
      const permStatus = await PushNotifications.requestPermissions();
      return permStatus.receive === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  // Method to send push notification using Supabase Edge Function
  public async sendPushNotification(toUserId: string, title: string, body: string, data?: any): Promise<void> {
    try {
      // Call Supabase Edge Function to send push notification
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          toUserId,
          title,
          body,
          data
        }
      });

      if (error) {
        console.error('Error calling push notification function:', error);
      } else {
        console.log('Push notification sent successfully');
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
