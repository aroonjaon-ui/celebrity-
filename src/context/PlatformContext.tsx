import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActiveWorkspaceState,
  AdminEscrowAccount,
  AdminSettings,
  AppNotification,
  AppRoute,
  AvailabilitySlot,
  Booking,
  ChatMessage,
  ChatThread,
  ClientProfile,
  ClientReview,
  DepositRecord,
  EscrowAccountSnapshot,
  FanCard,
  FanCardTier,
  SlotStatus,
  Talent,
  UserAccountProfile,
} from '../types.ts';

async function readJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) || 'Request failed.' };
  }
}

interface PresenceInfo {
  totalConnected: number;
  clientsOnline: number;
  managersOnline: number;
}

interface TypingInfo {
  threadId: string;
  senderRole: 'client' | 'manager';
  senderName: string;
  isTyping: boolean;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface CheckoutDraft {
  talentId: string;
  dates: string[];
  bookingId?: string;
}

interface BookingDepositInput {
  bookingId?: string;
  talentId?: string;
  dates?: string[];
  eventType?: string;
  eventLocation?: string;
  clientCompany?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  submittedAmount: number;
  proofUrl: string;
  reference?: string;
  note?: string;
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
  deposit: DepositRecord;
}

interface PlatformContextValue {
  route: AppRoute;
  navigate: (to: string) => void;
  loading: boolean;
  wsConnected: boolean;
  presence: PresenceInfo;
  isAdmin: boolean;
  isAuthenticated: boolean;
  hasClientAccount: boolean;
  signup: (input: { fullName: string; email: string; password: string; companyName?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  adminSettings: AdminSettings | null;
  escrowDepositInfo: EscrowAccountSnapshot | null;
  approvalPopup: {
    type: 'booking' | 'fancard';
    status: 'approved' | 'rejected';
    title: string;
    message: string;
    targetId: string;
  } | null;
  dismissApprovalPopup: () => void;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  updateAdminSettings: (patch: Partial<AdminSettings>) => Promise<void>;
  getEscrowAccount: () => Promise<AdminEscrowAccount>;
  updateEscrowAccount: (patch: Record<string, unknown>) => Promise<void>;
  submitBookingDeposit: (input: BookingDepositInput) => Promise<Booking>;
  getAdminDeposits: (status?: string) => Promise<AdminDepositItem[]>;
  approveDeposit: (type: 'booking' | 'fancard', id: string, cardImageUrl?: string) => Promise<void>;
  rejectDeposit: (type: 'booking' | 'fancard', id: string, reason: string) => Promise<void>;
  uploadFanCardImage: (id: string, cardImageUrl: string) => Promise<void>;
  createTalent: (input: Partial<Talent> & { initialBlocks?: Array<{ date: string; status: 'blocked' | 'travel' }> }) => Promise<Talent>;
  updateTalentFull: (id: string, patch: Partial<Talent>) => Promise<Talent>;
  archiveTalent: (id: string, archived: boolean) => Promise<void>;
  sendAdminChat: (input: { threadId?: string; talentId?: string; body: string; senderMode: 'celebrity' | 'manager' }) => void;
  markAdminThreadRead: (threadId: string) => void;
  sessionId: string;
  workspace: ActiveWorkspaceState;
  setWorkspaceRole: (role: 'client' | 'manager' | 'admin') => void;
  talents: Talent[];
  clientProfile: ClientProfile | null;
  userAccount: UserAccountProfile | null;
  availability: AvailabilitySlot[];
  threads: ChatThread[];
  messages: ChatMessage[];
  bookings: Booking[];
  fanCards: FanCard[];
  reviews: ClientReview[];
  notifications: AppNotification[];
  typingByThread: Record<string, TypingInfo | null>;
  checkoutDraft: CheckoutDraft | null;
  setCheckoutDraft: React.Dispatch<React.SetStateAction<CheckoutDraft | null>>;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  pushToast: (title: string, message: string, tone?: 'info' | 'success' | 'error') => void;
  updateTalentProfile: (talentId: string, patch: Partial<Talent>) => Promise<Talent>;
  uploadMediaFile: (file: File) => Promise<{ url: string; mediaType: 'image' | 'video' | 'document' }>;
  updateClientProfile: (patch: Partial<ClientProfile>) => Promise<ClientProfile>;
  updateUserAccount: (
    patch: Partial<UserAccountProfile> & { kycDocumentNumber?: string }
  ) => Promise<UserAccountProfile>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateCalendarSlots: (talentId: string, dates: string[], status: SlotStatus, note?: string) => Promise<void>;
  submitInquiry: (input: {
    talentId: string;
    dates: string[];
    eventType: string;
    eventLocation: string;
    clientCompany: string;
    contactName: string;
    contactEmail: string;
    notes?: string;
  }) => Promise<{ booking: Booking; threadId: string }>;
  decideInquiry: (bookingId: string, decision: 'accept' | 'decline', decisionNote?: string) => Promise<Booking>;
  confirmPayment: (input: BookingDepositInput) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<void>;
  purchaseFanCard: (input: {
    talentId: string;
    tier: FanCardTier;
    holderName: string;
    holderEmail: string;
    submittedAmount: number;
    proofUrl: string;
    reference?: string;
    note?: string;
  }) => Promise<FanCard>;
  submitReview: (input: {
    reviewerName: string;
    reviewerRole: string;
    companyName: string;
    talentName: string;
    eventType: string;
    rating: number;
    comment: string;
  }) => Promise<ClientReview>;
  sendChatMessage: (input: { threadId?: string; talentId?: string; body: string }) => void;
  sendSupportMessage: (input: { body: string; senderName?: string; senderEmail?: string }) => Promise<void>;
  sendTyping: (threadId: string, isTyping: boolean) => void;
  markThreadRead: (threadId: string) => void;
  markNotificationRead: (id: string | 'all') => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function parsePathToRoute(fullPath: string): AppRoute {
  const [rawPath, rawSearch = ''] = fullPath.split('?');
  const clean = rawPath.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'home' };
  if (clean === '/roster') {
    const params = new URLSearchParams(rawSearch);
    const query = params.get('q') || undefined;
    return { page: 'roster', query };
  }
  if (clean.startsWith('/talent/')) {
    const slug = decodeURIComponent(clean.slice('/talent/'.length));
    if (slug) return { page: 'talent', slug };
  }
  if (clean === '/calendar') return { page: 'calendar' };
  if (clean === '/messages') return { page: 'messages' };
  if (clean.startsWith('/messages/talent/')) {
    const talentId = decodeURIComponent(clean.slice('/messages/talent/'.length));
    if (talentId) return { page: 'messages', talentId };
  }
  if (clean.startsWith('/messages/')) {
    return { page: 'messages', threadId: decodeURIComponent(clean.slice('/messages/'.length)) };
  }
  if (clean === '/checkout') return { page: 'checkout' };
  if (clean === '/bookings') return { page: 'bookings' };
  if (clean === '/client-profile') return { page: 'client-profile' };
  if (clean === '/manager' || clean === '/dashboard') return { page: 'manager' };
  if (clean === '/admin') return { page: 'admin' };
  if (clean === '/auth' || clean === '/login') return { page: 'auth', mode: 'login' };
  if (clean === '/signup' || clean === '/register') return { page: 'auth', mode: 'signup' };
  return { page: 'home' };
}

function mergeChatThread(prev: ChatThread[], thread: ChatThread): ChatThread[] {
  const exists = prev.some((t) => t.id === thread.id);
  const updated = exists ? prev.map((t) => (t.id === thread.id ? thread : t)) : [thread, ...prev];
  return [...updated].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<AppRoute>(() =>
    parsePathToRoute(`${window.location.pathname}${window.location.search}`)
  );
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  // Fixed presence value kept for compatibility with the polling transport.
  const [presence] = useState<PresenceInfo>({ totalConnected: 1, clientsOnline: 1, managersOnline: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasClientAccount, setHasClientAccount] = useState(false);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [escrowDepositInfo, setEscrowDepositInfo] = useState<EscrowAccountSnapshot | null>(null);
  const [approvalPopup, setApprovalPopup] = useState<PlatformContextValue['approvalPopup']>(null);
  const [sessionId] = useState(() => `sess-${Math.random().toString(36).slice(2, 10)}`);

  const [talents, setTalents] = useState<Talent[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccountProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fanCards, setFanCards] = useState<FanCard[]>([]);
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [typingByThread] = useState<Record<string, TypingInfo | null>>({});
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [workspace, setWorkspace] = useState<ActiveWorkspaceState>({
    role: 'client',
    displayName: 'Jordan Reyes',
  });

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  // Last approval status seen for each booking / Fan Card, used to detect
  // approved/rejected transitions between bootstrap polls.
  const approvalStatusRef = useRef<Map<string, string> | null>(null);

  const pushToast = useCallback((title: string, message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, title, message, tone }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigate = useCallback((to: string) => {
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(parsePathToRoute(to));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePathToRoute(`${window.location.pathname}${window.location.search}`));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Bootstrap initial state over HTTP and keep it fresh with 3-second polling
  useEffect(() => {
    let active = true;
    let inFlight = false;

    function notifyApprovalTransitions(nextBookings: Booking[], nextFanCards: FanCard[]) {
      const current = new Map<string, string>();
      const changes: Array<{
        id: string;
        type: 'booking' | 'fancard';
        status: string;
        reference: string;
        reason?: string;
      }> = [];

      nextBookings.forEach((booking) => {
        const key = `booking:${booking.id}`;
        current.set(key, booking.approvalStatus);
        changes.push({
          id: booking.id,
          type: 'booking',
          status: booking.approvalStatus,
          reference: booking.referenceCode || booking.id,
          reason: booking.decisionNote || booking.deposit?.rejectionReason,
        });
      });
      nextFanCards.forEach((card) => {
        const key = `fancard:${card.id}`;
        current.set(key, card.approvalStatus);
        changes.push({
          id: card.id,
          type: 'fancard',
          status: card.approvalStatus,
          reference: card.cardNumber || card.id,
          reason: card.rejectionReason || card.deposit?.rejectionReason,
        });
      });

      const previous = approvalStatusRef.current;
      // The first successful poll seeds the baseline; only later changes are transitions.
      if (previous === null) {
        approvalStatusRef.current = current;
        return;
      }

      changes.forEach((change) => {
        if (previous.get(`${change.type}:${change.id}`) === change.status) return;
        if (change.status !== 'approved' && change.status !== 'rejected') return;

        if (change.status === 'approved') {
          setApprovalPopup({
            type: change.type,
            status: 'approved',
            title: change.type === 'booking' ? 'Deposit Approved' : 'Fan Card Approved',
            message:
              change.type === 'booking'
                ? `Booking ${change.reference} is confirmed. Your dates are locked.`
                : `Your Fan Card ${change.reference} is now active.`,
            targetId: change.id,
          });
          pushToast(
            change.type === 'booking' ? 'Deposit Approved' : 'Fan Card Approved',
            change.type === 'booking'
              ? `Booking ${change.reference} is confirmed.`
              : `Fan Card ${change.reference} is active.`,
            'success'
          );
        } else {
          setApprovalPopup({
            type: change.type,
            status: 'rejected',
            title: change.type === 'booking' ? 'Deposit Rejected' : 'Fan Card Deposit Rejected',
            message: change.reason || 'Your deposit was rejected. Please contact management.',
            targetId: change.id,
          });
          pushToast('Deposit Rejected', change.reason || 'Please contact management.', 'error');
        }
      });

      approvalStatusRef.current = current;
    }

    async function fetchBootstrap() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const res = await fetch('/api/bootstrap');
        if (!res.ok) return;
        const data = await readJsonResponse(res);
        if (!active) return;
        setTalents(data.talents || []);
        setClientProfile(data.clientProfile || null);
        setUserAccount(data.userAccount || null);
        setAvailability(data.availability || []);
        setThreads(data.threads || []);
        setMessages(data.messages || []);
        setBookings(data.bookings || []);
        setFanCards(data.fanCards || []);
        setReviews(data.reviews || []);
        setNotifications(data.notifications || []);
        setIsAdmin(Boolean(data.isAdmin));
        setIsAuthenticated(Boolean(data.isAuthenticated));
        setHasClientAccount(Boolean(data.hasClientAccount));
        setAdminSettings(data.adminSettings || null);
        setEscrowDepositInfo(data.escrowDepositInfo || null);
        if (data.userAccount?.fullName && workspaceRef.current.role === 'client') {
          setWorkspace((prev) =>
            prev.role === 'client' ? { ...prev, displayName: data.userAccount.fullName } : prev
          );
        }
        notifyApprovalTransitions(data.bookings || [], data.fanCards || []);
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }

    setWsConnected(true);
    void fetchBootstrap();
    const pollTimer = window.setInterval(() => {
      void fetchBootstrap();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(pollTimer);
      setWsConnected(false);
    };
  }, [pushToast]);

  const setWorkspaceRole = useCallback(
    (role: 'client' | 'manager' | 'admin') => {
      if (role === 'admin' && !isAdmin) {
        pushToast('Admin Login Required', 'Log in at /admin to use the admin workspace.', 'error');
        return;
      }
      const displayName =
        role === 'admin'
          ? 'Platform Admin'
          : role === 'manager'
            ? 'Hannah Sterling (Talent Manager)'
            : clientProfile?.contactName || 'Jordan Reyes';
      const next: ActiveWorkspaceState = { role, displayName };
      setWorkspace(next);
      pushToast(
        role === 'admin'
          ? 'Admin Workspace Active'
          : role === 'manager'
            ? 'Celebrity Manager View Active'
            : 'Client Booking View Active',
        role === 'admin'
          ? 'You can manage the roster, deposits, Fan Cards, and all messages.'
          : role === 'manager'
            ? 'You can accept/decline booking inquiries and manage calendar blocks.'
            : 'Browsing as a booking client. Submit inquiries and chat with agents.',
        'info'
      );
    },
    [clientProfile?.contactName, isAdmin, pushToast]
  );

  const dismissApprovalPopup = useCallback(() => setApprovalPopup(null), []);

  const adminLogin = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Admin login failed.');
      setIsAdmin(true);
      setWorkspace({ role: 'admin', displayName: 'Platform Admin' });
      navigate('/admin');
      pushToast('Admin Login Successful', 'Admin workspace is now active.', 'success');
    },
    [navigate, pushToast]
  );

  const adminLogout = useCallback(async () => {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Admin logout failed.');
    setIsAdmin(false);
    setWorkspace({ role: 'client', displayName: clientProfile?.contactName || 'Jordan Reyes' });
    navigate('/');
    pushToast('Admin Logged Out', 'Admin access has been disabled.', 'info');
  }, [clientProfile?.contactName, navigate, pushToast]);

  const signup = useCallback(
    async (input: { fullName: string; email: string; password: string; companyName?: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      setIsAuthenticated(true);
      setHasClientAccount(true);
      setIsAdmin(false);
      setUserAccount(data.userAccount || null);
      if (data.clientProfile) setClientProfile(data.clientProfile);
      setWorkspace({ role: 'client', displayName: data.userAccount?.fullName || input.fullName });
      navigate('/');
      pushToast('Account Created', 'Welcome to Mercer & Sterling.', 'success');
    },
    [navigate, pushToast]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not log in.');
      setIsAuthenticated(true);
      setHasClientAccount(true);
      setIsAdmin(false);
      setUserAccount(data.userAccount || null);
      setWorkspace({ role: 'client', displayName: data.userAccount?.fullName || email });
      navigate('/');
      pushToast('Welcome Back', 'You are signed in.', 'success');
    },
    [navigate, pushToast]
  );

  const logout = useCallback(async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not log out.');
    setIsAuthenticated(false);
    setIsAdmin(false);
    setWorkspace({ role: 'client', displayName: 'Jordan Reyes' });
    navigate('/auth');
    pushToast('Signed Out', 'You have been logged out.', 'info');
  }, [navigate, pushToast]);

  const updateAdminSettings = useCallback(async (patch: Partial<AdminSettings>) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not save admin settings.');
    setAdminSettings(data.adminSettings);
    setEscrowDepositInfo(data.escrowDepositInfo);
    pushToast('Settings Saved', 'Escrow and Fan Card pricing updated.', 'success');
  }, [pushToast]);

  const getEscrowAccount = useCallback(async (): Promise<AdminEscrowAccount> => {
    const res = await fetch('/api/admin/escrow-account');
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not load escrow account.');
    return data.escrowAccount as AdminEscrowAccount;
  }, []);

  const updateEscrowAccount = useCallback(async (patch: Record<string, unknown>) => {
    const res = await fetch('/api/admin/escrow-account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not save escrow account.');
    setEscrowDepositInfo(data.escrowDepositInfo);
    pushToast('Deposit Details Saved', 'Bank deposit instructions updated.', 'success');
  }, [pushToast]);

  const submitBookingDeposit = useCallback(
    async (input: BookingDepositInput): Promise<Booking> => {
      const res = await fetch('/api/deposits/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, sessionId: sessionId, idempotencyKey: `dep-${sessionId}-${Date.now()}` }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not submit deposit.');
      pushToast('Deposit Submitted', 'Your deposit is awaiting admin approval.', 'info');
      return data.booking as Booking;
    },
    [pushToast, sessionId]
  );

  const getAdminDeposits = useCallback(async (status = ''): Promise<AdminDepositItem[]> => {
    const res = await fetch(`/api/admin/deposits${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not load deposits.');
    return data.deposits as AdminDepositItem[];
  }, []);

  const approveDeposit = useCallback(
    async (type: 'booking' | 'fancard', id: string, cardImageUrl?: string) => {
      const res = await fetch(`/api/admin/deposits/${type}/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardImageUrl }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not approve deposit.');
      pushToast('Deposit Approved', 'The client has been notified.', 'success');
    },
    [pushToast]
  );

  const rejectDeposit = useCallback(
    async (type: 'booking' | 'fancard', id: string, reason: string) => {
      const res = await fetch(`/api/admin/deposits/${type}/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not reject deposit.');
      pushToast('Deposit Rejected', 'The client has been notified.', 'info');
    },
    [pushToast]
  );

  const uploadFanCardImage = useCallback(
    async (id: string, cardImageUrl: string) => {
      const res = await fetch(`/api/admin/fan-cards/${encodeURIComponent(id)}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardImageUrl }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not upload Fan Card image.');
      setFanCards((prev) => prev.map((c) => (c.id === data.fanCard.id ? data.fanCard : c)));
      pushToast('Card Image Saved', 'Official Fan Card image uploaded.', 'success');
    },
    [pushToast]
  );

  const createTalent = useCallback(
    async (input: Partial<Talent> & { initialBlocks?: Array<{ date: string; status: 'blocked' | 'travel' }> }): Promise<Talent> => {
      const res = await fetch('/api/admin/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not create celebrity.');
      setTalents((prev) => [data.talent, ...prev]);
      pushToast('Celebrity Added', `${data.talent.name} is now on the roster.`, 'success');
      return data.talent as Talent;
    },
    [pushToast]
  );

  const updateTalentFull = useCallback(async (id: string, patch: Partial<Talent>): Promise<Talent> => {
    const res = await fetch(`/api/admin/talents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not update celebrity.');
    setTalents((prev) => prev.map((t) => (t.id === data.talent.id ? data.talent : t)));
    pushToast('Celebrity Saved', 'Profile changes are live.', 'success');
    return data.talent as Talent;
  }, [pushToast]);

  const archiveTalent = useCallback(
    async (id: string, archived: boolean) => {
      const res = await fetch(`/api/admin/talents/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not update celebrity archive state.');
      setTalents((prev) => prev.map((t) => (t.id === data.talent.id ? data.talent : t)));
    },
    []
  );

  const sendAdminChat = useCallback(
    (input: { threadId?: string; talentId?: string; body: string; senderMode: 'celebrity' | 'manager' }) => {
      void (async () => {
        try {
          const res = await fetch('/api/admin/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Could not send admin message.');
          }
          const data = await readJsonResponse(res);
          if (data.message) {
            const message = data.message as ChatMessage;
            setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          }
          if (data.thread) {
            const thread = data.thread as ChatThread;
            setThreads((prev) => mergeChatThread(prev, thread));
          }
        } catch (err) {
          console.error('Admin chat send error:', err);
          pushToast('Message Not Sent', 'Could not send your message. Please try again.', 'error');
        }
      })();
    },
    [pushToast]
  );

  const markAdminThreadRead = useCallback((threadId: string) => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId }),
        });
        if (!res.ok) return;
        const data = await readJsonResponse(res);
        if (data.thread) {
          const thread = data.thread as ChatThread;
          setThreads((prev) => mergeChatThread(prev, thread));
        }
      } catch (err) {
        console.error('Admin chat read error:', err);
      }
    })();
  }, []);

  const updateTalentProfile = useCallback(async (talentId: string, patch: Partial<Talent>): Promise<Talent> => {
    const res = await fetch(`/api/talents/${encodeURIComponent(talentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update celebrity profile.');
    setTalents((prev) => prev.map((t) => (t.id === data.talent.id ? data.talent : t)));
    return data.talent;
  }, []);

  const uploadMediaFile = useCallback(async (file: File): Promise<{ url: string; mediaType: 'image' | 'video' }> => {
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read selected file.'));
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        dataBase64,
      }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Media upload failed.');
    return data;
  }, []);

  const updateClientProfile = useCallback(async (patch: Partial<ClientProfile>): Promise<ClientProfile> => {
    const res = await fetch('/api/client-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update client profile.');
    setClientProfile(data.clientProfile);
    return data.clientProfile;
  }, []);

  const updateUserAccount = useCallback(
    async (patch: Partial<UserAccountProfile> & { kycDocumentNumber?: string }): Promise<UserAccountProfile> => {
      const res = await fetch('/api/user-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update account settings.');
      setUserAccount(data.userAccount);
      setWorkspace((prev) =>
        prev.role === 'client' ? { ...prev, displayName: data.userAccount.fullName } : prev
      );
      return data.userAccount as UserAccountProfile;
    },
    []
  );

  const updateUserPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    const res = await fetch('/api/user-account/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update password.');
  }, []);

  const updateCalendarSlots = useCallback(
    async (talentId: string, dates: string[], status: SlotStatus, note?: string) => {
      const res = await fetch('/api/calendar/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId, dates, status, sessionId, note }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update calendar availability.');
      setAvailability(data.availability);
    },
    [sessionId]
  );

  const submitInquiry = useCallback(
    async (input: {
      talentId: string;
      dates: string[];
      eventType: string;
      eventLocation: string;
      clientCompany: string;
      contactName: string;
      contactEmail: string;
      notes?: string;
    }) => {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, sessionId }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not submit booking inquiry.');
      return data as { booking: Booking; threadId: string };
    },
    [sessionId]
  );

  const decideInquiry = useCallback(async (bookingId: string, decision: 'accept' | 'decline', decisionNote?: string) => {
    const res = await fetch(`/api/inquiries/${encodeURIComponent(bookingId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, decisionNote }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not process inquiry decision.');
    setBookings((prev) => prev.map((b) => (b.id === data.booking.id ? data.booking : b)));
    return data.booking as Booking;
  }, []);

  const confirmPayment = useCallback(
    async (input: BookingDepositInput): Promise<Booking> => submitBookingDeposit(input),
    [submitBookingDeposit]
  );

  const cancelBooking = useCallback(async (bookingId: string) => {
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
    });
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Failed to cancel booking.');
    setBookings((prev) => prev.map((b) => (b.id === data.booking.id ? data.booking : b)));
  }, []);

  const purchaseFanCard = useCallback(
    async (input: {
      talentId: string;
      tier: FanCardTier;
      holderName: string;
      holderEmail: string;
      submittedAmount: number;
      proofUrl: string;
      reference?: string;
      note?: string;
    }) => {
      const res = await fetch('/api/fan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Unable to submit Fan Card deposit.');
      setFanCards((prev) => (prev.some((c) => c.id === data.fanCard.id) ? prev : [data.fanCard, ...prev]));
      pushToast('Fan Card Request Submitted', 'Your deposit is awaiting admin approval.', 'info');
      return data.fanCard as FanCard;
    },
    [pushToast]
  );

  const submitReview = useCallback(
    async (input: {
      reviewerName: string;
      reviewerRole: string;
      companyName: string;
      talentName: string;
      eventType: string;
      rating: number;
      comment: string;
    }) => {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Could not submit review.');
      setReviews((prev) => (prev.some((r) => r.id === data.review.id) ? prev : [data.review, ...prev]));
      return data.review as ClientReview;
    },
    []
  );

  const sendChatMessage = useCallback(
    (input: { threadId?: string; talentId?: string; body: string }) => {
      void (async () => {
        const senderRole = workspaceRef.current.role === 'manager' ? 'manager' : 'client';
        try {
          const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              threadId: input.threadId,
              talentId: input.talentId,
              body: input.body,
              senderRole,
              senderName: workspaceRef.current.displayName,
            }),
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Could not send message.');
          }
          const data = await readJsonResponse(res);
          if (data.message) {
            const message = data.message as ChatMessage;
            setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          }
          if (data.thread) {
            const thread = data.thread as ChatThread;
            setThreads((prev) => mergeChatThread(prev, thread));
          }
        } catch (err) {
          console.error('Chat send error:', err);
          pushToast('Message Not Sent', 'Could not send your message. Please try again.', 'error');
        }
      })();
    },
    [pushToast]
  );

  const sendSupportMessage = useCallback(
    async (input: { body: string; senderName?: string; senderEmail?: string }) => {
      try {
        const res = await fetch('/api/support/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(data.error || 'Could not send support message.');
        if (data.message) {
          const message = data.message as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        }
        if (data.thread) {
          const thread = data.thread as ChatThread;
          setThreads((prev) => mergeChatThread(prev, thread));
        }
      } catch (err) {
        console.error('Support chat send error:', err);
        pushToast(
          'Message Not Sent',
          err instanceof Error ? err.message : 'Could not reach support. Please try again.',
          'error'
        );
      }
    },
    [pushToast]
  );

  // No-op: typing indicators are not transported over HTTP polling.
  const sendTyping = useCallback(() => {}, []);

  const markThreadRead = useCallback((threadId: string) => {
    void (async () => {
      const role = workspaceRef.current.role === 'manager' ? 'manager' : 'client';
      try {
        const res = await fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, role }),
        });
        if (!res.ok) return;
        const data = await readJsonResponse(res);
        if (data.thread) {
          const thread = data.thread as ChatThread;
          setThreads((prev) => mergeChatThread(prev, thread));
        }
      } catch (err) {
        console.error('Chat read error:', err);
      }
    })();
  }, []);

  const markNotificationRead = useCallback(async (id: string | 'all') => {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const data = await readJsonResponse(res);
      setNotifications(data.notifications || []);
    }
  }, []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      route,
      navigate,
      loading,
      wsConnected,
      presence,
      isAdmin,
      isAuthenticated,
      hasClientAccount,
      signup,
      login,
      logout,
      adminSettings,
      escrowDepositInfo,
      approvalPopup,
      dismissApprovalPopup,
      adminLogin,
      adminLogout,
      updateAdminSettings,
      getEscrowAccount,
      updateEscrowAccount,
      submitBookingDeposit,
      getAdminDeposits,
      approveDeposit,
      rejectDeposit,
      uploadFanCardImage,
      createTalent,
      updateTalentFull,
      archiveTalent,
      sendAdminChat,
      markAdminThreadRead,
      sessionId,
      workspace,
      setWorkspaceRole,
      talents,
      clientProfile,
      userAccount,
      availability,
      threads,
      messages,
      bookings,
      fanCards,
      reviews,
      notifications,
      typingByThread,
      checkoutDraft,
      setCheckoutDraft,
      toasts,
      dismissToast,
      pushToast,
      updateTalentProfile,
      uploadMediaFile,
      updateClientProfile,
      updateUserAccount,
      updateUserPassword,
      updateCalendarSlots,
      submitInquiry,
      decideInquiry,
      confirmPayment,
      cancelBooking,
      purchaseFanCard,
      submitReview,
      sendChatMessage,
      sendSupportMessage,
      sendTyping,
      markThreadRead,
      markNotificationRead,
    }),
    [
      route,
      navigate,
      loading,
      wsConnected,
      presence,
      isAdmin,
      isAuthenticated,
      hasClientAccount,
      signup,
      login,
      logout,
      adminSettings,
      escrowDepositInfo,
      approvalPopup,
      dismissApprovalPopup,
      adminLogin,
      adminLogout,
      updateAdminSettings,
      getEscrowAccount,
      updateEscrowAccount,
      submitBookingDeposit,
      getAdminDeposits,
      approveDeposit,
      rejectDeposit,
      uploadFanCardImage,
      createTalent,
      updateTalentFull,
      archiveTalent,
      sendAdminChat,
      markAdminThreadRead,
      sessionId,
      workspace,
      setWorkspaceRole,
      talents,
      clientProfile,
      userAccount,
      availability,
      threads,
      messages,
      bookings,
      fanCards,
      reviews,
      notifications,
      typingByThread,
      checkoutDraft,
      toasts,
      dismissToast,
      pushToast,
      updateTalentProfile,
      uploadMediaFile,
      updateClientProfile,
      updateUserAccount,
      updateUserPassword,
      updateCalendarSlots,
      submitInquiry,
      decideInquiry,
      confirmPayment,
      cancelBooking,
      purchaseFanCard,
      submitReview,
      sendChatMessage,
      sendSupportMessage,
      sendTyping,
      markThreadRead,
      markNotificationRead,
    ]
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
};

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
