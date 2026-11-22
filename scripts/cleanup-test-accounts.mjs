import { supabase } from '../supabase.ts';

const { data, error } = await supabase.from('app_state').select('data').eq('id', 'main').maybeSingle();
if (error) throw new Error(error.message);
if (!data?.data) throw new Error('No app state found');

const state = structuredClone(data.data);
const testEmails = new Set(
  (state.userAccounts || [])
    .map((account) => account.email)
    .filter((email) => /^smoke(-\d+)?@test\.com$/i.test(email) || /^smoke-\d+-\d+@test\.com$/i.test(email))
);

if (testEmails.size === 0) {
  console.log('No test accounts found');
  process.exit(0);
}

state.userAccounts = (state.userAccounts || []).filter((account) => !testEmails.has(account.email));
for (const [token, email] of Object.entries(state.clientSessionEmails || {})) {
  if (testEmails.has(email)) {
    delete state.clientSessionEmails[token];
    delete state.clientSessions?.[token];
  }
}
if (state.userAccount && testEmails.has(state.userAccount.email)) {
  state.userAccount = state.userAccounts[0]?.userAccount || null;
  state.clientProfile = state.userAccounts[0]?.clientProfile || null;
}

const { error: writeError } = await supabase.from('app_state').upsert({
  id: 'main',
  data: state,
  updated_at: new Date().toISOString(),
});
if (writeError) throw new Error(writeError.message);
console.log(`Removed ${testEmails.size} test account(s): ${[...testEmails].join(', ')}`);
