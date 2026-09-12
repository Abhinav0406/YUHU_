export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const FALLBACK_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ice-servers`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`Edge function returned ${res.status}`);

    const servers = await res.json();
    console.log('ICE servers fetched from edge function:', servers.length);
    return servers;
  } catch (error) {
    console.warn('Edge function failed, using fallback ICE servers:', error);
    return FALLBACK_SERVERS;
  }
}

// Call quality monitoring utilities
export const callQualityUtils = {
  // Monitor connection quality
  getConnectionQuality: (connection: RTCPeerConnection) => {
    const stats = connection.getStats();
    let totalBitrate = 0;
    let totalPackets = 0;
    
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        totalBitrate += report.bytesReceived || 0;
        totalPackets += report.packetsReceived || 0;
      }
    });
    
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