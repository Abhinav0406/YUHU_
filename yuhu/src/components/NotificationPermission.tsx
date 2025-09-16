import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';

interface NotificationPermissionProps {
  onPermissionChange?: (granted: boolean) => void;
}

const NotificationPermission: React.FC<NotificationPermissionProps> = ({ onPermissionChange }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (notificationService.isSupported()) {
      setPermission(notificationService.getPermission());
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!notificationService.isSupported()) {
      return;
    }

    setIsRequesting(true);
    try {
      const granted = await notificationService.requestPermission();
      setPermission(notificationService.getPermission());
      onPermissionChange?.(granted);
      
      if (granted) {
        // Show a test notification
        await notificationService.showNotification('Notifications enabled!', {
          body: 'You will now receive notifications for new messages and friend requests.',
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNotification = async () => {
    if (permission === 'granted') {
      await notificationService.showChatNotification('Test User', 'This is a test notification!');
    }
  };

  if (!notificationService.isSupported()) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-yellow-400">
          <BellOff className="w-5 h-5" />
          <span className="font-medium">Notifications not supported</span>
        </div>
        <p className="text-yellow-300/80 text-sm mt-1">
          Your browser doesn't support notifications. Please use a modern browser like Chrome or Safari.
        </p>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Notifications enabled</span>
          </div>
          <button
            onClick={handleTestNotification}
            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-medium transition"
          >
            Test
          </button>
        </div>
        <p className="text-green-300/80 text-sm mt-1">
          You'll receive notifications for new messages and friend requests.
        </p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Notifications blocked</span>
        </div>
        <p className="text-red-300/80 text-sm mt-1">
          Notifications are blocked. Please enable them in your browser settings to receive message alerts.
        </p>
        <div className="mt-2 text-xs text-red-300/60">
          <p>To enable notifications:</p>
          <p>1. Click the lock icon in your browser's address bar</p>
          <p>2. Set notifications to "Allow"</p>
          <p>3. Refresh the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 text-blue-400 mb-2">
        <Bell className="w-5 h-5" />
        <span className="font-medium">Enable notifications</span>
      </div>
      <p className="text-blue-300/80 text-sm mb-3">
        Get notified about new messages and friend requests even when the app is closed.
      </p>
      <button
        onClick={handleRequestPermission}
        disabled={isRequesting}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
      >
        {isRequesting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Requesting...
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" />
            Enable Notifications
          </>
        )}
      </button>
    </div>
  );
};

export default NotificationPermission;
