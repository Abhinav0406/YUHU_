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
import { getIceServers } from '@/lib/iceServers';
import { toast } from '@/components/ui/sonner';

interface ChatWindowProps {
  chatId?: string;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId: propChatId, onClose }) => {
  const { chatId: paramChatId } = useParams<{ chatId: string }>();
  const { user, profile } = useAuth();
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
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ['messages', activeChatId] });
          // Notification logic
          const newMsg = payload.new;
          if (newMsg && user && newMsg.sender_id !== user.id) {
            // Fetch sender profile for name (if available in payload, otherwise fallback)
            let senderName = 'Someone';
            if (chatDetails?.type === 'direct') {
              senderName = chatDetails?.name || 'Someone';
            } else if (newMsg.sender_name) {
              senderName = newMsg.sender_name;
            }
            toast(`${senderName}: ${newMsg.text}`);
            // If the message is for a different chat, update the sidebar
            if (newMsg.chat_id !== activeChatId) {
              queryClient.invalidateQueries({ queryKey: ['chats'] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, queryClient, user, chatDetails]);

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

  // Call UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState('00:00');

  // Update call duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showCallModal && callStartTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        setCallDuration(`${min}:${sec}`);
      }, 1000);
    } else {
      setCallDuration('00:00');
    }
    return () => clearInterval(timer);
  }, [showCallModal, callStartTime]);

  // Toggle mute
  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      localStreamRef.current?.getAudioTracks().forEach(track => (track.enabled = !newMuted));
      return newMuted;
    });
  };
  // Toggle camera
  const toggleCamera = () => {
    setIsCameraOn((prev) => {
      const newOn = !prev;
      localStreamRef.current?.getVideoTracks().forEach(track => (track.enabled = newOn));
      return newOn;
    });
  };

  // Start call: set start time
  const startCall = async () => {
    setCallError(null);
    setIsCalling(true);
    setShowCallModal(true);
    setCallStartTime(Date.now());
    await setupMediaAndConnection(true);
  };
  // Answer call: set start time
  const answerCall = async () => {
    setCallError(null);
    setIsReceivingCall(false);
    setShowCallModal(true);
    setCallStartTime(Date.now());
    await setupMediaAndConnection(false);
  };
  // End call: reset start time and notify other party
  const endCall = () => {
    // Send hangup signal to other party
    if (friendId) {
      sendSignal(activeChatId!, {
        type: 'hangup',
        from: user.id,
        to: friendId,
        data: null
      });
    }

    setShowCallModal(false);
    setIsCalling(false);
    setIsReceivingCall(false);
    setCallError(null);
    setCallStartTime(null);
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

  // Setup media and peer connection
  const setupMediaAndConnection = async (isCaller: boolean) => {
    try {
      // Get local media
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Get ICE servers from our backend
      const iceServers = await getIceServers();
      console.log('Using ICE servers:', iceServers);
      
      // Create peer connection with dynamic ICE servers
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      // Add local tracks
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track:', event);
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            // Ensure video plays
            remoteVideoRef.current.play().catch(err => console.error('Error playing remote video:', err));
          }
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

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          setCallError('Connection failed. Please try again.');
          endCall();
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          setCallError('ICE connection failed. Please check your network connection.');
          endCall();
        }
      };

      // Signaling
      if (!signalingUnsubRef.current) {
        signalingUnsubRef.current = subscribeToSignaling(activeChatId!, async (msg: SignalMessage) => {
          console.log('Received signal', msg);
          if (msg.to !== user.id) return;
          if (!peerConnectionRef.current && msg.type !== 'hangup') return;
          
          if (msg.type === 'offer' && !isCaller) {
            try {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);
              sendSignal(activeChatId!, {
                type: 'answer',
                from: user.id,
                to: friendId!,
                data: answer,
              });
            } catch (error) {
              console.error('Error handling offer:', error);
              setCallError('Failed to handle incoming call. Please try again.');
              endCall();
            }
          } else if (msg.type === 'answer') {
            try {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
            } catch (error) {
              console.error('Error handling answer:', error);
              setCallError('Failed to establish call. Please try again.');
              endCall();
            }
          } else if (msg.type === 'ice') {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.data));
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          } else if (msg.type === 'hangup') {
            // Handle incoming hangup signal
            console.log('Received hangup signal');
            endCall();
          }
        });
      }
      // Caller: create and send offer
      if (isCaller && friendId) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(activeChatId!, {
            type: 'offer',
            from: user.id,
            to: friendId,
            data: offer,
          });
        } catch (error) {
          console.error('Error creating offer:', error);
          setCallError('Failed to start call. Please try again.');
          endCall();
        }
      }
    } catch (error) {
      console.error('Error setting up media and connection:', error);
      setCallError('Failed to start call: ' + (error as Error).message);
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
        <DialogContent className="max-w-lg w-full rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-2xl p-0 overflow-hidden flex flex-col items-center">
          <div className="w-full flex flex-col items-center p-6 pb-2">
            <h2 className="text-xl font-bold mb-2 text-yuhu-primary tracking-tight">
              {isReceivingCall ? 'Incoming Call' : 'Call in Progress'}
            </h2>
            <div className="text-xs text-muted-foreground mb-2">
              {isReceivingCall ? 'Someone is calling you...' : `Duration: ${callDuration}`}
            </div>
            {callError && <div className="text-red-500 mb-2">{callError}</div>}
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center mt-2">
              {/* Local Video/User */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`rounded-2xl shadow-lg bg-black w-64 h-64 object-cover border-4 border-yuhu-primary ${!isCameraOn ? 'hidden' : ''} max-w-full`}
                  />
                  {!isCameraOn && (
                    <div className="w-64 h-64 rounded-2xl bg-zinc-700 flex items-center justify-center text-5xl font-bold text-yuhu-primary shadow-lg max-w-full">
                      {profile?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">You</span>
                </div>
                <div className="mt-1 text-xs text-center text-muted-foreground truncate max-w-[12rem]">{profile?.fullName || profile?.username}</div>
              </div>
              {/* Remote Video/User */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="rounded-2xl shadow-lg bg-black w-64 h-64 object-cover border-4 border-yuhu-primary max-w-full"
                  />
                  {/* Fallback avatar/initials if remote video is not available */}
                  {/* Optionally, you can add a state to detect remote video stream and show fallback if needed */}
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">Friend</span>
                </div>
                <div className="mt-1 text-xs text-center text-muted-foreground truncate max-w-[12rem]">{chatDetails?.name}</div>
              </div>
            </div>
            {/* Animated Connecting Indicator */}
            {!callStartTime && !isReceivingCall && (
              <div className="mt-4 flex items-center gap-2 animate-pulse text-yuhu-primary">
                <span className="w-2 h-2 bg-yuhu-primary rounded-full inline-block"></span>
                Connecting...
              </div>
            )}
            {/* Call Controls */}
            <div className="flex gap-4 mt-6 mb-2 w-full justify-center">
              {isReceivingCall && (
                <Button
                  className="rounded-full bg-green-600 hover:bg-green-700 text-white shadow px-6 font-bold"
                  onClick={answerCall}
                  title="Accept Call"
                >
                  Accept
                </Button>
              )}
              <Button
                variant={isMuted ? 'secondary' : 'ghost'}
                size="icon"
                className={`rounded-full bg-zinc-800 hover:bg-zinc-700 text-white shadow ${isMuted ? 'bg-yellow-600' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9v6m6-6v6m-9 0a9 9 0 1118 0 9 9 0 01-18 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h6a2 2 0 002-2z" />
                  )}
                </svg>
              </Button>
              <Button
                variant={isCameraOn ? 'ghost' : 'secondary'}
                size="icon"
                className={`rounded-full bg-zinc-800 hover:bg-zinc-700 text-white shadow ${!isCameraOn ? 'bg-yellow-600' : ''}`}
                onClick={toggleCamera}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  {isCameraOn ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
                  )}
                </svg>
              </Button>
              <Button
                className="rounded-full bg-red-600 hover:bg-red-700 text-white shadow px-6 font-bold"
                onClick={endCall}
                title="End Call"
              >
                End
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatWindow;
