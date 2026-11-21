import fs from 'node:fs';

const root = process.cwd();
const seedPath = `${root}/supabase/seed-store.ts`;
const storePath = `${root}/data/store.json`;

const seedText = fs.readFileSync(seedPath, 'utf8');
const json = seedText.slice(seedText.indexOf('{'), seedText.lastIndexOf('}') + 1);
const data = JSON.parse(json);

if (data.userAccount?.kyc) {
  data.userAccount.kyc.status = 'unverified';
  data.userAccount.kyc.documentNumberMasked = '';
  delete data.userAccount.kyc.submittedAt;
  delete data.userAccount.kyc.documentFileUrl;
}
data.userAccounts = [];
data.clientSessionEmails = {};
if (!Array.isArray(data.threads)) data.threads = [];
if (!data.threads.some((thread) => thread.id === 'support-thread')) {
  data.threads.unshift({
    id: 'support-thread',
    talentId: 'support',
    clientCompany: 'Live Support',
    subject: 'Live Support',
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: '',
    unreadForClient: 0,
    unreadForManager: 0,
    unreadForAdmin: 0,
  });
}

fs.writeFileSync(seedPath, `export const seedStore: any = JSON.parse(${JSON.stringify(JSON.stringify(data))});\n`);
fs.writeFileSync(storePath, `${JSON.stringify(data, null, 2)}\n`);
console.log('seed files normalized');
