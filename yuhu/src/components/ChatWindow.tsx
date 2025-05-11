import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, sendMessage, clearChat, getChatDetails } from '@/services/chatService';
import Message from './Message';
import MessageInput from './MessageInput';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Video, Loader2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import UserProfile from './UserProfile';

interface ChatWindowProps {
  chatId?: string;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId: propChatId, onClose }) => {
  const { chatId: paramChatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isClearChatDialogOpen, setIsClearChatDialogOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  
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
  
  const handleSendMessage = (msg: string) => {
    if (!activeChatId || !user) return;
    if (!msg.trim()) return;
    
    sendMessageMutation.mutate({
      chatId: activeChatId,
      senderId: user.id,
      text: msg.trim(),
    });
    
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

  const clearChatMutation = useMutation({
    mutationFn: () => clearChat(activeChatId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeChatId] });
      setIsClearChatDialogOpen(false);
    },
  });

  const handleClearChat = () => {
    setIsClearChatDialogOpen(true);
  };

  // Handler to fetch and show friend's profile
  const handleShowProfile = async () => {
    if (chatDetails?.type !== 'direct' || !chatDetails?.friendId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', chatDetails.friendId)
      .maybeSingle();
    if (!error && data) {
      setFriendProfile({ ...data, avatar: data.avatar_url });
      setShowProfile(true);
    }
  };

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
    <div className="flex flex-col h-full w-full max-w-full bg-background">
      {/* Chat header */}
      <div className="border-b p-2 sm:p-3 flex items-center justify-between min-h-[56px] sm:min-h-[64px]">
        <div className="flex items-center min-w-0 cursor-pointer" onClick={handleShowProfile}>
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
            <AvatarImage src={chatDetails.avatar} alt={chatDetails.name} />
            <AvatarFallback>{chatDetails.name[0]}</AvatarFallback>
          </Avatar>
          <div className="ml-2 sm:ml-3 min-w-0">
            <div className="font-semibold text-base sm:text-lg truncate">{chatDetails.name}</div>
            <div className="text-xs sm:text-sm text-muted-foreground truncate">
              {chatDetails.type === 'direct' ? (
                chatDetails.online ? 'Online' : 'Offline'
              ) : (
                `${chatDetails.members?.length || 0} members`
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground touch-target">
            <Phone className="h-5 w-5" />
            <span className="sr-only">Voice call</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground touch-target">
            <Video className="h-5 w-5" />
            <span className="sr-only">Video call</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground touch-target">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600"
                onClick={handleClearChat}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Messages area */}
      <ScrollArea className="flex-1 px-1 sm:px-4 py-2 sm:py-4 w-full max-w-full overflow-x-hidden">
        <div className="space-y-3 sm:space-y-4">
          {messages.map(message => (
            <Message
              key={message.id}
              {...message}
              chatId={activeChatId!}
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
      <div className="px-1 sm:px-4 pb-2 sm:pb-4 w-full max-w-full">
        <MessageInput 
          onSendMessage={handleSendMessage} 
          disabled={sendMessageMutation.isPending}
        />
      </div>

      <ConfirmationDialog
        isOpen={isClearChatDialogOpen}
        onClose={() => setIsClearChatDialogOpen(false)}
        onConfirm={() => clearChatMutation.mutate()}
        title="Clear Chat"
        description="Are you sure you want to clear all messages in this chat? This action cannot be undone."
        confirmText="Clear Chat"
        cancelText="Cancel"
      />

      {/* Friend Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-zinc-800 shadow-2xl p-0 overflow-y-auto max-h-[90vh]">
          {friendProfile && <UserProfile profile={friendProfile} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatWindow;
