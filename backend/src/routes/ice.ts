import { Router, Router as ExpressRouter, Request, Response } from 'express';
import https from 'https';

const router: ExpressRouter = Router();

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
          if (parsed.v && parsed.v.iceServers) {
            console.log('Using Xirsys ICE servers');
            resolve(parsed.v.iceServers);
          } else {
            throw new Error('Invalid Xirsys response format');
          }
        } catch (e) {
          console.error('Error parsing Xirsys response:', e);
          // Fallback to public STUN servers and OpenRelay TURN servers
          resolve([
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: [
                "turn:openrelay.metered.ca:80",
                "turn:openrelay.metered.ca:443",
                "turn:openrelay.metered.ca:443?transport=tcp"
              ],
              username: "openrelayproject",
              credential: "openrelayproject"
            }
          ]);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Error fetching ICE servers from Xirsys:', e);
      // Fallback to public STUN servers and OpenRelay TURN servers
      resolve([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp"
          ],
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]);
    });

    req.write(JSON.stringify({ format: 'urls' }));
    req.end();
  });
}

// GET /api/ice-servers
router.get('/ice-servers', async (req: Request, res: Response) => {
  try {
    const iceServers = await getIceServers();
    res.json(iceServers);
  } catch (error) {
    console.error('Error in ICE servers endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ICE servers',
      fallback: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp"
          ],
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]
    });
  }
});

export default router;