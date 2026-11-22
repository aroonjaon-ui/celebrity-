import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { AvailabilityGrid } from '../components/AvailabilityGrid.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { AvailabilitySlot, Booking, FanCard, FanCardTier } from '../types.ts';

interface MessagesPageProps {
  initialThreadId?: string;
  initialTalentId?: string;
}

const FAN_CARD_TIERS: Array<{ id: FanCardTier; label: string; summary: string }> = [
  { id: 'silver', label: 'Silver Pass', summary: 'Verified member badge & priority updates' },
  { id: 'gold', label: 'Gold Pass', summary: 'Priority appearance access & member drops' },
  { id: 'platinum', label: 'Platinum Pass', summary: 'VIP lounge invitations & concierge priority' },
];

export const MessagesPage: React.FC<MessagesPageProps> = ({ initialThreadId, initialTalentId }) => {
  const {
    talents,
    threads,
    messages,
    bookings,
    fanCards,
    availability,
    clientProfile,
    userAccount,
    isAdmin,
    adminSettings,
    escrowDepositInfo,
    workspace,
    wsConnected,
    presence,
    typingByThread,
    sendChatMessage,
    sendAdminChat,
    sendTyping,
    markThreadRead,
    markAdminThreadRead,
    submitBookingDeposit,
    purchaseFanCard,
    uploadMediaFile,
    setCheckoutDraft,
    pushToast,
    navigate,
  } = usePlatform();

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // In-chat Escrow Payment Modal state
  const [escrowModalOpen, setEscrowModalOpen] = useState(false);
  const [escrowItemType, setEscrowItemType] = useState<'booking' | 'fancard'>('booking');
  const [selectedFanCardTier, setSelectedFanCardTier] = useState<FanCardTier>('gold');
  const [selectedMemberFanCardId, setSelectedMemberFanCardId] = useState<string>('');
  const [escrowDates, setEscrowDates] = useState<string[]>([]);
  const [eventType, setEventType] = useState('Private Appearance');
  const [eventLocation, setEventLocation] = useState('New York, NY');
  const [clientCompany, setClientCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofName, setProofName] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [depositReference, setDepositReference] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [submittedAmount, setSubmittedAmount] = useState('');
  const [processingEscrow, setProcessingEscrow] = useState(false);
  const [escrowError, setEscrowError] = useState('');
  const [escrowReceipt, setEscrowReceipt] = useState<Booking | null>(null);
  const [issuedFanCardReceipt, setIssuedFanCardReceipt] = useState<FanCard | null>(null);

  const fanCardPrices = adminSettings?.fanCardPrices || { silver: 49, gold: 149, platinum: 399 };

  const isFocusedChat = Boolean(initialThreadId || initialTalentId);

  const activeThread = useMemo(() => {
    if (initialThreadId) {
      return threads.find((t) => t.id === initialThreadId) || null;
    }
    if (initialTalentId) {
      return threads.find((t) => t.talentId === initialTalentId) || null;
    }
    return null;
  }, [threads, initialThreadId, initialTalentId]);

  const activeTalent = useMemo(() => {
    if (activeThread) {
      return talents.find((t) => t.id === activeThread.talentId) || null;
    }
    if (initialTalentId) {
      return talents.find((t) => t.id === initialTalentId) || null;
    }
    return null;
  }, [talents, activeThread, initialTalentId]);

  const pendingUnpaidBooking = useMemo(() => {
    if (!activeTalent) return undefined;
    return bookings.find(
      (b) =>
        b.talentId === activeTalent.id &&
        (b.paymentStatus === 'unpaid' || b.approvalStatus === 'rejected') &&
        (b.status === 'accepted' || b.status === 'pending')
    );
  }, [bookings, activeTalent]);

  const threadMessages = useMemo(
    () => (activeThread ? messages.filter((m) => m.threadId === activeThread.id) : []),
    [messages, activeThread]
  );

  useEffect(() => {
    if (activeThread) {
      if (isAdmin) markAdminThreadRead(activeThread.id);
      else markThreadRead(activeThread.id);
    }
  }, [activeThread, threadMessages.length, markThreadRead, markAdminThreadRead, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!activeThread) return;
    sendTyping(activeThread.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTyping(activeThread.id, false);
    }, 1400);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeTalent) return;
    if (isAdmin) {
      sendAdminChat({
        threadId: activeThread?.id,
        talentId: activeTalent.id,
        body: draft.trim(),
        senderMode: 'manager',
      });
    } else if (activeThread) {
      sendChatMessage({ threadId: activeThread.id, body: draft.trim() });
      sendTyping(activeThread.id, false);
    } else {
      sendChatMessage({ talentId: activeTalent.id, body: draft.trim() });
    }
    setDraft('');
  };

  const openEscrowModal = () => {
    if (!activeTalent) return;
    setEscrowError('');
    setEscrowReceipt(null);
    setIssuedFanCardReceipt(null);
    setEscrowItemType('booking');
    setSelectedFanCardTier('gold');
    setProofUrl('');
    setProofName('');
    setDepositReference('');
    setDepositNote('');

    const defaultName = userAccount?.fullName || clientProfile?.contactName || '';
    const defaultEmail = userAccount?.email || clientProfile?.contactEmail || '';
    const defaultCompany = clientProfile?.companyName || userAccount?.fullName || 'Private Client';

    setClientCompany(pendingUnpaidBooking?.clientCompany || defaultCompany);
    setContactName(pendingUnpaidBooking?.contactName || defaultName);
    setContactEmail(pendingUnpaidBooking?.contactEmail || defaultEmail);
    setMemberName(defaultName);
    setEventType(pendingUnpaidBooking?.eventType || 'Private Appearance');
    setEventLocation(pendingUnpaidBooking?.eventLocation || 'New York, NY');

    const matchingCard = fanCards.find((fc) => fc.talentId === activeTalent.id);
    setSelectedMemberFanCardId(matchingCard ? matchingCard.id : '');

    if (pendingUnpaidBooking) {
      setEscrowDates(pendingUnpaidBooking.dates);
    } else {
      const today = new Date();
      let foundDate = '';
      for (let offset = 1; offset <= 30; offset++) {
        const d = new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
        const slot = availability.find((s) => s.talentId === activeTalent.id && s.date === d);
        if (!slot || slot.status === 'available') {
          foundDate = d;
          break;
        }
      }
      setEscrowDates(foundDate ? [foundDate] : []);
    }

    const dayCount = pendingUnpaidBooking ? pendingUnpaidBooking.dates.length : 1;
    const percent = activeTalent.escrowFeePercent ?? adminSettings?.escrowFeePercent ?? 6;
    setSubmittedAmount(String(Math.round(activeTalent.dailyRate * dayCount * (1 + percent / 100))));

    setEscrowModalOpen(true);
  };

  const handleToggleEscrowDate = (dateStr: string, slot?: AvailabilitySlot) => {
    if (slot && slot.status !== 'available') return;
    setEscrowDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setEscrowError('');
    try {
      const result = await uploadMediaFile(file);
      setProofUrl(result.url);
      setProofName(file.name);
    } catch (err) {
      setEscrowError(err instanceof Error ? err.message : 'Could not upload deposit proof.');
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const activeEscrowDates = pendingUnpaidBooking ? pendingUnpaidBooking.dates : escrowDates;
  const escrowSubtotal = activeTalent ? activeTalent.dailyRate * activeEscrowDates.length : 0;
  const escrowPercent = activeTalent?.escrowFeePercent ?? adminSettings?.escrowFeePercent ?? 6;
  const escrowFee = Math.round(escrowSubtotal * (escrowPercent / 100));
  const escrowTotal = escrowSubtotal + escrowFee;
  const selectedTierInfo = FAN_CARD_TIERS.find((t) => t.id === selectedFanCardTier) || FAN_CARD_TIERS[1];
  const selectedTierFee = fanCardPrices[selectedFanCardTier];

  const handleEscrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTalent) return;
    setEscrowError('');

    if (!proofUrl) {
      setEscrowError('Upload your bank deposit receipt first.');
      return;
    }
    const amount = Number(submittedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setEscrowError('Enter the amount you sent.');
      return;
    }

    setProcessingEscrow(true);
    try {
      if (escrowItemType === 'fancard') {
        const card = await purchaseFanCard({
          talentId: activeTalent.id,
          tier: selectedFanCardTier,
          holderName: memberName || contactName,
          holderEmail: contactEmail,
          submittedAmount: amount,
          proofUrl,
          reference: depositReference || undefined,
          note: depositNote || undefined,
        });
        setIssuedFanCardReceipt(card);
      } else {
        if (activeEscrowDates.length === 0) {
          throw new Error('Please select at least one available date for this booking deposit.');
        }
        const attachedFanCard = fanCards.find((fc) => fc.id === selectedMemberFanCardId);
        const booking = await submitBookingDeposit({
          bookingId: pendingUnpaidBooking?.id,
          talentId: activeTalent.id,
          dates: activeEscrowDates,
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
        setEscrowReceipt(booking);
      }
    } catch (err) {
      setEscrowError(err instanceof Error ? err.message : 'Unable to submit deposit.');
    } finally {
      setProcessingEscrow(false);
    }
  };

  const handleOpenFullCheckout = () => {
    if (!activeTalent) return;
    setCheckoutDraft({
      talentId: activeTalent.id,
      dates: activeEscrowDates,
      bookingId: pendingUnpaidBooking?.id,
    });
    setEscrowModalOpen(false);
    navigate('/checkout');
  };

  // Only show celebrities that have an active conversation thread
  const activeConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return threads
      .map((thread) => ({
        thread,
        talent: talents.find((t) => t.id === thread.talentId),
      }))
      .filter((item): item is { thread: typeof item.thread; talent: NonNullable<typeof item.talent> } => {
        if (!item.talent) return false;
        if (tokens.length === 0) return true;
        const threadBodyText = messages
          .filter((m) => m.threadId === item.thread.id)
          .map((m) => m.body)
          .join(' ');
        const haystack = [
          item.talent.name,
          item.talent.category,
          item.talent.representationManager,
          item.thread.subject,
          item.thread.lastMessagePreview,
          threadBodyText,
        ]
          .join(' ')
          .toLowerCase();
        return tokens.every((tok) => haystack.includes(tok));
      });
  }, [threads, talents, messages, search]);

  // VIEW 1: Vertical List of Messaged Celebrities Only (/messages)
  if (!isFocusedChat) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs text-zinc-500">
              Active Conversations <span aria-hidden="true">·</span>{' '}
              {wsConnected ? 'Live WebSocket Connected' : 'Reconnecting...'} ({presence.totalConnected} online)
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
              Messages
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Conversations with celebrities you have messaged from the roster or booking inquiries.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter conversations..."
              className="pl-9 pr-8 py-2 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 w-64"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-950 cursor-pointer"
                aria-label="Clear conversation search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {activeConversations.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-zinc-950">No conversations yet</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Select a celebrity from the Roster and click Message to start a direct conversation with their
              representation team.
            </p>
            <button
              type="button"
              onClick={() => navigate('/roster')}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer transition-colors"
            >
              Browse Roster
            </button>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-200">
            {activeConversations.map(({ thread, talent }) => {
              const unread =
                workspace.role === 'manager' ? thread.unreadForManager : thread.unreadForClient;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => navigate(`/messages/${thread.id}`)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <SafeImage
                      src={talent.portraitUrl}
                      alt={talent.name}
                      fallbackText={talent.name}
                      className="w-12 h-14 rounded-xl object-cover object-top shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-base font-bold text-zinc-950 truncate">{talent.name}</h2>
                        <span className="text-xs text-zinc-400 hidden sm:inline">·</span>
                        <span className="text-xs text-zinc-500 hidden sm:inline truncate">
                          {talent.representationManager}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-zinc-700 truncate">{thread.subject}</p>
                      <p className="text-xs text-zinc-500 truncate">{thread.lastMessagePreview}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                      {new Date(thread.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {unread > 0 && (
                      <span className="font-mono tabular-nums text-[11px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-md">
                        {unread}
                      </span>
                    )}
                    <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-zinc-100 rounded-xl">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VIEW 2: Focused Individual Celebrity Chat Room
  const typingState = activeThread ? typingByThread[activeThread.id] : null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Messages</span>
        </button>
      </div>

      {activeTalent ? (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col h-[calc(100dvh-148px)] min-h-[520px]">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <SafeImage
                src={activeTalent.portraitUrl}
                alt={activeTalent.name}
                fallbackText={activeTalent.name}
                className="w-11 h-12 rounded-xl object-cover object-top shrink-0"
              />
              <div className="min-w-0">
                <h1 className="font-display text-lg font-bold text-zinc-950 truncate">{activeTalent.name}</h1>
                <p className="text-xs text-zinc-500 truncate">
                  {activeTalent.category} <span aria-hidden="true">·</span> Rep: {activeTalent.representationManager}{' '}
                  <span aria-hidden="true">·</span> {activeTalent.responseTime}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/talent/${activeTalent.slug}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl whitespace-nowrap cursor-pointer shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Profile &amp; Calendar</span>
            </button>
          </div>

          {/* Chat Feed Wrapper with Hovering Escrow Payment Button */}
          <div className="relative flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-3 bg-zinc-50/70">
              {threadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-2">
                  <p className="font-display text-base font-bold text-zinc-950">
                    Direct Channel with {activeTalent.name}&apos;s Team
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Send your first message below to add {activeTalent.name} to your Messages list and connect with{' '}
                    {activeTalent.representationManager}, or use the Escrow Payment button to fund a booking or Fan Card.
                  </p>
                </div>
              ) : (
                threadMessages.map((msg) => {
                  const isOwn = msg.senderRole === workspace.role;
                  const isSystem = msg.senderRole === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="max-w-lg mx-auto bg-white border border-zinc-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{msg.senderName}</span>
                        </div>
                        <p className="text-xs text-zinc-700 leading-relaxed">{msg.body}</p>
                        {msg.attachment && (
                          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-600">
                            <span>{msg.attachment.referenceId}</span>
                            {msg.attachment.amount && (
                              <span>${msg.attachment.amount.toLocaleString('en-US')} USD</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      <span className="text-[11px] text-zinc-500 mb-1">
                        {msg.senderName} ·{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div
                        className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isOwn
                            ? 'bg-zinc-950 text-white'
                            : 'bg-white border border-zinc-200 text-zinc-950'
                        }`}
                      >
                        <p>{msg.body}</p>
                        {msg.attachment && (
                          <div
                            className={`mt-3 pt-2.5 border-t text-xs space-y-1 ${
                              isOwn ? 'border-zinc-800 text-zinc-300' : 'border-zinc-100 text-zinc-600'
                            }`}
                          >
                            <p className="font-semibold inline-flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{msg.attachment.title}</span>
                            </p>
                            {msg.attachment.dates && (
                              <p className="font-mono tabular-nums text-[11px]">
                                Dates: {msg.attachment.dates.join(', ')}
                              </p>
                            )}
                            {msg.attachment.amount && (
                              <p className="font-mono tabular-nums text-[11px]">
                                Escrow Total: ${msg.attachment.amount.toLocaleString('en-US')} USD
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {typingState && typingState.senderRole !== workspace.role && (
                <p className="text-xs text-zinc-500 italic">{typingState.senderName} is typing...</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Hovering Escrow Payment Button */}
            <button
              type="button"
              onClick={openEscrowModal}
              className="absolute bottom-4 right-5 z-20 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl shadow-lg shadow-zinc-950/20 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>
                {pendingUnpaidBooking
                  ? `Pay Escrow · $${pendingUnpaidBooking.totalAmount.toLocaleString('en-US')}`
                  : 'Escrow Payment'}
              </span>
            </button>
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-zinc-200 bg-white flex items-end gap-3">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={`Message ${activeTalent.name}'s team...`}
              className="flex-1 resize-none px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:bg-white focus:border-zinc-950 max-h-32"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-40 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-950">Conversation not found.</p>
          <button
            type="button"
            onClick={() => navigate('/messages')}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
          >
            Back to Messages
          </button>
        </div>
      )}

      {/* In-Chat Escrow Payment Modal */}
      {escrowModalOpen && activeTalent && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="escrow-modal-title"
        >
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Landmark className="w-4 h-4 text-blue-600" />
                <div>
                  <h2 id="escrow-modal-title" className="font-display text-base font-bold text-zinc-950">
                    Bank Deposit — {activeTalent.name}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {escrowItemType === 'fancard'
                      ? `Select an Official Fan Card tier for ${activeTalent.name}`
                      : pendingUnpaidBooking
                        ? `Deposit for booking ${pendingUnpaidBooking.referenceCode}`
                        : 'Submit a bank deposit or select an Official Fan Card'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEscrowModalOpen(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
                aria-label="Close escrow payment modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {escrowReceipt ? (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3">
                  <Clock3 className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Deposit Submitted</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-zinc-950">
                      Awaiting Approval — {escrowReceipt.referenceCode}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Dates are held on {escrowReceipt.talentName}&apos;s calendar. They lock permanently after admin approval.
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-4 border-t border-b border-zinc-200 py-4 text-xs">
                  <div>
                    <dt className="text-zinc-500">Dates Held</dt>
                    <dd className="mt-0.5 font-mono tabular-nums text-zinc-950">{escrowReceipt.dates.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Deposit Submitted</dt>
                    <dd className="mt-0.5 font-mono tabular-nums font-semibold text-zinc-950">
                      ${escrowReceipt.deposit?.submittedAmount.toLocaleString('en-US') || 0} USD
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Payment Method</dt>
                    <dd className="mt-0.5 font-mono text-zinc-950">{escrowReceipt.paymentMethodSummary}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Status</dt>
                    <dd className="mt-0.5 font-semibold text-amber-700">Pending admin review</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEscrowModalOpen(false);
                      navigate('/bookings');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer"
                  >
                    View Bookings
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer"
                  >
                    Return to Chat
                  </button>
                </div>
              </div>
            ) : issuedFanCardReceipt ? (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3">
                  <Clock3 className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Fan Card Deposit Submitted</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-zinc-950">
                      {issuedFanCardReceipt.talentName} · <span className="capitalize">{issuedFanCardReceipt.tier} Pass</span>
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Awaiting admin approval and official card image upload. Your card is not active yet.
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-4 border-t border-b border-zinc-200 py-4 text-xs">
                  <div>
                    <dt className="text-zinc-500">Card Number</dt>
                    <dd className="mt-0.5 font-mono tabular-nums font-semibold text-zinc-950">
                      {issuedFanCardReceipt.cardNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Annual Membership</dt>
                    <dd className="mt-0.5 font-mono tabular-nums font-semibold text-zinc-950">
                      ${issuedFanCardReceipt.annualFee} USD / yr
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Cardholder</dt>
                    <dd className="mt-0.5 text-zinc-950">{issuedFanCardReceipt.holderName}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Valid Until</dt>
                    <dd className="mt-0.5 font-mono tabular-nums text-zinc-950">{issuedFanCardReceipt.validUntil}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEscrowModalOpen(false);
                      navigate('/dashboard');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer"
                  >
                    View in Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer"
                  >
                    Return to Chat
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEscrowSubmit} className="divide-y divide-zinc-200 max-h-[80vh] overflow-y-auto">
                {/* Escrow Purpose Selector: Booking Escrow vs Official Fan Card */}
                <div className="px-6 py-4 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-zinc-950">Select Escrow Payment Type</span>
                  <div className="inline-flex p-1 bg-zinc-200/70 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEscrowItemType('booking');
                        setEscrowError('');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        escrowItemType === 'booking'
                          ? 'bg-white text-zinc-950 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      Booking Escrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEscrowItemType('fancard');
                        setEscrowError('');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        escrowItemType === 'fancard'
                          ? 'bg-white text-zinc-950 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      Official Fan Card
                    </button>
                  </div>
                </div>

                {escrowError && (
                  <div className="mx-6 mt-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {escrowError}
                  </div>
                )}

                {escrowItemType === 'fancard' ? (
                  <div className="p-6 space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-zinc-950">Select Fan Card Tier</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Issued directly for {activeTalent.name} and added to your Official Fan Cards list.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {FAN_CARD_TIERS.map((tier) => {
                        const active = selectedFanCardTier === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => setSelectedFanCardTier(tier.id)}
                            className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                              active
                                ? 'border-zinc-950 bg-zinc-950 text-white'
                                : 'border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400'
                            }`}
                          >
                            <p className="font-display text-sm font-bold">{tier.label}</p>
                            <p className="mt-1 font-mono tabular-nums text-base font-bold">
                              ${fanCardPrices[tier.id]}/yr
                            </p>
                            <p className={`mt-1.5 text-[11px] leading-snug ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                              {tier.summary}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-zinc-700">Member Full Name</span>
                        <input
                          type="text"
                          required
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-zinc-700">Member Email</span>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    {!pendingUnpaidBooking && (
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-zinc-950">Select Booking Dates</p>
                          <span className="font-mono text-xs text-zinc-500">
                            {escrowDates.length} day{escrowDates.length === 1 ? '' : 's'} selected
                          </span>
                        </div>

                        <AvailabilityGrid
                          talentId={activeTalent.id}
                          availability={availability}
                          selectedDates={escrowDates}
                          onToggleDate={handleToggleEscrowDate}
                          compact
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-zinc-700">Event Format</span>
                            <input
                              type="text"
                              required
                              value={eventType}
                              onChange={(e) => setEventType(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-zinc-700">Location / Venue</span>
                            <input
                              type="text"
                              required
                              value={eventLocation}
                              onChange={(e) => setEventLocation(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-zinc-700">Client / Organization</span>
                            <input
                              type="text"
                              required
                              value={clientCompany}
                              onChange={(e) => setClientCompany(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-zinc-700">Contact Email</span>
                            <input
                              type="email"
                              required
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Optional Official Fan Card Attachment on Booking Escrow */}
                    <div className="px-6 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-950">
                          Select Official Fan Card (Optional Member Verification)
                        </span>
                        <button
                          type="button"
                          onClick={() => setEscrowItemType('fancard')}
                          className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          + Get New Fan Card
                        </button>
                      </div>
                      <select
                        value={selectedMemberFanCardId}
                        onChange={(e) => setSelectedMemberFanCardId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-950 focus:outline-none focus:border-zinc-950"
                      >
                        <option value="">No Fan Card selected</option>
                        {fanCards.map((fc) => (
                          <option key={fc.id} value={fc.id}>
                            {fc.talentName} · {fc.tier.toUpperCase()} Pass ({fc.cardNumber}) — Exp {fc.validUntil}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Escrow Summary Breakdown */}
                <div className="px-6 py-4 bg-zinc-50 space-y-1.5 text-xs">
                  {escrowItemType === 'fancard' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          {activeTalent.name} — {selectedTierInfo.label} (Annual)
                        </span>
                        <span className="font-mono tabular-nums text-zinc-950">
                          ${selectedTierFee.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-950 text-sm">
                        <span>Total Fan Card Deposit</span>
                        <span className="font-mono tabular-nums">${selectedTierFee.toLocaleString('en-US')} USD</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          {activeTalent.name} ({activeEscrowDates.length} day{activeEscrowDates.length === 1 ? '' : 's'} × $
                          {activeTalent.dailyRate.toLocaleString('en-US')})
                        </span>
                        <span className="font-mono tabular-nums text-zinc-950">
                          ${escrowSubtotal.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Escrow &amp; Rider Protection ({escrowPercent}%)</span>
                        <span className="font-mono tabular-nums text-zinc-950">
                          ${escrowFee.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-950 text-sm">
                        <span>Total Escrow Authorization</span>
                        <span className="font-mono tabular-nums">${escrowTotal.toLocaleString('en-US')} USD</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Bank Deposit Proof */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-950 inline-flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-zinc-600" />
                      <span>Bank Deposit Details</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenFullCheckout}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Open Full Checkout Page
                    </button>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] space-y-1">
                    <p className="font-semibold text-zinc-950">
                      {escrowDepositInfo?.bankName || 'Mercer & Sterling Escrow'}
                    </p>
                    <p className="text-zinc-600">{escrowDepositInfo?.accountHolder || 'Mercer & Sterling Escrow LLC'}</p>
                    <p className="font-mono text-zinc-600">
                      Account •••• {escrowDepositInfo?.accountNumberLast4 || '----'} · Routing ••••{' '}
                      {escrowDepositInfo?.routingNumberLast4 || '----'}
                    </p>
                    {escrowDepositInfo?.depositInstructions && (
                      <p className="text-zinc-600 whitespace-pre-wrap pt-1">{escrowDepositInfo.depositInstructions}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-700">Amount Sent (USD)</span>
                      <input
                        type="number"
                        min={1}
                        required
                        value={submittedAmount}
                        onChange={(e) => setSubmittedAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-700">Bank Reference (optional)</span>
                      <input
                        value={depositReference}
                        onChange={(e) => setDepositReference(e.target.value)}
                        placeholder="Transfer reference"
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-zinc-700">Deposit Receipt / Proof</span>
                    <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-950">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingProof ? 'Uploading…' : proofName || 'Choose image or PDF'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={handleProofUpload}
                      />
                    </label>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-zinc-700">Note for admin (optional)</span>
                    <textarea
                      rows={2}
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                    />
                  </label>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setEscrowModalOpen(false)}
                      className="px-4 py-2.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        processingEscrow ||
                        uploadingProof ||
                        (escrowItemType === 'booking' && activeEscrowDates.length === 0)
                      }
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {processingEscrow
                        ? 'Submitting deposit…'
                        : escrowItemType === 'fancard'
                          ? `Submit Fan Card Deposit · $${selectedTierFee} USD`
                          : `Submit Booking Deposit · $${escrowTotal.toLocaleString('en-US')} USD`}
                    </button>
                  </div>
                </div>

              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
