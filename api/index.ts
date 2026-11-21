import { createApiApp } from '../server.ts';

// Vercel Node functions pass a Node-style (req, res). Wait for Express to
// finish the response so async Supabase writes complete before the invocation ends.
const appPromise = createApiApp();

type VercelRequest = any;
type VercelResponse = any;

export default async (req: VercelRequest, res: VercelResponse) => {
  const app = await appPromise;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    res.once('finish', finish);
    res.once('close', finish);
    app(req, res);
  });
};
