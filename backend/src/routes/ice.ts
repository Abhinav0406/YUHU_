import { Router } from 'express';
import https from 'https';

const router = Router();

// Xirsys credentials - should be in environment variables in production
const XIRSYS_USERNAME = 'Ambica';
const XIRSYS_CREDENTIAL = 'cdb9393e-2e40-11f0-94fc-0242ac150003';
const XIRSYS_DOMAIN = 'YUHU';

async function getIceServers(): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      host: 'global.xirsys.net',
      path: `/_turn/${XIRSYS_DOMAIN}`,
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${XIRSYS_USERNAME}:${XIRSYS_CREDENTIAL}`).toString('base64'),
        'Content-Type': 'application/json',
        'Content-Length': JSON.stringify({ format: 'urls' }).length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.v.iceServers);
        } catch (e) {
          console.error('Error parsing Xirsys response:', e);
          // Fallback to public STUN servers
          resolve([
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Error fetching ICE servers:', e);
      // Fallback to public STUN servers
      resolve([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]);
    });

    req.write(JSON.stringify({ format: 'urls' }));
    req.end();
  });
}

// GET /api/ice-servers
router.get('/ice-servers', async (req, res) => {
  try {
    const iceServers = await getIceServers();
    res.json(iceServers);
  } catch (error) {
    console.error('Error in ICE servers endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ICE servers',
      fallback: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
  }
});

export default router; 