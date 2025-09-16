// Notification Service for PWA
export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.checkPermission();
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

  public async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
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
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();