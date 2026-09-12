import { supabase } from '../lib/supabase';

export type SignalType = 'offer' | 'answer' | 'ice' | 'hangup' | 'request-offer' | 'ringing';

export type SignalMessage = {
  type: SignalType;
  from: string; // sender user id
  to: string;   // receiver user id
  data: any;
};

export type IncomingCallPayload = {
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video' | 'audio';
  offer?: any;
};

function getOrCreateChannel(channelName: string) {
  let channel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
  if (!channel) {
    channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      console.log(`[Mobile Signaling] Channel ${channelName} status:`, status);
    });
  }
  return channel;
}

// Global direct-to-user call channel: user-calls-${targetUserId}
// Instantly wakes up and alerts the other user via Supabase Realtime
export function broadcastCallToUser(targetUserId: string, callData: IncomingCallPayload) {
  const channelName = `user-calls-${targetUserId}`;
  console.log('[Mobile Signaling] Broadcasting direct incoming call to user:', targetUserId);
  const channel = getOrCreateChannel(channelName);
  return channel.send({
    type: 'broadcast',
    event: 'incoming-call',
    payload: callData,
  });
}

// Global listener for incoming calls at root App level
export function subscribeToUserCalls(userId: string, onIncomingCall: (callData: IncomingCallPayload) => void) {
  const channelName = `user-calls-${userId}`;
  console.log('[Mobile Signaling] Subscribing to direct incoming calls for user:', userId);
  
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel.on('broadcast', { event: 'incoming-call' }, (payload) => {
    console.log('[Mobile Signaling] Received direct incoming call:', payload.payload);
    if (payload.payload) {
      onIncomingCall(payload.payload as IncomingCallPayload);
    }
  });

  channel.subscribe((status) => {
    console.log('[Mobile Signaling] Status for user calls', channelName, ':', status);
  });

  return () => {
    console.log('[Mobile Signaling] Unsubscribing from direct user calls:', userId);
    supabase.removeChannel(channel);
  };
}

// Subscribe to signaling messages for a chat
export function subscribeToSignaling(chatId: string, onMessage: (msg: SignalMessage) => void) {
  console.log('[Mobile Signaling] Subscribing to chat signaling:', chatId);
  const channelName = `webrtc-signaling-${chatId}`;
  
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel.on('broadcast', { event: 'signal' }, (payload) => {
    console.log('[Mobile Signaling] Received signal:', payload.payload?.type, 'from:', payload.payload?.from);
    if (payload.payload) {
      onMessage(payload.payload as SignalMessage);
    }
  });

  channel.subscribe((status) => {
    console.log('[Mobile Signaling] Status for', channelName, ':', status);
  });

  return () => {
    console.log('[Mobile Signaling] Unsubscribing from chat:', chatId);
    supabase.removeChannel(channel);
  };
}

// Send a signaling message to the other user without blocking
export function sendSignal(chatId: string, message: SignalMessage) {
  const channelName = `webrtc-signaling-${chatId}`;
  const channel = getOrCreateChannel(channelName);

  return channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: message,
  });
}
