import Constants from 'expo-constants';

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest ?? {};
const extra = (expoConfig as any).extra || {};
const SUPABASE_URL: string = extra.supabaseUrl || '';
const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey || '';

const GOOGLE_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export async function getIceServers(): Promise<RTCIceServer[]> {
  // 1. Try Supabase Edge Function to get TURN servers from Metered
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ice-servers`, {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const servers = await res.json();
        if (Array.isArray(servers) && servers.length > 0) {
          console.log('[Mobile WebRTC] Fetched ICE servers from edge function:', servers.length);
          return servers;
        }
      }
    } catch (err) {
      console.warn('[Mobile WebRTC] Edge function failed, using STUN fallback:', err);
    }
  }

  // 2. Fallback to Google STUN servers
  return GOOGLE_STUN_SERVERS;
}
