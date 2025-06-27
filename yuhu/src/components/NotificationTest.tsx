import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Phone, Users, Bell } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { toast } from '@/components/ui/sonner';

const NotificationTest: React.FC = () => {
  const testMessageNotification = async () => {
    await notificationService.showMessageNotification(
      'John Doe',
      'Hey! How are you doing? This is a test message notification.',
      'test-chat-id',
      'https://via.placeholder.com/40'
    );
    toast('Message notification sent!');
  };

  const testCallNotification = async () => {
    await notificationService.showCallNotification(
      'Jane Smith',
      true, // isIncoming
      'test-chat-id',
      'https://via.placeholder.com/40'
    );
    toast('Call notification sent!');
  };

  const testFriendRequestNotification = async () => {
    await notificationService.showFriendRequestNotification(
      'Alice Johnson',
      'https://via.placeholder.com/40'
    );
    toast('Friend request notification sent!');
  };

  const testSystemNotification = async () => {
    await notificationService.showSystemNotification(
      'System Update',
      'Your app has been updated to the latest version with new features!'
    );
    toast('System notification sent!');
  };

  const testAllNotifications = async () => {
    // Test all notification types with a delay
    await testMessageNotification();
    setTimeout(() => testCallNotification(), 1000);
    setTimeout(() => testFriendRequestNotification(), 2000);
    setTimeout(() => testSystemNotification(), 3000);
  };

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Testing
          </CardTitle>
          <CardDescription>
            Test different types of notifications to verify your settings are working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={testMessageNotification}
              className="flex items-center gap-2"
              variant="outline"
            >
              <MessageCircle className="h-4 w-4" />
              Test Message
            </Button>
            
            <Button
              onClick={testCallNotification}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Phone className="h-4 w-4" />
              Test Call
            </Button>
            
            <Button
              onClick={testFriendRequestNotification}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Users className="h-4 w-4" />
              Test Friend Request
            </Button>
            
            <Button
              onClick={testSystemNotification}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Bell className="h-4 w-4" />
              Test System
            </Button>
          </div>
          
          <Button
            onClick={testAllNotifications}
            className="w-full bg-yuhu-primary hover:bg-yuhu-dark"
          >
            Test All Notifications (Sequential)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium mb-2">1. Browser Notifications</h4>
            <p className="text-muted-foreground">
              Make sure you've granted notification permissions to your browser. 
              You should see browser notifications appear outside the app.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">2. In-App Notifications</h4>
            <p className="text-muted-foreground">
              Toast notifications should appear in the top-right corner of the app.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">3. Sound Notifications</h4>
            <p className="text-muted-foreground">
              You should hear notification sounds if sound notifications are enabled.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">4. Notification Center</h4>
            <p className="text-muted-foreground">
              Click the bell icon in the header to see the notification center with all recent notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTest; 