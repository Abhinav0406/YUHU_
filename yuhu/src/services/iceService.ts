// Frontend service to fetch ICE servers from our backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  // Enhanced fallback ICE servers for immediate use
  const fallbackServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443", 
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ];

  // 🚨 TEMPORARY: Skip backend due to CORS issues
  console.log('⚡ Using fallback ICE servers (backend disabled due to CORS)');
  console.log('📊 ICE Servers loaded:', fallbackServers.length, 'servers');
  return fallbackServers;

  // DISABLED: Backend fetch (uncomment and fix CORS to re-enable)
  /*
  try {
    console.log('Fetching ICE servers from:', `${BACKEND_URL}/api/ice-servers`);
    
    // Set a timeout for the backend request
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${BACKEND_URL}/api/ice-servers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // REMOVED credentials to avoid CORS issues
      // credentials: 'include',
      signal: controller.signal
    });

    console.log('ICE servers response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch ICE servers: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('ICE servers received from backend:', data);
    
    // If the response includes an error but has fallback servers, use those
    if (data.error && data.fallback) {
      console.warn('Using backend fallback ICE servers:', data.error);
      return data.fallback;
    }

    // Combine backend servers with fallback for redundancy
    return [...data, ...fallbackServers];
  } catch (error) {
    console.error('Error fetching ICE servers from backend:', error);
    console.log('Using fallback ICE servers');
    return fallbackServers;
  }
  */
} 