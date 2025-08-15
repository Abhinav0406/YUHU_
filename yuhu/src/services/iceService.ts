// Frontend service to fetch ICE servers from our backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  // Enhanced free ICE servers for production use
  const productionServers = [
    // Free STUN servers (Google, Cloudflare, etc.)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.voiparound.com:3478' },
    { urls: 'stun:stun.voipstunt.com:3478' },
    
    // Free TURN servers for NAT traversal
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443", 
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: [
        "turn:global.turn.twilio.com:3478?transport=udp",
        "turn:global.turn.twilio.com:3478?transport=tcp",
        "turn:global.turn.twilio.com:443?transport=tcp"
      ],
      username: "free", // Twilio offers free TURN servers
      credential: "free"
    }
  ];

  console.log('🚀 Using production ICE servers:', productionServers.length, 'servers');
  console.log('💡 These servers are free and production-ready');
  
  return productionServers;
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