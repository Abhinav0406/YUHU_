import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const XIRSYS_USERNAME = Deno.env.get('XIRSYS_USERNAME') ?? 'Ambica';
const XIRSYS_CREDENTIAL = Deno.env.get('XIRSYS_CREDENTIAL') ?? 'cdb9393e-2e40-11f0-94fc-0242ac150003';
const XIRSYS_DOMAIN = Deno.env.get('XIRSYS_DOMAIN') ?? 'YUHU';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_SERVERS = [
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const credentials = btoa(`${XIRSYS_USERNAME}:${XIRSYS_CREDENTIAL}`);
    const body = JSON.stringify({ format: 'urls' });

    const response = await fetch(`https://global.xirsys.net/_turn/${XIRSYS_DOMAIN}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await response.json();

    if (data?.v?.iceServers) {
      console.log('Returning Xirsys ICE servers');
      return new Response(JSON.stringify(data.v.iceServers), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected Xirsys response: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('Xirsys failed, using fallback:', error);
    return new Response(JSON.stringify(FALLBACK_SERVERS), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
