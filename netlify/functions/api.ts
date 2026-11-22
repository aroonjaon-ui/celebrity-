import serverless from 'serverless-http';

import { createApiApp } from '../../server';

// createApiApp is async (it loads state from Supabase), so build the
// serverless-http handler once and reuse it across warm invocations.
const handlerPromise = createApiApp().then((app) => serverless(app));

// Netlify Functions receive Lambda-style (event, context) arguments.
type NetlifyEvent = any;
type NetlifyContext = any;

export const handler = async (event: NetlifyEvent, context: NetlifyContext) =>
  (await handlerPromise)(event, context);
