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
  const channel = supabase.channel(`webrtc-signaling-${chatId}`);
  
  channel.on('broadcast', { event: 'signal' }, (payload) => {
    console.log('Received signaling message:', payload.payload);
    onMessage(payload.payload as SignalMessage);
  });
  
  channel.subscribe((status) => {
    console.log('Signaling subscription status:', status);
  });
  
  return () => {
    console.log('Unsubscribing from signaling for chat:', chatId);
    supabase.removeChannel(channel);
  };
}

// Send a signaling message to the other user in the chat
export function sendSignal(chatId: string, message: SignalMessage) {
  console.log('Sending signal:', message.type, 'from', message.from, 'to', message.to);
  return supabase.channel(`webrtc-signaling-${chatId}`)
    .send({ type: 'broadcast', event: 'signal', payload: message })
    .then((result) => {
      console.log('Signal sent successfully:', result);
      return result;
    })
    .catch((error) => {
      console.error('Error sending signal:', error);
      throw error;
    });
} 