import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { subscribeToSignaling, sendSignal, broadcastCallToUser, SignalMessage } from '../services/webrtcSignaling';
import { getIceServers } from '../services/iceService';

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

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isIncoming && !hasAcceptedIncoming) {
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
      return () => {
        pulseLoop.stop();
      };
    }
  }, [isIncoming, hasAcceptedIncoming]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<any[]>([]);
  const callTimerRef = useRef<any>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const offerIntervalRef = useRef<any>(null);
  const latestOfferRef = useRef<any>(incomingOffer || null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const toneIntervalRef = useRef<any>(null);

  const stopWebTones = () => {
    if (toneIntervalRef.current) {
      clearInterval(toneIntervalRef.current);
      toneIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }
  };

  const playWebRingtone = () => {
    stopWebTones();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const playChord = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.18);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.18);
          osc.stop(ctx.currentTime + idx * 0.18 + 0.65);
        });
      };

      playChord();
      toneIntervalRef.current = setInterval(playChord, 2200);
    } catch (e) {}
  };

  const playWebDialtone = () => {
    stopWebTones();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const playBeep = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.2);
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 1.3);
        });
      };

      playBeep();
      toneIntervalRef.current = setInterval(playBeep, 3500);
    } catch (e) {}
  };

  useEffect(() => {
    if (isIncoming && !hasAcceptedIncoming) {
      playWebRingtone();
      return () => stopWebTones();
    } else {
      stopWebTones();
    }
  }, [isIncoming, hasAcceptedIncoming]);

  useEffect(() => {
    if (!isIncoming && !callConnected) {
      playWebDialtone();
      return () => stopWebTones();
    } else if (callConnected) {
      stopWebTones();
    }
  }, [isIncoming, callConnected]);

  // Bind video element streams on web
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Signaling listener
  useEffect(() => {
    let signalingUnsub: (() => void) | null = null;

    signalingUnsub = subscribeToSignaling(chatId, async (msg: SignalMessage) => {
      if (msg.to !== user?.id) return;

      try {
        if (msg.type === 'offer') {
          console.log('[Web CallScreen] Offer signal received');
          latestOfferRef.current = msg.data;
          const activePc = peerConnectionRef.current;
          if (activePc && hasAcceptedIncomingRef.current && !isAnsweringRef.current) {
            await handleAnswerCall(activePc, msg.data);
          }
        } else if (msg.type === 'request-offer') {
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
          stopWebTones();
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }

          const activePc = peerConnectionRef.current;
          if (activePc && activePc.signalingState === 'have-local-offer') {
            await activePc.setRemoteDescription(new RTCSessionDescription(msg.data));
            for (const cand of iceCandidateQueueRef.current) {
              try {
                if (cand && (cand.candidate || cand.sdpMid !== undefined)) {
                  await activePc.addIceCandidate(new RTCIceCandidate(cand));
                }
              } catch (e) {}
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
            } catch (e) {}
          } else {
            iceCandidateQueueRef.current.push(msg.data);
          }
        } else if (msg.type === 'hangup') {
          alert(`${friendName || 'Friend'} ended the call.`);
          endCall(false);
        }
      } catch (e) {
        console.error('[Web CallScreen] Signaling error:', e);
      }
    });

    if (!isIncoming) {
      startMediaAndPeerConnection(true);
    }

    return () => {
      if (signalingUnsub) signalingUnsub();
      cleanupResources();
    };
  }, [chatId, user?.id, isIncoming]);

  useEffect(() => {
    if (isIncoming && !hasAcceptedIncoming) {
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
      handleAcceptIncomingCall();
    }
  }, [isIncoming, autoAccept]);

  const startMediaAndPeerConnection = async (isCaller: boolean) => {
    try {
      const isVoiceOnly = callType === 'voice';
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: isVoiceOnly ? false : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
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
          }).catch((err) => console.warn('Error sending ICE candidate:', err));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }
          setCallConnected(true);
          setCallStatus('Connected');
          startTimer();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setCallStatus('Call disconnected');
          setTimeout(() => endCall(false), 2000);
        }
      };

      if (isCaller) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video',
        });
        await pc.setLocalDescription(offer);

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
        const offerToUse = latestOfferRef.current || incomingOffer;
        if (offerToUse) {
          await handleAnswerCall(pc, offerToUse);
        } else {
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
      alert(err.message || 'Unable to establish call connection.');
      endCall(true);
    }
  };

  const handleAnswerCall = async (pc: RTCPeerConnection, offerData: any) => {
    if (isAnsweringRef.current) return;
    if (!offerData || !offerData.sdp) return;

    try {
      isAnsweringRef.current = true;
      setCallStatus('Connecting...');

      if (pc.signalingState === 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: offerData.type, sdp: offerData.sdp }));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal(chatId, {
        type: 'answer',
        from: user?.id || '',
        to: friendId,
        data: { type: answer.type, sdp: answer.sdp },
      });

      for (const cand of iceCandidateQueueRef.current) {
        try {
          if (cand && (cand.candidate || cand.sdpMid !== undefined)) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (e) {}
      }
      iceCandidateQueueRef.current = [];
    } catch (e) {
      console.error('Error answering call:', e);
      isAnsweringRef.current = false;
    }
  };

  const handleAcceptIncomingCall = () => {
    stopWebTones();
    hasAcceptedIncomingRef.current = true;
    setHasAcceptedIncoming(true);
    setCallStatus('Connecting...');
    startMediaAndPeerConnection(false);
  };

  const handleDeclineIncomingCall = () => {
    stopWebTones();
    endCall(true);
  };

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

  const cleanupResources = () => {
    stopWebTones();
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
  };

  const endCall = (sendHangup: boolean = true) => {
    stopWebTones();
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

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsCameraOff(!videoTracks[0].enabled);
      }
    }
  };

  if (isIncoming && !hasAcceptedIncoming) {
    return (
      <View style={styles.incomingContainer}>
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
          <TouchableOpacity
            style={styles.incomingDeclineButton}
            onPress={handleDeclineIncomingCall}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.incomingActionLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.incomingAcceptButton}
            onPress={handleAcceptIncomingCall}
            activeOpacity={0.8}
          >
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={32} color="#fff" />
            <Text style={styles.incomingActionLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hidden audio element for crystal clear remote voice playback */}
      <audio ref={remoteAudioRef as any} autoPlay playsInline style={{ display: 'none' }} />

      {/* Main Remote View */}
      {callType === 'video' && remoteStream ? (
        <video
          ref={remoteVideoRef as any}
          autoPlay
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
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

      {/* Local Video Thumbnail */}
      {callType === 'video' && localStream && !isCameraOff && (
        <div
          style={{
            position: 'absolute',
            top: 90,
            right: 20,
            width: 110,
            height: 155,
            borderRadius: 16,
            overflow: 'hidden',
            border: '2px solid #6366f1',
            backgroundColor: '#000',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          <video
            ref={localVideoRef as any}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        </div>
      )}

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topFriendName}>{friendName || 'Friend'}</Text>
          <Text style={styles.topDuration}>{callConnected ? callDuration : callStatus}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Bottom Floating Control Bar (WhatsApp Style matching Mobile) */}
      <View style={styles.controlsBar}>
        {/* Speaker / Volume Indicator */}
        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={() => setIsSpeakerOn(!isSpeakerOn)}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
            size={24}
            color={isSpeakerOn ? '#fff' : '#e5e7eb'}
          />
        </TouchableOpacity>

        {/* Camera Toggle */}
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

        {/* Flip Camera */}
        {callType === 'video' && !isCameraOff && (
          <TouchableOpacity style={styles.controlButton} onPress={() => {}}>
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
    position: 'relative',
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
    top: 30,
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
    bottom: 34,
    left: 20,
    right: 20,
    maxWidth: 440,
    marginHorizontal: 'auto',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 40,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 20,
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
    position: 'relative',
  },
  incomingPulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  incomingAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  incomingAvatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3730a3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  incomingAvatarLetter: {
    color: '#fff',
    fontSize: 54,
    fontWeight: 'bold',
  },
  incomingActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 20,
  },
  incomingDeclineButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
  },
  incomingAcceptButton: {
    alignItems: 'center',
    backgroundColor: '#22c55e',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
  },
  incomingActionLabel: {
    position: 'absolute',
    bottom: -24,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
});
