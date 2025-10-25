// Enhanced Notification Service for PWA + Push Notifications
import { pushNotificationService } from './pushNotificationService';

// Define NotificationAction interface
interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Extended NotificationOptions interface to include actions
interface ExtendedNotificationOptions extends NotificationOptions {
  actions?: NotificationAction[];
}

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.checkPermission();
    this.initializePushNotifications();
  }

  private async initializePushNotifications(): Promise<void> {
    try {
      await pushNotificationService.initialize();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async checkPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.log('Notification permission denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  public async showNotification(title: string, options: ExtendedNotificationOptions = {}): Promise<void> {
    if (this.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  public async showChatNotification(senderName: string, message: string, chatId?: string): Promise<void> {
    await this.showNotification(`New message from ${senderName}`, {
      body: message,
      tag: `chat-${chatId || 'unknown'}`,
      requireInteraction: true,
      actions: [
        {
          action: 'open',
          title: 'Open Chat'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  }

  public async showMessageNotification(senderName: string, message: string, chatId?: string, senderAvatar?: string): Promise<void> {
    await this.showNotification(`New message from ${senderName}`, {
      body: message,
      icon: senderAvatar || '/favicon.ico',
      tag: `message-${chatId || 'unknown'}`,
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Open Chat'
        }
      ]
    });
  }

  public async showFriendRequestNotification(senderName: string): Promise<void> {
    await this.showNotification(`Friend request from ${senderName}`, {
      body: 'Tap to view friend request',
      tag: 'friend-request',
      requireInteraction: true,
      actions: [
        {
          action: 'open',
          title: 'View Request'
        }
      ]
    });
  }

  public async showCallNotification(callerName: string, isVideo: boolean = false): Promise<void> {
    const callType = isVideo ? 'video call' : 'voice call';
    await this.showNotification(`Incoming ${callType} from ${callerName}`, {
      body: 'Tap to answer',
      tag: 'incoming-call',
      requireInteraction: true,
      actions: [
        {
          action: 'answer',
          title: 'Answer'
        },
        {
          action: 'decline',
          title: 'Decline'
        }
      ]
    });
  }

  public isSupported(): boolean {
    return 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    return this.permission;
  }

  public getPreferences(): { permission: NotificationPermission; supported: boolean } {
    return {
      permission: this.permission,
      supported: this.isSupported()
    };
  }

  public async clearAllNotifications(): Promise<void> {
    if ('serviceWorker' in navigator && 'getRegistrations' in navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const notifications = await registration.getNotifications();
        notifications.forEach(notification => notification.close());
      }
    }
  }

  // Enhanced methods for push notifications
  public async sendMessageNotification(senderName: string, message: string, chatId: string, recipientUserId: string, senderAvatar?: string): Promise<void> {
    // Show in-app notification if app is open
    await this.showMessageNotification(senderName, message, chatId, senderAvatar);
    
    // Send push notification for out-of-app scenarios
    try {
      await pushNotificationService.sendPushNotification(
        recipientUserId,
        `New message from ${senderName}`,
        message,
        {
          chatId,
          senderName,
          senderAvatar,
          type: 'message'
        }
      );
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  public async sendCallNotification(callerName: string, recipientUserId: string, isVideo: boolean = false): Promise<void> {
    // Show in-app notification if app is open
    await this.showCallNotification(callerName, isVideo);
    
    // Send push notification for out-of-app scenarios
    try {
      await pushNotificationService.sendPushNotification(
        recipientUserId,
        `Incoming ${isVideo ? 'video' : 'voice'} call`,
        `${callerName} is calling you`,
        {
          callerName,
          isVideo,
          type: 'call'
        }
      );
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  public async sendFriendRequestNotification(senderName: string, recipientUserId: string, senderAvatar?: string): Promise<void> {
    // Show in-app notification if app is open
    await this.showFriendRequestNotification(senderName);
    
    // Send push notification for out-of-app scenarios
    try {
      await pushNotificationService.sendPushNotification(
        recipientUserId,
        'New friend request',
        `${senderName} wants to be your friend`,
        {
          senderName,
          senderAvatar,
          type: 'friend_request'
        }
      );
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  // Get FCM token for backend registration
  public getFCMToken(): string | null {
    return pushNotificationService.getFCMToken();
  }

  // Check if push notifications are available
  public async isPushNotificationSupported(): Promise<boolean> {
    return await pushNotificationService.checkPermissions();
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();