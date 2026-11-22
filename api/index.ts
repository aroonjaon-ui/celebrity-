import { createApiApp } from '../server.ts';

// Vercel Node functions pass Node-style (req, res). Build the Express app once,
// but keep startup errors so every invocation returns readable JSON instead of
// Vercel's generic FUNCTION_INVOCATION_FAILED page.
let startupError: unknown = null;
const appPromise = createApiApp().catch((err) => {
  startupError = err;
  console.error('API startup failed:', err);
  return null;
});

type VercelRequest = any;
type VercelResponse = any;

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default async (req: VercelRequest, res: VercelResponse) => {
  const url = String(req.url || '');

  // Bypass startup so we can always tell whether the function itself loads.
  if (url.startsWith('/api/health') || url === '/health') {
    sendJson(res, 200, {
      ok: !startupError,
      startupError: startupError ? errorMessage(startupError) : null,
    });
    return;
  }

  try {
    const app = await appPromise;
    if (!app) throw startupError || new Error('API app failed to initialize');

    await new Promise<void>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        console.error('API invocation timed out:', url);
        sendJson(res, 504, { error: 'The server took too long to respond. Please try again.' });
        finish();
      }, 9000);
      timer.unref?.();

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };

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
    console.error('API invocation failed:', err);
    sendJson(res, 500, {
      error: 'API failed to initialize. Check deployment logs.',
      detail: errorMessage(err),
    });
  }
};
