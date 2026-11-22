import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Save,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { FanCard, UserAccountProfile } from '../types.ts';

type SettingsTab = 'profile' | 'kyc' | 'security' | 'fancards' | 'preferences';

type FanCardState = { label: string; badgeClass: string; active: boolean };

const fanCardStateFor = (fc: FanCard): FanCardState => {
  if (fc.approvalStatus === 'rejected' || fc.paymentStatus === 'rejected') {
    return { label: 'Deposit rejected', badgeClass: 'bg-red-50 text-red-600', active: false };
  }
  if (fc.approvalStatus === 'pending_review' || fc.paymentStatus === 'submitted') {
    return { label: 'Deposit pending review', badgeClass: 'bg-amber-50 text-amber-700', active: false };
  }
  if (fc.active && fc.approvalStatus === 'approved' && fc.paymentStatus === 'paid') {
    return { label: 'Active', badgeClass: 'bg-emerald-50 text-emerald-700', active: true };
  }
  return { label: 'Awaiting activation', badgeClass: 'bg-zinc-100 text-zinc-600', active: false };
};

const hasKycDocumentOnFile = (kyc: UserAccountProfile['kyc'] | undefined): boolean =>
  Boolean(kyc?.documentFileUrl);

export const ManagerDashboardPage: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
  const {
    userAccount,
    bookings,
    fanCards,
    talents,
    updateUserAccount,
    updateUserPassword,
    uploadMediaFile,
    navigate,
    pushToast,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab === 'fancards' || initialTab === 'kyc' || initialTab === 'security' || initialTab === 'preferences'
      ? initialTab
      : 'profile'
  );
  const panelRef = useRef<HTMLElement | null>(null);

  // Personal & Signup Details
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  // KYC Details
  const [legalName, setLegalName] = useState('');
  const [documentType, setDocumentType] = useState<UserAccountProfile['kyc']['documentType']>('Passport');
  const [kycDocumentNumber, setKycDocumentNumber] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [issuingCountry, setIssuingCountry] = useState('');
  const [documentFileUrl, setDocumentFileUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Security & Login
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Preferences
  const [bookingAlerts, setBookingAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [fanCardPerks, setFanCardPerks] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const ownerEmail = userAccount?.email?.toLowerCase() || '';
  const ownedFanCards = fanCards.filter((fc) => {
    if (!ownerEmail) return false;
    return (fc.ownerKey || fc.holderEmail || '').toLowerCase() === ownerEmail;
  });
  const activeFanCards = ownedFanCards.filter((fc) => fanCardStateFor(fc).active);
  const pendingFanCards = ownedFanCards.filter(
    (fc) => fc.approvalStatus === 'pending_review' || fc.paymentStatus === 'submitted',
  );

  const hasKycDocument = hasKycDocumentOnFile(userAccount?.kyc);
  const kycVerified = userAccount?.kyc.status === 'verified' && hasKycDocument;

  useEffect(() => {
    if (!userAccount) return;
    setFullName(userAccount.fullName);
    setUsername(userAccount.username);
    setEmail(userAccount.email);
    setPhone(userAccount.phone);
    setDateOfBirth(userAccount.dateOfBirth);
    setAddressLine(userAccount.addressLine);
    setCity(userAccount.city);
    setPostalCode(userAccount.postalCode);
    setCountry(userAccount.country);
    setTimezone(userAccount.timezone);

    setLegalName(userAccount.kyc.legalName);
    setDocumentType(userAccount.kyc.documentType);
    setDocumentExpiry(userAccount.kyc.documentExpiry);
    setIssuingCountry(userAccount.kyc.issuingCountry);
    setDocumentFileUrl(userAccount.kyc.documentFileUrl || '');

    setTwoFactorEnabled(userAccount.twoFactorEnabled);
    setBookingAlerts(userAccount.preferences.bookingAlerts);
    setMessageAlerts(userAccount.preferences.messageAlerts);
    setFanCardPerks(userAccount.preferences.fanCardPerks);
    setMarketingEmails(userAccount.preferences.marketingEmails);
  }, [userAccount]);

  const selectTab = (tab: SettingsTab, scrollOnMobile = false) => {
    setActiveTab(tab);
    if (scrollOnMobile && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  };

  const handleSaveAccount = async (e?: React.FormEvent, overrideTwoFactor?: boolean) => {
    if (e) e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const kycDetailsChanged =
        Boolean(kycDocumentNumber.trim()) ||
        legalName !== userAccount?.kyc.legalName ||
        documentType !== userAccount?.kyc.documentType ||
        documentExpiry !== userAccount?.kyc.documentExpiry ||
        issuingCountry !== userAccount?.kyc.issuingCountry ||
        (documentFileUrl || undefined) !== userAccount?.kyc.documentFileUrl;
      const nextKycStatus = kycDetailsChanged ? 'pending_review' : userAccount?.kyc.status || 'unverified';
      await updateUserAccount({
        fullName,
        username,
        email,
        phone,
        dateOfBirth,
        addressLine,
        city,
        postalCode,
        country,
        timezone,
        twoFactorEnabled: overrideTwoFactor !== undefined ? overrideTwoFactor : twoFactorEnabled,
        kycDocumentNumber: kycDocumentNumber.trim() || undefined,
        kyc: {
          status: nextKycStatus,
          legalName,
          documentType,
          documentNumberMasked: userAccount?.kyc.documentNumberMasked || '•••• 0000',
          documentExpiry,
          issuingCountry,
          documentFileUrl: documentFileUrl || undefined,
        },
        preferences: {
          bookingAlerts,
          messageAlerts,
          fanCardPerks,
          marketingEmails,
        },
      });
      setKycDocumentNumber('');
      pushToast('Settings Saved', 'Your profile, KYC, and account preferences are up to date.', 'success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save account settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle2FA = async () => {
    const next = !twoFactorEnabled;
    setTwoFactorEnabled(next);
    await handleSaveAccount(undefined, next);
  };

  const handleUploadKycDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const { url } = await uploadMediaFile(file);
      setDocumentFileUrl(url);
      pushToast('Document Uploaded', 'ID image attached. Click Save KYC Details to confirm.', 'success');
    } catch (err) {
      pushToast('Upload Failed', err instanceof Error ? err.message : 'Unable to upload document.', 'error');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      pushToast('Password Updated', 'Your login password has been updated securely.', 'success');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const kycLabel = !hasKycDocument
    ? 'Not verified'
    : userAccount?.kyc.status === 'verified'
      ? 'Verified'
      : userAccount?.kyc.status === 'pending_review'
        ? 'Pending Review'
        : 'Not verified';

  const navItems: Array<{ id: SettingsTab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'profile', label: 'Personal & Signup', icon: <User className="w-4 h-4" /> },
    { id: 'kyc', label: 'KYC & Identity', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'security', label: 'Login & Security', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'fancards', label: 'Official Fan Cards', count: activeFanCards.length, icon: <CreditCard className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Bell className="w-4 h-4" /> },
  ];

  const inputClass =
    'w-full px-3.5 py-2 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 transition-colors';

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Clean Typographic User Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-zinc-950 text-white font-display text-lg font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight truncate">
              {fullName || 'Account Settings'}
            </h1>
            <p className="mt-1 text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-zinc-700">@{username || 'member'}</span>
              <span aria-hidden="true">·</span>
              <span>{email}</span>
              <span aria-hidden="true">·</span>
              <span>
                Member since <span className="font-mono tabular-nums">{userAccount?.signupDate || '2025-09-18'}</span>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
          >
            View Bookings
          </button>
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
          >
            Browse Roster
          </button>
        </div>
      </div>

      {/* Interactive 4-Column Account Status Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => selectTab('kyc', true)}
          className={`text-left p-5 transition-colors cursor-pointer ${
            activeTab === 'kyc'
              ? 'bg-zinc-50 border-b-2 border-blue-600'
              : 'bg-white hover:bg-zinc-50/80 border-b-2 border-transparent'
          }`}
        >
          <p className={`text-xs ${activeTab === 'kyc' ? 'text-blue-600 font-semibold' : 'text-zinc-500'}`}>
            Identity (KYC)
          </p>
          <p className="mt-1 font-display text-lg font-bold text-zinc-950 inline-flex items-center gap-1.5">
            {kycVerified && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{kycLabel}</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
            {documentType} {userAccount?.kyc.documentNumberMasked || '••••'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => selectTab('security', true)}
          className={`text-left p-5 transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'bg-zinc-50 border-b-2 border-blue-600'
              : 'bg-white hover:bg-zinc-50/80 border-b-2 border-transparent'
          }`}
        >
          <p className={`text-xs ${activeTab === 'security' ? 'text-blue-600 font-semibold' : 'text-zinc-500'}`}>
            Login Security
          </p>
          <p className="mt-1 font-display text-lg font-bold text-zinc-950">
            {twoFactorEnabled ? '2FA Enabled' : 'Standard'}
          </p>
          <p className="mt-0.5 font-mono tabular-nums text-[11px] text-zinc-500">
            Last sign-in{' '}
            {userAccount?.lastLoginAt ? new Date(userAccount.lastLoginAt).toLocaleDateString() : 'Today'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/bookings')}
          className="text-left p-5 bg-white hover:bg-zinc-50/80 border-b-2 border-transparent transition-colors cursor-pointer"
        >
          <p className="text-xs text-zinc-500">Bookings &amp; Inquiries</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-bold text-zinc-950">{bookings.length}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Active &amp; historical</p>
        </button>

        <button
          type="button"
          onClick={() => selectTab('fancards', true)}
          className={`text-left p-5 transition-colors cursor-pointer ${
            activeTab === 'fancards'
              ? 'bg-zinc-50 border-b-2 border-blue-600'
              : 'bg-white hover:bg-zinc-50/80 border-b-2 border-transparent'
          }`}
        >
          <p className={`text-xs ${activeTab === 'fancards' ? 'text-blue-600 font-semibold' : 'text-zinc-500'}`}>
            Official Fan Cards
          </p>
          <p className="mt-1 font-mono tabular-nums text-lg font-bold text-zinc-950">{activeFanCards.length}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Active memberships</p>
        </button>
      </div>

      {/* Main Settings Layout: Left Nav List + Single Flat White List Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 space-y-6">
          <nav className="space-y-1" aria-label="Account settings">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2.5 transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-zinc-950 border border-zinc-200 font-semibold'
                      : 'text-zinc-600 border border-transparent hover:text-zinc-950 hover:bg-zinc-100/80'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className={active ? 'text-blue-600' : 'text-zinc-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span className="font-mono tabular-nums text-[11px] text-zinc-500">{item.count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-zinc-200 pt-5 px-2 space-y-2.5 text-xs">
            <p className="font-semibold text-zinc-950">Signup Record</p>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Date of Birth</dt>
                <dd className="font-mono tabular-nums text-zinc-800">{dateOfBirth || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Joined</dt>
                <dd className="font-mono tabular-nums text-zinc-800">{userAccount?.signupDate || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Timezone</dt>
                <dd className="font-mono text-zinc-800 truncate max-w-[130px]">{timezone}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <section ref={panelRef} className="lg:col-span-9 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          {formError && (
            <div className="mx-6 sm:mx-8 mt-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {formError}
            </div>
          )}

          {/* TAB 1: PERSONAL & SIGNUP */}
          {activeTab === 'profile' && (
            <form onSubmit={(e) => handleSaveAccount(e)} className="divide-y divide-zinc-200">
              <div className="px-6 sm:px-8 py-6">
                <h2 className="font-display text-lg font-bold text-zinc-950">Personal &amp; Signup Information</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Core details registered on your account for login, verification, and booking confirmations.
                </p>
              </div>

              <div className="divide-y divide-zinc-100">
                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Full Name</p>
                    <p className="text-[11px] text-zinc-500">Shown on inquiries and Fan Cards</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Username</p>
                    <p className="text-[11px] text-zinc-500">Unique account handle</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Login Email Address</p>
                    <p className="text-[11px] text-zinc-500">Primary email for sign-in &amp; receipts</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Phone Number</p>
                    <p className="text-[11px] text-zinc-500">Used for booking &amp; security alerts</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Date of Birth</p>
                    <p className="text-[11px] text-zinc-500">Required for age &amp; KYC match</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Street Address</p>
                    <p className="text-[11px] text-zinc-500">Billing &amp; residential street</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">City, Postal Code &amp; Country</p>
                    <p className="text-[11px] text-zinc-500">Regional billing location</p>
                  </div>
                  <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="City / State"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                    <input
                      type="text"
                      placeholder="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-4 bg-zinc-50/70 flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">
                  Account created <span className="font-mono tabular-nums">{userAccount?.signupDate || '2025-09-18'}</span>
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: KYC & IDENTITY (CLEAN LIST) */}
          {activeTab === 'kyc' && (
            <form onSubmit={(e) => handleSaveAccount(e)} className="divide-y divide-zinc-200">
              <div className="px-6 sm:px-8 py-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-zinc-950">KYC &amp; Identity Verification</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Identity records required for protected escrow bookings and Official Fan Card issuance.
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    kycVerified
                      ? 'text-emerald-700'
                      : hasKycDocument && userAccount?.kyc.status === 'pending_review'
                        ? 'text-amber-700'
                        : 'text-zinc-500'
                  }`}
                >
                  {kycVerified && <CheckCircle2 className="w-4 h-4" />}
                  <span>{kycLabel}</span>
                </div>
              </div>

              <ul className="divide-y divide-zinc-100">
                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Verification Status</p>
                    <p className="text-[11px] text-zinc-500">Current compliance review state</p>
                  </div>
                  <div className="sm:col-span-8 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-zinc-950 inline-flex items-center gap-1.5">
                      {kycVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{kycLabel}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-zinc-500">
                      {userAccount?.kyc.submittedAt
                        ? `Submitted ${new Date(userAccount.kyc.submittedAt).toLocaleDateString()}`
                        : hasKycDocument
                          ? 'On file'
                          : 'No document on file'}
                    </span>
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Legal Full Name</p>
                    <p className="text-[11px] text-zinc-500">Exact name shown on your government ID</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      required
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Document Type</p>
                    <p className="text-[11px] text-zinc-500">Accepted government-issued ID</p>
                  </div>
                  <div className="sm:col-span-8">
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as UserAccountProfile['kyc']['documentType'])}
                      className={inputClass}
                    >
                      <option value="Passport">Passport</option>
                      <option value="Drivers License">Driver&apos;s License</option>
                      <option value="National ID">National ID Card</option>
                    </select>
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Document Number</p>
                    <p className="text-[11px] text-zinc-500">
                      On file: <span className="font-mono text-zinc-700">{userAccount?.kyc.documentNumberMasked || 'None'}</span>
                    </p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={kycDocumentNumber}
                      onChange={(e) => setKycDocumentNumber(e.target.value)}
                      placeholder="Enter new ID number to update"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Issuing Country</p>
                    <p className="text-[11px] text-zinc-500">Country or jurisdiction of issue</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      required
                      value={issuingCountry}
                      onChange={(e) => setIssuingCountry(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Document Expiry Date</p>
                    <p className="text-[11px] text-zinc-500">Must be valid &amp; unexpired</p>
                  </div>
                  <div className="sm:col-span-8">
                    <input
                      type="date"
                      value={documentExpiry}
                      onChange={(e) => setDocumentExpiry(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Photo ID Scan</p>
                    <p className="text-[11px] text-zinc-500">
                      {documentFileUrl ? 'Document image attached and encrypted' : 'JPG, PNG, or WebP scan'}
                    </p>
                  </div>
                  <div className="sm:col-span-8 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-600 truncate">
                      {documentFileUrl ? 'Verified ID attachment ready' : 'No new file uploaded'}
                    </span>
                    <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDoc ? 'Uploading...' : documentFileUrl ? 'Replace ID' : 'Upload ID'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUploadKycDoc}
                        disabled={uploadingDoc}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </li>
              </ul>

              <div className="px-6 sm:px-8 py-4 bg-zinc-50/70 flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">Only masked last-4 digits are displayed or retained.</span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save KYC Details'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LOGIN & SECURITY (CLEAN LIST) */}
          {activeTab === 'security' && (
            <div className="divide-y divide-zinc-200">
              <div className="px-6 sm:px-8 py-6">
                <h2 className="font-display text-lg font-bold text-zinc-950">Login &amp; Security</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Review your sign-in credentials, two-factor authentication, and password security settings.
                </p>
              </div>

              <ul className="divide-y divide-zinc-100">
                <li className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">Primary Login Email</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Used to sign in and receive security notices</p>
                  </div>
                  <span className="font-mono text-xs text-zinc-800">{email || '—'}</span>
                </li>

                <li className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">Account Handle</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Registered username on your profile</p>
                  </div>
                  <span className="font-mono text-xs text-zinc-800">@{username || 'member'}</span>
                </li>

                <li className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">Two-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Extra verification step on new device sign-ins and escrow approvals
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggle2FA}
                    disabled={saving}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                      twoFactorEnabled
                        ? 'bg-zinc-950 text-white border-zinc-950 hover:bg-blue-600 hover:border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-950'
                    }`}
                  >
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </li>

                <li className="px-6 sm:px-8 py-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-950">Login Password</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Salted scrypt credential · <span className="font-mono">••••••••••••</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm((v) => !v);
                        setPasswordError('');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer transition-colors shrink-0"
                    >
                      {showPasswordForm ? 'Cancel' : 'Change Password'}
                    </button>
                  </div>

                  {showPasswordForm && (
                    <form onSubmit={handlePasswordChange} className="pt-3 border-t border-zinc-100 space-y-4">
                      {passwordError && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                          {passwordError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-zinc-700">Current Password</span>
                          <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className={inputClass}
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-zinc-700">New Password</span>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={inputClass}
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-zinc-700">Confirm Password</span>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={inputClass}
                          />
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingPassword}
                          className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          {savingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  )}
                </li>

                <li className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">Last Sign-In Activity</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Most recent authenticated browser session</p>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-zinc-700">
                    {userAccount?.lastLoginAt ? new Date(userAccount.lastLoginAt).toLocaleString() : 'Active now'}
                  </span>
                </li>

                <li className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">Account Registered</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Original signup date</p>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-zinc-700">
                    {userAccount?.signupDate || '2025-09-18'}
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* TAB 4: OFFICIAL FAN CARDS (DEDICATED LIST) */}
          {activeTab === 'fancards' && (
            <div className="divide-y divide-zinc-200">
              <div className="px-6 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-zinc-950">
                    Official Fan Cards ({activeFanCards.length} active)
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Approved celebrity membership passes issued to your account.
                    {pendingFanCards.length > 0 && ` ${pendingFanCards.length} deposit(s) awaiting admin review.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/roster')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer transition-colors"
                >
                  <span>Get New Fan Card</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {ownedFanCards.length === 0 ? (
                <div className="px-6 sm:px-8 py-12 text-center space-y-3">
                  <CreditCard className="w-6 h-6 text-zinc-400 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-950">No Official Fan Cards yet</p>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    Visit any celebrity profile in the Roster and select Get Official Fan Card to issue a Silver, Gold, or Platinum pass.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/roster')}
                      className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer transition-colors"
                    >
                      Browse Roster
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {ownedFanCards.map((fc) => {
                    const matchedTalent = talents.find((t) => t.id === fc.talentId);
                    const cardState = fanCardStateFor(fc);
                    return (
                      <li
                        key={fc.id}
                        className="px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {fc.cardImageUrl && (
                            <SafeImage
                              src={fc.cardImageUrl}
                              alt={`${fc.talentName} ${fc.tier} Fan Card`}
                              fallbackText={fc.talentName}
                              className="w-20 h-12 rounded-lg object-cover border border-zinc-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-zinc-950">{fc.talentName}</span>
                              <span className="text-xs text-zinc-500 capitalize">· {fc.tier} Pass</span>
                              <span className="font-mono tabular-nums text-xs text-zinc-700">${fc.annualFee}/yr</span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${cardState.badgeClass}`}
                              >
                                {cardState.label}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500">Holder: {fc.holderName}</p>
                            {!cardState.active && fc.deposit && (
                              <p className="text-[11px] text-zinc-500">
                                Deposit submitted:{' '}
                                <span className="font-mono tabular-nums font-semibold text-zinc-700">
                                  ${fc.deposit.submittedAmount.toLocaleString('en-US')} USD
                                </span>
                                <span aria-hidden="true"> · </span>
                                <a
                                  href={fc.deposit.proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-blue-600 hover:underline"
                                >
                                  View proof
                                </a>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="font-mono tabular-nums text-xs font-medium text-zinc-950">
                              {cardState.active
                                ? `Exp ${fc.validUntil}`
                                : cardState.label === 'Deposit rejected'
                                  ? `Rejected · ${fc.validUntil}`
                                  : `Pending · ${fc.validUntil}`}
                            </p>
                            <p className="font-mono tabular-nums text-[11px] text-zinc-400">
                              {cardState.active ? 'Issued' : 'Submitted'}{' '}
                              {new Date(fc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {matchedTalent && (
                            <button
                              type="button"
                              onClick={() => navigate(`/talent/${matchedTalent.slug}`)}
                              className="px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                            >
                              View Profile
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* TAB 5: PREFERENCES */}
          {activeTab === 'preferences' && (
            <form onSubmit={(e) => handleSaveAccount(e)} className="divide-y divide-zinc-200">
              <div className="px-6 sm:px-8 py-6">
                <h2 className="font-display text-lg font-bold text-zinc-950">Regional &amp; Alert Settings</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Control timezone formatting and notification preferences across your account.
                </p>
              </div>

              <ul className="divide-y divide-zinc-100">
                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Timezone</p>
                    <p className="text-[11px] text-zinc-500">Used for booking dates &amp; timestamps</p>
                  </div>
                  <div className="sm:col-span-8">
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={inputClass}
                    >
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>
                </li>

                <li className="px-6 sm:px-8 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-center">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-zinc-950">Currency</p>
                    <p className="text-[11px] text-zinc-500">Settlement currency</p>
                  </div>
                  <div className="sm:col-span-8">
                    <span className="font-mono text-xs text-zinc-700">USD ($)</span>
                  </div>
                </li>

                {(
                  [
                    {
                      label: 'Booking & Escrow Alerts',
                      desc: 'Receive updates when booking requests are accepted, declined, or settled.',
                      val: bookingAlerts,
                      set: setBookingAlerts,
                    },
                    {
                      label: 'Direct Message Notifications',
                      desc: 'Alert on new WebSocket messages from talent representation.',
                      val: messageAlerts,
                      set: setMessageAlerts,
                    },
                    {
                      label: 'Official Fan Card Perks',
                      desc: 'Priority event notices and membership updates for your Fan Cards.',
                      val: fanCardPerks,
                      set: setFanCardPerks,
                    },
                    {
                      label: 'Roster Announcements',
                      desc: 'Monthly updates when new talent joins Mercer & Sterling.',
                      val: marketingEmails,
                      set: setMarketingEmails,
                    },
                  ] as const
                ).map((item) => (
                  <li key={item.label} className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-950">{item.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.set(!item.val)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer shrink-0 ${
                        item.val
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-950'
                      }`}
                    >
                      {item.val ? 'On' : 'Off'}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="px-6 sm:px-8 py-4 bg-zinc-50/70 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};
