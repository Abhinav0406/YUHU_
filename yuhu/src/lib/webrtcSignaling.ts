import { supabase } from '@/lib/supabase';

// Message types: 'offer', 'answer', 'ice', 'hangup'
export type SignalMessage = {
  type: 'offer' | 'answer' | 'ice' | 'hangup';
  from: string; // sender user id
  to: string;   // receiver user id
  data: any;
};

// Subscribe to signaling messages for a chat
export function subscribeToSignaling(chatId: string, onMessage: (msg: SignalMessage) => void) {
  console.log('Subscribing to signaling for chat:', chatId);
  const channelName = `webrtc-signaling-${chatId}`;
  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false }, // Don't receive our own messages
    },
  });
  
  channel.on('broadcast', { event: 'signal' }, (payload) => {
    console.log('Received signaling message:', payload.payload);
    console.log('Channel name:', channelName);
    onMessage(payload.payload as SignalMessage);
  });
  
  channel.subscribe((status) => {
    console.log('Signaling subscription status for', channelName, ':', status);
    if (status === 'SUBSCRIBED') {
      console.log('Successfully subscribed to signaling channel');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Failed to subscribe to signaling channel');
    }
  });
  
  return () => {
    console.log('Unsubscribing from signaling for chat:', chatId);
    supabase.removeChannel(channel);
  };
}

// Send a signaling message to the other user in the chat
export function sendSignal(chatId: string, message: SignalMessage) {
  const channelName = `webrtc-signaling-${chatId}`;
  console.log('Sending signal:', message.type, 'from', message.from, 'to', message.to);
  console.log('Using channel:', channelName);
  console.log('Message payload:', message);
  
  const channel = supabase.channel(channelName);
  
  return channel.send({ 
    type: 'broadcast', 
    event: 'signal', 
    payload: message 
  })
  .then((result) => {
    console.log('Signal sent successfully:', result);
    console.log('Channel status after send:', channel.state);
    return result;
  })
  .catch((error) => {
    console.error('Error sending signal:', error);
    console.error('Channel state:', channel.state);
    throw error;
  });
} 