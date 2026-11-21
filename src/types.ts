export type TalentCategory =
  | 'Film & Television'
  | 'Music & Recording'
  | 'Culinary & Hospitality'
  | 'Creative Direction'
  | 'Athletics & Keynote';

export interface ExperienceItem {
  id: string;
  yearRange: string;
  role: string;
  organization: string;
  description: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  mediaType: 'image' | 'video';
  url: string;
  caption: string;
  year: string;
}

export interface SocialLinks {
  instagram?: string;
  imdb?: string;
  linkedin?: string;
  youtube?: string;
  x?: string;
  website?: string;
}

export interface Talent {
  id: string;
  slug: string;
  name: string;
  category: TalentCategory;
  location: string;
  timezone: string;
  dailyRate: number;
  currency: 'USD';
  portraitUrl: string;
  tagline: string;
  biography: string;
  yearsActive: number;
  experience: ExperienceItem[];
  portfolio: PortfolioItem[];
  socialLinks: SocialLinks;
  engagementTypes: string[];
  representationManager: string;
  responseTime: string;
  verified: boolean;
  escrowFeePercent?: number;
  archived?: boolean;
}

export type BudgetRange =
  | '$15,000 – $30,000'
  | '$30,000 – $75,000'
  | '$75,000 – $150,000'
  | '$150,000+';

export interface ClientProfile {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  industry: string;
  headquarters: string;
  website: string;
  eventTypes: string[];
  preferredBudgetRange: BudgetRange;
  billingEntity: string;
  notes: string;
  updatedAt: string;
}

export type SlotStatus = 'available' | 'hold' | 'booked' | 'blocked' | 'travel';

export type ApprovalStatus = 'not_submitted' | 'pending_review' | 'approved' | 'rejected';

export type PaymentStatus = 'unpaid' | 'submitted' | 'paid' | 'refunded' | 'rejected';

export type DepositMethod = 'bank_transfer';

export interface DepositRecord {
  id: string;
  type: 'booking' | 'fancard';
  targetId: string;
  submittedAt: string;
  submittedBy: string;
  expectedAmount: number;
  submittedAmount: number;
  method: DepositMethod;
  proofUrl: string;
  reference?: string;
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface EscrowAccountSnapshot {
  bankName: string;
  accountHolder: string;
  accountNumberLast4: string;
  routingNumberLast4: string;
  swift: string;
  ibanLast4?: string;
  currency: 'USD';
  depositInstructions: string;
  minimumDeposit?: number;
}

export interface AdminEscrowAccount extends EscrowAccountSnapshot {
  accountNumber?: string;
  routingNumber?: string;
  iban?: string;
  accountNumberEnc?: string;
  routingNumberEnc?: string;
  ibanEnc?: string;
  updatedAt: string;
}

export interface AdminSettings {
  escrowFeePercent: number;
  fanCardPrices: Record<FanCardTier, number>;
  escrowAccount: AdminEscrowAccount;
}

export interface AvailabilitySlot {
  talentId: string;
  date: string; // YYYY-MM-DD
  status: SlotStatus;
  holdSessionId?: string;
  holdExpiresAt?: number;
  bookingId?: string;
  note?: string;
}

export interface ChatThread {
  id: string;
  talentId: string;
  clientCompany: string;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadForClient: number;
  unreadForManager: number;
  unreadForAdmin: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderRole: 'client' | 'manager' | 'system' | 'celebrity';
  senderName: string;
  body: string;
  createdAt: string;
  attachment?: {
    type: 'booking_proposal' | 'payment_receipt';
    title: string;
    dates?: string[];
    amount?: number;
    eventType?: string;
    referenceId?: string;
  };
}

export type BookingStatus = 'pending' | 'accepted' | 'confirmed' | 'declined' | 'cancelled';

export interface Booking {
  id: string;
  referenceCode: string;
  talentId: string;
  talentName: string;
  clientCompany: string;
  contactName: string;
  contactEmail: string;
  eventType: string;
  eventLocation: string;
  dates: string[];
  dailyRate: number;
  talentSubtotal: number;
  escrowFee: number;
  totalAmount: number;
  currency: 'USD';
  paymentStatus: PaymentStatus;
  approvalStatus: ApprovalStatus;
  paymentMethodSummary?: string;
  paymentProvider?: 'bank_deposit' | 'escrow_gateway';
  paymentIntentId?: string;
  receiptSignature?: string;
  deposit?: DepositRecord;
  escrowAccountSnapshot?: EscrowAccountSnapshot;
  status: BookingStatus;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  recipientRole: 'client' | 'manager' | 'admin' | 'all';
  title: string;
  message: string;
  category: 'inquiry' | 'status_update' | 'payment' | 'message' | 'deposit';
  bookingId?: string;
  talentId?: string;
  read: boolean;
  createdAt: string;
}

export interface ActiveWorkspaceState {
  role: 'client' | 'manager' | 'admin';
  displayName: string;
}

export type FanCardTier = 'silver' | 'gold' | 'platinum';

export interface FanCard {
  id: string;
  cardNumber: string;
  talentId: string;
  talentName: string;
  tier: FanCardTier;
  holderName: string;
  holderEmail: string;
  ownerKey?: string;
  annualFee: number;
  currency: 'USD';
  active: boolean;
  paymentStatus: PaymentStatus;
  approvalStatus: ApprovalStatus;
  paymentMethodSummary: string;
  receiptSignature: string;
  cardImageUrl?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  deposit?: DepositRecord;
  validUntil: string;
  createdAt: string;
}

export type KycStatus = 'unverified' | 'pending_review' | 'verified';

export interface UserAccountProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  signupDate: string;
  lastLoginAt: string;
  twoFactorEnabled: boolean;
  timezone: string;
  preferredCurrency: 'USD';
  kyc: {
    status: KycStatus;
    legalName: string;
    documentType: 'Passport' | 'Drivers License' | 'National ID';
    documentNumberMasked: string;
    documentExpiry: string;
    issuingCountry: string;
    documentFileUrl?: string;
    submittedAt?: string;
  };
  preferences: {
    bookingAlerts: boolean;
    messageAlerts: boolean;
    fanCardPerks: boolean;
    marketingEmails: boolean;
  };
  updatedAt: string;
}

export interface ClientReview {
  id: string;
  reviewerName: string;
  reviewerRole: string;
  companyName: string;
  talentName: string;
  eventType: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type AppRoute =
  | { page: 'home' }
  | { page: 'roster'; query?: string }
  | { page: 'talent'; slug: string }
  | { page: 'calendar' }
  | { page: 'messages'; threadId?: string; talentId?: string }
  | { page: 'checkout'; talentId?: string; bookingId?: string }
  | { page: 'bookings' }
  | { page: 'client-profile' }
  | { page: 'manager' }
  | { page: 'admin' }
  | { page: 'auth'; mode: 'login' | 'signup' };
