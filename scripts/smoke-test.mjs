import { supabase } from '../supabase.ts';

const base = 'http://127.0.0.1:3000';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const post = (path, body, cookie = '') =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

async function ready() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(base + '/api/bootstrap');
      if (res.ok) return true;
    } catch {}
    await wait(500);
  }
  return false;
}

const { data: beforeRow } = await supabase.from('app_state').select('data').eq('id', 'main').maybeSingle();
const original = structuredClone(beforeRow.data);

try {
  if (!(await ready())) throw new Error('server not ready');

  const results = {};
  const boot = await fetch(base + '/api/bootstrap');
  results.bootstrap = boot.status;

  const s1 = await post('/api/auth/signup', {
    fullName: 'Smoke One',
    email: 'smoke1@test.com',
    password: 'smokepass123',
  });
  results.signup1 = s1.status;
  const jar1 = cookieOf(s1);

  const s2 = await post('/api/auth/signup', {
    fullName: 'Smoke Two',
    email: 'smoke2@test.com',
    password: 'smokepass123',
  });
  results.signup2 = s2.status;
  const jar2 = cookieOf(s2);

  const duplicate = await post('/api/auth/signup', {
    fullName: 'Smoke Dup',
    email: 'smoke1@test.com',
    password: 'smokepass123',
  });
  results.duplicateSignup = duplicate.status;

  const session1 = await fetch(base + '/api/auth/session', { headers: { cookie: jar1 } });
  const body1 = await session1.json();
  results.session1 = `${session1.status}:${body1.userAccount?.email}`;

  const session2 = await fetch(base + '/api/auth/session', { headers: { cookie: jar2 } });
  const body2 = await session2.json();
  results.session2 = `${session2.status}:${body2.userAccount?.email}`;

  const login1 = await post('/api/auth/login', { email: 'smoke1@test.com', password: 'smokepass123' });
  results.login1 = login1.status;

  const adminLogin = await post('/api/admin/login', {
    email: 'admin@mercersterling.com',
    password: 'admin123',
  });
  results.adminLogin = adminLogin.status;

  const support = await post('/api/support/message', {
    body: 'Smoke test support message',
    senderName: 'Smoke Tester',
    senderEmail: 'smoke1@test.com',
  });
  results.support = support.status;

  console.log(JSON.stringify(results));
} finally {
  await supabase.from('app_state').upsert({
    id: 'main',
    data: original,
    updated_at: new Date().toISOString(),
  });
  console.log('state restored');
}
