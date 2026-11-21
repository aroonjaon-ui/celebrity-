import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Landmark, Lock, ShieldCheck, Upload } from 'lucide-react';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { Booking, FanCard, FanCardTier } from '../types.ts';

const FAN_CARD_TIERS: Array<{ id: FanCardTier; label: string; summary: string }> = [
  { id: 'silver', label: 'Silver Pass', summary: 'Verified member badge & priority updates' },
  { id: 'gold', label: 'Gold Pass', summary: 'Priority appearance access & member drops' },
  { id: 'platinum', label: 'Platinum Pass', summary: 'VIP lounge invitations & concierge priority' },
];

export const CheckoutPage: React.FC = () => {
  const {
    talents,
    bookings,
    fanCards,
    clientProfile,
    userAccount,
    checkoutDraft,
    adminSettings,
    escrowDepositInfo,
    submitBookingDeposit,
    purchaseFanCard,
    uploadMediaFile,
    navigate,
    pushToast,
  } = usePlatform();

  const existingBooking = useMemo(
    () => (checkoutDraft?.bookingId ? bookings.find((b) => b.id === checkoutDraft.bookingId) : undefined),
    [bookings, checkoutDraft]
  );

  const [escrowCategory, setEscrowCategory] = useState<'booking' | 'fancard'>('booking');
  const [selectedTalentId, setSelectedTalentId] = useState('');
  const [selectedFanCardTier, setSelectedFanCardTier] = useState<FanCardTier>('gold');
  const [selectedMemberFanCardId, setSelectedMemberFanCardId] = useState('');

  const selectedTalent = useMemo(() => {
    const id = selectedTalentId || existingBooking?.talentId || checkoutDraft?.talentId || talents[0]?.id;
    return talents.find((t) => t.id === id);
  }, [talents, selectedTalentId, existingBooking, checkoutDraft]);

  const targetDates = useMemo(() => {
    if (existingBooking) return existingBooking.dates;
    if (checkoutDraft?.dates?.length) return checkoutDraft.dates;
    return [];
  }, [existingBooking, checkoutDraft]);

  const [eventType, setEventType] = useState(existingBooking?.eventType || 'Brand Campaign');
  const [eventLocation, setEventLocation] = useState(existingBooking?.eventLocation || 'New York, NY');
  const [clientCompany, setClientCompany] = useState(
    existingBooking?.clientCompany || clientProfile?.companyName || ''
  );
  const [contactName, setContactName] = useState(
    existingBooking?.contactName || userAccount?.fullName || clientProfile?.contactName || ''
  );
  const [contactEmail, setContactEmail] = useState(
    existingBooking?.contactEmail || userAccount?.email || clientProfile?.contactEmail || ''
  );
  const [memberName, setMemberName] = useState(userAccount?.fullName || clientProfile?.contactName || '');
  const [memberEmail, setMemberEmail] = useState(userAccount?.email || clientProfile?.contactEmail || '');

  const [proofUrl, setProofUrl] = useState('');
  const [proofName, setProofName] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [depositReference, setDepositReference] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [submittedAmount, setSubmittedAmount] = useState('');

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<Booking | null>(null);
  const [fanCardReceipt, setFanCardReceipt] = useState<FanCard | null>(null);

  const fanCardPrices = adminSettings?.fanCardPrices || { silver: 49, gold: 149, platinum: 399 };

  useEffect(() => {
    if (existingBooking) {
      setEventType(existingBooking.eventType);
      setEventLocation(existingBooking.eventLocation);
      setClientCompany(existingBooking.clientCompany);
      setContactName(existingBooking.contactName);
      setContactEmail(existingBooking.contactEmail);
    } else if (clientProfile || userAccount) {
      setClientCompany((prev) => prev || clientProfile?.companyName || userAccount?.fullName || '');
      setContactName((prev) => prev || userAccount?.fullName || clientProfile?.contactName || '');
      setContactEmail((prev) => prev || userAccount?.email || clientProfile?.contactEmail || '');
      setMemberName((prev) => prev || userAccount?.fullName || clientProfile?.contactName || '');
      setMemberEmail((prev) => prev || userAccount?.email || clientProfile?.contactEmail || '');
    }
  }, [existingBooking, clientProfile, userAccount]);

  useEffect(() => {
    if (selectedTalent) {
      const matching = fanCards.find((fc) => fc.talentId === selectedTalent.id);
      if (matching) setSelectedMemberFanCardId((prev) => prev || matching.id);
    }
  }, [selectedTalent, fanCards]);

  useEffect(() => {
    if (selectedTalent && !submittedAmount) {
      if (escrowCategory === 'fancard') {
        setSubmittedAmount(String(fanCardPrices[selectedFanCardTier]));
      } else {
        const subtotal = selectedTalent.dailyRate * targetDates.length;
        const percent = selectedTalent.escrowFeePercent ?? adminSettings?.escrowFeePercent ?? 6;
        setSubmittedAmount(String(Math.round(subtotal * (1 + percent / 100))));
      }
    }
  }, [selectedTalent, escrowCategory, selectedFanCardTier, targetDates.length, adminSettings, fanCardPrices, submittedAmount]);

  if (!selectedTalent) {
    return (
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <p className="text-sm text-zinc-600">Select a principal and dates to start the deposit request.</p>
        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
        >
          Open Availability Calendar
        </button>
      </div>
    );
  }

  const talentSubtotal = selectedTalent.dailyRate * targetDates.length;
  const escrowPercent = selectedTalent.escrowFeePercent ?? adminSettings?.escrowFeePercent ?? 6;
  const escrowFee = Math.round(talentSubtotal * (escrowPercent / 100));
  const totalAmount = talentSubtotal + escrowFee;
  const selectedTierFee = fanCardPrices[selectedFanCardTier];

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setErrorMsg('');
    try {
      const result = await uploadMediaFile(file);
      setProofUrl(result.url);
      setProofName(file.name);
      pushToast('Proof Uploaded', 'Deposit receipt attached to your request.', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not upload deposit proof.');
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!proofUrl) {
      setErrorMsg('Upload a bank deposit receipt before submitting.');
      return;
    }
    const amount = Number(submittedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('Enter the amount you sent.');
      return;
    }

    setProcessing(true);
    try {
      if (escrowCategory === 'fancard') {
        const card = await purchaseFanCard({
          talentId: selectedTalent.id,
          tier: selectedFanCardTier,
          holderName: memberName,
          holderEmail: memberEmail,
          submittedAmount: amount,
          proofUrl,
          reference: depositReference || undefined,
          note: depositNote || undefined,
        });
        setFanCardReceipt(card);
      } else {
        if (targetDates.length === 0) {
          throw new Error('No booking dates selected. Pick dates on the availability calendar first.');
        }
        const attachedFanCard = fanCards.find((fc) => fc.id === selectedMemberFanCardId);
        const booking = await submitBookingDeposit({
          bookingId: existingBooking?.id,
          talentId: selectedTalent.id,
          dates: targetDates,
          eventType,
          eventLocation,
          clientCompany,
          contactName,
          contactEmail,
          notes: attachedFanCard
            ? `Fan Card Attached: ${attachedFanCard.cardNumber} (${attachedFanCard.tier.toUpperCase()})`
            : undefined,
          submittedAmount: amount,
          proofUrl,
          reference: depositReference || undefined,
          note: depositNote || undefined,
        });
        setReceipt(booking);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not submit deposit.');
    } finally {
      setProcessing(false);
    }
  };

  if (fanCardReceipt) {
    return (
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 space-y-6">
          <div className="flex items-start gap-3">
            <Clock3 className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700">Fan Card Deposit Submitted</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-zinc-950">
                {fanCardReceipt.talentName} · {fanCardReceipt.tier.toUpperCase()} Pass
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Your deposit is awaiting admin approval. Your card becomes active once an official card image is uploaded
                and the deposit is approved.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-zinc-200 py-5 text-xs">
            <div>
              <dt className="text-zinc-500">Card Number</dt>
              <dd className="mt-0.5 font-mono font-semibold text-zinc-950">{fanCardReceipt.cardNumber}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Member</dt>
              <dd className="mt-0.5 font-semibold text-zinc-950">{fanCardReceipt.holderName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Deposit Submitted</dt>
              <dd className="mt-0.5 font-mono font-semibold text-zinc-950">
                ${fanCardReceipt.deposit?.submittedAmount.toLocaleString('en-US') || 0} USD
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="mt-0.5 font-semibold text-amber-700">Awaiting admin approval</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/client-profile')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
            >
              View Client Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 rounded-xl cursor-pointer"
            >
              Open Messages
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (receipt) {
    return (
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 space-y-6">
          <div className="flex items-start gap-3">
            <Clock3 className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700">Deposit Submitted — Pending Approval</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-zinc-950">{receipt.referenceCode}</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Your dates are held while admin reviews the bank deposit. They lock permanently once approved.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-zinc-200 py-5 text-xs">
            <div>
              <dt className="text-zinc-500">Principal</dt>
              <dd className="mt-0.5 font-semibold text-zinc-950">{receipt.talentName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Dates Held</dt>
              <dd className="mt-0.5 font-mono text-zinc-950">{receipt.dates.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Deposit Submitted</dt>
              <dd className="mt-0.5 font-mono font-semibold text-zinc-950">
                ${receipt.deposit?.submittedAmount.toLocaleString('en-US') || 0} USD
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="mt-0.5 font-semibold text-amber-700">Awaiting admin approval</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/bookings')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
            >
              View Bookings
            </button>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 rounded-xl cursor-pointer"
            >
              Open Agent Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="border-b border-zinc-200 pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Manual Bank Deposit — Admin Approval Required</span>
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">Escrow Checkout</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Transfer funds by bank deposit, upload your receipt, and admin will confirm the booking or card.
          </p>
        </div>
        <div className="inline-flex p-1 bg-zinc-200/70 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => {
              setEscrowCategory('booking');
              setErrorMsg('');
            }}
            className={`px-4 py-2 rounded-lg font-semibold cursor-pointer ${
              escrowCategory === 'booking' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
            }`}
          >
            Booking Deposit
          </button>
          <button
            type="button"
            onClick={() => {
              setEscrowCategory('fancard');
              setErrorMsg('');
            }}
            className={`px-4 py-2 rounded-lg font-semibold cursor-pointer ${
              escrowCategory === 'fancard' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
            }`}
          >
            Official Fan Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{errorMsg}</div>}

          {escrowCategory === 'fancard' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display text-base font-bold text-zinc-950">Select Celebrity &amp; Fan Card Tier</h2>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Celebrity Principal</span>
                  <select
                    value={selectedTalent.id}
                    onChange={(e) => setSelectedTalentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl"
                  >
                    {talents.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FAN_CARD_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => {
                      setSelectedFanCardTier(tier.id);
                      setSubmittedAmount(String(fanCardPrices[tier.id]));
                    }}
                    className={`text-left p-4 rounded-xl border cursor-pointer ${
                      selectedFanCardTier === tier.id
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 text-zinc-950 hover:border-zinc-400'
                    }`}
                  >
                    <p className="font-display text-sm font-bold">{tier.label}</p>
                    <p className="mt-1 font-mono text-base font-bold">${fanCardPrices[tier.id]}/yr</p>
                    <p className={`mt-1.5 text-[11px] ${selectedFanCardTier === tier.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {tier.summary}
                    </p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Member Full Name</span>
                  <input
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Member Email</span>
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display text-base font-bold text-zinc-950">Engagement Details</h2>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Celebrity Principal</span>
                  <select
                    value={selectedTalent.id}
                    disabled={Boolean(existingBooking)}
                    onChange={(e) => setSelectedTalentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl disabled:opacity-60"
                  >
                    {talents.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {targetDates.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  No dates selected. Choose dates on the availability calendar before submitting a booking deposit.
                </div>
              ) : (
                <p className="text-xs text-zinc-600">
                  Dates: <span className="font-mono font-semibold">{targetDates.join(', ')}</span>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Client Company</span>
                  <input
                    required
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Contact Name</span>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Contact Email</span>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Event Format</span>
                  <input
                    required
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-700">Location / Venue</span>
                  <input
                    required
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                  />
                </label>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-5">
                <p className="text-xs font-semibold text-zinc-950">Official Fan Card (optional)</p>
                <select
                  value={selectedMemberFanCardId}
                  onChange={(e) => setSelectedMemberFanCardId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl"
                >
                  <option value="">No Fan Card selected</option>
                  {fanCards.map((fc) => (
                    <option key={fc.id} value={fc.id}>
                      {fc.talentName} · {fc.tier.toUpperCase()} ({fc.cardNumber}) — Exp {fc.validUntil}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-zinc-200 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-zinc-950 inline-flex items-center gap-2">
                <Landmark className="w-4 h-4 text-zinc-600" /> Bank Deposit
              </h2>
              <span className="text-[11px] text-zinc-500">No card required</span>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-zinc-950">{escrowDepositInfo?.bankName || 'Deposit account'}</p>
              <p className="text-zinc-600">{escrowDepositInfo?.accountHolder || 'Mercer & Sterling Escrow LLC'}</p>
              <p className="font-mono text-zinc-600">
                Account •••• {escrowDepositInfo?.accountNumberLast4 || '----'} · Routing ••••{' '}
                {escrowDepositInfo?.routingNumberLast4 || '----'}
                {escrowDepositInfo?.swift ? ` · SWIFT ${escrowDepositInfo.swift}` : ''}
              </p>
              {escrowDepositInfo?.depositInstructions && (
                <p className="text-zinc-600 whitespace-pre-wrap pt-1">{escrowDepositInfo.depositInstructions}</p>
              )}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700">Deposit Receipt / Proof (image or PDF)</span>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-950">
                <Upload className="w-4 h-4" />
                {uploadingProof ? 'Uploading…' : proofName || 'Choose receipt file'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleProofUpload}
                />
              </label>
              {proofUrl && <p className="text-[11px] text-emerald-700">Receipt attached successfully.</p>}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Amount Sent (USD)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={submittedAmount}
                  onChange={(e) => setSubmittedAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-xl"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Bank Reference (optional)</span>
                <input
                  value={depositReference}
                  onChange={(e) => setDepositReference(e.target.value)}
                  placeholder="Transfer reference number"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700">Note for admin (optional)</span>
              <textarea
                rows={2}
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={processing || uploadingProof || (escrowCategory === 'booking' && targetDates.length === 0)}
            className="w-full py-3 px-5 text-sm font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {processing
              ? 'Submitting deposit…'
              : escrowCategory === 'fancard'
                ? `Submit Fan Card Deposit · $${selectedTierFee} USD`
                : `Submit Booking Deposit · $${totalAmount.toLocaleString('en-US')} USD`}
          </button>
        </form>

        <aside className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3 border-b border-zinc-200 pb-5">
            <SafeImage
              src={selectedTalent.portraitUrl}
              alt={selectedTalent.name}
              className="w-14 h-14 rounded-xl object-cover object-top bg-zinc-100"
            />
            <div>
              <p className="font-display text-lg font-bold text-zinc-950">{selectedTalent.name}</p>
              <p className="text-xs text-zinc-500">{selectedTalent.category}</p>
            </div>
          </div>

          {escrowCategory === 'fancard' ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Selected tier</span>
                <span className="font-semibold capitalize">{selectedFanCardTier} pass</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Annual fee</span>
                <span className="font-mono font-semibold">${selectedTierFee} USD</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-3">
                <span className="font-semibold text-zinc-950">Deposit due</span>
                <span className="font-mono font-bold text-zinc-950">${selectedTierFee} USD</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Daily rate × {targetDates.length} days</span>
                <span className="font-mono">${talentSubtotal.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Escrow fee ({escrowPercent}%)</span>
                <span className="font-mono">${escrowFee.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-3">
                <span className="font-semibold text-zinc-950">Deposit due</span>
                <span className="font-mono font-bold text-zinc-950">${totalAmount.toLocaleString('en-US')} USD</span>
              </div>
            </div>
          )}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-900 inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Admin approval required
            </p>
            <p className="mt-2 text-[11px] text-amber-800 leading-relaxed">
              Nothing is confirmed until admin verifies your deposit. Approved bookings lock dates; approved Fan Cards
              receive an official card image.
            </p>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs font-semibold text-emerald-900 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> No card details needed
            </p>
            <p className="mt-2 text-[11px] text-emerald-800 leading-relaxed">
              Payments are made only by manual bank transfer. Card numbers are not collected or validated.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
