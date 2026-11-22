import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CreditCard,
  Image as ImageIcon,
  Inbox,
  LogOut,
  MessageSquare,
  Plus,
  Save,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import type {
  AdminEscrowAccount,
  AdminSettings,
  EscrowAccountSnapshot,
  FanCardTier,
  Talent,
  UserAccountProfile,
} from '../types.ts';

type AdminTab = 'roster' | 'editor' | 'escrow' | 'approvals' | 'users' | 'messages';

interface AdminUserView {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  signupDate: string;
  lastLoginAt: string;
  kyc: UserAccountProfile['kyc'];
}

interface AdminDepositItem {
  type: 'booking' | 'fancard';
  id: string;
  reference: string;
  title: string;
  client: string;
  contactEmail: string;
  expectedAmount: number;
  submittedAmount: number;
  proofUrl: string;
  referenceNote?: string;
  note?: string;
  submittedAt: string;
  approvalStatus: string;
}

const CATEGORIES: Talent['category'][] = [
  'Film & Television',
  'Music & Recording',
  'Culinary & Hospitality',
  'Creative Direction',
  'Athletics & Keynote',
];

// The live support thread is shared by all visitors, so it has no roster profile.
const SUPPORT_TALENT: Talent = {
  id: 'support',
  slug: 'support',
  name: 'Live Support',
  category: 'Film & Television',
  location: '—',
  timezone: 'UTC',
  dailyRate: 0,
  currency: 'USD',
  portraitUrl: '',
  tagline: 'Platform support',
  biography: '',
  yearsActive: 0,
  experience: [],
  portfolio: [],
  socialLinks: {},
  engagementTypes: [],
  representationManager: 'Live Support',
  responseTime: '',
  verified: true,
};

const resolveThreadTalent = (talents: Talent[], talentId?: string): Talent | undefined =>
  talentId === SUPPORT_TALENT.id ? SUPPORT_TALENT : talents.find((t) => t.id === talentId);

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 transition-colors';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5';

export const AdminPage: React.FC = () => {
  const {
    isAdmin,
    adminLogin,
    adminLogout,
    talents,
    adminSettings,
    escrowDepositInfo,
    adminSettings: settings,
    updateAdminSettings,
    getEscrowAccount,
    updateEscrowAccount,
    createTalent,
    updateTalentFull,
    archiveTalent,
    uploadMediaFile,
    getAdminDeposits,
    approveDeposit,
    rejectDeposit,
    threads,
    messages,
    sendAdminChat,
    markAdminThreadRead,
    pushToast,
  } = usePlatform();
  const { t } = useLanguage();

  const [tab, setTab] = useState<AdminTab>('roster');
  const [email, setEmail] = useState('admin@mercersterling.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      await adminLogin(email, password);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-950">Admin Login</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in with the admin credentials stored in Supabase.
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Admin email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="admin@mercersterling.com"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div>
              <label className={labelClass}>Admin password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Admin password"
                required
              />
            </div>
            {loginError && <p className="text-xs text-red-600">{loginError}</p>}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-600">
              <div className="flex items-center justify-between gap-2">
                <span>
                  Admin access:{' '}
                  <span className="font-mono text-zinc-950">admin@mercersterling.com</span> /{' '}
                  <span className="font-mono text-zinc-950">admin123</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@mercersterling.com');
                    setPassword('admin123');
                    setLoginError('');
                  }}
                  className="shrink-0 font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Use
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loggingIn || !email || !password}
              className="w-full py-2.5 text-sm font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
            >
              {loggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'roster', label: t('Roster_Admin'), icon: <UserPlus className="w-4 h-4" /> },
    { id: 'editor', label: 'Celebrity Editor', icon: <Save className="w-4 h-4" /> },
    { id: 'escrow', label: t('Escrow & Deposits'), icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'approvals', label: t('Approvals'), icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'users', label: 'Users & KYC', icon: <Users className="w-4 h-4" /> },
    { id: 'messages', label: t('All Messages'), icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Platform control</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-zinc-950">Admin Center</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage the roster, deposits, Fan Cards, and every conversation.</p>
        </div>
        <button
          type="button"
          onClick={() => adminLogout().catch((err) => pushToast('Logout Failed', err.message, 'error'))}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:border-zinc-950 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border cursor-pointer transition-colors ${
              tab === item.id
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-950'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <RosterTab
          talents={talents}
          onAdd={() => {
            setSelectedTalent(null);
            setTab('editor');
          }}
          onEdit={(talent) => {
            setSelectedTalent(talent);
            setTab('editor');
          }}
          onArchive={(talent) => archiveTalent(talent.id, !talent.archived).catch((err) => pushToast('Error', err.message, 'error'))}
        />
      )}

      {tab === 'editor' && (
        <CelebrityEditor
          talent={selectedTalent}
          uploadMediaFile={uploadMediaFile}
          onSaved={(talent) => setSelectedTalent(talent)}
          onCreate={createTalent}
          onUpdate={updateTalentFull}
        />
      )}

      {tab === 'escrow' && (
        <EscrowTab
          settings={settings}
          escrowDepositInfo={escrowDepositInfo}
          onSaveSettings={updateAdminSettings}
          onLoadAccount={getEscrowAccount}
          onSaveAccount={updateEscrowAccount}
        />
      )}

      {tab === 'approvals' && (
        <ApprovalsTab
          getAdminDeposits={getAdminDeposits}
          approveDeposit={approveDeposit}
          rejectDeposit={rejectDeposit}
          uploadMediaFile={uploadMediaFile}
        />
      )}

      {tab === 'users' && <UsersTab pushToast={pushToast} />}

      {tab === 'messages' && (
        <AdminMessagesTab
          threads={threads}
          messages={messages}
          onRead={markAdminThreadRead}
          onSend={sendAdminChat}
        />
      )}
    </div>
  );
};

