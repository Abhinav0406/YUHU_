import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import Message from './Message';
import MessageInput from './MessageInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Video, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, getChatDetails, sendMessage } from '@/services/chatService';
import { supabase } from '@/lib/supabase';

interface ChatWindowProps {
  chatId?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId: propChatId }) => {
  const { chatId: paramChatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const activeChatId = propChatId || paramChatId;
  const [isTyping, setIsTyping] = useState(false);
  
  // Get chat details
  const { 
    data: chatDetails,
    isLoading: isLoadingDetails,
    error: detailsError
  } = useQuery({
    queryKey: ['chatDetails', activeChatId],
    queryFn: () => user?.id && activeChatId ? getChatDetails(activeChatId, user.id) : null,
    enabled: !!activeChatId && !!user?.id
  });

  // Get messages
  const { 
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery({
    queryKey: ['messages', activeChatId],
    queryFn: () => user?.id && activeChatId ? getMessages(activeChatId, user.id) : [],
    enabled: !!activeChatId && !!user?.id,
    refetchInterval: 3000, // Poll for new messages every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ chatId, senderId, text }: { chatId: string, senderId: string, text: string }) => 
      sendMessage(chatId, senderId, text),
    onSuccess: (newMessage) => {
      if (newMessage) {
        queryClient.setQueryData(['messages', activeChatId], (oldMessages: any = []) => [
          ...oldMessages, 
          newMessage
        ]);
        
        // Invalidate chats list to update last message
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
    }
  });
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const handleSendMessage = (text: string) => {
    if (!activeChatId || !user || !text.trim()) return;
    
    sendMessageMutation.mutate({
      chatId: activeChatId,
      senderId: user.id,
      text: text.trim()
    });
    
    // Scroll to bottom when a new message is sent
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  // Real-time subscription for new messages
  useEffect(() => {
    if (!activeChatId) return;

    const channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${activeChatId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['messages', activeChatId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, queryClient]);

  // Loading state
  if (isLoadingDetails || isLoadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-yuhu-primary animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (detailsError || messagesError || !chatDetails) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <h3 className="text-lg font-medium text-muted-foreground">
            Error loading chat
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please try again later
          </p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['chatDetails', activeChatId] })}
            className="mt-4 bg-yuhu-primary hover:bg-yuhu-dark"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!activeChatId || !chatDetails) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <h3 className="text-lg font-medium text-muted-foreground">Select a chat to start messaging</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Or start a new conversation with a classmate
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={chatDetails.avatar} alt={chatDetails.name} />
            <AvatarFallback>{chatDetails.name[0]}</AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <div className="font-semibold">{chatDetails.name}</div>
            <div className="text-xs text-muted-foreground">
              {chatDetails.type === 'direct' ? (
                chatDetails.online ? 'Online' : 'Offline'
              ) : (
                `${chatDetails.members?.length || 0} members`
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Phone className="h-5 w-5" />
            <span className="sr-only">Voice call</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Video className="h-5 w-5" />
            <span className="sr-only">Video call</span>
          </Button>
        </div>
      </div>
      
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(message => (
            <Message
              key={message.id}
              {...message}
            />
          ))}
          {isTyping && (
            <div className="flex items-center">
              <Avatar className="h-7 w-7">
                <AvatarImage src={chatDetails.avatar} alt={chatDetails.name} />
                <AvatarFallback>{chatDetails.name[0]}</AvatarFallback>
              </Avatar>
              <div className="ml-2 bg-muted px-3 py-2 rounded-full">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      
      {/* Message input */}
      <MessageInput 
        onSendMessage={handleSendMessage} 
        disabled={sendMessageMutation.isPending}
      />
    </div>
  );
};

export default ChatWindow;
