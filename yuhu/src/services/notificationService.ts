import { toast } from '@/components/ui/sonner';
import { createNotificationSound } from '@/lib/createNotificationSound';

export interface NotificationPreferences {
  browserNotifications: boolean;
  inAppNotifications: boolean;
  soundNotifications: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  friendRequestNotifications: boolean;
}

export interface NotificationData {
  title: string;
  message: string;
  type: 'message' | 'call' | 'friend_request' | 'system';
  icon?: string;
  data?: any;
  clickAction?: () => void;
}

class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private preferences: NotificationPreferences = {
    browserNotifications: true,
    inAppNotifications: true,
    soundNotifications: true,
    messageNotifications: true,
    callNotifications: true,
    friendRequestNotifications: true,
  };

  constructor() {
    this.loadPreferences();
    this.initializeAudio();
  }

  private loadPreferences() {
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
      this.preferences = { ...this.preferences, ...JSON.parse(saved) };
    }
  }

  private savePreferences() {
    localStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
  }

  private initializeAudio() {
    this.audio = new Audio('/assets/notification.mp3');
    this.audio.preload = 'auto';
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return Notification.permission === 'granted';
  }

  async showNotification(data: NotificationData): Promise<void> {
    const { title, message, type, icon, data: notificationData, clickAction } = data;

    // Check if notifications are enabled for this type
    if (!this.shouldShowNotification(type)) {
      return;
    }

    // Show in-app toast notification
    if (this.preferences.inAppNotifications) {
      this.showInAppNotification(title, message, type);
    }

    // Show browser notification
    if (this.preferences.browserNotifications && type !== 'system') {
      await this.showBrowserNotification(title, message, icon, notificationData, clickAction);
    }

    // Play sound notification
    if (this.preferences.soundNotifications) {
      this.playNotificationSound(type);
    }
  }

  private shouldShowNotification(type: string): boolean {
    switch (type) {
      case 'message':
        return this.preferences.messageNotifications;
      case 'call':
        return this.preferences.callNotifications;
      case 'friend_request':
        return this.preferences.friendRequestNotifications;
      default:
        return true;
    }
  }

  private showInAppNotification(title: string, message: string, type: string) {
    const icon = this.getNotificationIcon(type);
    toast(message, {
      description: title,
      icon: icon,
      duration: 5000,
      action: {
        label: 'View',
        onClick: () => {
          // Handle click action
        },
      },
    });
  }

  private async showBrowserNotification(
    title: string,
    message: string,
    icon?: string,
    data?: any,
    clickAction?: () => void
  ) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(title, {
      body: message,
      icon: icon || '/chat-icon.png',
      badge: '/chat-icon.png',
      tag: 'yuhu-notification',
      data: data,
      requireInteraction: false,
      silent: false,
    });

    if (clickAction) {
      notification.onclick = () => {
        clickAction();
        notification.close();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  private playNotificationSound(type: string) {
    if (!this.preferences.soundNotifications) return;

    try {
      // Try to use the fallback sound system
      createNotificationSound(type as any);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  private getNotificationIcon(type: string): string {
    switch (type) {
      case 'call':
        return '📞';
      case 'message':
        return '💬';
      case 'friend_request':
        return '👥';
      case 'system':
        return '🔔';
      default:
        return '📢';
    }
  }

  // Public methods for different notification types
  async showMessageNotification(senderName: string, message: string, chatId: string, senderAvatar?: string) {
    await this.showNotification({
      title: `New message from ${senderName}`,
      message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
      type: 'message',
      icon: senderAvatar || '/chat-icon.png',
      data: { chatId, senderName },
      clickAction: () => {
        // Navigate to chat
        window.location.href = `/chat/${chatId}`;
      },
    });
  }

  async showCallNotification(callerName: string, isIncoming: boolean, chatId: string, callerAvatar?: string) {
    const title = isIncoming ? `Incoming call from ${callerName}` : `Calling ${callerName}`;
    const message = isIncoming ? 'Tap to answer' : 'Connecting...';
    
    await this.showNotification({
      title,
      message,
      type: 'call',
      icon: callerAvatar || '/chat-icon.png',
      data: { chatId, callerName, isIncoming },
      clickAction: () => {
        // Navigate to chat with call modal
        window.location.href = `/chat/${chatId}?call=incoming`;
      },
    });
  }

  async showFriendRequestNotification(requesterName: string, requesterAvatar?: string) {
    await this.showNotification({
      title: `Friend request from ${requesterName}`,
      message: 'Tap to view and respond',
      type: 'friend_request',
      icon: requesterAvatar || '/chat-icon.png',
      data: { requesterName },
      clickAction: () => {
        // Navigate to friend requests page
        window.location.href = '/friends/requests';
      },
    });
  }

  async showSystemNotification(title: string, message: string) {
    await this.showNotification({
      title,
      message,
      type: 'system',
    });
  }

  // Preference management
  updatePreferences(newPreferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Utility methods
  isSupported(): boolean {
    return 'Notification' in window;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  // Clear all notifications
  clearAllNotifications() {
    if ('Notification' in window) {
      // Close all notifications (this is a workaround as there's no direct API)
      // The notifications will auto-close after 5 seconds anyway
    }
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Export convenience functions
export const showMessageNotification = (senderName: string, message: string, chatId: string, senderAvatar?: string) =>
  notificationService.showMessageNotification(senderName, message, chatId, senderAvatar);

export const showCallNotification = (callerName: string, isIncoming: boolean, chatId: string, callerAvatar?: string) =>
  notificationService.showCallNotification(callerName, isIncoming, chatId, callerAvatar);

export const showFriendRequestNotification = (requesterName: string, requesterAvatar?: string) =>
  notificationService.showFriendRequestNotification(requesterName, requesterAvatar);

export const showSystemNotification = (title: string, message: string) =>
  notificationService.showSystemNotification(title, message);

export default notificationService; 