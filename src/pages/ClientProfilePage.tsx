import React, { useEffect, useState } from 'react';
import { Building2, Check, Globe, Mail, Save } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { BudgetRange } from '../types.ts';

const EVENT_TYPE_OPTIONS = [
  'Executive Keynote',
  'Brand Campaign',
  'Private Gala',
  'Editorial Shoot',
  'Private Acoustic Performance',
  'Hospitality Advisory',
  'Charity Appearance',
];

const BUDGET_RANGES: BudgetRange[] = [
  '$15,000 – $30,000',
  '$30,000 – $75,000',
  '$75,000 – $150,000',
  '$150,000+',
];

export const ClientProfilePage: React.FC = () => {
  const { clientProfile, updateClientProfile, bookings, pushToast, navigate } = usePlatform();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [website, setWebsite] = useState('');
  const [billingEntity, setBillingEntity] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [preferredBudgetRange, setPreferredBudgetRange] = useState<BudgetRange>('$30,000 – $75,000');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    if (clientProfile) {
      setCompanyName(clientProfile.companyName);
      setContactName(clientProfile.contactName);
      setContactEmail(clientProfile.contactEmail);
      setIndustry(clientProfile.industry);
      setHeadquarters(clientProfile.headquarters);
      setWebsite(clientProfile.website);
      setBillingEntity(clientProfile.billingEntity);
      setEventTypes(clientProfile.eventTypes);
      setPreferredBudgetRange(clientProfile.preferredBudgetRange);
      setNotes(clientProfile.notes);
    }
  }, [clientProfile]);

  const toggleEventType = (ev: string) => {
    setEventTypes((prev) => (prev.includes(ev) ? prev.filter((item) => item !== ev) : [...prev, ev]));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const updated = await updateClientProfile({
        companyName,
        contactName,
        contactEmail,
        industry,
        headquarters,
        website,
        billingEntity,
        eventTypes,
        preferredBudgetRange,
        notes,
      });
      setSavedAt(new Date(updated.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      pushToast('Client Profile Saved', `${updated.companyName} details updated for future booking inquiries.`, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save client profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs text-zinc-500">Client Account &amp; Production Brief</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
            Client Organization Profile
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Company credentials, preferred event formats, and budget range shared with talent representation on inquiries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/roster')}
          className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
        >
          Browse Roster
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSave} className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">{errorMsg}</div>
          )}

          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-zinc-950">Company Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Company Name *</span>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Industry / Sector</span>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Primary Contact Name *</span>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Contact Email *</span>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Headquarters</span>
                <input
                  type="text"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700">Company Website</span>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-zinc-700">Billing Legal Entity</span>
                <input
                  type="text"
                  value={billingEntity}
                  onChange={(e) => setBillingEntity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-zinc-950">Type of Events</h2>
            <p className="text-xs text-zinc-500">Select all engagement formats your organization commissions.</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPE_OPTIONS.map((ev) => {
                const active = eventTypes.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEventType(ev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-950'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{ev}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-zinc-950">Budget Range</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUDGET_RANGES.map((range) => {
                const active = preferredBudgetRange === range;
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setPreferredBudgetRange(range)}
                    className={`px-4 py-3 text-left rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
                    }`}
                  >
                    <p className="font-mono tabular-nums text-xs font-semibold">{range}</p>
                    <p className={`text-[11px] mt-0.5 ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      Typical per-engagement allocation
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-6 space-y-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">Production &amp; Rider Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              {savedAt ? `Saved at ${savedAt}` : 'Changes pre-fill booking requests automatically'}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">{companyName || 'Company Profile'}</h3>
                <p className="text-xs text-zinc-500">{industry || 'Organization'}</p>
              </div>
            </div>

            <dl className="space-y-2.5 text-xs border-t border-zinc-100 pt-4">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Contact</dt>
                <dd className="font-medium text-zinc-950 text-right">{contactName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </dt>
                <dd className="font-medium text-zinc-950 truncate max-w-[180px]">{contactEmail}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Budget Range</dt>
                <dd className="font-mono tabular-nums font-semibold text-zinc-950">{preferredBudgetRange}</dd>
              </div>
              {website && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 inline-flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Web
                  </dt>
                  <dd className="font-medium text-blue-600 truncate max-w-[180px]">{website}</dd>
                </div>
              )}
            </dl>

            <div className="border-t border-zinc-100 pt-4">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Commissioned Formats</p>
              <p className="text-xs text-zinc-700 leading-relaxed">
                {eventTypes.length > 0 ? eventTypes.join(' · ') : 'None selected'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-950">Account Activity</h3>
            <p className="text-xs text-zinc-600">
              {bookings.length} active or historical booking records associated with {companyName || 'this account'}.
            </p>
            <button
              type="button"
              onClick={() => navigate('/bookings')}
              className="w-full px-4 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer transition-colors"
            >
              View Booking Ledger
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
