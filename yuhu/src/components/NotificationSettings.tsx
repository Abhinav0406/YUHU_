import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, MessageCircle, Phone, Users, Settings } from 'lucide-react';
import { notificationService, NotificationPreferences } from '@/services/notificationService';
import { toast } from '@/components/ui/sonner';
import NotificationTest from './NotificationTest';

const NotificationSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    browserNotifications: true,
    inAppNotifications: true,
    soundNotifications: true,
    messageNotifications: true,
    callNotifications: true,
    friendRequestNotifications: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Load current preferences
    setPreferences(notificationService.getPreferences());
    setPermissionStatus(notificationService.getPermissionStatus());
    setIsSupported(notificationService.isSupported());
  }, []);

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    notificationService.updatePreferences(newPreferences);
    
    toast('Notification settings updated', {
      description: `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`,
    });
  };

  const requestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermissionStatus(notificationService.getPermissionStatus());
    
    if (granted) {
      toast('Notification permission granted!', {
        description: 'You will now receive notifications for new messages and calls.',
      });
    } else {
      toast('Notification permission denied', {
        description: 'You can enable notifications in your browser settings.',
      });
    }
  };

  const testNotification = async () => {
    await notificationService.showSystemNotification(
      'Test Notification',
      'This is a test notification to verify your settings are working correctly.'
    );
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      default:
        return 'Not requested';
    }
  };

  if (!isSupported) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Notifications are not supported in this browser.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Permission Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Browser Permission
          </CardTitle>
          <CardDescription>
            Manage browser notification permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Notification Permission</Label>
              <p className="text-sm text-muted-foreground">
                Status: <span className={getPermissionStatusColor()}>{getPermissionStatusText()}</span>
              </p>
            </div>
            {permissionStatus !== 'granted' && (
              <Button onClick={requestNotificationPermission} variant="outline">
                Request Permission
              </Button>
            )}
          </div>
          {permissionStatus === 'denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Notifications are blocked. Please enable them in your browser settings to receive notifications.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browser-notifications">Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in your browser
              </p>
            </div>
            <Switch
              id="browser-notifications"
              checked={preferences.browserNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('browserNotifications', checked)}
              disabled={permissionStatus !== 'granted'}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-notifications">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show toast notifications within the app
              </p>
            </div>
            <Switch
              id="in-app-notifications"
              checked={preferences.inAppNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('inAppNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound-notifications">Sound Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Play sound for notifications
              </p>
            </div>
            <Switch
              id="sound-notifications"
              checked={preferences.soundNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('soundNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <div className="space-y-0.5">
                <Label htmlFor="message-notifications">Message Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  New messages from friends
                </p>
              </div>
            </div>
            <Switch
              id="message-notifications"
              checked={preferences.messageNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('messageNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-green-600" />
              <div className="space-y-0.5">
                <Label htmlFor="call-notifications">Call Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Incoming and outgoing calls
                </p>
              </div>
            </div>
            <Switch
              id="call-notifications"
              checked={preferences.callNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('callNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-600" />
              <div className="space-y-0.5">
                <Label htmlFor="friend-request-notifications">Friend Request Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  New friend requests
                </p>
              </div>
            </div>
            <Switch
              id="friend-request-notifications"
              checked={preferences.friendRequestNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('friendRequestNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Test Notifications</CardTitle>
          <CardDescription>
            Test your notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationTest />
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings; 