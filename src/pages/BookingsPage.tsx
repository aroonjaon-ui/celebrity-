import React, { useMemo, useState } from 'react';
import { FileText, MessageSquare, Search, X } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { Booking, BookingStatus, Talent } from '../types.ts';

type TalentWithFee = Talent & { escrowFeePercent?: number };

type DepositStatus = { label: string; colorClass: string };

const depositStatusFor = (b: Booking): DepositStatus => {
  if (b.approvalStatus === 'approved' && b.paymentStatus === 'paid') {
    return { label: 'Deposit approved', colorClass: 'text-emerald-700' };
  }
  if (b.approvalStatus === 'pending_review' || b.paymentStatus === 'submitted') {
    return { label: 'Deposit pending review', colorClass: 'text-amber-700' };
  }
  if (b.approvalStatus === 'rejected' || b.paymentStatus === 'rejected') {
    return { label: 'Deposit rejected', colorClass: 'text-red-600' };
  }
  if (b.paymentStatus === 'refunded') {
    return { label: 'Deposit refunded', colorClass: 'text-zinc-500' };
  }
  return { label: 'Deposit not submitted', colorClass: 'text-zinc-500' };
};

const isApprovedPaid = (b: Booking): boolean => b.approvalStatus === 'approved' && b.paymentStatus === 'paid';

