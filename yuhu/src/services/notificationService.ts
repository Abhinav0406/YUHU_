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
  private notificationQueue: NotificationData[] = [];
  private isProcessingQueue = false;
  private debugMode = true; // Enable debug logging

  constructor() {
    this.loadPreferences();
    this.initializeAudio();
    this.startHealthCheck();
  }

  private log(message: string, data?: any) {
    if (this.debugMode) {
      console.log(`🔔 [NotificationService] ${message}`, data || '');
    }
  }

  private logError(message: string, error?: any) {
    if (this.debugMode) {
      console.error(`🔔 [NotificationService] ERROR: ${message}`, error || '');
    }
  }

  private loadPreferences() {
    try {
      const saved = localStorage.getItem('notificationPreferences');
      if (saved) {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
        this.log('Preferences loaded:', this.preferences);
      }
    } catch (error) {
      this.logError('Failed to load preferences:', error);
    }
  }

  private savePreferences() {
    try {
      localStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
      this.log('Preferences saved');
    } catch (error) {
      this.logError('Failed to save preferences:', error);
    }
  }

  private initializeAudio() {
    try {
      this.audio = new Audio('/assets/call-notification.mp3');
      this.audio.preload = 'auto';
      this.audio.volume = 0.3;
      
      this.audio.addEventListener('canplaythrough', () => {
        this.log('Audio file loaded successfully');
      });
      
      this.audio.addEventListener('error', (e) => {
        this.logError('Audio file error:', e);
        this.audio = null;
      });
    } catch (error) {
      this.logError('Failed to initialize audio:', error);
      this.audio = null;
    }
  }

  private startHealthCheck() {
    // Check notification status every 30 seconds
    setInterval(() => {
      this.checkNotificationHealth();
    }, 30000);
  }

  private async checkNotificationHealth() {
    const status = {
      permission: Notification.permission,
      supported: 'Notification' in window,
      preferences: this.preferences,
      audioReady: this.audio?.readyState >= 2,
      queueLength: this.notificationQueue.length,
    };
    
    this.log('Health check:', status);
    
    // Auto-request permission if not granted
    if (Notification.permission === 'default') {
      this.log('Requesting notification permission...');
      await this.requestPermission();
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      this.logError('Browser does not support notifications');
      return false;
    }

    try {
      if (Notification.permission === 'default') {
        this.log('Requesting permission...');
        const permission = await Notification.requestPermission();
        this.log('Permission result:', permission);
        return permission === 'granted';
      }

      const result = Notification.permission === 'granted';
      this.log('Permission status:', result);
      return result;
    } catch (error) {
      this.logError('Error requesting permission:', error);
      return false;
    }
  }

  async showNotification(data: NotificationData): Promise<void> {
    this.log('Received notification request:', data);
    
    // Add to queue to prevent blocking
    this.notificationQueue.push(data);
    
    if (!this.isProcessingQueue) {
      this.processNotificationQueue();
    }
  }

  private async processNotificationQueue() {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    
    while (this.notificationQueue.length > 0) {
      const data = this.notificationQueue.shift();
      if (data) {
        await this.processSingleNotification(data);
        // Small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.isProcessingQueue = false;
  }

  private async processSingleNotification(data: NotificationData) {
    const { title, message, type, icon, data: notificationData, clickAction } = data;

    this.log('Processing notification:', { title, message, type });

    // Check if notifications are enabled for this type
    if (!this.shouldShowNotification(type)) {
      this.log('Notification blocked by preferences for type:', type);
      return;
    }

    try {
      // Show in-app toast notification
      if (this.preferences.inAppNotifications) {
        this.log('Showing in-app notification');
        this.showInAppNotification(title, message, type);
      }

      // Show browser notification
      if (this.preferences.browserNotifications && type !== 'system') {
        this.log('Showing browser notification');
        await this.showBrowserNotification(title, message, icon, notificationData, clickAction);
      }

      // Play sound notification
      if (this.preferences.soundNotifications) {
        this.log('Playing notification sound');
        this.playNotificationSound(type);
      }
    } catch (error) {
      this.logError('Error processing notification:', error);
    }
  }

  private shouldShowNotification(type: string): boolean {
    const shouldShow = this.preferences[`${type}Notifications` as keyof NotificationPreferences] ?? true;
    this.log(`Should show ${type} notification:`, shouldShow);
    return shouldShow;
  }

  private showInAppNotification(title: string, message: string, type: string) {
    const icon = this.getNotificationIcon(type);
    this.log('Showing in-app toast:', { message, title, icon, type });
    
    try {
      toast(message, {
        description: title,
        icon: icon,
        duration: 5000,
        action: {
          label: 'View',
          onClick: () => {
            this.log('In-app notification clicked');
          },
        },
      });
      this.log('Toast displayed successfully');
    } catch (error) {
      this.logError('Error showing toast:', error);
    }
  }

  private async showBrowserNotification(
    title: string,
    message: string,
    icon?: string,
    data?: any,
    clickAction?: () => void
  ) {
    if (!('Notification' in window)) {
      this.log('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      this.log('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        body: message,
        icon: icon || '/chat-icon.png',
        badge: '/chat-icon.png',
        tag: 'yuhu-notification',
        data: data,
        requireInteraction: false,
        silent: false,
      });

      this.log('Browser notification created:', notification);

      if (clickAction) {
        notification.onclick = () => {
          this.log('Browser notification clicked');
          clickAction();
          notification.close();
        };
      }

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (error) {
      this.logError('Error creating browser notification:', error);
    }
  }

  private playNotificationSound(type: string) {
    if (!this.preferences.soundNotifications) {
      this.log('Sound notifications disabled');
      return;
    }

    try {
      // Try to use the audio file first
      if (this.audio && this.audio.readyState >= 2) {
        this.log('Playing audio file');
        this.audio.currentTime = 0;
        this.audio.play().catch((error) => {
          this.logError('Audio file play failed, using fallback:', error);
          // Fallback to programmatic sound
          createNotificationSound(type as any);
        });
      } else {
        this.log('Audio not ready, using programmatic sound');
        // Use the programmatic fallback sound system
        createNotificationSound(type as any);
      }
    } catch (error) {
      this.logError('Failed to play notification sound:', error);
      // Try programmatic fallback as last resort
      try {
        createNotificationSound(type as any);
      } catch (fallbackError) {
        this.logError('Fallback sound also failed:', fallbackError);
      }
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

  // Enhanced notification methods with better error handling
  async showMessageNotification(senderName: string, message: string, chatId: string, senderAvatar?: string) {
    this.log('Showing message notification:', { senderName, message: message.substring(0, 50), chatId });
    
    await this.showNotification({
      title: `New message from ${senderName}`,
      message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
      type: 'message',
      icon: senderAvatar || '/chat-icon.png',
      data: { chatId, senderName },
      clickAction: () => {
        this.log('Message notification clicked, navigating to chat:', chatId);
        // Navigate to chat
        window.location.href = `/chat/${chatId}`;
      },
    });
  }

  async showCallNotification(callerName: string, isIncoming: boolean, chatId: string, callerAvatar?: string) {
    const title = isIncoming ? `Incoming call from ${callerName}` : `Calling ${callerName}`;
    const message = isIncoming ? 'Tap to answer' : 'Connecting...';
    
    this.log('Showing call notification:', { callerName, isIncoming, chatId });
    
    await this.showNotification({
      title,
      message,
      type: 'call',
      icon: callerAvatar || '/chat-icon.png',
      data: { chatId, callerName, isIncoming },
      clickAction: () => {
        this.log('Call notification clicked, navigating to chat:', chatId);
        // Navigate to chat with call modal
        window.location.href = `/chat/${chatId}?call=incoming`;
      },
    });
  }

  async showFriendRequestNotification(requesterName: string, requesterAvatar?: string) {
    this.log('Showing friend request notification:', { requesterName });
    
    await this.showNotification({
      title: `Friend request from ${requesterName}`,
      message: 'Tap to view and respond',
      type: 'friend_request',
      icon: requesterAvatar || '/chat-icon.png',
      data: { requesterName },
      clickAction: () => {
        this.log('Friend request notification clicked');
        // Navigate to friend requests page
        window.location.href = '/friends/requests';
      },
    });
  }

  async showSystemNotification(title: string, message: string) {
    this.log('Showing system notification:', { title, message });
    
    await this.showNotification({
      title,
      message,
      type: 'system',
    });
  }

  // Test notification method
  async testNotification() {
    this.log('Testing notification system...');
    
    await this.showNotification({
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working',
      type: 'system',
      clickAction: () => {
        this.log('Test notification clicked');
      },
    });
  }

  // Preference management
  updatePreferences(newPreferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
    this.log('Preferences updated:', this.preferences);
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Utility methods
  isSupported(): boolean {
    const supported = 'Notification' in window;
    this.log('Notifications supported:', supported);
    return supported;
  }

  getPermissionStatus(): NotificationPermission {
    const status = Notification.permission;
    this.log('Permission status:', status);
    return status;
  }

  // Debug methods
  enableDebugMode() {
    this.debugMode = true;
    this.log('Debug mode enabled');
  }

  disableDebugMode() {
    this.debugMode = false;
    console.log('🔔 [NotificationService] Debug mode disabled');
  }

  getStatus() {
    return {
      permission: Notification.permission,
      supported: 'Notification' in window,
      preferences: this.preferences,
      audioReady: this.audio?.readyState >= 2,
      queueLength: this.notificationQueue.length,
      isProcessingQueue: this.isProcessingQueue,
    };
  }

  // Clear all notifications
  clearAllNotifications() {
    this.log('Clearing all notifications');
    this.notificationQueue = [];
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