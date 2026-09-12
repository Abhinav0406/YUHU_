import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Image,
  Alert,
  Vibration,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { subscribeToSignaling, sendSignal, broadcastCallToUser, SignalMessage } from '../services/webrtcSignaling';
import { getIceServers } from '../services/iceService';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CallRouteParams {
  chatId: string;
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  callType: 'voice' | 'video';
  isIncoming?: boolean;
  incomingOffer?: any;
  autoAccept?: boolean;
  onCallEnd?: () => void;
}

export default function CallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const {
    chatId,
    friendId,
    friendName,
    friendAvatar,
    callType,
    isIncoming = false,
    incomingOffer,
    autoAccept = false,
    onCallEnd,
  } = (route.params || {}) as CallRouteParams;

  const [hasAcceptedIncoming, setHasAcceptedIncoming] = useState(!isIncoming || !!autoAccept);
  const hasAcceptedIncomingRef = useRef(!isIncoming || !!autoAccept);
  const isAnsweringRef = useRef(false);
  const [callStatus, setCallStatus] = useState<string>(
    isIncoming && !autoAccept ? 'Incoming call...' : 'Calling...'
  );
  const [callConnected, setCallConnected] = useState(false);
  const [callDuration, setCallDuration] = useState('00:00');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [isCameraOff, setIsCameraOff] = useState(callType === 'voice');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteVideoTrackId, setRemoteVideoTrackId] = useState<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<any[]>([]);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const offerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestOfferRef = useRef<any>(incomingOffer || null);
  const ringtoneSoundRef = useRef<Audio.Sound | null>(null);
  const dialtoneSoundRef = useRef<Audio.Sound | null>(null);

  const stopAllTones = async () => {
    try {
      if (ringtoneSoundRef.current) {
        await ringtoneSoundRef.current.stopAsync();
        await ringtoneSoundRef.current.unloadAsync();
        ringtoneSoundRef.current = null;
      }
    } catch (e) {}
    try {
      if (dialtoneSoundRef.current) {
        await dialtoneSoundRef.current.stopAsync();
        await dialtoneSoundRef.current.unloadAsync();
        dialtoneSoundRef.current = null;
      }
    } catch (e) {}
  };

  // Pulse animation for incoming call ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Incoming Call Ringtone & Vibration
  useEffect(() => {
    if (isIncoming && !hasAcceptedIncoming) {
      // Start phone vibration pattern for incoming call
      Vibration.vibrate([0, 800, 1000], true);

      // Start pulsing animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // Play ringing sound through loudspeaker
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: false, // Louder speaker for ringtone
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
          });

          const { sound } = await Audio.Sound.createAsync(
            require('../../assets/ringtone.wav'),
            { shouldPlay: true, isLooping: true, volume: 1.0 }
          );
          ringtoneSoundRef.current = sound;
        } catch (err) {
          console.warn('[CallScreen] Could not play ringtone sound:', err);
        }
      })();

      return () => {
        Vibration.cancel();
        pulseLoop.stop();
        stopAllTones();
      };
    } else {
      Vibration.cancel();
      stopAllTones();
    }
  }, [isIncoming, hasAcceptedIncoming]);

  // Outgoing Call Dial Tone ("ring... ring...")
  useEffect(() => {
    if (!isIncoming && !callConnected) {
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('../../assets/dialtone.wav'),
            { shouldPlay: true, isLooping: true, volume: 0.6 }
          );
          dialtoneSoundRef.current = sound;
        } catch (err) {
          console.warn('[CallScreen] Could not play dial tone:', err);
        }
      })();

      return () => {
        if (dialtoneSoundRef.current) {
          dialtoneSoundRef.current.stopAsync().catch(() => {});
          dialtoneSoundRef.current.unloadAsync().catch(() => {});
          dialtoneSoundRef.current = null;
        }
      };
    } else if (callConnected) {
      if (dialtoneSoundRef.current) {
        dialtoneSoundRef.current.stopAsync().catch(() => {});
        dialtoneSoundRef.current.unloadAsync().catch(() => {});
        dialtoneSoundRef.current = null;
      }
    }
  }, [isIncoming, callConnected]);

  // 1. Setup Audio Mode for Voice / Video
  useEffect(() => {
    if (!hasAcceptedIncoming && isIncoming) return; // Don't override ringtone mode while ringing

    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: !isSpeakerOn,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
        });
      } catch (err) {
        console.warn('Failed to set audio mode:', err);
      }
    };
    setupAudio();
  }, [isSpeakerOn, hasAcceptedIncoming, isIncoming]);

  // 2. Main Call Initiation / Response
  useEffect(() => {
    let signalingUnsub: (() => void) | null = null;

    // Listen to signaling from peer regardless of caller/callee status
    signalingUnsub = subscribeToSignaling(chatId, async (msg: SignalMessage) => {
      if (msg.to !== user?.id) return;
      console.log('[Mobile WebRTC] Signal received:', msg.type);

      try {
        if (msg.type === 'offer') {
          console.log('[Mobile WebRTC] Offer signal received!');
          latestOfferRef.current = msg.data;
          const activePc = peerConnectionRef.current;
          // If receiver has already accepted the incoming call, answer immediately
          if (activePc && hasAcceptedIncomingRef.current && !isAnsweringRef.current) {
            console.log('[Mobile WebRTC] Handling incoming offer');
            await handleAnswerCall(activePc, msg.data);
          }
        } else if (msg.type === 'request-offer') {
          console.log('[Mobile WebRTC] Peer requested offer, re-sending if caller');
          const activePc = peerConnectionRef.current;
          if (!isIncoming && activePc && activePc.localDescription) {
            const offerPayload = {
              type: activePc.localDescription.type,
              sdp: activePc.localDescription.sdp,
              callType,
            };
            sendSignal(chatId, {
              type: 'offer',
              from: user?.id || '',
              to: friendId,
              data: offerPayload,
            }).catch(() => {});
          }
        } else if (msg.type === 'answer') {
          console.log('[Mobile WebRTC] Caller received answer signal!');
          stopAllTones();
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }

          const activePc = peerConnectionRef.current;
          if (activePc && activePc.signalingState === 'have-local-offer') {
            await activePc.setRemoteDescription(new RTCSessionDescription(msg.data));
            console.log('[Mobile WebRTC] Remote description set from answer');

            // Drain queued ICE candidates safely
            for (const cand of iceCandidateQueueRef.current) {
              try {
                if (cand && (cand.candidate || cand.sdpMid !== undefined)) {
                  await activePc.addIceCandidate(new RTCIceCandidate(cand));
                }
              } catch (iceErr) {
                console.warn('[Mobile WebRTC] Error adding caller queued ICE candidate:', iceErr);
              }
            }
            iceCandidateQueueRef.current = [];
          }
        } else if (msg.type === 'ice') {
          const activePc = peerConnectionRef.current;
          if (activePc && activePc.remoteDescription && activePc.remoteDescription.type) {
            try {
              if (msg.data && (msg.data.candidate || msg.data.sdpMid !== undefined)) {
                await activePc.addIceCandidate(new RTCIceCandidate(msg.data));
              }
            } catch (iceErr) {
              console.warn('[Mobile WebRTC] Error adding incoming ICE candidate:', iceErr);
            }
          } else {
            iceCandidateQueueRef.current.push(msg.data);
          }
        } else if (msg.type === 'hangup') {
          Vibration.cancel();
          Alert.alert('Call Ended', `${friendName || 'Friend'} ended the call.`);
          endCall(false);
        }
      } catch (e) {
        console.error('[Mobile WebRTC] Signaling error:', e);
      }
    });

    // If caller: start stream and connection immediately
    if (!isIncoming) {
      startMediaAndPeerConnection(true);
    }

    return () => {
      if (signalingUnsub) signalingUnsub();
      cleanupResources();
    };
  }, [chatId, user?.id, isIncoming]);

  // Request offer when incoming screen appears and handle autoAccept
  useEffect(() => {
    if (isIncoming && !hasAcceptedIncoming) {
      // Callee is ringing, ping caller to ensure offer is ready
      sendSignal(chatId, {
        type: 'request-offer',
        from: user?.id || '',
        to: friendId,
        data: null,
      }).catch(() => {});
    }
  }, [isIncoming, hasAcceptedIncoming]);

  useEffect(() => {
    if (isIncoming && autoAccept && !hasAcceptedIncomingRef.current) {
      console.log('[Mobile WebRTC] Auto-accepting call from notification');
      handleAcceptIncomingCall();
    }
  }, [isIncoming, autoAccept]);

  // Start media devices and RTCPeerConnection
  const startMediaAndPeerConnection = async (isCaller: boolean) => {
    try {
      // Ensure microphone permission
      const audioPerm = await Audio.requestPermissionsAsync();
      if (!audioPerm.granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required for calling.');
        endCall(false);
        return;
      }

      const isVoiceOnly = callType === 'voice';
      let stream: MediaStream | null = null;

      if (!isVoiceOnly) {
        try {
          stream = (await mediaDevices.getUserMedia({
            audio: true,
            video: {
              facingMode: 'user',
            },
          })) as MediaStream;
        } catch (videoErr) {
          console.warn('[Mobile WebRTC] Video getUserMedia failed, falling back to voice:', videoErr);
          setIsCameraOff(true);
        }
      }

      if (!stream) {
        stream = (await mediaDevices.getUserMedia({
          audio: true,
          video: false,
        })) as MediaStream;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Fetch dynamic ICE Servers (STUN + Metered TURN)
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track: any) => {
        track.enabled = true;
        pc.addTrack(track, stream);
      });

      // Remote track handler
      pc.ontrack = (event: any) => {
        console.log('[Mobile WebRTC] Received remote track:', event.track?.kind, event.track?.id);

        const stream: MediaStream = remoteStreamRef.current || (event.streams && event.streams[0]) || new MediaStream();

        if (event.track) {
          event.track.enabled = true;
          if (!stream.getTracks().some((t: any) => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
        }

        remoteStreamRef.current = stream;
        setRemoteStream(stream);

        if (event.track?.kind === 'video') {
          console.log('[Mobile WebRTC] Remote video track detected:', event.track.id);
          setRemoteVideoTrackId(event.track.id);
        } else if (event.track?.kind === 'audio') {
          console.log('[Mobile WebRTC] Remote audio track detected');
          stream.getAudioTracks().forEach((t: any) => { t.enabled = true; });
        }
      };

      // ICE candidate handler
      pc.onicecandidate = (event: any) => {
        if (event.candidate && friendId) {
          sendSignal(chatId, {
            type: 'ice',
            from: user?.id || '',
            to: friendId,
            data: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log('[Mobile WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }
          setCallConnected(true);
          setCallStatus('Connected');
          startTimer();

          Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: !isSpeakerOn,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
          }).catch(() => {});
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setCallStatus('Call disconnected');
          setTimeout(() => endCall(false), 2000);
        }
      };

      if (isCaller) {
        // Create offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video',
        });
        await pc.setLocalDescription(offer);

        // Repeat offer signal every 1.5 seconds to handle receiver app wake-up race condition
        const sendOfferSignal = () => {
          const currentPc = peerConnectionRef.current;
          if (!currentPc || currentPc.connectionState === 'connected' || currentPc.signalingState !== 'have-local-offer') {
            if (offerIntervalRef.current) {
              clearInterval(offerIntervalRef.current);
              offerIntervalRef.current = null;
            }
            return;
          }
          const offerPayload = { type: offer.type, sdp: offer.sdp, callType };
          sendSignal(chatId, {
            type: 'offer',
            from: user?.id || '',
            to: friendId,
            data: offerPayload,
          }).catch(() => {});

          // Also broadcast directly to user in case they are outside the chat screen
          broadcastCallToUser(friendId, {
            chatId,
            callerId: user?.id || '',
            callerName: user?.user_metadata?.full_name || 'YUHU User',
            callerAvatar: user?.user_metadata?.avatar_url,
            callType,
            offer: offerPayload,
          }).catch(() => {});
        };

        sendOfferSignal();
        offerIntervalRef.current = setInterval(sendOfferSignal, 1500);
      } else {
        // Callee: answer the offer
        const offerToUse = latestOfferRef.current || incomingOffer;
        if (offerToUse) {
          await handleAnswerCall(pc, offerToUse);
        } else {
          // No offer arrived yet: ping caller to immediately send offer
          console.log('[Mobile WebRTC] Callee ready, requesting offer from caller');
          setCallStatus('Connecting...');
          sendSignal(chatId, {
            type: 'request-offer',
            from: user?.id || '',
            to: friendId,
            data: null,
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('Call flow initialization error:', err);
      Alert.alert('Call Error', err.message || 'Unable to establish call connection.');
      endCall(true);
    }
  };

  // Answer call function
  const handleAnswerCall = async (pc: RTCPeerConnection, offerData: any) => {
    if (isAnsweringRef.current) {
      console.log('[Mobile WebRTC] Already answering call, ignoring duplicate offer invocation');
      return;
    }
    if (!offerData || !offerData.sdp) {
      console.warn('[Mobile WebRTC] Missing SDP in offerData');
      return;
    }

    try {
      isAnsweringRef.current = true;
      setCallStatus('Connecting...');

      if (pc.signalingState === 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: offerData.type, sdp: offerData.sdp }));
        console.log('[Mobile WebRTC] Callee set remote description successfully');
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[Mobile WebRTC] Callee created and set local answer');

      await sendSignal(chatId, {
        type: 'answer',
        from: user?.id || '',
        to: friendId,
        data: { type: answer.type, sdp: answer.sdp },
      });

      // Safely drain queued ICE candidates
      console.log('[Mobile WebRTC] Draining', iceCandidateQueueRef.current.length, 'queued ICE candidates');
      for (const cand of iceCandidateQueueRef.current) {
        try {
          if (cand && (cand.candidate || cand.sdpMid !== undefined)) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (iceErr) {
          console.warn('[Mobile WebRTC] Error adding queued ICE candidate:', iceErr);
        }
      }
      iceCandidateQueueRef.current = [];
    } catch (e) {
      console.error('[Mobile WebRTC] Error answering call:', e);
      isAnsweringRef.current = false;
    }
  };

  // User accepted incoming call
  const handleAcceptIncomingCall = () => {
    Vibration.cancel();
    stopAllTones();
    hasAcceptedIncomingRef.current = true;
    setHasAcceptedIncoming(true);
    setCallStatus('Connecting...');
    startMediaAndPeerConnection(false);
  };

  // User declined incoming call
  const handleDeclineIncomingCall = () => {
    Vibration.cancel();
    stopAllTones();
    endCall(true);
  };

  // Timer helper
  const startTimer = () => {
    if (callTimerRef.current) return;
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      if (!callStartTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      setCallDuration(`${mins}:${secs}`);
    }, 1000);
  };

  // Cleanup helper
  const cleanupResources = () => {
    Vibration.cancel();
    stopAllTones();
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        try { track.stop(); } catch (e) {}
      });
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
  };

  // End Call function
  const endCall = (sendHangup: boolean = true) => {
    Vibration.cancel();
    stopAllTones();
    if (sendHangup && user?.id && friendId && chatId) {
      sendSignal(chatId, {
        type: 'hangup',
        from: user.id,
        to: friendId,
        data: null,
      }).catch(() => {});
    }
    cleanupResources();
    if (onCallEnd) {
      try {
        onCallEnd();
      } catch (e) {}
    }
    navigation.goBack();
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsCameraOff(!videoTracks[0].enabled);
      }
    }
  };

  // Switch Camera
  const switchCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        (videoTracks[0] as any)._switchCamera();
        setIsFrontCamera(!isFrontCamera);
      }
    }
  };

  // Toggle Speakerphone
  const toggleSpeaker = async () => {
    const nextSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(nextSpeakerState);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: !nextSpeakerState,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
    } catch (e) {
      console.warn('Failed to switch speaker:', e);
    }
  };

  // ==========================================
  // INCOMING CALL PROMPT (WhatsApp Style)
  // ==========================================
  if (isIncoming && !hasAcceptedIncoming) {
    return (
      <View style={styles.incomingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0b1120" />

        <View style={styles.incomingTopSection}>
          <Text style={styles.incomingCallTypeTitle}>
            {callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </Text>
          <Text style={styles.incomingFriendName}>{friendName || 'YUHU Friend'}</Text>
        </View>

        <View style={styles.incomingAvatarSection}>
          <Animated.View
            style={[
              styles.incomingPulseRing,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          {friendAvatar ? (
            <Image source={{ uri: friendAvatar }} style={styles.incomingAvatar} />
          ) : (
            <View style={styles.incomingAvatarPlaceholder}>
              <Text style={styles.incomingAvatarLetter}>
                {(friendName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.incomingActionsSection}>
          {/* Decline Button */}
          <TouchableOpacity
            style={styles.incomingDeclineButton}
            onPress={handleDeclineIncomingCall}
            activeOpacity={0.8}
          >
            <Ionicons
              name="call"
              size={32}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
            <Text style={styles.incomingActionLabel}>Decline</Text>
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity
            style={styles.incomingAcceptButton}
            onPress={handleAcceptIncomingCall}
            activeOpacity={0.8}
          >
            <Ionicons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={32}
              color="#fff"
            />
            <Text style={styles.incomingActionLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Minimized Picture-in-Picture floating view inside app
  if (isMinimized) {
    return (
      <TouchableOpacity
        style={styles.minimizedContainer}
        activeOpacity={0.9}
        onPress={() => setIsMinimized(false)}
      >
        {callType === 'video' && remoteStream && remoteStream.toURL() && remoteVideoTrackId ? (
          <RTCView
            key={`minimized-remote-${remoteStream.toURL()}-${remoteVideoTrackId}`}
            streamURL={remoteStream.toURL()}
            style={styles.minimizedVideo}
            objectFit="cover"
            zOrder={1}
          />
        ) : (
          <View style={styles.minimizedAvatarBox}>
            <Ionicons name="call" size={24} color="#22c55e" />
            <Text style={styles.minimizedText}>{callDuration}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.minimizedEndButton}
          onPress={() => endCall(true)}
        >
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Main Remote View */}
      {callType === 'video' && remoteStream && remoteStream.toURL() && remoteVideoTrackId ? (
        <RTCView
          key={`remote-video-${remoteStream.toURL()}-${remoteVideoTrackId}`}
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <View style={styles.avatarContainer}>
          {friendAvatar ? (
            <Image source={{ uri: friendAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{(friendName || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.friendNameText}>{friendName || 'Friend'}</Text>
          <Text style={styles.callStatusText}>
            {callConnected ? callDuration : callStatus}
          </Text>
        </View>
      )}

      {/* Local Video Thumbnail (PiP overlay in screen) */}
      {callType === 'video' && localStream && localStream.toURL() && !isCameraOff && (
        <TouchableOpacity style={styles.localVideoContainer} onPress={switchCamera}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={isFrontCamera}
            zOrder={1}
          />
        </TouchableOpacity>
      )}

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topButton} onPress={() => setIsMinimized(true)}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topFriendName}>{friendName || 'Friend'}</Text>
          <Text style={styles.topDuration}>{callConnected ? callDuration : callStatus}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Bottom Floating Control Bar (WhatsApp Style) */}
      <View style={styles.controlsBar}>
        {/* Speaker Toggle */}
        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
            size={24}
            color={isSpeakerOn ? '#fff' : '#e5e7eb'}
          />
        </TouchableOpacity>

        {/* Camera Toggle (Video Call Only) */}
        {callType === 'video' && (
          <TouchableOpacity
            style={[styles.controlButton, isCameraOff && styles.controlButtonOff]}
            onPress={toggleCamera}
          >
            <Ionicons
              name={isCameraOff ? 'videocam-off' : 'videocam'}
              size={24}
              color={isCameraOff ? '#f87171' : '#e5e7eb'}
            />
          </TouchableOpacity>
        )}

        {/* Flip Camera (Video Call Only) */}
        {callType === 'video' && !isCameraOff && (
          <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
            <Ionicons name="camera-reverse-outline" size={24} color="#e5e7eb" />
          </TouchableOpacity>
        )}

        {/* Mute Microphone */}
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonOff]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? '#f87171' : '#e5e7eb'}
          />
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity style={styles.endCallButton} onPress={() => endCall(true)}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  remoteVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: '#000',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3730a3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  avatarLetter: {
    fontSize: 54,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendNameText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  callStatusText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInfo: {
    alignItems: 'center',
  },
  topFriendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  topDuration: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 2,
  },
  controlsBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 34,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 40,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#4f46e5',
  },
  controlButtonOff: {
    backgroundColor: '#451a1a',
  },
  endCallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  // Minimized Window Styles
  minimizedContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 110,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#6366f1',
    elevation: 10,
    zIndex: 999,
  },
  minimizedVideo: {
    width: '100%',
    height: '100%',
  },
  minimizedAvatarBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  minimizedText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  minimizedEndButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Incoming Call Styles
  incomingContainer: {
    flex: 1,
    backgroundColor: '#0b1120',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 70,
    paddingHorizontal: 24,
  },
  incomingTopSection: {
    alignItems: 'center',
  },
  incomingCallTypeTitle: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  incomingFriendName: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  incomingAvatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingPulseRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  incomingAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  incomingAvatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#3730a3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  incomingAvatarLetter: {
    color: '#fff',
    fontSize: 60,
    fontWeight: 'bold',
  },
  incomingActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  incomingDeclineButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    elevation: 6,
  },
  incomingAcceptButton: {
    alignItems: 'center',
    backgroundColor: '#22c55e',
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    elevation: 6,
  },
  incomingActionLabel: {
    position: 'absolute',
    bottom: -26,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
});
