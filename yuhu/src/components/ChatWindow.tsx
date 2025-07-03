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
import { getIceServers } from '@/services/iceService';
import { toast } from '@/components/ui/sonner';
import { notificationService } from '@/services/notificationService';

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
    mutationFn: ({ chatId, senderId, text, type, replyTo }: { chatId: string, senderId: string, text: string, type?: string, replyTo?: string }) => 
      sendMessage(chatId, senderId, text, replyTo),
    onSuccess: (newMessage) => {
      if (newMessage) {
        queryClient.setQueryData(['messages', activeChatId], (oldMessages: any = []) => [
          ...oldMessages, 
          newMessage
        ]);
        // Invalidate chats list to update last message
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        clearReply(); // <-- Move clearReply here
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
  
  // Add state for reply
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<any>(null);

  // Handler to select a message to reply to
  const handleReply = (message: any) => {
    setReplyTo(message.id);
    setReplyToMessage(message);
  };

  // Handler to clear reply
  const clearReply = () => {
    setReplyTo(null);
    setReplyToMessage(null);
  };

  // Update handleSendMessage to include replyTo
  const handleSendMessage = (msg: string | { type: string; content: string }) => {
    if (!activeChatId || !user) return;

    let payload: any = {};
    if (typeof msg === 'string') {
      if (!msg.trim()) return;
      payload = {
        chatId: activeChatId,
        senderId: user.id,
        text: msg.trim(),
        replyTo,
      };
    } else if (typeof msg === 'object' && msg.type && msg.content) {
      // Only use object for non-text types
      if (msg.type === 'text') {
        payload = {
          chatId: activeChatId,
          senderId: user.id,
          text: msg.content,
          replyTo,
        };
      } else {
        payload = {
          chatId: activeChatId,
          senderId: user.id,
          text: JSON.stringify({ type: msg.type, content: msg.content }),
          type: msg.type,
          replyTo,
        };
      }
    }
    sendMessageMutation.mutate(payload);
    // clearReply(); <-- Remove from here
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  // Real-time subscription for new messages (all chats)
  useEffect(() => {
    // Request notification permission on mount and log status
    const initializeNotifications = async () => {
      try {
        const granted = await notificationService.requestPermission();
        console.log('Notification permission:', granted ? 'granted' : 'denied');
        console.log('Notification preferences:', notificationService.getPreferences());
      } catch (error) {
        console.error('Failed to request notification permission:', error);
      }
    };
    
    initializeNotifications();

    const channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new;
          if (newMsg && user && newMsg.sender_id !== user.id) {
            // Use the notification service for better notification handling
            await notificationService.showMessageNotification(
              newMsg.sender_name || 'Someone',
              newMsg.text,
              newMsg.chat_id,
              newMsg.sender_avatar
            );
          }
          // Invalidate messages for the relevant chat
          if (newMsg && newMsg.chat_id) {
            queryClient.invalidateQueries({ queryKey: ['messages', newMsg.chat_id] });
          }
          // Invalidate chats list to update last message
          queryClient.invalidateQueries({ queryKey: ['chats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

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

  // Helper: get friend's user id with fallback
  const [manualFriendId, setManualFriendId] = useState<string | null>(null);
  const friendId = chatDetails?.friendId || manualFriendId;
  
  console.log('🔍 Friend ID Analysis:', {
    friendIdFromDetails: chatDetails?.friendId,
    manualFriendId,
    finalFriendId: friendId,
    userId: user?.id,
    chatDetails: chatDetails,
    chatType: chatDetails?.type,
    members: chatDetails?.members
  });

  // Fallback: try to find friend ID manually if not available
  useEffect(() => {
    if (!chatDetails?.friendId && chatDetails?.type === 'direct' && activeChatId && user?.id) {
      console.log('🔧 Friend ID missing, trying to find manually...');
      
      const findFriendId = async () => {
        try {
          const { data: participants, error } = await supabase
            .from('chat_participants')
            .select('profile_id')
            .eq('chat_id', activeChatId)
            .neq('profile_id', user.id);
          
          if (!error && participants && participants.length > 0) {
            const foundFriendId = participants[0].profile_id;
            console.log('🔧 Found friend ID manually:', foundFriendId);
            setManualFriendId(foundFriendId);
          } else {
            console.error('🔧 Could not find friend ID manually:', error);
          }
        } catch (error) {
          console.error('🔧 Error finding friend ID manually:', error);
        }
      };
      
      findFriendId();
    }
  }, [chatDetails, activeChatId, user?.id]);

  // Call UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [iceConnectionStatus, setIceConnectionStatus] = useState<string>('disconnected');
  const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('video');

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

  // Helper to log call events to Supabase
  async function logCallEvent({ user_id, peer_id, type, status, chat_id, duration }) {
    try {
      await supabase.from('call_history').insert([
        { user_id, peer_id, type, status, chat_id, duration }
      ]);
    } catch (e) {
      console.error('Failed to log call event', e);
    }
  }

  // Start call: set start time
  const startCall = async (type: 'voice' | 'video' = 'video') => {
    console.log(`=== STARTING ${type.toUpperCase()} CALL ===`);
    console.log('Chat ID:', activeChatId);
    console.log('User ID:', user.id);
    console.log('Friend ID:', friendId);
    console.log('Chat Details:', chatDetails);
    
    if (!friendId) {
      setCallError('Cannot start call: Friend ID not found');
      return;
    }
    
    setCallError(null);
    setCallType(type);
    setIsCalling(true);
    setShowCallModal(true);
    setCallStartTime(Date.now());
    
    // Set camera state based on call type
    setIsCameraOn(type === 'video');
    
    await logCallEvent({
      user_id: user.id,
      peer_id: friendId,
      type: 'outgoing',
      status: 'started',
      chat_id: activeChatId,
      duration: null
    });
    await setupMediaAndConnection(true, type);
  };
  // Answer call: set start time
  const answerCall = async () => {
    setCallError(null);
    setIsReceivingCall(false);
    setShowCallModal(true);
    setCallStartTime(Date.now());
    
    // Set camera state based on incoming call type
    setIsCameraOn(callType === 'video');
    
    await logCallEvent({
      user_id: user.id,
      peer_id: friendId,
      type: 'incoming',
      status: 'accepted',
      chat_id: activeChatId,
      duration: null
    });
    toast('Call accepted');
    await setupMediaAndConnection(false, callType);
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
    setConnectionStatus('disconnected');
    setIceConnectionStatus('disconnected');
    setRemoteVideoAvailable(false);
    setShowDebug(false);
    setCallType('video'); // Reset call type
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (signalingUnsubRef.current) {
      signalingUnsubRef.current();
      signalingUnsubRef.current = undefined;
    }

    const callEndTime = Date.now();
    if (callStartTime) {
      const duration = Math.floor((callEndTime - callStartTime) / 1000);
      logCallEvent({
        user_id: user.id,
        peer_id: friendId,
        type: isReceivingCall ? 'incoming' : 'outgoing',
        status: 'completed',
        chat_id: activeChatId,
        duration
      });
    } else {
      // Missed call
      logCallEvent({
        user_id: user.id,
        peer_id: friendId,
        type: isReceivingCall ? 'incoming' : 'outgoing',
        status: 'missed',
        chat_id: activeChatId,
        duration: null
      });
      toast(`You missed a call from ${chatDetails?.name || 'a user'}`);
    }
  };

  // Setup media and peer connection
  const setupMediaAndConnection = async (isCaller: boolean, type: 'voice' | 'video' = 'video') => {
    try {
      // Check if WebRTC is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC is not supported in this browser');
      }

      // Check if RTCPeerConnection is supported
      if (!window.RTCPeerConnection) {
        throw new Error('RTCPeerConnection is not supported in this browser');
      }

      console.log(`Starting ${type} call setup...`);
      
      // Get local media based on call type
      const localStream = await navigator.mediaDevices.getUserMedia({ 
        video: type === 'video', 
        audio: true 
      });
      
      console.log('Local media stream obtained:', localStream.getTracks().map(t => t.kind));
      localStreamRef.current = localStream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Get ICE servers from our backend
      console.log('Fetching ICE servers...');
      const iceServers = await getIceServers();
      console.log('Using ICE servers:', iceServers);
      
      // Create peer connection with dynamic ICE servers
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      // Add local tracks
      localStream.getTracks().forEach(track => {
        console.log('Adding local track:', track.kind);
        pc.addTrack(track, localStream);
      });

      // Handle remote stream with enhanced debugging
      pc.ontrack = (event) => {
        console.log('📺 Received remote track event:', {
          track: event.track,
          kind: event.track.kind,
          readyState: event.track.readyState,
          enabled: event.track.enabled,
          muted: event.track.muted,
          streams: event.streams?.length || 0
        });
        
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          remoteStreamRef.current = remoteStream;
          
          // Enhanced track logging
          const videoTracks = remoteStream.getVideoTracks();
          const audioTracks = remoteStream.getAudioTracks();
          
          console.log('📺 Remote stream analysis:', {
            streamId: remoteStream.id,
            videoTracks: videoTracks.length,
            audioTracks: audioTracks.length,
            videoTrackState: videoTracks[0]?.readyState,
            audioTrackState: audioTracks[0]?.readyState,
            active: remoteStream.active
          });
          
          // Set video availability
          if (videoTracks.length === 0) {
            console.warn('⚠️ No remote video tracks found!');
            setRemoteVideoAvailable(false);
          } else {
            console.log('✅ Remote video tracks found, setting available');
            setRemoteVideoAvailable(true);
          }
          
          // Enhanced video element handling
          if (remoteVideoRef.current) {
            console.log('📺 Setting remote video srcObject');
            remoteVideoRef.current.srcObject = remoteStream;
            
            // Force video to play with better error handling
            const playPromise = remoteVideoRef.current.play();
            
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('✅ Remote video is playing successfully');
                  console.log('📺 Video dimensions:', {
                    videoWidth: remoteVideoRef.current?.videoWidth,
                    videoHeight: remoteVideoRef.current?.videoHeight
                  });
                })
                .catch(err => {
                  console.error('❌ Error playing remote video:', err);
                  
                  // Try to enable autoplay
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.muted = true;
                    remoteVideoRef.current.play().catch(err2 => {
                      console.error('❌ Error playing muted remote video:', err2);
                    });
                  }
                });
            }
            
            // Add event listeners for debugging
            remoteVideoRef.current.onloadedmetadata = () => {
              console.log('📺 Remote video metadata loaded');
            };
            
            remoteVideoRef.current.oncanplay = () => {
              console.log('📺 Remote video can play');
            };
            
            remoteVideoRef.current.onerror = (error) => {
              console.error('📺 Remote video error:', error);
            };
            
          } else {
            console.error('❌ remoteVideoRef.current is null!');
          }
          
          // Monitor track changes
          remoteStream.getTracks().forEach((track, index) => {
            console.log(`📺 Track ${index} (${track.kind}):`, {
              id: track.id,
              kind: track.kind,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            });
            
            track.onended = () => {
              console.log(`📺 Remote ${track.kind} track ended`);
            };
            
            track.onmute = () => {
              console.log(`🔇 Remote ${track.kind} track muted`);
            };
            
            track.onunmute = () => {
              console.log(`🔊 Remote ${track.kind} track unmuted`);
            };
          });
          
        } else {
          console.error('❌ No remote stream found in ontrack event');
          setRemoteVideoAvailable(false);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && friendId) {
          console.log('Sending ICE candidate to', friendId);
          console.log('ICE Candidate:', event.candidate);
          sendSignal(activeChatId!, {
            type: 'ice',
            from: user.id,
            to: friendId,
            data: event.candidate,
          }).catch(err => {
            console.error('Failed to send ICE candidate:', err);
          });
        } else if (!event.candidate) {
          console.log('ICE gathering completed');
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        setConnectionStatus(pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('WebRTC connection established successfully!');
          setCallError(null);
        } else if (pc.connectionState === 'failed') {
          setCallError('Connection failed. Please try again.');
          endCall();
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        setIceConnectionStatus(pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          console.log('ICE connection established!');
        } else if (pc.iceConnectionState === 'failed') {
          setCallError('ICE connection failed. Please check your network connection.');
          endCall();
        }
      };

      // Handle signaling state changes
      pc.onsignalingstatechange = () => {
        console.log('Signaling state:', pc.signalingState);
      };

      // Setup signaling subscription
      if (!signalingUnsubRef.current) {
        signalingUnsubRef.current = subscribeToSignaling(activeChatId!, async (msg: SignalMessage) => {
          console.log('Received signal', msg.type, 'from', msg.from, 'to', msg.to);
          if (msg.to !== user.id) return;
          
          const pc = peerConnectionRef.current;
          if (!pc && msg.type !== 'hangup') {
            console.warn('No peer connection available for signal:', msg.type);
            return;
          }
          
          try {
            if (msg.type === 'offer' && !isCaller) {
              console.log('Handling incoming offer:', msg.data);
              console.log('Current signaling state:', pc.signalingState);
              
              if (pc.signalingState !== 'stable') {
                console.warn('Peer connection not in stable state:', pc.signalingState);
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
              console.log('Remote description set successfully');
              
              const answer = await pc.createAnswer();
              console.log('Answer created:', answer);
              
              await pc.setLocalDescription(answer);
              console.log('Local description set successfully');
              
              sendSignal(activeChatId!, {
                type: 'answer',
                from: user.id,
                to: friendId!,
                data: answer,
              });
              console.log('Answer sent successfully');
              
            } else if (msg.type === 'answer' && isCaller) {
              console.log('Handling incoming answer:', msg.data);
              console.log('Current signaling state:', pc.signalingState);
              
              if (pc.signalingState !== 'have-local-offer') {
                console.warn('Unexpected signaling state for answer:', pc.signalingState);
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
              console.log('Remote description set from answer');
              
            } else if (msg.type === 'ice') {
              console.log('Received ICE candidate:', msg.data);
              
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(msg.data));
                console.log('ICE candidate added successfully');
              } else {
                console.warn('Received ICE candidate but no remote description set');
              }
              
            } else if (msg.type === 'hangup') {
              console.log('Received hangup signal');
              endCall();
            }
          } catch (error) {
            console.error('Error handling signal:', msg.type, error);
            setCallError(`Signal handling error (${msg.type}): ${error.message}`);
            
            // Don't end call immediately for ICE candidate errors
            if (msg.type !== 'ice') {
              setTimeout(() => endCall(), 2000);
            }
          }
        });
      }

      // Caller: create and send offer
      if (isCaller && friendId) {
        try {
          console.log('Creating offer as caller');
          console.log('Current signaling state before offer:', pc.signalingState);
          
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: type === 'video'
          });
          console.log('Offer created:', offer);
          
          await pc.setLocalDescription(offer);
          console.log('Local description set with offer');
          console.log('Signaling state after setting local description:', pc.signalingState);
          
          const result = await sendSignal(activeChatId!, {
            type: 'offer',
            from: user.id,
            to: friendId,
            data: { ...offer, callType: type },
          });
          console.log('Offer sent successfully:', result);
          
        } catch (error) {
          console.error('Error creating/sending offer:', error);
          setCallError(`Failed to start call: ${error.message}`);
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
    
    console.log('Setting up global signaling listener for chat:', activeChatId, 'user:', user.id);
    
    // Listen for incoming offers
    const unsub = subscribeToSignaling(activeChatId, (msg: SignalMessage) => {
      console.log('📞 Incoming signal (global effect):', msg.type, 'from:', msg.from, 'to:', msg.to, 'userId:', user.id);
      console.log('📞 Message details:', msg);
      
      if (msg.to !== user.id) {
        console.log('📞 Signal not for me, ignoring');
        return;
      }
      
      if (msg.type === 'offer') {
        console.log('📞 Incoming call offer received! Setting receive call state');
        
        // Extract call type from offer data
        const incomingCallType = msg.data?.callType || 'video';
        console.log('📞 Incoming call type:', incomingCallType);
        setCallType(incomingCallType);
        setIsReceivingCall(true);
        
        // Use notification service for call notifications
        notificationService.showCallNotification(
          chatDetails?.name || 'Someone',
          true, // isIncoming
          activeChatId,
          chatDetails?.avatar
        );
      }
    });
    
    return () => {
      console.log('📞 Cleaning up global signaling listener');
      unsub();
    };
  }, [activeChatId, user?.id, chatDetails]);

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
    <div className="flex flex-col h-full w-full max-w-full bg-background bg-[url('/images/chat2.jpg')] bg-cover bg-center bg-no-repeat bg-opacity-10">
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
                      {/* Add Call buttons for direct chats */}
          {chatDetails.type === 'direct' && (
            <>
              <Button variant="ghost" size="icon" className="text-yuhu-primary" onClick={() => startCall('voice')} title="Voice Call">
                <Phone className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-yuhu-primary" onClick={() => startCall('video')} title="Video Call">
                <Video className="h-5 w-5" />
              </Button>
            </>
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
              onReply={() => handleReply(message)}
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
          disabled={isLoadingMessages}
          replyTo={replyTo}
          replyToMessage={replyToMessage}
          onCancelReply={clearReply}
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
              {isReceivingCall ? `Incoming ${callType === 'voice' ? 'Voice' : 'Video'} Call` : `${callType === 'voice' ? 'Voice' : 'Video'} Call in Progress`}
            </h2>
            <div className="text-xs text-muted-foreground mb-2">
              {isReceivingCall ? 'Someone is calling you...' : `Duration: ${callDuration}`}
            </div>
            {callError && <div className="text-red-500 mb-2">{callError}</div>}
            {/* Connection Status Indicators */}
            {!isReceivingCall && (
              <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                <span className={`px-2 py-1 rounded ${connectionStatus === 'connected' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                  WebRTC: {connectionStatus}
                </span>
                <span className={`px-2 py-1 rounded ${iceConnectionStatus === 'connected' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                  ICE: {iceConnectionStatus}
                </span>
              </div>
            )}
            {callType === 'voice' ? (
              // Voice Call Layout - Side by side profile pictures
              <div className="flex gap-8 w-full justify-center items-center mt-4">
                {/* Local User Profile */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar className="w-32 h-32 border-4 border-yuhu-primary shadow-2xl">
                      <AvatarImage src={profile?.avatar} alt={profile?.fullName || profile?.username} />
                      <AvatarFallback className="text-3xl font-bold text-yuhu-primary bg-zinc-700">
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">You</span>
                    {isMuted && (
                      <span className="absolute top-1 right-1 bg-red-600 text-white text-xs p-1 rounded-full">
                        🔇
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-center text-muted-foreground font-medium">
                    {profile?.fullName || profile?.username}
                  </div>
                </div>
                
                {/* Voice Wave Animation */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 h-16">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-yuhu-primary rounded-full animate-pulse`}
                        style={{
                          height: `${Math.random() * 40 + 10}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.8s'
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-yuhu-primary font-medium">Voice Call</div>
                </div>

                {/* Remote User Profile */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar className="w-32 h-32 border-4 border-yuhu-primary shadow-2xl">
                      <AvatarImage src={chatDetails?.avatar} alt={chatDetails?.name} />
                      <AvatarFallback className="text-3xl font-bold text-yuhu-primary bg-zinc-700">
                        {chatDetails?.name?.[0]?.toUpperCase() || 'F'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">Friend</span>
                  </div>
                  <div className="mt-2 text-sm text-center text-muted-foreground font-medium">
                    {chatDetails?.name}
                  </div>
                </div>
              </div>
            ) : (
              // Video Call Layout - Original layout
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
                      className={`rounded-2xl shadow-lg bg-black w-64 h-64 object-cover border-4 border-yuhu-primary max-w-full ${!remoteVideoAvailable ? 'hidden' : ''}`}
                    />
                    {!remoteVideoAvailable && (
                      <div className="w-64 h-64 rounded-2xl bg-zinc-700 flex items-center justify-center text-5xl font-bold text-yuhu-primary shadow-lg max-w-full">
                        {chatDetails?.name?.[0]?.toUpperCase() || 'F'}
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">Friend</span>
                  </div>
                  <div className="mt-1 text-xs text-center text-muted-foreground truncate max-w-[12rem]">{chatDetails?.name}</div>
                </div>
              </div>
            )}
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
              {callType === 'video' && (
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
              )}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-zinc-800 hover:bg-zinc-700 text-white shadow"
                onClick={() => setShowDebug(!showDebug)}
                title="Toggle Debug Info"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
            {/* Debug Information */}
            {showDebug && (
              <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg text-xs text-left w-full max-w-md">
                <div className="font-semibold mb-2 text-yuhu-primary">Debug Information:</div>
                <div className="space-y-1">
                  <div>WebRTC State: <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></div>
                  <div>ICE State: <span className={iceConnectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>{iceConnectionStatus}</span></div>
                  <div>Remote Video: <span className={remoteVideoAvailable ? 'text-green-400' : 'text-red-400'}>{remoteVideoAvailable ? 'Available' : 'Not Available'}</span></div>
                  <div>Local Stream: <span className={localStreamRef.current ? 'text-green-400' : 'text-red-400'}>{localStreamRef.current ? 'Active' : 'Not Active'}</span></div>
                  <div>Peer Connection: <span className={peerConnectionRef.current ? 'text-green-400' : 'text-red-400'}>{peerConnectionRef.current ? 'Active' : 'Not Active'}</span></div>
                  <div>Chat ID: <span className="text-blue-400 break-all">{activeChatId}</span></div>
                  <div>Friend ID: <span className="text-blue-400">{friendId || 'NOT FOUND'}</span></div>
                  <div>User ID: <span className="text-blue-400">{user?.id}</span></div>
                  <div>Signaling: <span className={signalingUnsubRef.current ? 'text-green-400' : 'text-red-400'}>{signalingUnsubRef.current ? 'Active' : 'Not Active'}</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-600">
                  <div className="text-yellow-400 font-semibold">Quick Actions:</div>
                  <button 
                    className="text-blue-400 hover:text-blue-300 mr-3"
                    onClick={() => console.log('Current state:', { connectionStatus, iceConnectionStatus, friendId, activeChatId, user: user?.id })}
                  >
                    Log State
                  </button>
                  <button 
                    className="text-green-400 hover:text-green-300"
                    onClick={() => {
                      if (friendId) {
                        sendSignal(activeChatId!, {
                          type: 'ice',
                          from: user.id,
                          to: friendId,
                          data: { ping: Date.now() }
                        });
                        console.log('Ping sent to', friendId);
                      }
                    }}
                  >
                    Ping Friend
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatWindow;

