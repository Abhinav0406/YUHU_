import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { toast } from '@/components/ui/sonner';

const NotificationTest: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    setPermissionStatus(notificationService.getPermissionStatus());
    setIsSupported(notificationService.isSupported());
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testBasicToast = () => {
    try {
      toast('Basic Toast Test', {
        description: 'This is a test toast notification',
        duration: 3000,
      });
      addTestResult('✅ Basic toast test - SUCCESS');
    } catch (error) {
      addTestResult(`❌ Basic toast test - FAILED: ${error}`);
    }
  };

  const testNotificationService = async () => {
    try {
      await notificationService.showSystemNotification(
        'Notification Service Test',
        'This is a test notification from the notification service'
      );
      addTestResult('✅ Notification service test - SUCCESS');
    } catch (error) {
      addTestResult(`❌ Notification service test - FAILED: ${error}`);
    }
  };

  const testMessageNotification = async () => {
    try {
    await notificationService.showMessageNotification(
        'Test User',
        'This is a test message notification',
        'test-chat-id'
      );
      addTestResult('✅ Message notification test - SUCCESS');
    } catch (error) {
      addTestResult(`❌ Message notification test - FAILED: ${error}`);
    }
  };

  const testCallNotification = async () => {
    try {
    await notificationService.showCallNotification(
        'Test Caller',
        true,
        'test-chat-id'
      );
      addTestResult('✅ Call notification test - SUCCESS');
    } catch (error) {
      addTestResult(`❌ Call notification test - FAILED: ${error}`);
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await notificationService.requestPermission();
      setPermissionStatus(notificationService.getPermissionStatus());
      addTestResult(`Permission request - ${granted ? 'GRANTED' : 'DENIED'}`);
    } catch (error) {
      addTestResult(`❌ Permission request - FAILED: ${error}`);
    }
  };

  const checkPreferences = () => {
    const prefs = notificationService.getPreferences();
    addTestResult(`Current preferences: ${JSON.stringify(prefs, null, 2)}`);
  };

  const runAllTests = async () => {
    setTestResults([]);
    addTestResult('🧪 Starting comprehensive notification tests...');
    
    // Basic info
    addTestResult(`Browser support: ${isSupported ? 'YES' : 'NO'}`);
    addTestResult(`Permission status: ${permissionStatus}`);
    
    // Test basic toast
    testBasicToast();
    
    // Wait a bit then test service
    setTimeout(async () => {
      await testNotificationService();
      setTimeout(async () => {
    await testMessageNotification();
        setTimeout(async () => {
          await testCallNotification();
          addTestResult('🏁 All tests completed');
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const getStatusIcon = () => {
    if (!isSupported) return <XCircle className="h-5 w-5 text-red-500" />;
    if (permissionStatus === 'granted') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (permissionStatus === 'denied') return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (!isSupported || permissionStatus === 'denied') return 'destructive';
    if (permissionStatus === 'granted') return 'default';
    return 'secondary';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
          Notification System Test
          </CardTitle>
          <CardDescription>
          Test and debug your notification system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Notification Status</span>
          </div>
          <Badge variant={getStatusColor()}>
            {!isSupported ? 'Not Supported' : permissionStatus}
          </Badge>
        </div>

        {/* Alerts */}
        {!isSupported && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your browser does not support notifications. Try using a modern browser like Chrome, Firefox, or Safari.
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'denied' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Notification permission has been denied. Please enable notifications in your browser settings and refresh the page.
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'default' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Notification permission has not been requested yet. Click "Request Permission" below.
            </AlertDescription>
          </Alert>
        )}

        {/* Test Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={testBasicToast} variant="outline">
            Test Basic Toast
          </Button>
          <Button onClick={testNotificationService} variant="outline">
            Test Notification Service
          </Button>
          <Button onClick={testMessageNotification} variant="outline">
            Test Message Notification
          </Button>
          <Button onClick={testCallNotification} variant="outline">
            Test Call Notification
          </Button>
          <Button onClick={requestPermission} variant="default">
            Request Permission
          </Button>
          <Button onClick={checkPreferences} variant="outline">
            Check Preferences
          </Button>
          </div>
          
        <Button onClick={runAllTests} className="w-full" variant="default">
          Run All Tests
        </Button>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <div className="bg-muted p-3 rounded-lg max-h-60 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap">
                {testResults.join('\n')}
              </pre>
          </div>
          </div>
        )}
        </CardContent>
      </Card>
  );
};

export default NotificationTest; 