import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { notificationService, NotificationPreferences } from '@/services/notificationService';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';

const NotificationTest: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(notificationService.getPreferences());
  const [notificationStatus, setNotificationStatus] = useState(notificationService.getStatus());
  const [realTimeStatus, setRealTimeStatus] = useState<string>('disconnected');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    updateStatus();
    
    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const updateStatus = () => {
    setPermissionStatus(notificationService.getPermissionStatus());
    setPreferences(notificationService.getPreferences());
    setNotificationStatus(notificationService.getStatus());
  };

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testBrowserNotification = async () => {
    addTestResult('Testing browser notification...');
    
    try {
      const granted = await notificationService.requestPermission();
      if (granted) {
        await notificationService.showSystemNotification(
          'Test Browser Notification',
          'This is a test browser notification. If you see this, browser notifications are working!'
        );
        addTestResult('✅ Browser notification test successful');
      } else {
        addTestResult('❌ Browser notification permission denied');
      }
    } catch (error) {
      addTestResult(`❌ Browser notification test failed: ${error}`);
    }
  };

  const testInAppNotification = async () => {
    addTestResult('Testing in-app notification...');
    
    try {
      await notificationService.showSystemNotification(
        'Test In-App Notification',
        'This is a test in-app notification. You should see a toast message.'
      );
      addTestResult('✅ In-app notification test successful');
    } catch (error) {
      addTestResult(`❌ In-app notification test failed: ${error}`);
    }
  };

  const testSoundNotification = async () => {
    addTestResult('Testing sound notification...');
    
    try {
      await notificationService.showSystemNotification(
        'Test Sound Notification',
        'This notification should play a sound.'
      );
      addTestResult('✅ Sound notification test successful');
    } catch (error) {
      addTestResult(`❌ Sound notification test failed: ${error}`);
    }
  };

  const testMessageNotification = async () => {
    addTestResult('Testing message notification...');
    
    try {
      await notificationService.showMessageNotification(
        'Test User',
        'This is a test message notification to verify the system is working properly.',
        'test-chat-id',
        '/chat-icon.png'
      );
      addTestResult('✅ Message notification test successful');
    } catch (error) {
      addTestResult(`❌ Message notification test failed: ${error}`);
    }
  };

  const testRealTimeConnection = async () => {
    addTestResult('Testing real-time connection...');
    setIsTesting(true);
    
    try {
      // Test Supabase connection
      const { data, error } = await supabase.from('messages').select('count').limit(1);
      
      if (error) {
        addTestResult(`❌ Supabase connection failed: ${error.message}`);
        setRealTimeStatus('connection-error');
      } else {
        addTestResult('✅ Supabase connection successful');
        
        // Test real-time subscription
        const channel = supabase
          .channel('test-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {})
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              addTestResult('✅ Real-time subscription successful');
              setRealTimeStatus('connected');
            } else if (status === 'CHANNEL_ERROR') {
              addTestResult('❌ Real-time subscription failed');
              setRealTimeStatus('subscription-error');
            } else if (status === 'TIMED_OUT') {
              addTestResult('❌ Real-time subscription timed out');
              setRealTimeStatus('timeout');
            }
            
            // Clean up test subscription
            setTimeout(() => {
              supabase.removeChannel(channel);
              setIsTesting(false);
            }, 2000);
          });
      }
    } catch (error) {
      addTestResult(`❌ Real-time test failed: ${error}`);
      setIsTesting(false);
    }
  };

  const runFullTest = async () => {
    addTestResult('🚀 Starting full notification system test...');
    setIsTesting(true);
    
    try {
      // Test 1: Browser notifications
      await testBrowserNotification();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 2: In-app notifications
      await testInAppNotification();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 3: Sound notifications
      await testSoundNotification();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 4: Message notifications
      await testMessageNotification();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 5: Real-time connection
      await testRealTimeConnection();
      
      addTestResult('🎉 Full test completed!');
    } catch (error) {
      addTestResult(`❌ Full test failed: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    notificationService.updatePreferences(newPreferences);
    setPreferences(newPreferences);
    addTestResult(`Updated ${key}: ${value}`);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-gray-500';
      case 'connection-error': return 'bg-red-500';
      case 'subscription-error': return 'bg-orange-500';
      case 'timeout': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🔔 Notification System Debugger</h1>
        <p className="text-muted-foreground">
          Test and debug your notification system to ensure real-time notifications work properly
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current notification system status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">🔐</div>
              <div className="text-sm text-muted-foreground">Permission</div>
              <Badge variant={permissionStatus === 'granted' ? 'default' : 'destructive'}>
                {permissionStatus}
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">📡</div>
              <div className="text-sm text-muted-foreground">Real-time</div>
              <Badge className={getStatusColor(realTimeStatus)}>
                {realTimeStatus}
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">🎵</div>
              <div className="text-sm text-muted-foreground">Audio</div>
              <Badge variant={notificationStatus.audioReady ? 'default' : 'destructive'}>
                {notificationStatus.audioReady ? 'Ready' : 'Not Ready'}
              </Badge>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Notification Preferences</h4>
              <div className="space-y-2">
                {Object.entries(preferences).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="text-sm capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => updatePreference(key as keyof NotificationPreferences, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">System Info</h4>
              <div className="text-sm space-y-1">
                <div>Supported: {notificationStatus.supported ? '✅' : '❌'}</div>
                <div>Queue Length: {notificationStatus.queueLength}</div>
                <div>Processing: {notificationStatus.isProcessingQueue ? '✅' : '❌'}</div>
                <div>Permission: {notificationStatus.permission}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
          <CardDescription>Test different aspects of the notification system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <Button onClick={testBrowserNotification} variant="outline" disabled={isTesting}>
              Test Browser
            </Button>
            <Button onClick={testInAppNotification} variant="outline" disabled={isTesting}>
              Test In-App
            </Button>
            <Button onClick={testSoundNotification} variant="outline" disabled={isTesting}>
              Test Sound
            </Button>
            <Button onClick={testMessageNotification} variant="outline" disabled={isTesting}>
              Test Message
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={testRealTimeConnection} disabled={isTesting} className="flex-1">
              Test Real-time Connection
            </Button>
            <Button onClick={runFullTest} disabled={isTesting} className="flex-1">
              🚀 Run Full Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Results from notification tests</CardDescription>
            </div>
            <Button onClick={clearTestResults} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {testResults.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No test results yet. Run some tests to see results here.
              </div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono p-2 bg-muted rounded">
                  {result}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Tips */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Troubleshooting Tips</CardTitle>
          <CardDescription>Common issues and solutions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">Real-time Notifications Not Working?</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
              <li>• Check browser console for 🔔 logs</li>
              <li>• Ensure Supabase real-time is enabled in your project</li>
              <li>• Verify database triggers are set up correctly</li>
              <li>• Check if you're receiving real-time events in the console</li>
            </ul>
          </div>
          
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">Browser Notifications Not Showing?</h4>
            <ul className="text-sm text-yellow-800 dark:text-yellow-200 mt-2 space-y-1">
              <li>• Check notification permissions in browser settings</li>
              <li>• Ensure the page is not in focus (notifications don't show when focused)</li>
              <li>• Try refreshing the page and granting permissions again</li>
            </ul>
          </div>
          
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <h4 className="font-semibold text-green-900 dark:text-green-100">Quick Fixes</h4>
            <ul className="text-sm text-green-800 dark:text-green-200 mt-2 space-y-1">
              <li>• Run the full test to identify specific issues</li>
              <li>• Check the console logs for detailed error messages</li>
              <li>• Verify your Supabase configuration and real-time settings</li>
              <li>• Test with a different browser to isolate issues</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTest; 