/* ---------------- Roster ---------------- */

const RosterTab: React.FC<{
  talents: Talent[];
  onAdd: () => void;
  onEdit: (talent: Talent) => void;
  onArchive: (talent: Talent) => void;
}> = ({ talents, onAdd, onEdit, onArchive }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      talents.filter((talent) =>
        `${talent.name} ${talent.category} ${talent.location}`.toLowerCase().includes(query.toLowerCase())
      ),
    [talents, query]
  );

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100">
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-950">Celebrity Roster</h2>
          <p className="text-xs text-zinc-500 mt-1">{filtered.length} profiles</p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roster…"
            className={`${inputClass} sm:w-64`}
          />
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add celebrity
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
              <th className="px-6 py-3 font-semibold">Celebrity</th>
              <th className="px-6 py-3 font-semibold">Category</th>
              <th className="px-6 py-3 font-semibold text-right">{t('Daily rate')}</th>
              <th className="px-6 py-3 font-semibold text-right">Escrow</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((talent) => (
              <tr key={talent.id} className={talent.archived ? 'opacity-50' : ''}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <SafeImage src={talent.portraitUrl} alt={talent.name} className="w-10 h-10 rounded-lg object-cover bg-zinc-100" />
                    <div>
                      <p className="font-semibold text-zinc-950">{talent.name}</p>
                      <p className="text-xs text-zinc-500">/{talent.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-zinc-600">{talent.category}</td>
                <td className="px-6 py-4 text-right font-mono tabular-nums">${talent.dailyRate.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-mono tabular-nums">
                  {talent.escrowFeePercent ?? 'default'}%
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(talent)}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:border-zinc-950 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onArchive(talent)}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-lg hover:border-red-400 hover:text-red-600 cursor-pointer"
                    >
                      {talent.archived ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/* ---------------- Celebrity editor ---------------- */

const CelebrityEditor: React.FC<{
  talent: Talent | null;
  uploadMediaFile: (file: File) => Promise<{ url: string; mediaType: 'image' | 'video' | 'document' }>;
  onSaved: (talent: Talent) => void;
  onCreate: (input: Partial<Talent> & { initialBlocks?: Array<{ date: string; status: 'blocked' | 'travel' }> }) => Promise<Talent>;
  onUpdate: (id: string, patch: Partial<Talent>) => Promise<Talent>;
}> = ({ talent, uploadMediaFile, onSaved, onCreate, onUpdate }) => {
  const [form, setForm] = useState<Partial<Talent>>({});
  const [portrait, setPortrait] = useState('');
  const [engagements, setEngagements] = useState('');
  const [initialBlocks, setInitialBlocks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(talent ? { ...talent } : { category: 'Film & Television', dailyRate: 10000, verified: true, yearsActive: 1 });
    setPortrait(talent?.portraitUrl || '');
    setEngagements(talent?.engagementTypes.join(', ') || '');
    setInitialBlocks('');
    setError('');
  }, [talent]);

  const set = <K extends keyof Talent>(key: K, value: Talent[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const handlePortrait = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMediaFile(file);
      setPortrait(result.url);
      set('portraitUrl', result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const blocks = initialBlocks
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [date, status] = line.split(':').map((part) => part.trim());
          return { date, status: (status === 'travel' ? 'travel' : 'blocked') as 'blocked' | 'travel' };
        })
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
      const payload: Partial<Talent> & { initialBlocks?: Array<{ date: string; status: 'blocked' | 'travel' }> } = {
        ...form,
        portraitUrl: portrait,
        engagementTypes: engagements
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        dailyRate: Number(form.dailyRate) || 10000,
        yearsActive: Number(form.yearsActive) || 1,
        escrowFeePercent:
          form.escrowFeePercent === undefined ||
          form.escrowFeePercent === null ||
          (form.escrowFeePercent as unknown) === ''
            ? undefined
            : Number(form.escrowFeePercent),
      };
      if (!talent) payload.initialBlocks = blocks;
      const saved = talent ? await onUpdate(talent.id, payload) : await onCreate(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save celebrity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-5 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-950">
            {talent ? `Edit ${talent.name}` : 'Add New Celebrity'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Set profile, pricing, biography, and initial availability.</p>
        </div>
        {portrait && (
          <SafeImage src={portrait} alt="Portrait preview" className="w-16 h-16 rounded-xl object-cover bg-zinc-100" />
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Full name">
            <input className={inputClass} value={form.name || ''} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Slug">
            <input className={inputClass} value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated" />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category || 'Film & Television'} onChange={(e) => set('category', e.target.value as Talent['category'])}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input className={inputClass} value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Timezone">
            <input className={inputClass} value={form.timezone || ''} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Daily rate (USD)">
            <input type="number" min={1000} className={inputClass} value={form.dailyRate ?? 10000} onChange={(e) => set('dailyRate', Number(e.target.value))} />
          </Field>
          <Field label="Escrow override % (blank = global)">
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              className={inputClass}
              value={form.escrowFeePercent ?? ''}
              onChange={(e) => set('escrowFeePercent', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </Field>
          <Field label="Years active">
            <input type="number" min={0} className={inputClass} value={form.yearsActive ?? 1} onChange={(e) => set('yearsActive', Number(e.target.value))} />
          </Field>
          <Field label="Representation manager">
            <input className={inputClass} value={form.representationManager || ''} onChange={(e) => set('representationManager', e.target.value)} />
          </Field>
          <Field label="Response time">
            <input className={inputClass} value={form.responseTime || ''} onChange={(e) => set('responseTime', e.target.value)} />
          </Field>
          <Field label="Engagement types (comma separated)">
            <input className={inputClass} value={engagements} onChange={(e) => setEngagements(e.target.value)} />
          </Field>
          <Field label="Portrait image">
            <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-950">
              <Upload className="w-4 h-4" /> Upload portrait
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePortrait} />
            </label>
          </Field>
        </div>

        <Field label="Tagline">
          <input className={inputClass} value={form.tagline || ''} onChange={(e) => set('tagline', e.target.value)} />
        </Field>
        <Field label="Biography">
          <textarea rows={6} className={inputClass} value={form.biography || ''} onChange={(e) => set('biography', e.target.value)} />
        </Field>

        {!talent && (
          <Field label="Initial calendar blocks (one per line, YYYY-MM-DD:blocked or YYYY-MM-DD:travel)">
            <textarea rows={4} className={`${inputClass} font-mono text-xs`} value={initialBlocks} onChange={(e) => setInitialBlocks(e.target.value)} />
          </Field>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
          <input type="checkbox" checked={form.verified !== false} onChange={(e) => set('verified', e.target.checked)} className="w-4 h-4" />
          Verified talent
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : talent ? 'Save changes' : 'Add to roster'}
          </button>
        </div>
      </form>
    </section>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className={labelClass}>{label}</label>
    {children}
  </div>
);

/* ---------------- Escrow & deposit details ---------------- */

const EscrowTab: React.FC<{
  settings: AdminSettings | null;
  escrowDepositInfo: EscrowAccountSnapshot | null;
  onSaveSettings: (patch: Partial<AdminSettings>) => Promise<void>;
  onLoadAccount: () => Promise<AdminEscrowAccount>;
  onSaveAccount: (patch: Record<string, unknown>) => Promise<void>;
}> = ({ settings, escrowDepositInfo, onSaveSettings, onLoadAccount, onSaveAccount }) => {
  const [escrowPercent, setEscrowPercent] = useState('6');
  const [prices, setPrices] = useState({ silver: '49', gold: '149', platinum: '399' });
  const [account, setAccount] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setEscrowPercent(String(settings.escrowFeePercent));
      setPrices({
        silver: String(settings.fanCardPrices.silver),
        gold: String(settings.fanCardPrices.gold),
        platinum: String(settings.fanCardPrices.platinum),
      });
    }
  }, [settings]);

  const loadAccount = useCallback(async () => {
    try {
      const data = await onLoadAccount();
      setAccount({
        bankName: data.bankName || '',
        accountHolder: data.accountHolder || '',
        accountNumber: data.accountNumber || '',
        routingNumber: data.routingNumber || '',
        swift: data.swift || '',
        iban: data.iban || '',
        depositInstructions: data.depositInstructions || '',
        minimumDeposit: String(data.minimumDeposit ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deposit details.');
    }
  }, [onLoadAccount]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSaveSettings({
        escrowFeePercent: Number(escrowPercent),
        fanCardPrices: {
          silver: Number(prices.silver),
          gold: Number(prices.gold),
          platinum: Number(prices.platinum),
        },
      });
      await onSaveAccount({
        ...account,
        minimumDeposit: Number(account.minimumDeposit || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={saveAll} className="space-y-6">
      <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-zinc-950">Escrow & Fan Card Pricing</h2>
        <p className="text-xs text-zinc-500 mt-1">Applied to every new deposit request.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
          <Field label="Escrow fee %">
            <input type="number" min={0} max={50} step="0.5" className={inputClass} value={escrowPercent} onChange={(e) => setEscrowPercent(e.target.value)} />
          </Field>
          {(['silver', 'gold', 'platinum'] as FanCardTier[]).map((tier) => (
            <Field key={tier} label={`${tier.toUpperCase()} Fan Card`}>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={prices[tier]}
                onChange={(e) => setPrices((prev) => ({ ...prev, [tier]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-5 h-5 text-zinc-500" />
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-950">Bank Deposit Details</h2>
            <p className="text-xs text-zinc-500">Clients see masked numbers and your instructions at checkout.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Bank name">
            <input className={inputClass} value={account.bankName || ''} onChange={(e) => setAccount({ ...account, bankName: e.target.value })} />
          </Field>
          <Field label="Account holder">
            <input className={inputClass} value={account.accountHolder || ''} onChange={(e) => setAccount({ ...account, accountHolder: e.target.value })} />
          </Field>
          <Field label="Account number">
            <input className={inputClass} value={account.accountNumber || ''} onChange={(e) => setAccount({ ...account, accountNumber: e.target.value })} placeholder="Stored encrypted" />
          </Field>
          <Field label="Routing number">
            <input className={inputClass} value={account.routingNumber || ''} onChange={(e) => setAccount({ ...account, routingNumber: e.target.value })} placeholder="Stored encrypted" />
          </Field>
          <Field label="SWIFT">
            <input className={inputClass} value={account.swift || ''} onChange={(e) => setAccount({ ...account, swift: e.target.value })} />
          </Field>
          <Field label="IBAN (optional)">
            <input className={inputClass} value={account.iban || ''} onChange={(e) => setAccount({ ...account, iban: e.target.value })} placeholder="Stored encrypted" />
          </Field>
          <Field label="Minimum deposit">
            <input type="number" min={0} className={inputClass} value={account.minimumDeposit || '0'} onChange={(e) => setAccount({ ...account, minimumDeposit: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Deposit instructions">
              <textarea rows={4} className={inputClass} value={account.depositInstructions || ''} onChange={(e) => setAccount({ ...account, depositInstructions: e.target.value })} />
            </Field>
          </div>
        </div>

        {escrowDepositInfo && (
          <div className="mt-6 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Client preview</p>
            <p className="text-sm font-semibold text-zinc-950">{escrowDepositInfo.bankName}</p>
            <p className="text-xs text-zinc-600">{escrowDepositInfo.accountHolder}</p>
            <p className="text-xs font-mono text-zinc-600">
              Account •••• {escrowDepositInfo.accountNumberLast4} · Routing •••• {escrowDepositInfo.routingNumberLast4}
            </p>
            <p className="text-xs text-zinc-600 mt-2 whitespace-pre-wrap">{escrowDepositInfo.depositInstructions}</p>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save deposit settings'}
        </button>
      </div>
    </form>
  );
};

/* ---------------- Approvals ---------------- */

const ApprovalsTab: React.FC<{
  getAdminDeposits: (status?: string) => Promise<AdminDepositItem[]>;
  approveDeposit: (type: 'booking' | 'fancard', id: string, cardImageUrl?: string) => Promise<void>;
  rejectDeposit: (type: 'booking' | 'fancard', id: string, reason: string) => Promise<void>;
  uploadMediaFile: (file: File) => Promise<{ url: string; mediaType: 'image' | 'video' | 'document' }>;
}> = ({ getAdminDeposits, approveDeposit, rejectDeposit, uploadMediaFile }) => {
  const [status, setStatus] = useState('pending_review');
  const [items, setItems] = useState<AdminDepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [reason, setReason] = useState('');
  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getAdminDeposits(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deposits.');
    } finally {
      setLoading(false);
    }
  }, [getAdminDeposits, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: AdminDepositItem) => {
    setBusyId(item.id);
    setError('');
    try {
      if (item.type === 'fancard' && !cardImages[item.id]) {
        throw new Error('Upload the official Fan Card image first.');
      }
      await approveDeposit(item.type, item.id, cardImages[item.id]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve deposit.');
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (item: AdminDepositItem) => {
    setBusyId(item.id);
    setError('');
    try {
      await rejectDeposit(item.type, item.id, reason);
      setRejectingId('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject deposit.');
    } finally {
      setBusyId('');
    }
  };

  const handleCardImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMediaFile(file);
      setCardImages((prev) => ({ ...prev, [id]: result.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
    e.target.value = '';
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-950">Deposit Approvals</h2>
          <p className="text-xs text-zinc-500 mt-1">Review bank transfer proof for bookings and Fan Cards.</p>
        </div>
        <select className={`${inputClass} sm:w-52`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="px-6 py-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="p-8 text-sm text-zinc-500">Loading deposits…</p>
      ) : items.length === 0 ? (
        <p className="p-8 text-sm text-zinc-500">No deposits in this view.</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-zinc-100 text-zinc-600">
                    {item.type === 'booking' ? 'Booking' : 'Fan Card'}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{item.reference}</span>
                  <span
                    className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                      item.approvalStatus === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.approvalStatus === 'rejected'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.approvalStatus.replace('_', ' ')}
                  </span>
                </div>
                <p className="font-semibold text-zinc-950">{item.title}</p>
                <p className="text-xs text-zinc-500">
                  {item.client} · {item.contactEmail}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600">
                  <span>
                    Expected: <strong className="font-mono">${item.expectedAmount.toLocaleString()}</strong>
                  </span>
                  <span>
                    Submitted: <strong className="font-mono">${item.submittedAmount.toLocaleString()}</strong>
                  </span>
                  {item.referenceNote && <span>Ref: {item.referenceNote}</span>}
                </div>
                {item.note && <p className="text-xs text-zinc-500">Note: {item.note}</p>}
                <a href={item.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                  <ImageIcon className="w-4 h-4" /> View deposit proof
                </a>
                {item.type === 'fancard' && item.approvalStatus === 'pending_review' && (
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-950">
                      <Upload className="w-4 h-4" /> Upload official card image
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleCardImage(item.id, e)} />
                    </label>
                    {cardImages[item.id] && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
                        <Check className="w-4 h-4" /> Card image ready
                        <SafeImage src={cardImages[item.id]} alt="Card preview" className="w-14 h-9 rounded object-cover border border-zinc-200" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {item.approvalStatus === 'pending_review' && (
                <div className="flex flex-col sm:items-end gap-2">
                  {rejectingId === item.id ? (
                    <div className="w-full sm:w-72 space-y-2">
                      <textarea
                        rows={2}
                        className={inputClass}
                        placeholder="Rejection reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReject(item)}
                          disabled={busyId === item.id || reason.trim().length < 3}
                          className="px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg disabled:opacity-50 cursor-pointer"
                        >
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId('');
                            setReason('');
                          }}
                          className="px-3 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(item.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-xl hover:border-red-500 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/* ---------------- Users & KYC ---------------- */

const UsersTab: React.FC<{ pushToast: ReturnType<typeof usePlatform>['pushToast'] }> = ({ pushToast }) => {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = (await res.json().catch(() => ({}))) as { users?: AdminUserView[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not load registered users.');
      setUsers(data.users || []);
    } catch (err) {
      pushToast('Unable to Load Users', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const decideKyc = async (user: AdminUserView, decision: 'approve' | 'reject') => {
    setBusyEmail(user.email);
    try {
      const res = await fetch('/api/admin/users/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { kyc?: AdminUserView['kyc']; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not update KYC.');
      if (data.kyc) {
        setUsers((current) =>
          current.map((item) => (item.email === user.email ? { ...item, kyc: data.kyc! } : item))
        );
      }
      pushToast(
        decision === 'approve' ? 'KYC Approved' : 'KYC Rejected',
        `${user.fullName || user.email} has been updated.`,
        'success'
      );
    } catch (err) {
      pushToast('KYC Update Failed', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setBusyEmail('');
    }
  };

  const statusLabel = (status: AdminUserView['kyc']['status']) =>
    status === 'verified' ? 'Verified' : status === 'pending_review' ? 'Pending review' : 'Unverified';
  const statusClass = (status: AdminUserView['kyc']['status']) =>
    status === 'verified'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'pending_review'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-zinc-100 text-zinc-600 border-zinc-200';
  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '—');

  if (loading) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Loading registered users…</div>;
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
        No registered users yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-950">Registered Users</h2>
          <p className="mt-1 text-xs text-zinc-500">Review KYC submissions and approve verified accounts.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="px-3 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:border-zinc-950 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {users.map((user) => {
        const documentUrl = user.kyc.documentFileUrl || '';
        const isImage = /\.(png|jpe?g|webp)$/i.test(documentUrl);
        const busy = busyEmail === user.email;
        return (
          <div key={user.email} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-950 truncate">{user.fullName || user.email}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {user.companyName ? `${user.companyName} · ` : ''}
                  Joined {formatDate(user.signupDate)} · Last login {formatDate(user.lastLoginAt)}
                </p>
              </div>
              <span
                className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusClass(user.kyc.status)}`}
              >
                {statusLabel(user.kyc.status)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className={labelClass}>Legal name</p>
                <p className="font-medium text-zinc-800 truncate">{user.kyc.legalName || '—'}</p>
              </div>
              <div>
                <p className={labelClass}>Document</p>
                <p className="font-medium text-zinc-800 truncate">{user.kyc.documentType || '—'}</p>
              </div>
              <div>
                <p className={labelClass}>Number</p>
                <p className="font-medium text-zinc-800 truncate">{user.kyc.documentNumberMasked || '—'}</p>
              </div>
              <div>
                <p className={labelClass}>Expiry</p>
                <p className="font-medium text-zinc-800">{user.kyc.documentExpiry || '—'}</p>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <p className={labelClass}>Issuing country</p>
                <p className="font-medium text-zinc-800">{user.kyc.issuingCountry || '—'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className={labelClass}>KYC document</p>
              {documentUrl ? (
                <>
                  {isImage && (
                    <SafeImage
                      src={documentUrl}
                      alt={`KYC document for ${user.fullName || user.email}`}
                      fallbackText="KYC"
                      className="h-32 w-full object-cover rounded-xl border border-zinc-200"
                    />
                  )}
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open document ↗
                  </a>
                </>
              ) : (
                <p className="text-xs text-amber-700">No document uploaded — approval is blocked.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={busy || !documentUrl || user.kyc.status === 'verified'}
                onClick={() => void decideKyc(user, 'approve')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" /> Approve KYC
              </button>
              <button
                type="button"
                disabled={busy || user.kyc.status === 'unverified'}
                onClick={() => void decideKyc(user, 'reject')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:border-zinc-950 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" /> Reject / Reset
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------------- Admin messages ---------------- */

const AdminMessagesTab: React.FC<{
  threads: ReturnType<typeof usePlatform>['threads'];
  messages: ReturnType<typeof usePlatform>['messages'];
  onRead: (threadId: string) => void;
  onSend: (input: { threadId?: string; talentId?: string; body: string; senderMode: 'celebrity' | 'manager' }) => void;
}> = ({ threads, messages, onRead, onSend }) => {
  const [selectedId, setSelectedId] = useState('');
  const [body, setBody] = useState('');
  const [senderMode, setSenderMode] = useState<'celebrity' | 'manager'>('celebrity');
  const [query, setQuery] = useState('');
  const { talents } = usePlatform();

  const filtered = useMemo(
    () =>
      threads.filter((thread) => {
        if (!query.trim()) return true;
        const talent = resolveThreadTalent(talents, thread.talentId);
        return `${thread.clientCompany} ${thread.subject} ${talent?.name || ''}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [threads, talents, query]
  );

  const selected = threads.find((thread) => thread.id === selectedId) || filtered[0];
  const threadTalent = resolveThreadTalent(talents, selected?.talentId);
  const threadMessages = useMemo(
    () => messages.filter((m) => m.threadId === selected?.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, selected?.id]
  );

  useEffect(() => {
    if (selected) onRead(selected.id);
  }, [selected?.id, onRead]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !selected) return;
    onSend({ threadId: selected.id, talentId: selected.talentId, body: body.trim(), senderMode });
    setBody('');
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] h-[calc(100dvh-180px)] min-h-[520px]">
        <div className="border-r border-zinc-100 flex flex-col">
          <div className="p-4 border-b border-zinc-100">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all conversations…"
              className={inputClass}
            />
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100">
            {filtered.map((thread) => {
              const talent = resolveThreadTalent(talents, thread.talentId);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  className={`w-full text-left p-4 cursor-pointer transition-colors ${
                    selected?.id === thread.id ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{talent?.name || thread.clientCompany}</p>
                    {thread.unreadForAdmin > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-600 text-white">{thread.unreadForAdmin}</span>
                    )}
                  </div>
                  <p className={`text-xs truncate mt-1 ${selected?.id === thread.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {thread.lastMessagePreview}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">{threadTalent?.name || 'Celebrity'}</p>
                  <p className="text-xs text-zinc-500">
                    {selected.talentId === SUPPORT_TALENT.id
                      ? 'Client support conversation'
                      : `${selected.clientCompany} · ${selected.subject}`}
                  </p>
                </div>
                <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
                  {(['celebrity', 'manager'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSenderMode(mode)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                        senderMode === mode ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
                      }`}
                    >
                      {mode === 'celebrity' ? 'As Celebrity' : 'As Management'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-3 bg-zinc-50/50">
                {threadMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.senderRole === 'client' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                        message.senderRole === 'client'
                          ? 'bg-white border border-zinc-200 text-zinc-800'
                          : 'bg-zinc-950 text-white'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{message.senderName}</p>
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={send} className="p-4 border-t border-zinc-100 flex items-end gap-2">
                <textarea
                  rows={2}
                  className={`${inputClass} resize-none max-h-32`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={`Reply as ${senderMode === 'celebrity' ? threadTalent?.name || 'celebrity' : 'management'}…`}
                />
                <button
                  type="submit"
                  disabled={!body.trim()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              <Inbox className="w-5 h-5 mr-2" /> No conversations yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
