import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  className,
  showIcon = true,
  variant = 'destructive',
  size = 'md'
}) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Get initial unread count
    fetchUnreadCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', 'any')
        .neq('sender_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-5 w-5 text-xs';
      case 'lg':
        return 'h-7 w-7 text-sm';
      default:
        return 'h-6 w-6 text-xs';
    }
  };

  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      {showIcon && (
        <Bell className={cn('text-muted-foreground', getSizeClasses())} />
      )}
      <Badge
        variant={variant}
        className={cn(
          'absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full p-0 flex items-center justify-center text-xs font-medium',
          showIcon ? '' : 'static'
        )}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </Badge>
    </div>
  );
};

export default NotificationBadge; 