import { createApiApp } from '../server.ts';

// Vercel Node functions pass a Node-style (req, res), so the Express app can
// be invoked directly without serverless-http.
const appPromise = createApiApp();

type VercelRequest = any;
type VercelResponse = any;

export default async (req: VercelRequest, res: VercelResponse) =>
  (await appPromise)(req, res);
