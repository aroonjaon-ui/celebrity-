import { createApiApp } from '../server';

// Vercel Node functions pass Node-style (req, res). Build the Express app once
// and wait for the response so async Supabase writes complete before the
// invocation ends.
type VercelRequest = any;
type VercelResponse = any;

let startupError: unknown = null;
const appPromise = createApiApp().catch((err) => {
  startupError = err;
  console.error('API startup failed:', err);
  return null;
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function getApp(): Promise<any> {
  const app = await appPromise;
  if (!app) throw startupError || new Error('API app failed to initialize');
  return app;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  const url = String(req.url || '');

  if (url.startsWith('/api/health') || url === '/health') {
    try {
      await getApp();
      sendJson(res, 200, { ok: true, startupError: null });
    } catch (err) {
      sendJson(res, 500, { ok: false, startupError: errorMessage(err) });
    }
    return;
  }

  try {
    const app = await getApp();

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        console.error('API invocation timed out:', url);
        sendJson(res, 504, { error: 'The server took too long to respond. Please try again.' });
        finish();
      }, 9000);
      timer.unref?.();

      res.once('finish', finish);
      res.once('close', finish);

      try {
        app(req, res, (err: unknown) => {
          if (err) {
            console.error('Express route error:', err);
            sendJson(res, 500, { error: 'Server error', detail: errorMessage(err) });
          } else {
            sendJson(res, 404, { error: 'Not found' });
          }
          finish();
        });
      } catch (err) {
        console.error('Express dispatch failed:', err);
        sendJson(res, 500, { error: 'Server error', detail: errorMessage(err) });
        finish();
      }
    });
  } catch (err) {
    if (!startupError) startupError = err;
    console.error('API invocation failed:', err);
    sendJson(res, 500, {
      error: 'API failed to initialize. Check deployment logs.',
      detail: errorMessage(err),
    });
  }
};
