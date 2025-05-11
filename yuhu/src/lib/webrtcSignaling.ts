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
  const channel = supabase.channel(`webrtc-signaling-${chatId}`);
  channel.on('broadcast', { event: 'signal' }, (payload) => {
    onMessage(payload.payload as SignalMessage);
  });
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Send a signaling message to the other user in the chat
export function sendSignal(chatId: string, message: SignalMessage) {
  return supabase.channel(`webrtc-signaling-${chatId}`)
    .send({ type: 'broadcast', event: 'signal', payload: message });
} 