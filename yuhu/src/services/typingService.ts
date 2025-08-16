import { supabase } from '@/lib/supabase';

export interface TypingEvent {
  chat_id: string;
  user_id: string;
  username: string;
  is_typing: boolean;
  timestamp: string;
}

/**
 * Send typing status to other users in a chat
 */
export async function sendTypingStatus(
  chatId: string, 
  userId: string, 
  username: string, 
  isTyping: boolean
): Promise<boolean> {
  try {
    console.log('🖊️ Sending typing status:', { chatId, userId, username, isTyping });
    
    // Use Supabase real-time to broadcast typing status
    const channel = supabase.channel(`typing:${chatId}`);
    
    const result = await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        chat_id: chatId,
        user_id: userId,
        username: username,
        is_typing: isTyping,
        timestamp: new Date().toISOString()
      }
    });

    console.log('🖊️ Typing status sent successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ Error sending typing status:', error);
    return false;
  }
}

/**
 * Subscribe to typing events in a chat
 */
export function subscribeToTyping(
  chatId: string,
  onTypingUpdate: (typingUsers: string[]) => void
) {
  console.log('🖊️ Setting up typing subscription for chat:', chatId);
  const channel = supabase.channel(`typing:${chatId}`);
  
  const typingUsers = new Set<string>();
  let typingTimeouts = new Map<string, NodeJS.Timeout>();

  // Listen for typing events
  channel
    .on('broadcast', { event: 'typing' }, (payload: any) => {
      const { user_id, username, is_typing } = payload as TypingEvent;
      console.log('🖊️ Received typing event:', { username, is_typing, chatId });
      
      if (is_typing) {
        // Add user to typing list
        typingUsers.add(username);
        console.log('🖊️ User started typing:', username);
        
        // Clear existing timeout for this user
        if (typingTimeouts.has(user_id)) {
          clearTimeout(typingTimeouts.get(user_id)!);
        }
        
        // Set timeout to remove typing indicator after 3 seconds of inactivity
        const timeout = setTimeout(() => {
          typingUsers.delete(username);
          typingTimeouts.delete(user_id);
          console.log('🖊️ Typing timeout for user:', username);
          onTypingUpdate(Array.from(typingUsers));
        }, 3000);
        
        typingTimeouts.set(user_id, timeout);
        
      } else {
        // Remove user from typing list immediately
        typingUsers.delete(username);
        console.log('🖊️ User stopped typing:', username);
        if (typingTimeouts.has(user_id)) {
          clearTimeout(typingTimeouts.get(user_id)!);
          typingTimeouts.delete(user_id);
        }
      }
      
      // Notify UI of typing users
      onTypingUpdate(Array.from(typingUsers));
    })
    .subscribe();

  // Return cleanup function
  return () => {
    // Clear all timeouts
    typingTimeouts.forEach(timeout => clearTimeout(timeout));
    typingTimeouts.clear();
    
    // Unsubscribe from channel
    supabase.removeChannel(channel);
  };
}

/**
 * Debounced typing function to avoid sending too many typing events
 */
export function createTypingDebouncer(
  chatId: string,
  userId: string,
  username: string
) {
  let typingTimeout: NodeJS.Timeout | null = null;
  let isCurrentlyTyping = false;

  const startTyping = () => {
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true;
      console.log('🖊️ Starting typing indicator for:', username, 'in chat:', chatId);
      sendTypingStatus(chatId, userId, username, true);
    }

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set timeout to stop typing after 1 second of inactivity
    typingTimeout = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isCurrentlyTyping) {
      isCurrentlyTyping = false;
      console.log('🖊️ Stopping typing indicator for:', username, 'in chat:', chatId);
      sendTypingStatus(chatId, userId, username, false);
    }
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
  };

  return {
    startTyping,
    stopTyping,
    cleanup: () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (isCurrentlyTyping) {
        stopTyping();
      }
    }
  };
}
