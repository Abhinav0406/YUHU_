// ICE Server configuration for WebRTC
export const getIceServers = async () => {
  try {
    const response = await fetch('https://global.xirsys.net/_turn/YUHU', {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa('Ambica:cdb9393e-2e40-11f0-94fc-0242ac150003'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ format: 'urls' })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch ICE servers');
    }

    const data = await response.json();
    return data.v.iceServers;
  } catch (error) {
    console.error('Error fetching ICE servers:', error);
    // Fallback to public STUN servers if Xirsys fails
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }
}; 