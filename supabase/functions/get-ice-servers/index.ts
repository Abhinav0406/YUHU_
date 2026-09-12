import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 1. Check for Metered TURN credentials
  // Secret: METERED_API_KEY (in Supabase Dashboard -> Edge Functions -> Secrets)
  const url = new URL(req.url);
  const meteredApiKey = Deno.env.get('METERED_API_KEY') || url.searchParams.get('apiKey');
  const meteredDomain = Deno.env.get('METERED_DOMAIN') || url.searchParams.get('domain') || 'yuhu';

  if (meteredApiKey) {
    try {
      console.log(`Fetching TURN credentials from Metered domain: ${meteredDomain}`);
      const meteredRes = await fetch(
        `https://${meteredDomain}.metered.ca/api/v1/turn/credentials?apiKey=${meteredApiKey}`
      );

      if (meteredRes.ok) {
        const servers = await meteredRes.json();
        if (Array.isArray(servers) && servers.length > 0) {
          console.log(`Successfully obtained ${servers.length} ICE servers from Metered`);
          const combined = [...GOOGLE_STUN_SERVERS, ...servers];
          return new Response(JSON.stringify(combined), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.warn(`Metered returned status ${meteredRes.status}`);
      }
    } catch (meteredErr) {
      console.error('Failed to fetch from Metered:', meteredErr);
    }
  }

  // 2. Optional: Try Xirsys if credentials are configured
  const xirsysUsername = Deno.env.get('XIRSYS_USERNAME');
  const xirsysCredential = Deno.env.get('XIRSYS_CREDENTIAL');
  const xirsysDomain = Deno.env.get('XIRSYS_DOMAIN');

  if (xirsysUsername && xirsysCredential && xirsysDomain) {
    try {
      const credentials = btoa(`${xirsysUsername}:${xirsysCredential}`);
      const body = JSON.stringify({ format: 'urls' });

      const response = await fetch(`https://global.xirsys.net/_turn/${xirsysDomain}`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      const data = await response.json();
      if (data?.v?.iceServers) {
        console.log('Returning Xirsys ICE servers');
        const combined = [...GOOGLE_STUN_SERVERS, ...data.v.iceServers];
        return new Response(JSON.stringify(combined), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    } catch (xirsysErr) {
      console.warn('Xirsys failed:', xirsysErr);
    }
  }

  // 3. Fallback: Google STUN servers (handles direct P2P connections)
  console.log('Returning Google STUN servers');
  return new Response(JSON.stringify(GOOGLE_STUN_SERVERS), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
