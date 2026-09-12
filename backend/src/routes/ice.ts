import { Router, Router as ExpressRouter, Request, Response } from 'express';
import https from 'https';

const router: ExpressRouter = Router();

const GOOGLE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const METERED_DOMAIN = process.env.METERED_DOMAIN || 'yuhu';
const METERED_API_KEY = process.env.METERED_API_KEY;

async function getIceServers(): Promise<any> {
  // 1. Try Metered if configured
  if (METERED_API_KEY) {
    try {
      const servers: any = await new Promise((resolve, reject) => {
        https.get(`https://${METERED_DOMAIN}.metered.ca/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed) && parsed.length > 0) {
                resolve(parsed);
              } else {
                reject(new Error('Invalid Metered response'));
              }
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });

      return [...GOOGLE_STUN_SERVERS, ...servers];
    } catch (err) {
      console.warn('Metered fetch failed in backend:', err);
    }
  }

  // 2. Fallback to Google STUN servers
  return GOOGLE_STUN_SERVERS;
}

// GET /api/ice-servers
router.get('/ice-servers', async (req: Request, res: Response) => {
  try {
    const iceServers = await getIceServers();
    res.json(iceServers);
  } catch (error) {
    console.error('Error in ICE servers endpoint:', error);
    res.json(GOOGLE_STUN_SERVERS);
  }
});

export default router;
