import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bell, MessageCircle, Phone, Users, X, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';

interface Notification {
  id: string;
  type: 'message' | 'call' | 'friend_request' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
  icon?: string;
}

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Load notifications from localStorage (for demo purposes)
    // In a real app, you'd store notifications in the database
    loadNotifications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg && newMsg.sender_id !== user.id) {
            addNotification({
              type: 'message',
              title: `New message from ${newMsg.sender_name || 'Someone'}`,
              message: newMsg.text,
              data: { chatId: newMsg.chat_id, senderId: newMsg.sender_id },
              icon: newMsg.sender_avatar,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadNotifications = () => {
    const stored = localStorage.getItem(`notifications_${user?.id}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed);
      setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
    }
  };

  const saveNotifications = (newNotifications: Notification[]) => {
    setNotifications(newNotifications);
    setUnreadCount(newNotifications.filter(n => !n.read).length);
    localStorage.setItem(`notifications_${user?.id}`, JSON.stringify(newNotifications));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    const updatedNotifications = [newNotification, ...notifications].slice(0, 50); // Keep last 50
    saveNotifications(updatedNotifications);
  };

  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updatedNotifications);
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updatedNotifications);
  };

  const deleteNotification = (id: string) => {
    const updatedNotifications = notifications.filter(n => n.id !== id);
    saveNotifications(updatedNotifications);
  };

  const clearAllNotifications = () => {
    saveNotifications([]);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.data?.chatId) {
      window.location.href = `/chat/${notification.data.chatId}`;
    } else if (notification.type === 'friend_request') {
      window.location.href = '/friends/requests';
    }

    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="h-4 w-4 text-blue-600" />;
      case 'call':
        return <Phone className="h-4 w-4 text-green-600" />;
      case 'friend_request':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return format(timestamp, 'MMM d');
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-lg shadow-lg z-50">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Notifications</CardTitle>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllNotifications}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification, index) => (
                      <div key={notification.id}>
                        <div
                          className={cn(
                            'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
                            !notification.read && 'bg-blue-50/50'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {notification.icon ? (
                                <img
                                  src={notification.icon}
                                  alt=""
                                  className="h-4 w-4 rounded-full"
                                />
                              ) : (
                                getNotificationIcon(notification.type)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-foreground line-clamp-1">
                                  {notification.title}
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(notification.timestamp)}
                                  </span>
                                  {!notification.read && (
                                    <div className="h-2 w-2 bg-blue-600 rounded-full" />
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                        {index < notifications.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationCenter; 