export const BookingsPage: React.FC = () => {
  const {
    bookings,
    threads,
    talents,
    adminSettings,
    escrowDepositInfo,
    setCheckoutDraft,
    cancelBooking,
    navigate,
    pushToast,
  } = usePlatform();
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [search, setSearch] = useState('');
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);

  const escrowPercentFor = (talentId: string): number => {
    const talent = talents.find((t) => t.id === talentId) as TalentWithFee | undefined;
    return talent?.escrowFeePercent ?? adminSettings?.escrowFeePercent ?? 6;
  };
  const receiptEscrowPercent = receiptBooking
    ? escrowPercentFor(receiptBooking.talentId)
    : (adminSettings?.escrowFeePercent ?? 6);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return bookings.filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        b.referenceCode,
        b.talentName,
        b.clientCompany,
        b.eventType,
        b.eventLocation,
        b.status,
        ...b.dates,
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [bookings, filter, search]);

  const statusText: Record<BookingStatus, { label: string; colorClass: string }> = {
    pending: { label: 'Pending Review', colorClass: 'text-amber-700' },
    accepted: { label: 'Accepted — Submit Bank Deposit', colorClass: 'text-blue-600' },
    confirmed: { label: 'Confirmed & Locked', colorClass: 'text-emerald-700' },
    declined: { label: 'Declined', colorClass: 'text-red-600' },
    cancelled: { label: 'Cancelled', colorClass: 'text-zinc-500' },
  };

  const handleCancel = async (b: Booking) => {
    try {
      await cancelBooking(b.id);
      pushToast('Booking Cancelled', `${b.referenceCode} cancelled and dates released.`, 'info');
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Unable to cancel booking.', 'error');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
            Bookings &amp; Inquiries
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Track pending requests, submit bank deposits for accepted engagements, and view verified deposit receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/roster')}
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
        >
          New Booking Inquiry
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 border border-zinc-200/70 rounded-xl w-fit text-xs">
          {(['all', 'pending', 'accepted', 'confirmed', 'declined', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg font-medium capitalize cursor-pointer transition-all ${
                filter === tab ? 'bg-white text-zinc-950 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, talent, event..."
            className="pl-9 pr-8 py-2 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 w-64"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-950 cursor-pointer"
              aria-label="Clear booking search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-950">No booking records in this status.</p>
          <p className="text-xs text-zinc-500">Select a principal from the roster to submit an inquiry.</p>
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
          >
            Browse Roster
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-200">
          {filtered.map((b) => {
            const st = statusText[b.status];
            const depositStatus = depositStatusFor(b);
            return (
              <div key={b.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono tabular-nums font-semibold text-zinc-950">{b.referenceCode}</span>
                    <span className="text-zinc-300" aria-hidden="true">·</span>
                    <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                    <span className="text-zinc-300" aria-hidden="true">·</span>
                    <span className={`font-semibold ${depositStatus.colorClass}`}>{depositStatus.label}</span>
                    <span className="text-zinc-300" aria-hidden="true">·</span>
                    <span className="text-zinc-500">{b.clientCompany}</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-zinc-950">
                    {b.talentName} <span className="font-sans text-sm font-normal text-zinc-600">— {b.eventType}</span>
                  </h2>
                  <p className="text-xs text-zinc-600">
                    {b.eventLocation} <span aria-hidden="true">·</span>{' '}
                    <span className="font-mono tabular-nums">{b.dates.join(', ')}</span>
                  </p>
                  {b.decisionNote && (
                    <p className="text-xs text-zinc-500 italic">Management Note: {b.decisionNote}</p>
                  )}
                  {b.deposit && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-zinc-600">
                        Deposit submitted:{' '}
                        <span className="font-mono tabular-nums font-semibold text-zinc-950">
                          ${b.deposit.submittedAmount.toLocaleString('en-US')} USD
                        </span>{' '}
                        <span className={depositStatus.colorClass}>— {depositStatus.label}</span>
                      </p>
                      <a
                        href={b.deposit.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        <FileText className="w-3 h-3" /> View deposit proof
                      </a>
                      {b.deposit.rejectionReason && (
                        <p className="text-[11px] text-red-600">Reason: {b.deposit.rejectionReason}</p>
                      )}
                    </div>
                  )}
                  {b.status === 'accepted' && !b.deposit && escrowDepositInfo && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-zinc-500">
                        Bank deposit: {escrowDepositInfo.bankName} · Account •••• {escrowDepositInfo.accountNumberLast4} ·
                        Routing •••• {escrowDepositInfo.routingNumberLast4}
                      </p>
                      {escrowDepositInfo.depositInstructions && (
                        <p className="text-[11px] text-zinc-500 whitespace-pre-wrap">
                          {escrowDepositInfo.depositInstructions}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-left lg:text-right">
                    <p className="font-mono tabular-nums text-base font-semibold text-zinc-950">
                      ${b.totalAmount.toLocaleString('en-US')} USD
                    </p>
                    <p className={`text-[11px] font-medium ${depositStatus.colorClass}`}>
                      {depositStatus.label}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {b.status === 'accepted' &&
                      !isApprovedPaid(b) &&
                      b.approvalStatus !== 'pending_review' &&
                      b.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutDraft({ talentId: b.talentId, dates: b.dates, bookingId: b.id });
                            navigate('/checkout');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl whitespace-nowrap cursor-pointer"
                        >
                          Submit Bank Deposit
                        </button>
                      )}

                    {isApprovedPaid(b) && (
                      <button
                        type="button"
                        onClick={() => setReceiptBooking(b)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const existing = threads.find((t) => t.talentId === b.talentId);
                        navigate(existing ? `/messages/${existing.id}` : `/messages/talent/${b.talentId}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl whitespace-nowrap cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>

                    {(b.status === 'pending' || b.status === 'accepted' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(b)}
                        className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receiptBooking && isApprovedPaid(receiptBooking) && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 flex items-center justify-center p-4"
          onClick={() => setReceiptBooking(null)}
        >
          <div
            className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-zinc-950">Bank Deposit Receipt</h3>
                <p className="font-mono text-xs text-zinc-500">{receiptBooking.referenceCode}</p>
                <p className="text-[11px] font-semibold text-emerald-700">Approved deposit</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                className="p-1 text-zinc-500 hover:text-zinc-950 cursor-pointer"
                aria-label="Close receipt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Talent</dt>
                <dd className="font-semibold text-zinc-950">{receiptBooking.talentName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Client</dt>
                <dd className="font-medium text-zinc-950">{receiptBooking.clientCompany}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Dates</dt>
                <dd className="font-mono tabular-nums text-zinc-950">{receiptBooking.dates.join(', ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Talent Fee</dt>
                <dd className="font-mono tabular-nums">${receiptBooking.talentSubtotal.toLocaleString('en-US')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Escrow Fee ({receiptEscrowPercent}%)</dt>
                <dd className="font-mono tabular-nums">${receiptBooking.escrowFee.toLocaleString('en-US')}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-950">
                <dt>Total Settled</dt>
                <dd className="font-mono tabular-nums">${receiptBooking.totalAmount.toLocaleString('en-US')} USD</dd>
              </div>
              <div className="flex justify-between pt-1">
                <dt className="text-zinc-500">Deposit Submitted</dt>
                <dd className="font-mono tabular-nums text-zinc-700">
                  ${(receiptBooking.deposit?.submittedAmount ?? 0).toLocaleString('en-US')} USD
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Bank Reference</dt>
                <dd className="font-mono text-zinc-700">{receiptBooking.deposit?.reference || '—'}</dd>
              </div>
              {receiptBooking.deposit?.proofUrl && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Deposit Proof</dt>
                  <dd>
                    <a
                      href={receiptBooking.deposit.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      View proof
                    </a>
                  </dd>
                </div>
              )}
              {isApprovedPaid(receiptBooking) && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Verification Signature</dt>
                  <dd className="font-mono text-zinc-700">{receiptBooking.receiptSignature}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
