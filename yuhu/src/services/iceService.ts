// Frontend service to fetch ICE servers from our backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ice-servers`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch ICE servers');
    }

    const data = await response.json();
    
    // If the response includes an error but has fallback servers, use those
    if (data.error && data.fallback) {
      console.warn('Using fallback ICE servers:', data.error);
      return data.fallback;
    }

    return data;
  } catch (error) {
    console.error('Error fetching ICE servers:', error);
    // Fallback to public STUN servers if backend fails
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }
} 