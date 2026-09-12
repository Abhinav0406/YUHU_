import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import CallScreen from './src/screens/CallScreen';
import notificationService from './src/services/notificationService';
import { subscribeToUserCalls, sendSignal, IncomingCallPayload } from './src/services/webrtcSignaling';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Chats') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#18181b',
          borderTopWidth: 1,
          borderTopColor: '#27272a',
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          tabBarLabel: 'Chats',
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Notifications',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const navigation = useNavigation();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const activeCallChatIdRef = useRef<string | null>(null);

  // Navigate to CallScreen safely without pushing duplicate screens
  const handleIncomingCall = (params: {
    chatId: string;
    friendId: string;
    friendName?: string;
    friendAvatar?: string;
    callType?: 'voice' | 'video';
    incomingOffer?: any;
    autoAccept?: boolean;
  }) => {
    if (!params.chatId || !params.friendId) return;

    if (activeCallChatIdRef.current === params.chatId) {
      console.log('[App] Already in call screen for chat:', params.chatId);
      return;
    }

    activeCallChatIdRef.current = params.chatId;

    (navigation as any).navigate('Call', {
      chatId: params.chatId,
      friendId: params.friendId,
      friendName: params.friendName || 'Friend',
      friendAvatar: params.friendAvatar,
      callType: params.callType || 'voice',
      isIncoming: true,
      incomingOffer: params.incomingOffer,
      autoAccept: !!params.autoAccept,
      onCallEnd: () => {
        if (activeCallChatIdRef.current === params.chatId) {
          activeCallChatIdRef.current = null;
        }
      },
    });
  };

  // Register for push notifications when user logs in
  useEffect(() => {
    if (user?.id) {
      // 1. Listen for direct real-time incoming call signals across the whole app
      const callUnsub = subscribeToUserCalls(user.id, (callData: IncomingCallPayload) => {
        console.log('[App] Received incoming call via Realtime broadcast:', callData);
        handleIncomingCall({
          chatId: callData.chatId,
          friendId: callData.callerId,
          friendName: callData.callerName || 'Friend',
          friendAvatar: callData.callerAvatar,
          callType: callData.callType || 'voice',
          incomingOffer: callData.offer,
        });
      });

      // 2. Register for push notifications
      notificationService.registerForPushNotificationsAsync(user.id).catch((error) => {
        console.error('Error registering for push notifications:', error);
      });

      // 3. Foreground Notification Listener
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received in foreground:', notification);
        const data = notification.request.content.data;
        if (data?.type === 'incoming_call') {
          handleIncomingCall({
            chatId: data.chatId,
            friendId: data.callerId,
            friendName: data.callerName || 'Friend',
            friendAvatar: data.callerAvatar,
            callType: data.callType || 'voice',
          });
        }
      });

      // 4. Notification Tap / Response Listener (Action Buttons: Accept / Decline)
      const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
        console.log('Notification response received:', response);
        const data = response.notification.request.content.data;
        const actionIdentifier = response.actionIdentifier;

        if (data?.type === 'incoming_call') {
          // If user tapped Decline button directly from notification action
          if (actionIdentifier === 'decline') {
            console.log('[App] User declined call from notification banner');
            if (data.chatId && data.callerId && user?.id) {
              sendSignal(data.chatId, {
                type: 'hangup',
                from: user.id,
                to: data.callerId,
                data: null,
              }).catch(() => {});
            }
            Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
            return;
          }

          // If user tapped Accept button, autoAccept = true
          const autoAccept = actionIdentifier === 'accept';
          handleIncomingCall({
            chatId: data.chatId,
            friendId: data.callerId,
            friendName: data.callerName || 'Friend',
            friendAvatar: data.callerAvatar,
            callType: data.callType || 'voice',
            autoAccept,
          });
          return;
        }

        if (data?.chatId) {
          (navigation as any).navigate('Chat', {
            chatId: data.chatId,
            chatName: data.chatName || 'Chat',
          });
        }
      };

      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // 5. Handle Cold Start: Check if app was opened by tapping a notification when app was killed
      Notifications.getLastNotificationResponseAsync().then((lastResponse) => {
        if (lastResponse) {
          console.log('[App] App opened from cold start via notification:', lastResponse);
          handleNotificationResponse(lastResponse);
        }
      }).catch((e) => console.warn('Error checking last notification response:', e));

      return () => {
        callUnsub();
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      };
    }
  }, [user?.id, navigation]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#18181b',
        }}
      >
        <Text style={{ color: '#f9fafb' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Friends"
            component={FriendsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Call"
            component={CallScreen}
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

