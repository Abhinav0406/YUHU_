export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY as string | undefined;
const METERED_DOMAIN = (import.meta.env.VITE_METERED_DOMAIN as string) || 'yuhu';

const STUN_FALLBACK_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export async function getIceServers(): Promise<RTCIceServer[]> {
  // 1. Try Supabase Edge Function first
  try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const edgeUrl = METERED_API_KEY
        ? `${SUPABASE_URL}/functions/v1/get-ice-servers?apiKey=${encodeURIComponent(METERED_API_KEY)}&domain=${encodeURIComponent(METERED_DOMAIN)}`
        : `${SUPABASE_URL}/functions/v1/get-ice-servers`;

      const res = await fetch(edgeUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const servers = await res.json();
        if (Array.isArray(servers) && servers.length > 0) {
          console.log('✅ ICE servers fetched from edge function:', servers.length);
          return servers;
        }
      } else {
        console.warn(`Edge function returned status ${res.status}`);
      }
    }
  } catch (error) {
    console.warn('Edge function failed for ICE servers:', error);
  }

  // 2. Direct Metered TURN fetch if VITE_METERED_API_KEY is configured
  if (METERED_API_KEY) {
    try {
      console.log('Fetching ICE servers directly from Metered...');
      const meteredRes = await fetch(
        `https://${METERED_DOMAIN}.metered.ca/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
      );
      if (meteredRes.ok) {
        const meteredServers = await meteredRes.json();
        if (Array.isArray(meteredServers) && meteredServers.length > 0) {
          console.log('✅ ICE servers fetched directly from Metered:', meteredServers.length);
          return [...STUN_FALLBACK_SERVERS, ...meteredServers];
        }
      }
    } catch (meteredErr) {
      console.warn('Direct Metered fetch failed:', meteredErr);
    }
  }

  // 3. Fallback to Google STUN servers
  console.log('Using STUN fallback servers');
  return STUN_FALLBACK_SERVERS;
}

// Call quality monitoring utilities
export const callQualityUtils = {
  // Monitor connection quality
  getConnectionQuality: (connection: RTCPeerConnection) => {
    const stats = connection.getStats();
    let totalBitrate = 0;
    let totalPackets = 0;

    stats.then((report) => {
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
          totalBitrate += stat.bytesReceived || 0;
          totalPackets += stat.packetsReceived || 0;
        }
      });
    }).catch(() => {});

    return {
      bitrate: totalBitrate,
      packets: totalPackets,
      quality: totalBitrate > 100000 ? 'Good' : totalBitrate > 50000 ? 'Fair' : 'Poor'
    };
  },

  // Get available bandwidth
  getAvailableBandwidth: async (connection: RTCPeerConnection) => {
    try {
      const stats = await connection.getStats();
      let availableBandwidth = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          availableBandwidth = report.availableOutgoingBitrate || 0;
        }
      });

      return availableBandwidth;
    } catch (error) {
      console.warn('Could not get bandwidth info:', error);
      return 0;
    }
  },

  // Check if connection is stable
  isConnectionStable: (connection: RTCPeerConnection) => {
    return connection.connectionState === 'connected' &&
           connection.iceConnectionState === 'connected';
  }
};
