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
import { subscribeToSignaling, sendSignal, SignalMessage } from '@/lib/webrtcSignaling';

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
  const [showCallModal, setShowCallModal] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const signalingUnsubRef = useRef<() => void>();
  
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

  // Helper: get friend's user id
  const friendId = chatDetails?.friendId;
  console.log('friendId', friendId, 'userId', user?.id);

  // Start call (as caller)
  const startCall = async () => {
    setCallError(null);
    setIsCalling(true);
    setShowCallModal(true);
    await setupMediaAndConnection(true);
  };

  // Answer call (as callee)
  const answerCall = async () => {
    setCallError(null);
    setIsReceivingCall(false);
    setShowCallModal(true);
    await setupMediaAndConnection(false);
  };

  // Setup media and peer connection
  const setupMediaAndConnection = async (isCaller: boolean) => {
    try {
      // Get local media
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
      });
      peerConnectionRef.current = pc;
      // Add local tracks
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      // Handle remote stream
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && friendId) {
          console.log('Sending ICE candidate to', friendId, event.candidate);
          sendSignal(activeChatId!, {
            type: 'ice',
            from: user.id,
            to: friendId,
            data: event.candidate,
          });
        }
      };
      // Signaling
      if (!signalingUnsubRef.current) {
        signalingUnsubRef.current = subscribeToSignaling(activeChatId!, async (msg: SignalMessage) => {
          console.log('Received signal', msg);
          if (msg.to !== user.id) return;
          if (!peerConnectionRef.current) return;
          if (msg.type === 'offer' && !isCaller) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            sendSignal(activeChatId!, {
              type: 'answer',
              from: user.id,
              to: friendId!,
              data: answer,
            });
          } else if (msg.type === 'answer' && isCaller) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
          } else if (msg.type === 'ice') {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.data));
            } catch (e) {}
          }
        });
      }
      // Caller: create and send offer
      if (isCaller && friendId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(activeChatId!, {
          type: 'offer',
          from: user.id,
          to: friendId,
          data: offer,
        });
      }
    } catch (err) {
      setCallError('Could not start call: ' + (err as Error).message);
      endCall();
    }
  };

  // Handle incoming signaling (offer)
  useEffect(() => {
    if (!activeChatId || !user?.id) return;
    // Listen for incoming offers
    const unsub = subscribeToSignaling(activeChatId, (msg: SignalMessage) => {
      console.log('Incoming signal (effect)', msg, 'userId', user.id);
      if (msg.to !== user.id) return;
      if (msg.type === 'offer') {
        console.log('Incoming call offer received!');
        setIsReceivingCall(true);
      }
    });
    return () => {
      unsub();
    };
  }, [activeChatId, user?.id]);

  // End call and cleanup
  const endCall = () => {
    setShowCallModal(false);
    setIsCalling(false);
    setIsReceivingCall(false);
    setCallError(null);
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (signalingUnsubRef.current) {
      signalingUnsubRef.current();
      signalingUnsubRef.current = undefined;
    }
  };

  // Attach video refs on modal open
  useEffect(() => {
    if (showCallModal && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (showCallModal && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [showCallModal]);

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
          {/* Add Call button for direct chats */}
          {chatDetails.type === 'direct' && (
            <Button variant="ghost" size="icon" className="text-yuhu-primary" onClick={startCall} title="Start Call">
              <Phone className="h-5 w-5" />
            </Button>
          )}
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

      {/* Call Modal */}
      <Dialog open={showCallModal || isReceivingCall} onOpenChange={endCall}>
        <DialogContent className="max-w-md w-full rounded-2xl bg-zinc-900 shadow-2xl p-4 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-4 text-yuhu-primary">
            {isReceivingCall ? 'Incoming Call' : 'Call in Progress'}
          </h2>
          {callError && <div className="text-red-500 mb-2">{callError}</div>}
          <div className="flex flex-col items-center gap-4 w-full">
            <video ref={localVideoRef} autoPlay muted playsInline className="rounded-lg bg-black w-full max-w-xs h-40 object-cover" />
            <video ref={remoteVideoRef} autoPlay playsInline className="rounded-lg bg-black w-full max-w-xs h-40 object-cover" />
          </div>
          {isReceivingCall ? (
            <Button className="mt-6 bg-yuhu-primary hover:bg-yuhu-dark w-full" onClick={answerCall}>Answer</Button>
          ) : (
            <Button className="mt-6 bg-red-600 hover:bg-red-700 w-full" onClick={endCall}>End Call</Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatWindow;
