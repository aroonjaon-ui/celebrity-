import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import {
  SUPABASE_BUCKET,
  SUPABASE_PUBLIC_FILE_BASE,
  supabase,
} from './supabase.ts';
import { seedStore } from './supabase/seed-store.ts';
import type {
  AdminEscrowAccount,
  AdminSettings,
  AppNotification,
  ApprovalStatus,
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
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const RECEIPT_SECRET =
  process.env.PAYMENT_RECEIPT_SECRET && process.env.PAYMENT_RECEIPT_SECRET.length >= 16
    ? process.env.PAYMENT_RECEIPT_SECRET
    : crypto.randomBytes(32).toString('hex');

const ESCROW_DETAILS_SECRET =
  process.env.ESCROW_DETAILS_SECRET ||
  (process.env.PAYMENT_RECEIPT_SECRET && process.env.PAYMENT_RECEIPT_SECRET.length >= 16
    ? process.env.PAYMENT_RECEIPT_SECRET
    : 'mercer-sterling-local-escrow-secret-change-me');
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const CLIENT_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
// Sessions live in the persisted Supabase snapshot so serverless instances share them.

function encryptSecret(value: string): string {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(ESCROW_DETAILS_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(value: string | undefined): string {
  if (!value) return '';
  try {
    const [ivPart, tagPart, dataPart] = value.split(':');
    const key = crypto.createHash('sha256').update(ESCROW_DETAILS_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function isAdminRequest(req: { headers: { cookie?: string } }): boolean {
  const token = parseCookies(req.headers.cookie).ms_admin;
  if (!token) return false;
  const expires = store.adminSessions?.[token];
  if (!expires) return false;
  if (expires < Date.now()) {
    if (store.adminSessions) {
      delete store.adminSessions[token];
      saveStore(store);
    }
    return false;
  }
  return true;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex || !/^[a-f0-9]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function readAdminCredential(email?: string): Promise<{ email: string; passwordHash: string } | null> {
  const requested = typeof email === 'string' ? email.trim().toLowerCase() : '';
  let query = supabase.from('admin_users').select('email,password_hash');
  query = requested ? query.eq('email', requested) : query.eq('id', 'default');
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('Admin credential lookup failed:', error.message);
    return null;
  }
  if (!data?.email || !data?.password_hash) return null;
  return { email: data.email, passwordHash: data.password_hash };
}

function isClientRequest(req: { headers: { cookie?: string } }): boolean {
  const token = parseCookies(req.headers.cookie).ms_client;
  if (!token) return false;
  const expires = store.clientSessions?.[token];
  if (!expires) return false;
  if (expires < Date.now()) {
    if (store.clientSessions) {
      delete store.clientSessions[token];
      saveStore(store);
    }
    return false;
  }
  return true;
}

function setClientSession(res: express.Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.clientSessions = store.clientSessions || {};
  store.clientSessions[token] = Date.now() + CLIENT_SESSION_MS;
  res.setHeader(
    'Set-Cookie',
    `ms_client=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(CLIENT_SESSION_MS / 1000)}`
  );
  return token;
}

function setAdminSession(res: express.Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.adminSessions = store.adminSessions || {};
  store.adminSessions[token] = Date.now() + ADMIN_SESSION_MS;
  res.setHeader(
    'Set-Cookie',
    `ms_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(ADMIN_SESSION_MS / 1000)}`
  );
  return token;
}

function escrowSnapshot(account: AdminEscrowAccount): EscrowAccountSnapshot {
  return {
    bankName: account.bankName,
    accountHolder: account.accountHolder,
    accountNumberLast4: account.accountNumberLast4,
    routingNumberLast4: account.routingNumberLast4,
    swift: account.swift,
    ibanLast4: account.ibanLast4,
    currency: account.currency,
    depositInstructions: account.depositInstructions,
    minimumDeposit: account.minimumDeposit,
  };
}

function resolveEscrowPercent(talent: Talent): number {
  if (
    typeof talent.escrowFeePercent === 'number' &&
    Number.isFinite(talent.escrowFeePercent) &&
    talent.escrowFeePercent >= 0 &&
    talent.escrowFeePercent <= 50
  ) {
    return talent.escrowFeePercent;
  }
  return store.adminSettings.escrowFeePercent;
}

interface StoreData {
  talents: Talent[];
  clientProfile: ClientProfile;
  userAccount: UserAccountProfile;
  userPasswordHash?: string;
  availability: AvailabilitySlot[];
  threads: ChatThread[];
  messages: ChatMessage[];
  bookings: Booking[];
  fanCards: FanCard[];
  reviews: ClientReview[];
  notifications: AppNotification[];
  adminSettings: AdminSettings;
  processedIdempotencyKeys: Record<string, string>;
  adminSessions?: Record<string, number>;
  clientSessions?: Record<string, number>;
}

function isoDateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function sanitizeSafeUrl(value: unknown, allowRelativeUpload = false): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (allowRelativeUpload && /^\/uploads\/[a-f0-9-]+\.(jpg|png|webp|mp4|webm|pdf)$/i.test(trimmed)) {
    return trimmed;
  }
  if (allowRelativeUpload && /^\/src\/assets\/images\/[a-zA-Z0-9_.-]+\.(jpg|png|webp)$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function createInitialStore(): StoreData {
  const talents: Talent[] = [
    {
      id: 'talent-elena',
      slug: 'elena-rostova',
      name: 'Elena Rostova',
      category: 'Film & Television',
      location: 'New York / London',
      timezone: 'America/New_York',
      dailyRate: 28000,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_elena_rostova_1795207490928.jpg',
      tagline: 'BAFTA-nominated dramatic lead & luxury house ambassador',
      biography:
        'Elena Rostova is an acclaimed stage and screen actress known for nuanced dramatic performances across independent cinema and prestige television. Over a fourteen-year career spanning London’s West End and New York studio productions, she has partnered selectively with architectural, horology, and fashion houses on global editorial campaigns and keynote cultural conversations.',
      yearsActive: 14,
      experience: [
        {
          id: 'exp-e1',
          yearRange: '2023 – Present',
          role: 'Lead Actor & Executive Producer',
          organization: 'The Glass Meridian (Limited Series)',
          description: 'Critically acclaimed six-part drama nominated for Best Actress at the BAFTA Television Awards.',
        },
        {
          id: 'exp-e2',
          yearRange: '2020 – 2024',
          role: 'Global Brand Ambassador',
          organization: 'Maison Verrier Horology',
          description: 'Principal face of the Heritage Chronograph campaign across print, cinema, and Venice Film Festival appearances.',
        },
        {
          id: 'exp-e3',
          yearRange: '2016 – 2020',
          role: 'Principal Ensemble Member',
          organization: 'Royal National Theatre, London',
          description: 'Starring roles in contemporary adaptations of Chekhov and Ibsen under Olivier-winning direction.',
        },
      ],
      portfolio: [
        {
          id: 'port-e1',
          title: 'Autumn Editorial Campaign — Tribeca',
          mediaType: 'image',
          url: '/src/assets/images/talent_elena_rostova_1795207490928.jpg',
          caption: 'Key visual study photographed on 35mm film for European print distribution.',
          year: '2026',
        },
        {
          id: 'port-e2',
          title: 'Mercer & Sterling Salon Conversation',
          mediaType: 'image',
          url: '/src/assets/images/hero_agency_salon_1795207489851.jpg',
          caption: 'Private press roundtable and cultural salon hosted in Lower Manhattan.',
          year: '2025',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/elenarostova',
        imdb: 'https://www.imdb.com',
        linkedin: 'https://www.linkedin.com',
        website: 'https://elenarostova.example.com',
      },
      engagementTypes: ['Brand Campaign', 'Film & Editorial Shoot', 'Keynote & Fireside Chat', 'Festival Appearance'],
      representationManager: 'Hannah Sterling',
      responseTime: 'Typically responds within 2 hours',
      verified: true,
    },
    {
      id: 'talent-marcus',
      slug: 'marcus-vance',
      name: 'Marcus Vance',
      category: 'Music & Recording',
      location: 'Los Angeles, CA',
      timezone: 'America/Los_Angeles',
      dailyRate: 35000,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_marcus_vance_1795207489861.jpg',
      tagline: 'Grammy-winning vocalist, composer & acoustic ensemble director',
      biography:
        'Marcus Vance blends classic soul instrumentation with contemporary orchestral arrangements. A two-time Grammy recipient, Marcus headlines intimate private performances for global leadership summits, composes bespoke sonic identities for flagship architectural launches, and curates acoustic residencies worldwide.',
      yearsActive: 12,
      experience: [
        {
          id: 'exp-m1',
          yearRange: '2024 – Present',
          role: 'Musical Director & Composer',
          organization: 'Vance Sound Collective',
          description: 'Leads an eight-piece touring ensemble for private cultural galas, film scoring, and acoustic showcases.',
        },
        {
          id: 'exp-m2',
          yearRange: '2022',
          role: 'Grammy Award Winner — Best R&B Album',
          organization: 'Recording Academy',
          description: 'Recognized for "Analog Hours", recorded live to two-inch tape in Los Angeles and Abbey Road.',
        },
      ],
      portfolio: [
        {
          id: 'port-m1',
          title: 'Analog Hours Studio Sessions',
          mediaType: 'image',
          url: '/src/assets/images/talent_marcus_vance_1795207489861.jpg',
          caption: 'Live tape session portrait from Sunset Sound Studio B.',
          year: '2026',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/marcusvance',
        youtube: 'https://youtube.com',
        x: 'https://x.com',
        website: 'https://marcusvance.example.com',
      },
      engagementTypes: ['Private Acoustic Performance', 'Brand Campaign', 'Sonic Branding & Score', 'Keynote & Fireside Chat'],
      representationManager: 'Julian Mercer',
      responseTime: 'Typically responds within 3 hours',
      verified: true,
    },
    {
      id: 'talent-kenji',
      slug: 'kenji-takahashi',
      name: 'Kenji Takahashi',
      category: 'Culinary & Hospitality',
      location: 'San Francisco / Tokyo',
      timezone: 'America/Los_Angeles',
      dailyRate: 22000,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_kenji_takahashi_1795207490729.jpg',
      tagline: 'Two-Michelin-star chef, culinary author & hospitality advisor',
      biography:
        'Chef Kenji Takahashi bridges seasonal California agriculture with disciplined Kaiseki craft. Beyond his flagship tasting rooms in San Francisco and Kyoto, Kenji partners with hospitality groups, private collectors, and executive retreats to design bespoke multi-course dining experiences and culinary keynote programs.',
      yearsActive: 18,
      experience: [
        {
          id: 'exp-k1',
          yearRange: '2019 – Present',
          role: 'Chef-Patron',
          organization: 'Kurogane Dining Room',
          description: 'Maintained Two Michelin Stars for six consecutive years with a 14-seat seasonal counter.',
        },
        {
          id: 'exp-k2',
          yearRange: '2023',
          role: 'Author',
          organization: 'Salt, Cedar & Ceramic (Phaidon)',
          description: 'New York Times bestselling culinary monograph examining fermentation and tableware craftsmanship.',
        },
      ],
      portfolio: [
        {
          id: 'port-k1',
          title: 'Kyoto Craft & Culinary Residency',
          mediaType: 'image',
          url: '/src/assets/images/talent_kenji_takahashi_1795207490729.jpg',
          caption: 'Portrait from the winter menu monograph shoot in Kyoto.',
          year: '2026',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/cheftakahashi',
        linkedin: 'https://linkedin.com',
        website: 'https://kenjitakahashi.example.com',
      },
      engagementTypes: ['Private Chef Table & Gala', 'Hospitality Advisory', 'Culinary Keynote', 'Editorial Campaign'],
      representationManager: 'Hannah Sterling',
      responseTime: 'Typically responds within 4 hours',
      verified: true,
    },
    {
      id: 'talent-claire',
      slug: 'claire-beaumont',
      name: 'Claire Beaumont',
      category: 'Creative Direction',
      location: 'Paris, France',
      timezone: 'Europe/Paris',
      dailyRate: 24500,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_claire_beaumont_1795207491048.jpg',
      tagline: 'Creative director, architectural curator & design forum keynote',
      biography:
        'Claire Beaumont advises luxury houses, museum foundations, and technology leaders on spatial identity, exhibition curation, and enduring visual direction. Formerly Creative Director at Atelier Lumière in Paris, she frequently speaks at international design summits and oversees capsule collaborations.',
      yearsActive: 15,
      experience: [
        {
          id: 'exp-c1',
          yearRange: '2021 – Present',
          role: 'Founder & Principal Creative Director',
          organization: 'Studio Beaumont Paris',
          description: 'Directs architectural monographs, flagship retail interiors, and global brand transformations.',
        },
        {
          id: 'exp-c2',
          yearRange: '2015 – 2021',
          role: 'Senior Design Director',
          organization: 'Maison Saint-Clair',
          description: 'Led cross-disciplinary spatial, packaging, and runway scenography across Paris and Milan.',
        },
      ],
      portfolio: [
        {
          id: 'port-c1',
          title: 'Paris Design Week Monograph',
          mediaType: 'image',
          url: '/src/assets/images/talent_claire_beaumont_1795207491048.jpg',
          caption: 'Studio portrait preceding the Palais de Tokyo keynote symposium.',
          year: '2026',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/clairebeaumont',
        linkedin: 'https://linkedin.com',
        website: 'https://studiobeaumont.example.com',
      },
      engagementTypes: ['Keynote & Design Summit', 'Creative Advisory', 'Exhibition Curation', 'Brand Campaign'],
      representationManager: 'Julian Mercer',
      responseTime: 'Typically responds within 2 hours',
      verified: true,
    },
    {
      id: 'talent-devon',
      slug: 'devon-brooks',
      name: 'Devon Brooks',
      category: 'Athletics & Keynote',
      location: 'Chicago, IL',
      timezone: 'America/Chicago',
      dailyRate: 19500,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_devon_brooks_1795207490270.jpg',
      tagline: 'Olympic track gold medalist, leadership speaker & foundation chair',
      biography:
        'Two-time Olympic sprint gold medalist Devon Brooks translates elite athletic preparation into practical leadership frameworks for Fortune 500 executive retreats and youth athletics initiatives. His appearances combine compelling storytelling, athletic campaign photography, and community clinics.',
      yearsActive: 9,
      experience: [
        {
          id: 'exp-d1',
          yearRange: '2022 – Present',
          role: 'Chair & Founder',
          organization: 'Brooks Youth Track Foundation',
          description: 'Funded 18 community athletic facilities and scholarship mentorship programs across the Midwest.',
        },
        {
          id: 'exp-d2',
          yearRange: '2021 & 2024',
          role: 'Olympic Gold Medalist',
          organization: 'USA Track & Field',
          description: 'Two-time Olympic champion and World Athletics relay record holder.',
        },
      ],
      portfolio: [
        {
          id: 'port-d1',
          title: 'Chicago Leadership & Athletics Forum',
          mediaType: 'image',
          url: '/src/assets/images/talent_devon_brooks_1795207490270.jpg',
          caption: 'Editorial feature preceding the annual foundation gala in Chicago.',
          year: '2026',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/devonbrooks',
        x: 'https://x.com',
        linkedin: 'https://linkedin.com',
      },
      engagementTypes: ['Executive Keynote', 'Brand Campaign', 'Charity Gala Appearance', 'Youth Clinic'],
      representationManager: 'Hannah Sterling',
      responseTime: 'Typically responds within 1 hour',
      verified: true,
    },
    {
      id: 'talent-sofia',
      slug: 'sofia-alvarez',
      name: 'Sofia Alvarez',
      category: 'Creative Direction',
      location: 'Mexico City / Madrid',
      timezone: 'America/Mexico_City',
      dailyRate: 21000,
      currency: 'USD',
      portraitUrl: '/src/assets/images/talent_sofia_alvarez_1795208468556.jpg',
      tagline: 'Architectural designer, museum curator & Venice Biennale speaker',
      biography:
        'Sofia Alvarez leads public cultural pavilions, civic museum retrospectives, and architectural design dialogues across Latin America and Europe. Her engagements span institutional keynote lectures, architectural brand collaborations, and curated collector salons.',
      yearsActive: 11,
      experience: [
        {
          id: 'exp-s1',
          yearRange: '2022 – Present',
          role: 'Principal Architect & Curator',
          organization: 'Taller Alvarez',
          description: 'Designed civic gallery spaces in Mexico City and curated traveling architecture exhibitions.',
        },
        {
          id: 'exp-s2',
          yearRange: '2018 – 2022',
          role: 'Visiting Exhibition Fellow',
          organization: 'Museo Reina Sofía, Madrid',
          description: 'Directed spatial programming and symposium panels for contemporary design retrospectives.',
        },
      ],
      portfolio: [
        {
          id: 'port-s1',
          title: 'Cultural Dialogues Exhibition',
          mediaType: 'image',
          url: '/src/assets/images/talent_sofia_alvarez_1795208468556.jpg',
          caption: 'Gallery opening portrait in limestone pavilion.',
          year: '2026',
        },
      ],
      socialLinks: {
        instagram: 'https://instagram.com/sofiaalvarez',
        linkedin: 'https://linkedin.com',
        website: 'https://talleralvarez.example.com',
      },
      engagementTypes: ['Keynote & Design Summit', 'Exhibition Curation', 'Creative Advisory', 'Brand Campaign'],
      representationManager: 'Julian Mercer',
      responseTime: 'Typically responds within 2 hours',
      verified: true,
    },
  ];

  const clientProfile: ClientProfile = {
    id: 'client-northbridge',
    companyName: 'Northbridge Holdings',
    contactName: 'Jordan Reyes',
    contactEmail: 'j.reyes@northbridge.example.com',
    industry: 'Financial Services & Cultural Philanthropy',
    headquarters: 'New York, NY',
    website: 'https://northbridge.example.com',
    eventTypes: ['Executive Keynote', 'Private Gala', 'Brand Campaign'],
    preferredBudgetRange: '$30,000 – $75,000',
    billingEntity: 'Northbridge Cultural Events LLC',
    notes: 'Annual leadership summit in Manhattan and spring philanthropic dinner series. Requires NDA and standard rider review 14 days prior.',
    updatedAt: new Date().toISOString(),
  };

  const pendingBookingId = 'bk-pending-01';
  const confirmedBookingId = 'bk-confirmed-01';

  const pendingDate1 = isoDateOffset(11);
  const pendingDate2 = isoDateOffset(12);
  const confirmedDate1 = isoDateOffset(5);
  const confirmedDate2 = isoDateOffset(6);

  const availability: AvailabilitySlot[] = [
    // Elena Rostova
    { talentId: 'talent-elena', date: confirmedDate1, status: 'booked', bookingId: confirmedBookingId, note: 'Confirmed — Autumn Gala' },
    { talentId: 'talent-elena', date: confirmedDate2, status: 'booked', bookingId: confirmedBookingId, note: 'Confirmed — Autumn Gala' },
    { talentId: 'talent-elena', date: isoDateOffset(7), status: 'travel', note: 'Return transit from London' },
    { talentId: 'talent-elena', date: isoDateOffset(14), status: 'blocked', note: 'Studio ADR hold' },
    { talentId: 'talent-elena', date: isoDateOffset(15), status: 'blocked', note: 'Studio ADR hold' },
    // Marcus Vance
    { talentId: 'talent-marcus', date: pendingDate1, status: 'hold', bookingId: pendingBookingId, note: 'Inquiry hold — Northbridge Holdings' },
    { talentId: 'talent-marcus', date: pendingDate2, status: 'hold', bookingId: pendingBookingId, note: 'Inquiry hold — Northbridge Holdings' },
    { talentId: 'talent-marcus', date: isoDateOffset(3), status: 'booked', note: 'Private Symphony Benefit' },
    { talentId: 'talent-marcus', date: isoDateOffset(18), status: 'travel', note: 'LA to Tokyo flight' },
    // Kenji Takahashi
    { talentId: 'talent-kenji', date: isoDateOffset(4), status: 'blocked', note: 'Kyoto menu tasting' },
    { talentId: 'talent-kenji', date: isoDateOffset(9), status: 'booked', note: 'Napa Valley Harvest Dinner' },
    // Claire Beaumont
    { talentId: 'talent-claire', date: isoDateOffset(8), status: 'booked', note: 'Milan Design Forum' },
    { talentId: 'talent-claire', date: isoDateOffset(16), status: 'travel', note: 'Paris-NYC Transit' },
    // Devon Brooks
    { talentId: 'talent-devon', date: isoDateOffset(10), status: 'booked', note: 'Chicago Youth Track Benefit' },
  ];

  const bookings: Booking[] = [
    {
      id: confirmedBookingId,
      referenceCode: 'MS-2026-8412',
      talentId: 'talent-elena',
      talentName: 'Elena Rostova',
      clientCompany: 'Northbridge Holdings',
      contactName: 'Jordan Reyes',
      contactEmail: 'j.reyes@northbridge.example.com',
      eventType: 'Keynote & Fireside Chat',
      eventLocation: 'The Glasshouse, New York, NY',
      dates: [confirmedDate1, confirmedDate2],
      dailyRate: 28000,
      talentSubtotal: 56000,
      escrowFee: 3360,
      totalAmount: 59360,
      currency: 'USD',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      paymentMethodSummary: 'Bank Deposit',
      paymentProvider: 'escrow_gateway',
      paymentIntentId: 'DEP-8412A9C',
      receiptSignature: crypto
        .createHmac('sha256', RECEIPT_SECRET)
        .update(`MS-2026-8412:59360`)
        .digest('hex')
        .slice(0, 24),
      status: 'confirmed',
      decisionNote: 'Confirmed with full stage & hospitality rider.',
      createdAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
      notes: '35-minute moderated fireside conversation followed by VIP donor reception.',
    },
    {
      id: pendingBookingId,
      referenceCode: 'MS-2026-9047',
      talentId: 'talent-marcus',
      talentName: 'Marcus Vance',
      clientCompany: 'Northbridge Holdings',
      contactName: 'Jordan Reyes',
      contactEmail: 'j.reyes@northbridge.example.com',
      eventType: 'Private Acoustic Performance',
      eventLocation: 'Lincoln Center Atrium, New York, NY',
      dates: [pendingDate1, pendingDate2],
      dailyRate: 35000,
      talentSubtotal: 70000,
      escrowFee: 4200,
      totalAmount: 74200,
      currency: 'USD',
      paymentStatus: 'unpaid',
      approvalStatus: 'not_submitted',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      notes: 'Requesting a 45-minute acoustic quartet set for 180 executive guests. Steinway grand piano provided on site.',
    },
  ];

  const threads: ChatThread[] = [
    {
      id: 'thread-elena',
      talentId: 'talent-elena',
      clientCompany: 'Northbridge Holdings',
      subject: 'Keynote & Fireside Chat — New York',
      lastMessageAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      lastMessagePreview: 'Confirmed rider received. Car service scheduled for 17:30.',
      unreadForClient: 0,
      unreadForManager: 0,
      unreadForAdmin: 0,
    },
    {
      id: 'thread-marcus',
      talentId: 'talent-marcus',
      clientCompany: 'Northbridge Holdings',
      subject: 'Private Acoustic Performance Inquiry',
      lastMessageAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      lastMessagePreview: 'Submitted booking inquiry MS-2026-9047 for two dates.',
      unreadForClient: 0,
      unreadForManager: 1,
      unreadForAdmin: 1,
    },
    {
      id: 'thread-kenji',
      talentId: 'talent-kenji',
      clientCompany: 'Northbridge Holdings',
      subject: 'Spring Collector Tasting Concept',
      lastMessageAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
      lastMessagePreview: 'We can review wine pairing timelines once your dates solidify.',
      unreadForClient: 1,
      unreadForManager: 0,
      unreadForAdmin: 0,
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'msg-1',
      threadId: 'thread-elena',
      senderRole: 'client',
      senderName: 'Jordan Reyes',
      body: 'Hello Hannah, we would love to finalize technical rehearsal timing for Elena’s fireside chat at The Glasshouse.',
      createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    },
    {
      id: 'msg-2',
      threadId: 'thread-elena',
      senderRole: 'system',
      senderName: 'Escrow Settlement',
      body: 'Escrow payment confirmed ($59,360 USD). Reference MS-2026-8412 is locked on the calendar.',
      createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      attachment: {
        type: 'payment_receipt',
        title: 'Confirmed Engagement Receipt MS-2026-8412',
        dates: [confirmedDate1, confirmedDate2],
        amount: 59360,
        eventType: 'Keynote & Fireside Chat',
        referenceId: 'MS-2026-8412',
      },
    },
    {
      id: 'msg-3',
      threadId: 'thread-elena',
      senderRole: 'manager',
      senderName: 'Hannah Sterling (Talent Manager)',
      body: 'Confirmed rider received. Car service scheduled for 17:30, and soundcheck at 18:15 works cleanly with Elena’s schedule.',
      createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    },
    {
      id: 'msg-4',
      threadId: 'thread-marcus',
      senderRole: 'client',
      senderName: 'Jordan Reyes',
      body: 'Submitted booking inquiry MS-2026-9047 for Marcus Vance’s acoustic performance at Lincoln Center Atrium.',
      createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      attachment: {
        type: 'booking_proposal',
        title: 'Booking Inquiry MS-2026-9047',
        dates: [pendingDate1, pendingDate2],
        amount: 74200,
        eventType: 'Private Acoustic Performance',
        referenceId: 'MS-2026-9047',
      },
    },
    {
      id: 'msg-5',
      threadId: 'thread-kenji',
      senderRole: 'manager',
      senderName: 'Hannah Sterling (Talent Manager)',
      body: 'We can review wine pairing timelines once your dates solidify. Chef Kenji has open windows late next month.',
      createdAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'notif-1',
      recipientRole: 'manager',
      title: 'New Booking Inquiry',
      message: `Northbridge Holdings requested Marcus Vance (${pendingDate1} – ${pendingDate2}) for Private Acoustic Performance.`,
      category: 'inquiry',
      bookingId: pendingBookingId,
      talentId: 'talent-marcus',
      read: false,
      createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    },
    {
      id: 'notif-2',
      recipientRole: 'client',
      title: 'Escrow Payment Confirmed',
      message: `Engagement MS-2026-8412 with Elena Rostova is confirmed and locked on calendar.`,
      category: 'payment',
      bookingId: confirmedBookingId,
      talentId: 'talent-elena',
      read: true,
      createdAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    },
  ];

  const userAccount: UserAccountProfile = {
    id: 'user-jordan',
    fullName: 'Jordan Reyes',
    username: 'jordan.reyes',
    email: 'j.reyes@northbridge.example.com',
    phone: '+1 (212) 555-0194',
    dateOfBirth: '1991-06-14',
    addressLine: '245 Hudson Street, Suite 14B',
    city: 'New York, NY',
    postalCode: '10013',
    country: 'United States',
    signupDate: '2025-09-18',
    lastLoginAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    twoFactorEnabled: true,
    timezone: 'America/New_York',
    preferredCurrency: 'USD',
    kyc: {
      status: 'verified',
      legalName: 'Jordan Alejandro Reyes',
      documentType: 'Passport',
      documentNumberMasked: '•••• 4821',
      documentExpiry: '2030-05-20',
      issuingCountry: 'United States',
      submittedAt: '2025-09-19T14:22:00.000Z',
    },
    preferences: {
      bookingAlerts: true,
      messageAlerts: true,
      fanCardPerks: true,
      marketingEmails: false,
    },
    updatedAt: new Date().toISOString(),
  };

  const reviews: ClientReview[] = [
    {
      id: 'rev-1',
      reviewerName: 'Natalie Mercer-Voss',
      reviewerRole: 'VP of Brand Experiences',
      companyName: 'Aurelia Hospitality Group',
      talentName: 'Elena Rostova',
      eventType: 'Keynote & Fireside Chat',
      rating: 5,
      comment:
        'Seamless rider coordination from first inquiry to stage arrival. Having real-time calendar locks and direct representation messaging saved our production team days of back-and-forth.',
      createdAt: new Date(Date.now() - 86400 * 1000 * 14).toISOString(),
    },
    {
      id: 'rev-2',
      reviewerName: 'David Chen',
      reviewerRole: 'Managing Partner',
      companyName: 'Vanguard Cultural Foundation',
      talentName: 'Marcus Vance',
      eventType: 'Private Acoustic Performance',
      rating: 5,
      comment:
        'Marcus delivered an unforgettable 45-minute acoustic set for our annual patrons dinner. Escrow settlement and technical staging notes were handled with complete transparency.',
      createdAt: new Date(Date.now() - 86400 * 1000 * 9).toISOString(),
    },
    {
      id: 'rev-3',
      reviewerName: 'Camille Laurent',
      reviewerRole: 'Creative Director',
      companyName: 'Maison Solis Paris',
      talentName: 'Claire Beaumont',
      eventType: 'Editorial Campaign Direction',
      rating: 5,
      comment:
        'Booking Claire through Mercer & Sterling gave our Paris showroom opening immediate gravitas. Every milestone, contract signature, and receipt stayed organized in one place.',
      createdAt: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
    },
  ];

  const defaultAdminSettings: AdminSettings = {
    escrowFeePercent: 6,
    fanCardPrices: { silver: 49, gold: 149, platinum: 399 },
    escrowAccount: {
      bankName: 'First Meridian Bank',
      accountHolder: 'Mercer & Sterling Escrow LLC',
      accountNumberLast4: '4429',
      routingNumberLast4: '0810',
      swift: 'FMBKUS33',
      ibanLast4: '',
      currency: 'USD',
      depositInstructions:
        'Include your booking reference or Fan Card request ID as the transfer memo. Upload the bank receipt after sending.',
      minimumDeposit: 0,
      updatedAt: new Date().toISOString(),
    },
  };

  return {
    talents,
    clientProfile,
    userAccount,
    availability,
    threads,
    messages,
    bookings,
    fanCards: [],
    reviews,
    notifications,
    adminSettings: defaultAdminSettings,
    processedIdempotencyKeys: {},
    adminSessions: {},
    clientSessions: {},
  };
}

function normalizeStore(parsed: StoreData): StoreData {
  const initial = createInitialStore();
  parsed.talents = Array.isArray(parsed.talents) && parsed.talents.length > 0 ? parsed.talents : initial.talents;
  parsed.fanCards = Array.isArray(parsed.fanCards) ? parsed.fanCards : [];
  parsed.reviews = Array.isArray(parsed.reviews) ? parsed.reviews : initial.reviews;
  parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
  parsed.bookings = Array.isArray(parsed.bookings) ? parsed.bookings : [];
  parsed.threads = Array.isArray(parsed.threads) ? parsed.threads : [];
  parsed.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  parsed.availability = Array.isArray(parsed.availability) ? parsed.availability : [];
  parsed.userAccount = parsed.userAccount || initial.userAccount;
  parsed.clientProfile = parsed.clientProfile || initial.clientProfile;
  parsed.processedIdempotencyKeys = parsed.processedIdempotencyKeys || {};
  parsed.adminSessions = parsed.adminSessions || {};
  parsed.clientSessions = parsed.clientSessions || {};

  if (!parsed.adminSettings) {
    parsed.adminSettings = initial.adminSettings;
  } else {
    parsed.adminSettings.escrowAccount = parsed.adminSettings.escrowAccount || initial.adminSettings.escrowAccount;
    parsed.adminSettings.fanCardPrices = parsed.adminSettings.fanCardPrices || initial.adminSettings.fanCardPrices;
    if (typeof parsed.adminSettings.escrowFeePercent !== 'number') {
      parsed.adminSettings.escrowFeePercent = 6;
    }
  }

  for (const thread of parsed.threads) {
    if (typeof thread.unreadForAdmin !== 'number') thread.unreadForAdmin = 0;
  }
  for (const booking of parsed.bookings) {
    if (!booking.approvalStatus) {
      booking.approvalStatus = booking.paymentStatus === 'paid' ? 'approved' : 'not_submitted';
    }
    if (booking.paymentStatus === 'paid' && !booking.paymentMethodSummary) {
      booking.paymentMethodSummary = 'Bank Deposit';
    }
  }
  for (const card of parsed.fanCards) {
    if (typeof card.active !== 'boolean') card.active = true;
    if (!card.approvalStatus) card.approvalStatus = 'approved';
    if (!card.paymentStatus) card.paymentStatus = 'paid';
    if (!card.ownerKey) card.ownerKey = card.holderEmail?.toLowerCase() || '';
  }
  for (const seedTalent of initial.talents) {
    if (!parsed.talents.some((t) => t.id === seedTalent.id)) parsed.talents.push(seedTalent);
  }
  return parsed;
}

let store: StoreData = createInitialStore();
let stateLoaded = false;
let stateDirty = false;

function saveStore(data: StoreData): void {
  store = data;
  stateDirty = true;
}

async function readSupabaseState(): Promise<StoreData | null> {
  const { data, error } = await supabase.from('app_state').select('data').eq('id', 'main').maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data?.data as StoreData) || null;
}

async function writeSupabaseState(data: StoreData): Promise<void> {
  const { error } = await supabase.from('app_state').upsert({
    id: 'main',
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

async function ensureState(): Promise<void> {
  if (stateLoaded) return;
  stateLoaded = true;
  try {
    const remote = await readSupabaseState();
    if (remote) {
      store = normalizeStore(remote);
      return;
    }
    const seeded = normalizeStore(JSON.parse(JSON.stringify(seedStore)) as StoreData);
    await writeSupabaseState(seeded);
    store = seeded;
  } catch (err) {
    console.error('Supabase state unavailable; falling back to local data:', err);
    try {
      if (fs.existsSync(STORE_PATH)) {
        store = normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as StoreData);
      }
    } catch (localErr) {
      console.error('Local fallback failed:', localErr);
    }
  }
}

async function flushStore(): Promise<void> {
  if (!stateDirty) return;
  stateDirty = false;
  try {
    await writeSupabaseState(store);
  } catch (err) {
    stateDirty = true;
    throw err;
  }
}


function pruneExpiredHolds(): boolean {
  const now = Date.now();
  let changed = false;
  store.availability = store.availability.filter((slot) => {
    if (slot.status === 'hold' && !slot.bookingId && slot.holdExpiresAt && slot.holdExpiresAt < now) {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) {
    saveStore(store);
  }
  return changed;
}

export async function createApiApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  await ensureState();
  pruneExpiredHolds();

  // Serverless has no long-lived socket, so broadcasts are no-ops.
  // The browser polls /api/bootstrap and detects changes itself.
  function broadcast(_event: string, _payload: unknown, _exclude?: unknown): void {}
  function broadcastPresence(): void {}

  // Flush Supabase writes before every JSON response.
  app.use((_req, res, next) => {
    const originalJson = res.json.bind(res);
    (res as express.Response & { json: (body?: unknown) => express.Response }).json = ((body?: unknown) => {
      void flushStore()
        .then(() => originalJson(body))
        .catch((err) => {
          console.error('Failed to persist state:', err);
          originalJson({ error: 'Failed to save data. Please try again.' });
        });
      return res;
    }) as express.Response['json'];
    next();
  });


  // Legacy relative upload URLs redirect to Supabase Storage.
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4|webm|pdf)$/i.test(filename)) {
      res.status(400).json({ error: 'Invalid file name' });
      return;
    }
    res.redirect(302, `${SUPABASE_PUBLIC_FILE_BASE}/${filename}`);
  });

  // Upload endpoint -> Supabase Storage
  app.post('/api/uploads', async (req, res) => {
    const { mimeType, dataBase64 } = req.body as {
      filename?: string;
      mimeType?: string;
      dataBase64?: string;
    };

    const allowedMimes: Record<string, { ext: string; mediaType: 'image' | 'video' | 'document' }> = {
      'image/jpeg': { ext: 'jpg', mediaType: 'image' },
      'image/png': { ext: 'png', mediaType: 'image' },
      'image/webp': { ext: 'webp', mediaType: 'image' },
      'video/mp4': { ext: 'mp4', mediaType: 'video' },
      'video/webm': { ext: 'webm', mediaType: 'video' },
      'application/pdf': { ext: 'pdf', mediaType: 'document' },
    };

    if (!mimeType || !allowedMimes[mimeType]) {
      res.status(400).json({ error: 'Unsupported media format. Use JPG, PNG, WebP, MP4, WebM, or PDF.' });
      return;
    }
    if (typeof dataBase64 !== 'string' || !dataBase64.length) {
      res.status(400).json({ error: 'Missing file payload.' });
      return;
    }

    const stripped = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(stripped, 'base64');
    if (buffer.length === 0 || buffer.length > 12 * 1024 * 1024) {
      res.status(413).json({ error: 'Media file must be under 12 MB.' });
      return;
    }

    const { ext, mediaType } = allowedMimes[mimeType];
    const safeName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(safeName, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      console.error('Supabase upload failed:', error.message);
      res.status(500).json({ error: 'Upload failed.' });
      return;
    }
    res.json({ url: `${SUPABASE_PUBLIC_FILE_BASE}/${safeName}`, mediaType });
  });


  // Bootstrap endpoint
  app.get('/api/bootstrap', (req, res) => {
    pruneExpiredHolds();
    res.json({
      talents: store.talents,
      clientProfile: store.clientProfile,
      userAccount: store.userAccount,
      availability: store.availability,
      threads: store.threads,
      messages: store.messages,
      bookings: store.bookings,
      fanCards: store.fanCards,
      reviews: store.reviews,
      notifications: store.notifications,
      adminSettings: store.adminSettings,
      escrowDepositInfo: escrowSnapshot(store.adminSettings.escrowAccount),
      isAdmin: isAdminRequest(req),
      isAuthenticated: isClientRequest(req),
      hasClientAccount: Boolean(store.userPasswordHash),
    });
  });

  // HTTP chat endpoints (replace the old WebSocket-only chat transport)
  app.post('/api/chat/send', (req, res) => {
    const { threadId, talentId, body, senderRole, senderName } = req.body as {
      threadId?: string;
      talentId?: string;
      body?: string;
      senderRole?: 'client' | 'manager';
      senderName?: string;
    };
    const cleanBody = typeof body === 'string' ? body.trim().slice(0, 2000) : '';
    const role = senderRole === 'manager' ? 'manager' : 'client';
    if (!cleanBody) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    let thread = store.threads.find((t) => t.id === threadId);
    if (!thread && talentId) {
      const talent = store.talents.find((t) => t.id === talentId);
      if (!talent) {
        res.status(404).json({ error: 'Celebrity not found.' });
        return;
      }
      thread = {
        id: `thread-${talent.id}-${Date.now()}`,
        talentId: talent.id,
        clientCompany: store.clientProfile.companyName,
        subject: `${talent.name} — Booking Inquiry`,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: cleanBody.slice(0, 110),
        unreadForClient: 0,
        unreadForManager: 0,
        unreadForAdmin: 0,
      };
      store.threads.unshift(thread);
    }
    if (!thread) {
      res.status(400).json({ error: 'A thread or celebrity is required.' });
      return;
    }

    const message: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      threadId: thread.id,
      senderRole: role,
      senderName:
        typeof senderName === 'string' && senderName.trim()
          ? senderName.trim().slice(0, 80)
          : role === 'manager'
            ? 'Talent Manager'
            : store.clientProfile.contactName,
      body: cleanBody,
      createdAt: new Date().toISOString(),
    };
    store.messages.push(message);
    thread.lastMessageAt = message.createdAt;
    thread.lastMessagePreview = cleanBody.slice(0, 110);
    if (role === 'client') {
      thread.unreadForManager = (thread.unreadForManager || 0) + 1;
      thread.unreadForAdmin = (thread.unreadForAdmin || 0) + 1;
    } else {
      thread.unreadForClient = (thread.unreadForClient || 0) + 1;
    }

    const talent = store.talents.find((t) => t.id === thread!.talentId);
    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: role === 'client' ? 'admin' : 'client',
      title: role === 'client' ? `Message from ${message.senderName}` : `Reply from ${talent?.name || 'Management'}`,
      message: cleanBody.slice(0, 120),
      category: 'message',
      talentId: thread.talentId,
      read: false,
      createdAt: message.createdAt,
    };
    store.notifications.unshift(notification);
    if (role === 'client') {
      store.notifications.unshift({ ...notification, id: `notif-${crypto.randomUUID().slice(0, 8)}`, recipientRole: 'manager' });
    }
    if (store.notifications.length > 50) store.notifications.length = 50;

    saveStore(store);
    res.status(201).json({ message, thread });
  });

  app.post('/api/chat/read', (req, res) => {
    const { threadId, role } = req.body as { threadId?: string; role?: string };
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found.' });
      return;
    }
    if (role === 'manager') thread.unreadForManager = 0;
    else thread.unreadForClient = 0;
    saveStore(store);
    res.json({ thread });
  });

  app.post('/api/admin/chat/send', requireAdmin, (req, res) => {
    const { threadId, talentId, body, senderMode } = req.body as {
      threadId?: string;
      talentId?: string;
      body?: string;
      senderMode?: 'celebrity' | 'manager';
    };
    const cleanBody = typeof body === 'string' ? body.trim().slice(0, 2000) : '';
    if (!cleanBody) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    let thread = store.threads.find((t) => t.id === threadId);
    if (!thread && talentId) {
      const talent = store.talents.find((t) => t.id === talentId);
      if (!talent) {
        res.status(404).json({ error: 'Celebrity not found.' });
        return;
      }
      thread = {
        id: `thread-${talent.id}-${Date.now()}`,
        talentId: talent.id,
        clientCompany: store.clientProfile.companyName,
        subject: `${talent.name} — Booking Inquiry`,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: cleanBody.slice(0, 110),
        unreadForClient: 0,
        unreadForManager: 0,
        unreadForAdmin: 0,
      };
      store.threads.unshift(thread);
    }
    if (!thread) {
      res.status(400).json({ error: 'A thread or celebrity is required.' });
      return;
    }
    const talent = store.talents.find((t) => t.id === thread!.talentId);
    if (!talent) {
      res.status(404).json({ error: 'Celebrity not found.' });
      return;
    }

    const mode = senderMode === 'manager' ? 'manager' : 'celebrity';
    const message: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      threadId: thread.id,
      senderRole: mode,
      senderName: mode === 'celebrity' ? talent.name : talent.representationManager || 'Talent Management',
      body: cleanBody,
      createdAt: new Date().toISOString(),
    };
    store.messages.push(message);
    thread.lastMessageAt = message.createdAt;
    thread.lastMessagePreview = cleanBody.slice(0, 110);
    thread.unreadForClient = (thread.unreadForClient || 0) + 1;

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'client',
      title: mode === 'celebrity' ? `Reply from ${talent.name}` : 'Reply from Management',
      message: cleanBody.slice(0, 120),
      category: 'message',
      talentId: thread.talentId,
      read: false,
      createdAt: message.createdAt,
    };
    store.notifications.unshift(notification);
    if (store.notifications.length > 50) store.notifications.length = 50;

    saveStore(store);
    res.status(201).json({ message, thread });
  });

  app.post('/api/admin/chat/read', requireAdmin, (req, res) => {
    const { threadId } = req.body as { threadId?: string };
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found.' });
      return;
    }
    thread.unreadForAdmin = 0;
    saveStore(store);
    res.json({ thread });
  });

  // Admin authentication
  app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const credential = await readAdminCredential(email);
    if (!credential) {
      res.status(401).json({ error: 'Incorrect admin email or password.' });
      return;
    }
    if (typeof password !== 'string' || !verifyPassword(password, credential.passwordHash)) {
      res.status(401).json({ error: 'Incorrect admin email or password.' });
      return;
    }
    setAdminSession(res);
    saveStore(store);
    res.json({ isAdmin: true, email: credential.email });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie).ms_admin;
    if (token && store.adminSessions) delete store.adminSessions[token];
    saveStore(store);
    res.setHeader('Set-Cookie', 'ms_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ isAdmin: false });
  });

  app.get('/api/admin/session', (req, res) => {
    res.json({ isAdmin: isAdminRequest(req) });
  });

  // Client account signup / login / logout
  app.post('/api/auth/signup', (req, res) => {
    const { fullName, email, password, companyName } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      companyName?: string;
    };
    const cleanName = typeof fullName === 'string' ? fullName.trim().slice(0, 80) : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 120) : '';
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (store.userPasswordHash) {
      res.status(409).json({ error: 'An account already exists. Please log in instead.' });
      return;
    }

    const nowIso = new Date().toISOString();
    store.userPasswordHash = hashPassword(password);
    store.userAccount = {
      ...store.userAccount,
      fullName: cleanName,
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      updatedAt: nowIso,
    };
    store.clientProfile = {
      ...store.clientProfile,
      contactName: cleanName,
      contactEmail: cleanEmail,
      companyName:
        typeof companyName === 'string' && companyName.trim()
          ? companyName.trim().slice(0, 120)
          : store.clientProfile.companyName,
    };
    setClientSession(res);
    saveStore(store);
    broadcast('user:updated', store.userAccount);
    broadcast('client-profile:updated', store.clientProfile);
    res.status(201).json({
      authenticated: true,
      hasClientAccount: true,
      userAccount: store.userAccount,
      clientProfile: store.clientProfile,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!store.userPasswordHash) {
      res.status(404).json({ error: 'No account found. Please sign up first.' });
      return;
    }
    if (cleanEmail !== store.userAccount.email.trim().toLowerCase() || !verifyPassword(password || '', store.userPasswordHash)) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }
    store.userAccount.lastLoginAt = new Date().toISOString();
    setClientSession(res);
    saveStore(store);
    res.json({ authenticated: true, hasClientAccount: true, userAccount: store.userAccount });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie).ms_client;
    if (token && store.clientSessions) delete store.clientSessions[token];
    saveStore(store);
    res.setHeader('Set-Cookie', 'ms_client=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ authenticated: false });
  });

  app.get('/api/auth/session', (req, res) => {
    res.json({
      authenticated: isClientRequest(req),
      hasClientAccount: Boolean(store.userPasswordHash),
      userAccount: store.userAccount,
    });
  });

  function requireClient(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!isClientRequest(req)) {
      res.status(401).json({ error: 'Please log in to continue.' });
      return;
    }
    next();
  }

  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    next();
  }

  // Admin settings
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const body = req.body as Partial<AdminSettings>;
    if (
      typeof body.escrowFeePercent === 'number' &&
      Number.isFinite(body.escrowFeePercent) &&
      body.escrowFeePercent >= 0 &&
      body.escrowFeePercent <= 50
    ) {
      store.adminSettings.escrowFeePercent = Math.round(body.escrowFeePercent * 100) / 100;
    }
    if (body.fanCardPrices && typeof body.fanCardPrices === 'object') {
      const prices = body.fanCardPrices;
      for (const tier of ['silver', 'gold', 'platinum'] as FanCardTier[]) {
        const value = prices[tier];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10000) {
          store.adminSettings.fanCardPrices[tier] = Math.round(value);
        }
      }
    }
    saveStore(store);
    broadcast('admin:settings:updated', {
      adminSettings: store.adminSettings,
      escrowDepositInfo: escrowSnapshot(store.adminSettings.escrowAccount),
    });
    res.json({
      adminSettings: store.adminSettings,
      escrowDepositInfo: escrowSnapshot(store.adminSettings.escrowAccount),
    });
  });

  // Escrow bank deposit details
  app.get('/api/admin/escrow-account', requireAdmin, (_req, res) => {
    const account = store.adminSettings.escrowAccount;
    res.json({
      escrowAccount: {
        ...escrowSnapshot(account),
        accountNumber: decryptSecret(account.accountNumberEnc),
        routingNumber: decryptSecret(account.routingNumberEnc),
        iban: decryptSecret(account.ibanEnc),
      },
    });
  });

  app.put('/api/admin/escrow-account', requireAdmin, (req, res) => {
    const body = req.body as Partial<AdminEscrowAccount> & {
      accountNumber?: string;
      routingNumber?: string;
      iban?: string;
    };
    const current = store.adminSettings.escrowAccount;
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.replace(/\D/g, '') : '';
    const routingNumber = typeof body.routingNumber === 'string' ? body.routingNumber.replace(/\D/g, '') : '';
    const iban = typeof body.iban === 'string' ? body.iban.trim().toUpperCase() : '';

    store.adminSettings.escrowAccount = {
      bankName: typeof body.bankName === 'string' && body.bankName.trim() ? body.bankName.trim().slice(0, 120) : current.bankName,
      accountHolder:
        typeof body.accountHolder === 'string' && body.accountHolder.trim()
          ? body.accountHolder.trim().slice(0, 120)
          : current.accountHolder,
      accountNumberLast4: accountNumber ? accountNumber.slice(-4) : current.accountNumberLast4,
      routingNumberLast4: routingNumber ? routingNumber.slice(-4) : current.routingNumberLast4,
      ibanLast4: iban ? iban.slice(-4) : current.ibanLast4,
      swift: typeof body.swift === 'string' ? body.swift.trim().slice(0, 40) : current.swift,
      currency: 'USD',
      depositInstructions:
        typeof body.depositInstructions === 'string'
          ? body.depositInstructions.trim().slice(0, 1000)
          : current.depositInstructions,
      minimumDeposit:
        typeof body.minimumDeposit === 'number' && Number.isFinite(body.minimumDeposit) && body.minimumDeposit >= 0
          ? Math.round(body.minimumDeposit)
          : current.minimumDeposit,
      accountNumberEnc: accountNumber ? encryptSecret(accountNumber) : current.accountNumberEnc,
      routingNumberEnc: routingNumber ? encryptSecret(routingNumber) : current.routingNumberEnc,
      ibanEnc: iban ? encryptSecret(iban) : current.ibanEnc,
      updatedAt: new Date().toISOString(),
    };

    saveStore(store);
    broadcast('escrow:account:updated', escrowSnapshot(store.adminSettings.escrowAccount));
    res.json({ escrowDepositInfo: escrowSnapshot(store.adminSettings.escrowAccount) });
  });

  // Admin full celebrity CRUD
  app.post('/api/admin/talents', requireAdmin, (req, res) => {
    const body = req.body as Partial<Talent> & {
      initialBlocks?: Array<{ date?: string; status?: string }>;
    };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (name.length < 2) {
      res.status(400).json({ error: 'Celebrity name is required.' });
      return;
    }
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) {
      res.status(400).json({ error: 'Could not generate a valid slug.' });
      return;
    }
    if (store.talents.some((t) => t.slug === slug)) {
      res.status(409).json({ error: 'A celebrity with this slug already exists.' });
      return;
    }
    const allowedCategories: Talent['category'][] = [
      'Film & Television',
      'Music & Recording',
      'Culinary & Hospitality',
      'Creative Direction',
      'Athletics & Keynote',
    ];
    const category = allowedCategories.includes(body.category as Talent['category'])
      ? (body.category as Talent['category'])
      : 'Film & Television';
    const dailyRate =
      typeof body.dailyRate === 'number' && Number.isFinite(body.dailyRate) && body.dailyRate >= 1000
        ? Math.round(Math.min(body.dailyRate, 2_000_000))
        : 10000;

    const talent: Talent = {
      id: `talent-${crypto.randomUUID().slice(0, 8)}`,
      slug,
      name,
      category,
      location: typeof body.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 80) : 'New York, NY',
      timezone: typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim().slice(0, 60) : 'America/New_York',
      dailyRate,
      currency: 'USD',
      portraitUrl: sanitizeSafeUrl(body.portraitUrl, true) || '/src/assets/images/hero_agency_salon_1795207489851.jpg',
      tagline: typeof body.tagline === 'string' ? body.tagline.trim().slice(0, 160) : '',
      biography: typeof body.biography === 'string' ? body.biography.trim().slice(0, 3000) : '',
      yearsActive:
        typeof body.yearsActive === 'number' && Number.isFinite(body.yearsActive)
          ? Math.round(Math.max(0, Math.min(body.yearsActive, 80)))
          : 1,
      experience: Array.isArray(body.experience)
        ? body.experience.slice(0, 20).map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : `exp-${crypto.randomUUID().slice(0, 8)}`,
            yearRange: String(item.yearRange || '').slice(0, 40),
            role: String(item.role || '').slice(0, 100),
            organization: String(item.organization || '').slice(0, 100),
            description: String(item.description || '').slice(0, 400),
          }))
        : [],
      portfolio: Array.isArray(body.portfolio)
        ? body.portfolio
            .map((item) => {
              const url = sanitizeSafeUrl(item?.url, true);
              if (!url || !item?.title) return null;
              return {
                id: typeof item.id === 'string' && item.id ? item.id : `port-${crypto.randomUUID().slice(0, 8)}`,
                title: String(item.title).slice(0, 120),
                mediaType: item.mediaType === 'video' ? ('video' as const) : ('image' as const),
                url,
                caption: String(item.caption || '').slice(0, 300),
                year: String(item.year || '2026').slice(0, 10),
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
            .slice(0, 24)
        : [],
      socialLinks: body.socialLinks && typeof body.socialLinks === 'object'
        ? {
            instagram: sanitizeSafeUrl(body.socialLinks.instagram) || undefined,
            imdb: sanitizeSafeUrl(body.socialLinks.imdb) || undefined,
            linkedin: sanitizeSafeUrl(body.socialLinks.linkedin) || undefined,
            youtube: sanitizeSafeUrl(body.socialLinks.youtube) || undefined,
            x: sanitizeSafeUrl(body.socialLinks.x) || undefined,
            website: sanitizeSafeUrl(body.socialLinks.website) || undefined,
          }
        : {},
      engagementTypes: Array.isArray(body.engagementTypes)
        ? body.engagementTypes.filter((e): e is string => typeof e === 'string' && !!e.trim()).map((e) => e.trim().slice(0, 60)).slice(0, 10)
        : [],
      representationManager:
        typeof body.representationManager === 'string' && body.representationManager.trim()
          ? body.representationManager.trim().slice(0, 100)
          : 'Hannah Sterling',
      responseTime: typeof body.responseTime === 'string' ? body.responseTime.trim().slice(0, 60) : 'Within 24 hours',
      verified: body.verified !== false,
      escrowFeePercent:
        typeof body.escrowFeePercent === 'number' && body.escrowFeePercent >= 0 && body.escrowFeePercent <= 50
          ? body.escrowFeePercent
          : undefined,
      archived: false,
    };

    store.talents.unshift(talent);
    if (Array.isArray(body.initialBlocks)) {
      for (const item of body.initialBlocks) {
        const date = typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : '';
        const status: SlotStatus = item?.status === 'travel' ? 'travel' : 'blocked';
        if (!date) continue;
        const idx = store.availability.findIndex((s) => s.talentId === talent.id && s.date === date);
        const slot: AvailabilitySlot = { talentId: talent.id, date, status, note: 'Admin initial block' };
        if (idx === -1) store.availability.push(slot);
        else store.availability[idx] = slot;
      }
    }
    saveStore(store);
    broadcast('talent:created', talent);
    broadcast('calendar:updated', { availability: store.availability });
    res.status(201).json({ talent });
  });

  app.put('/api/admin/talents/:id', requireAdmin, (req, res) => {
    const talent = store.talents.find((t) => t.id === req.params.id);
    if (!talent) {
      res.status(404).json({ error: 'Celebrity not found.' });
      return;
    }
    const body = req.body as Partial<Talent>;
    const allowedCategories: Talent['category'][] = [
      'Film & Television',
      'Music & Recording',
      'Culinary & Hospitality',
      'Creative Direction',
      'Athletics & Keynote',
    ];
    if (typeof body.name === 'string' && body.name.trim().length >= 2) talent.name = body.name.trim().slice(0, 120);
    if (typeof body.slug === 'string' && body.slug.trim()) {
      const nextSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (nextSlug && !store.talents.some((t) => t.id !== talent.id && t.slug === nextSlug)) talent.slug = nextSlug;
    }
    if (body.category && allowedCategories.includes(body.category)) talent.category = body.category;
    if (typeof body.location === 'string' && body.location.trim()) talent.location = body.location.trim().slice(0, 80);
    if (typeof body.timezone === 'string' && body.timezone.trim()) talent.timezone = body.timezone.trim().slice(0, 60);
    if (typeof body.dailyRate === 'number' && Number.isFinite(body.dailyRate) && body.dailyRate >= 1000) {
      talent.dailyRate = Math.round(Math.min(body.dailyRate, 2_000_000));
    }
    const portrait = sanitizeSafeUrl(body.portraitUrl, true);
    if (portrait) talent.portraitUrl = portrait;
    if (typeof body.tagline === 'string') talent.tagline = body.tagline.trim().slice(0, 160);
    if (typeof body.biography === 'string') talent.biography = body.biography.trim().slice(0, 3000);
    if (typeof body.yearsActive === 'number' && Number.isFinite(body.yearsActive)) {
      talent.yearsActive = Math.round(Math.max(0, Math.min(body.yearsActive, 80)));
    }
    if (typeof body.representationManager === 'string' && body.representationManager.trim()) {
      talent.representationManager = body.representationManager.trim().slice(0, 100);
    }
    if (typeof body.responseTime === 'string') talent.responseTime = body.responseTime.trim().slice(0, 60);
    if (typeof body.verified === 'boolean') talent.verified = body.verified;
    if (body.escrowFeePercent === undefined || body.escrowFeePercent === null) {
      talent.escrowFeePercent = undefined;
    } else if (typeof body.escrowFeePercent === 'number' && body.escrowFeePercent >= 0 && body.escrowFeePercent <= 50) {
      talent.escrowFeePercent = body.escrowFeePercent;
    }
    if (Array.isArray(body.engagementTypes)) {
      talent.engagementTypes = body.engagementTypes.filter((e): e is string => typeof e === 'string' && !!e.trim()).map((e) => e.trim().slice(0, 60)).slice(0, 10);
    }
    if (Array.isArray(body.experience)) {
      talent.experience = body.experience.slice(0, 20).map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `exp-${crypto.randomUUID().slice(0, 8)}`,
        yearRange: String(item.yearRange || '').slice(0, 40),
        role: String(item.role || '').slice(0, 100),
        organization: String(item.organization || '').slice(0, 100),
        description: String(item.description || '').slice(0, 400),
      }));
    }
    if (Array.isArray(body.portfolio)) {
      talent.portfolio = body.portfolio
        .map((item) => {
          const url = sanitizeSafeUrl(item?.url, true);
          if (!url || !item?.title) return null;
          return {
            id: typeof item.id === 'string' && item.id ? item.id : `port-${crypto.randomUUID().slice(0, 8)}`,
            title: String(item.title).slice(0, 120),
            mediaType: item.mediaType === 'video' ? ('video' as const) : ('image' as const),
            url,
            caption: String(item.caption || '').slice(0, 300),
            year: String(item.year || '2026').slice(0, 10),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 24);
    }
    if (body.socialLinks && typeof body.socialLinks === 'object') {
      talent.socialLinks = {
        instagram: sanitizeSafeUrl(body.socialLinks.instagram) || undefined,
        imdb: sanitizeSafeUrl(body.socialLinks.imdb) || undefined,
        linkedin: sanitizeSafeUrl(body.socialLinks.linkedin) || undefined,
        youtube: sanitizeSafeUrl(body.socialLinks.youtube) || undefined,
        x: sanitizeSafeUrl(body.socialLinks.x) || undefined,
        website: sanitizeSafeUrl(body.socialLinks.website) || undefined,
      };
    }
    saveStore(store);
    broadcast('talent:updated', talent);
    res.json({ talent });
  });

  app.post('/api/admin/talents/:id/archive', requireAdmin, (req, res) => {
    const talent = store.talents.find((t) => t.id === req.params.id);
    if (!talent) {
      res.status(404).json({ error: 'Celebrity not found.' });
      return;
    }
    talent.archived = req.body?.archived === false ? false : true;
    saveStore(store);
    broadcast('talent:updated', talent);
    res.json({ talent });
  });


  // Update Celebrity Profile (biography, experience, portfolio, socialLinks, tagline, rate)
  app.put('/api/talents/:id', (req, res) => {
    const talent = store.talents.find((t) => t.id === req.params.id);
    if (!talent) {
      res.status(404).json({ error: 'Celebrity profile not found' });
      return;
    }

    const body = req.body as Partial<Talent>;

    if (typeof body.tagline === 'string') {
      talent.tagline = body.tagline.trim().slice(0, 160);
    }
    if (typeof body.location === 'string' && body.location.trim()) {
      talent.location = body.location.trim().slice(0, 80);
    }
    if (typeof body.biography === 'string') {
      talent.biography = body.biography.trim().slice(0, 3000);
    }
    if (typeof body.dailyRate === 'number' && Number.isFinite(body.dailyRate) && body.dailyRate >= 1000 && body.dailyRate <= 2000000) {
      talent.dailyRate = Math.round(body.dailyRate);
    }
    if (typeof body.yearsActive === 'number' && Number.isFinite(body.yearsActive) && body.yearsActive >= 0 && body.yearsActive <= 80) {
      talent.yearsActive = Math.round(body.yearsActive);
    }
    if (Array.isArray(body.engagementTypes)) {
      talent.engagementTypes = body.engagementTypes
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        .map((e) => e.trim().slice(0, 60))
        .slice(0, 10);
    }
    if (Array.isArray(body.experience)) {
      talent.experience = body.experience
        .filter((item) => item && typeof item.role === 'string' && typeof item.organization === 'string')
        .map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id.slice(0, 40) : `exp-${crypto.randomUUID().slice(0, 8)}`,
          yearRange: String(item.yearRange || '').trim().slice(0, 40),
          role: String(item.role || '').trim().slice(0, 100),
          organization: String(item.organization || '').trim().slice(0, 100),
          description: String(item.description || '').trim().slice(0, 400),
        }))
        .slice(0, 20);
    }
    if (Array.isArray(body.portfolio)) {
      talent.portfolio = body.portfolio
        .map((item) => {
          const safeUrl = sanitizeSafeUrl(item?.url, true);
          if (!safeUrl || !item?.title) return null;
          return {
            id: typeof item.id === 'string' && item.id ? item.id.slice(0, 40) : `port-${crypto.randomUUID().slice(0, 8)}`,
            title: String(item.title).trim().slice(0, 120),
            mediaType: item.mediaType === 'video' ? ('video' as const) : ('image' as const),
            url: safeUrl,
            caption: String(item.caption || '').trim().slice(0, 300),
            year: String(item.year || '2026').trim().slice(0, 10),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 24);
    }
    if (body.socialLinks && typeof body.socialLinks === 'object') {
      talent.socialLinks = {
        instagram: sanitizeSafeUrl(body.socialLinks.instagram) || undefined,
        imdb: sanitizeSafeUrl(body.socialLinks.imdb) || undefined,
        linkedin: sanitizeSafeUrl(body.socialLinks.linkedin) || undefined,
        youtube: sanitizeSafeUrl(body.socialLinks.youtube) || undefined,
        x: sanitizeSafeUrl(body.socialLinks.x) || undefined,
        website: sanitizeSafeUrl(body.socialLinks.website) || undefined,
      };
    }

    saveStore(store);
    broadcast('talent:updated', talent);
    res.json({ talent });
  });

  // Update Client Profile
  app.put('/api/client-profile', (req, res) => {
    const body = req.body as Partial<ClientProfile>;
    if (typeof body.companyName !== 'string' || !body.companyName.trim()) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }
    if (typeof body.contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail.trim())) {
      res.status(400).json({ error: 'A valid contact email is required.' });
      return;
    }

    const allowedBudgets = new Set([
      '$15,000 – $30,000',
      '$30,000 – $75,000',
      '$75,000 – $150,000',
      '$150,000+',
    ]);

    store.clientProfile = {
      ...store.clientProfile,
      companyName: body.companyName.trim().slice(0, 120),
      contactName: typeof body.contactName === 'string' && body.contactName.trim() ? body.contactName.trim().slice(0, 80) : store.clientProfile.contactName,
      contactEmail: body.contactEmail.trim().slice(0, 120),
      industry: typeof body.industry === 'string' ? body.industry.trim().slice(0, 100) : store.clientProfile.industry,
      headquarters: typeof body.headquarters === 'string' ? body.headquarters.trim().slice(0, 100) : store.clientProfile.headquarters,
      website: sanitizeSafeUrl(body.website) || '',
      eventTypes: Array.isArray(body.eventTypes)
        ? body.eventTypes.filter((e): e is string => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim().slice(0, 60)).slice(0, 10)
        : store.clientProfile.eventTypes,
      preferredBudgetRange:
        body.preferredBudgetRange && allowedBudgets.has(body.preferredBudgetRange)
          ? body.preferredBudgetRange
          : store.clientProfile.preferredBudgetRange,
      billingEntity: typeof body.billingEntity === 'string' ? body.billingEntity.trim().slice(0, 120) : store.clientProfile.billingEntity,
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : store.clientProfile.notes,
      updatedAt: new Date().toISOString(),
    };

    saveStore(store);
    broadcast('client:updated', store.clientProfile);
    res.json({ clientProfile: store.clientProfile });
  });

  // Real-time calendar slot updates (Manager blocks/travel/available OR Client temporary hold)
  app.post('/api/calendar/update', (req, res) => {
    pruneExpiredHolds();
    const { talentId, dates, status, sessionId, note } = req.body as {
      talentId?: string;
      dates?: string[];
      status?: SlotStatus;
      sessionId?: string;
      note?: string;
    };

    if (!talentId || !Array.isArray(dates) || dates.length === 0) {
      res.status(400).json({ error: 'talentId and dates are required.' });
      return;
    }
    const talent = store.talents.find((t) => t.id === talentId);
    if (!talent) {
      res.status(404).json({ error: 'Talent not found.' });
      return;
    }

    const validStatuses = new Set<SlotStatus>(['available', 'hold', 'booked', 'blocked', 'travel']);
    if (!status || !validStatuses.has(status)) {
      res.status(400).json({ error: 'Invalid slot status.' });
      return;
    }

    const normalizedDates = Array.from(new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))));
    if (normalizedDates.length === 0) {
      res.status(400).json({ error: 'Valid YYYY-MM-DD dates are required.' });
      return;
    }

    // Check conflicts when acquiring a temporary client hold
    if (status === 'hold') {
      for (const d of normalizedDates) {
        const existing = store.availability.find((s) => s.talentId === talentId && s.date === d);
        if (existing && existing.status !== 'available') {
          if (existing.status === 'hold' && existing.holdSessionId && existing.holdSessionId === sessionId) {
            continue;
          }
          res.status(409).json({ error: `Date ${d} is currently ${existing.status}.` });
          return;
        }
      }
    }

    for (const d of normalizedDates) {
      const idx = store.availability.findIndex((s) => s.talentId === talentId && s.date === d);
      if (status === 'available') {
        if (idx !== -1) {
          // Only remove if not tied to an active confirmed booking unless explicitly cleared by manager
          store.availability.splice(idx, 1);
        }
      } else {
        const nextSlot: AvailabilitySlot = {
          talentId,
          date: d,
          status,
          holdSessionId: status === 'hold' ? sessionId : undefined,
          holdExpiresAt: status === 'hold' ? Date.now() + 10 * 60 * 1000 : undefined,
          note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 120) : undefined,
        };
        if (idx !== -1) {
          store.availability[idx] = nextSlot;
        } else {
          store.availability.push(nextSlot);
        }
      }
    }

    saveStore(store);
    broadcast('calendar:updated', { availability: store.availability });
    res.json({ availability: store.availability });
  });

  // Submit a Booking Inquiry / Request (Client -> Celebrity / Management)
  app.post('/api/inquiries', (req, res) => {
    pruneExpiredHolds();
    const {
      talentId,
      dates,
      eventType,
      eventLocation,
      clientCompany,
      contactName,
      contactEmail,
      notes,
      sessionId,
    } = req.body as {
      talentId?: string;
      dates?: string[];
      eventType?: string;
      eventLocation?: string;
      clientCompany?: string;
      contactName?: string;
      contactEmail?: string;
      notes?: string;
      sessionId?: string;
    };

    const talent = store.talents.find((t) => t.id === talentId);
    if (!talent) {
      res.status(404).json({ error: 'Selected celebrity not found.' });
      return;
    }

    const normalizedDates = Array.isArray(dates)
      ? Array.from(new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort()
      : [];

    if (normalizedDates.length === 0) {
      res.status(400).json({ error: 'Please select at least one date on the availability calendar.' });
      return;
    }
    if (typeof eventType !== 'string' || !eventType.trim()) {
      res.status(400).json({ error: 'Event type is required.' });
      return;
    }
    if (typeof eventLocation !== 'string' || !eventLocation.trim()) {
      res.status(400).json({ error: 'Event location is required.' });
      return;
    }
    if (typeof clientCompany !== 'string' || !clientCompany.trim()) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }
    if (typeof contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      res.status(400).json({ error: 'Valid contact email is required.' });
      return;
    }

    // Verify slot availability
    for (const d of normalizedDates) {
      const existing = store.availability.find((s) => s.talentId === talent.id && s.date === d);
      if (existing) {
        const isOwnTempHold = existing.status === 'hold' && !existing.bookingId && existing.holdSessionId === sessionId;
        if (!isOwnTempHold) {
          res.status(409).json({ error: `Date ${d} is no longer available (${existing.status}).` });
          return;
        }
      }
    }

    const talentSubtotal = talent.dailyRate * normalizedDates.length;
    const escrowFee = Math.round(talentSubtotal * (resolveEscrowPercent(talent) / 100));
    const totalAmount = talentSubtotal + escrowFee;
    const bookingId = `bk-${crypto.randomUUID().slice(0, 8)}`;
    const referenceCode = `MS-${new Date().getUTCFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const booking: Booking = {
      id: bookingId,
      referenceCode,
      talentId: talent.id,
      talentName: talent.name,
      clientCompany: clientCompany.trim().slice(0, 120),
      contactName: (contactName || store.clientProfile.contactName).trim().slice(0, 80),
      contactEmail: contactEmail.trim().slice(0, 120),
      eventType: eventType.trim().slice(0, 80),
      eventLocation: eventLocation.trim().slice(0, 120),
      dates: normalizedDates,
      dailyRate: talent.dailyRate,
      talentSubtotal,
      escrowFee,
      totalAmount,
      currency: 'USD',
      paymentStatus: 'unpaid',
      approvalStatus: 'not_submitted',
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
    };

    // Place inquiry hold on calendar
    for (const d of normalizedDates) {
      const idx = store.availability.findIndex((s) => s.talentId === talent.id && s.date === d);
      const slot: AvailabilitySlot = {
        talentId: talent.id,
        date: d,
        status: 'hold',
        bookingId: booking.id,
        note: `Inquiry hold — ${booking.clientCompany}`,
      };
      if (idx !== -1) store.availability[idx] = slot;
      else store.availability.push(slot);
    }

    store.bookings.unshift(booking);

    // Ensure or update chat thread
    let thread = store.threads.find((t) => t.talentId === talent.id);
    if (!thread) {
      thread = {
        id: `thread-${talent.id}`,
        talentId: talent.id,
        clientCompany: booking.clientCompany,
        subject: `${booking.eventType} — ${booking.eventLocation}`,
        lastMessageAt: nowIso,
        lastMessagePreview: `Submitted booking inquiry ${referenceCode}`,
        unreadForClient: 0,
        unreadForManager: 1,
        unreadForAdmin: 1,
      };
      store.threads.unshift(thread);
      broadcast('thread:created', thread);
    } else {
      thread.lastMessageAt = nowIso;
      thread.lastMessagePreview = `Submitted booking inquiry ${referenceCode}`;
      thread.unreadForManager += 1;
      thread.unreadForAdmin += 1;
    }

    const message: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      threadId: thread.id,
      senderRole: 'client',
      senderName: booking.contactName,
      body: `Submitted booking request ${referenceCode} for ${talent.name} (${booking.eventType} in ${booking.eventLocation}).${booking.notes ? ` Brief: ${booking.notes}` : ''}`,
      createdAt: nowIso,
      attachment: {
        type: 'booking_proposal',
        title: `Booking Inquiry ${referenceCode}`,
        dates: normalizedDates,
        amount: totalAmount,
        eventType: booking.eventType,
        referenceId: referenceCode,
      },
    };
    store.messages.push(message);

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'manager',
      title: 'New Booking Inquiry',
      message: `${booking.clientCompany} requested ${talent.name} on ${normalizedDates.join(', ')} (${booking.eventType}).`,
      category: 'inquiry',
      bookingId: booking.id,
      talentId: talent.id,
      read: false,
      createdAt: nowIso,
    };
    store.notifications.unshift(notification);

    saveStore(store);
    broadcast('calendar:updated', { availability: store.availability });
    broadcast('booking:created', booking);
    broadcast('chat:message', { message, thread });
    broadcast('notification:created', notification);

    res.status(201).json({ booking, threadId: thread.id });
  });

  // Accept or Decline a Booking Inquiry (Celebrity / Management Dashboard)
  app.post('/api/inquiries/:id/decision', (req, res) => {
    const booking = store.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking inquiry not found.' });
      return;
    }
    if (booking.status !== 'pending') {
      res.status(400).json({ error: `Inquiry has already been marked as ${booking.status}.` });
      return;
    }

    const { decision, decisionNote } = req.body as {
      decision?: 'accept' | 'decline';
      decisionNote?: string;
    };
    if (decision !== 'accept' && decision !== 'decline') {
      res.status(400).json({ error: 'decision must be accept or decline.' });
      return;
    }

    const nowIso = new Date().toISOString();
    booking.status = decision === 'accept' ? 'accepted' : 'declined';
    booking.decisionNote = typeof decisionNote === 'string' ? decisionNote.trim().slice(0, 500) : undefined;
    booking.updatedAt = nowIso;

    if (decision === 'decline') {
      store.availability = store.availability.filter((s) => s.bookingId !== booking.id);
    } else {
      // Keep dates held for this accepted booking until escrow settlement
      for (const s of store.availability) {
        if (s.bookingId === booking.id) {
          s.note = `Accepted hold — awaiting escrow (${booking.referenceCode})`;
        }
      }
    }

    const talent = store.talents.find((t) => t.id === booking.talentId);
    const thread = store.threads.find((t) => t.talentId === booking.talentId);
    if (thread) {
      const msgBody =
        decision === 'accept'
          ? `Management accepted booking inquiry ${booking.referenceCode} for ${booking.talentName}. Dates are held pending secure escrow settlement.${booking.decisionNote ? ` Note: ${booking.decisionNote}` : ''}`
          : `Booking inquiry ${booking.referenceCode} for ${booking.talentName} was declined.${booking.decisionNote ? ` Reason: ${booking.decisionNote}` : ''} Calendar dates have been released.`;

      const message: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        threadId: thread.id,
        senderRole: 'manager',
        senderName: talent?.representationManager || 'Talent Manager',
        body: msgBody,
        createdAt: nowIso,
      };
      store.messages.push(message);
      thread.lastMessageAt = nowIso;
      thread.lastMessagePreview = msgBody.slice(0, 110);
      thread.unreadForClient += 1;
      broadcast('chat:message', { message, thread });
    }

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'client',
      title: decision === 'accept' ? 'Booking Request Accepted' : 'Booking Request Declined',
      message:
        decision === 'accept'
          ? `${booking.talentName} accepted ${booking.referenceCode}. Proceed to Escrow Checkout to lock your dates.`
          : `${booking.talentName} declined ${booking.referenceCode}${booking.decisionNote ? `: ${booking.decisionNote}` : '.'}`,
      category: 'status_update',
      bookingId: booking.id,
      talentId: booking.talentId,
      read: false,
      createdAt: nowIso,
    };
    store.notifications.unshift(notification);

    saveStore(store);
    broadcast('booking:updated', booking);
    broadcast('calendar:updated', { availability: store.availability });
    broadcast('notification:created', notification);

    res.json({ booking });
  });

  // Submit a manual bank deposit for a booking. Admin approval is required.
  app.post('/api/deposits/submit', (req, res) => {
    pruneExpiredHolds();
    const {
      idempotencyKey,
      bookingId,
      talentId,
      dates,
      eventType,
      eventLocation,
      clientCompany,
      contactName,
      contactEmail,
      notes,
      sessionId,
      submittedAmount,
      proofUrl,
      reference,
      note,
    } = req.body as {
      idempotencyKey?: string;
      bookingId?: string;
      talentId?: string;
      dates?: string[];
      eventType?: string;
      eventLocation?: string;
      clientCompany?: string;
      contactName?: string;
      contactEmail?: string;
      notes?: string;
      sessionId?: string;
      submittedAmount?: number;
      proofUrl?: string;
      reference?: string;
      note?: string;
    };

    if (idempotencyKey && store.processedIdempotencyKeys[idempotencyKey]) {
      const existing = store.bookings.find((b) => b.id === store.processedIdempotencyKeys[idempotencyKey]);
      if (existing) {
        res.json({ booking: existing, deduplicated: true });
        return;
      }
    }

    const safeProofUrl = sanitizeSafeUrl(proofUrl, true);
    if (!safeProofUrl) {
      res.status(400).json({ error: 'Please upload a deposit receipt/proof image.' });
      return;
    }
    if (typeof submittedAmount !== 'number' || !Number.isFinite(submittedAmount) || submittedAmount <= 0) {
      res.status(400).json({ error: 'Please enter the deposit amount you sent.' });
      return;
    }

    let booking: Booking | undefined;
    if (bookingId) {
      booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }
      if (booking.approvalStatus === 'approved') {
        res.status(400).json({ error: 'This deposit has already been approved.' });
        return;
      }
    }

    const targetTalentId = booking ? booking.talentId : talentId;
    const talent = store.talents.find((t) => t.id === targetTalentId);
    if (!talent) {
      res.status(404).json({ error: 'Talent not found.' });
      return;
    }

    const targetDates = booking
      ? booking.dates
      : Array.isArray(dates)
        ? Array.from(new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort()
        : [];
    if (targetDates.length === 0) {
      res.status(400).json({ error: 'At least one booking date is required.' });
      return;
    }

    if (!booking) {
      for (const d of targetDates) {
        const slot = store.availability.find((s) => s.talentId === talent.id && s.date === d);
        if (slot) {
          const isOwnTempHold = slot.status === 'hold' && !slot.bookingId && slot.holdSessionId === sessionId;
          if (!isOwnTempHold) {
            res.status(409).json({ error: `Date ${d} is currently ${slot.status}.` });
            return;
          }
        }
      }
    }

    const talentSubtotal = talent.dailyRate * targetDates.length;
    const escrowFee = Math.round(talentSubtotal * (resolveEscrowPercent(talent) / 100));
    const totalAmount = talentSubtotal + escrowFee;
    const nowIso = new Date().toISOString();

    const deposit: DepositRecord = {
      id: `dep-${crypto.randomUUID().slice(0, 8)}`,
      type: 'booking',
      targetId: booking ? booking.id : `bk-${crypto.randomUUID().slice(0, 8)}`,
      submittedAt: nowIso,
      submittedBy: (contactEmail || booking?.contactEmail || store.clientProfile.contactEmail).trim().slice(0, 120),
      expectedAmount: booking ? booking.totalAmount : totalAmount,
      submittedAmount,
      method: 'bank_transfer',
      proofUrl: safeProofUrl,
      reference: typeof reference === 'string' ? reference.trim().slice(0, 120) : undefined,
      note: typeof note === 'string' ? note.trim().slice(0, 500) : undefined,
    };

    if (!booking) {
      const referenceCode = `MS-${new Date().getUTCFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      booking = {
        id: deposit.targetId,
        referenceCode,
        talentId: talent.id,
        talentName: talent.name,
        clientCompany: (clientCompany || store.clientProfile.companyName).trim().slice(0, 120),
        contactName: (contactName || store.clientProfile.contactName).trim().slice(0, 80),
        contactEmail: (contactEmail || store.clientProfile.contactEmail).trim().slice(0, 120),
        eventType: (eventType || 'Brand Campaign').trim().slice(0, 80),
        eventLocation: (eventLocation || 'New York, NY').trim().slice(0, 120),
        dates: targetDates,
        dailyRate: talent.dailyRate,
        talentSubtotal,
        escrowFee,
        totalAmount,
        currency: 'USD',
        paymentStatus: 'submitted',
        approvalStatus: 'pending_review',
        paymentMethodSummary: 'Bank Deposit',
        paymentProvider: 'escrow_gateway',
        paymentIntentId: reference || deposit.id,
        status: 'accepted',
        createdAt: nowIso,
        updatedAt: nowIso,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
        deposit,
        escrowAccountSnapshot: escrowSnapshot(store.adminSettings.escrowAccount),
      };
      store.bookings.unshift(booking);
    } else {
      booking.paymentStatus = 'submitted';
      booking.approvalStatus = 'pending_review';
      booking.paymentMethodSummary = 'Bank Deposit';
      booking.paymentIntentId = reference || deposit.id;
      booking.deposit = deposit;
      booking.escrowAccountSnapshot = escrowSnapshot(store.adminSettings.escrowAccount);
      booking.updatedAt = nowIso;
    }

    for (const d of targetDates) {
      const idx = store.availability.findIndex((s) => s.talentId === talent.id && s.date === d);
      const slot: AvailabilitySlot = {
        talentId: talent.id,
        date: d,
        status: 'hold',
        bookingId: booking.id,
        note: `Deposit pending admin approval — ${booking.clientCompany}`,
      };
      if (idx === -1) store.availability.push(slot);
      else store.availability[idx] = slot;
    }

    if (idempotencyKey) store.processedIdempotencyKeys[idempotencyKey] = booking.id;

    let thread = store.threads.find((t) => t.talentId === talent.id);
    if (!thread) {
      thread = {
        id: `thread-${talent.id}`,
        talentId: talent.id,
        clientCompany: booking.clientCompany,
        subject: `${booking.eventType} — ${booking.eventLocation}`,
        lastMessageAt: nowIso,
        lastMessagePreview: `Deposit submitted for ${booking.referenceCode}`,
        unreadForClient: 0,
        unreadForManager: 0,
        unreadForAdmin: 0,
      };
      store.threads.unshift(thread);
      broadcast('thread:created', thread);
    } else {
      thread.lastMessageAt = nowIso;
      thread.lastMessagePreview = `Deposit submitted for ${booking.referenceCode}`;
      thread.unreadForAdmin += 1;
    }

    const message: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      threadId: thread.id,
      senderRole: 'client',
      senderName: booking.contactName,
      body: `Deposit submitted for ${booking.referenceCode} ($${submittedAmount.toLocaleString('en-US')} USD). Awaiting admin approval.`,
      createdAt: nowIso,
      attachment: {
        type: 'booking_proposal',
        title: `Deposit Proof — ${booking.referenceCode}`,
        dates: targetDates,
        amount: submittedAmount,
        eventType: booking.eventType,
        referenceId: reference || booking.referenceCode,
      },
    };
    store.messages.push(message);

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'admin',
      title: 'Deposit Submitted for Approval',
      message: `${booking.clientCompany} submitted a $${submittedAmount.toLocaleString('en-US')} deposit for ${booking.referenceCode} (${talent.name}).`,
      category: 'deposit',
      bookingId: booking.id,
      talentId: talent.id,
      read: false,
      createdAt: nowIso,
    };
    store.notifications.unshift(notification);
    if (store.notifications.length > 50) store.notifications.length = 50;

    saveStore(store);
    broadcast('deposit:submitted', { type: 'booking', id: booking.id, reference: booking.referenceCode, amount: submittedAmount });
    broadcast('calendar:updated', { availability: store.availability });
    broadcast(bookingId ? 'booking:updated' : 'booking:created', booking);
    broadcast('chat:message', { message, thread });
    broadcast('notification:created', notification);

    res.status(201).json({ booking });
  });

  // Admin deposit review list/detail
  app.get('/api/admin/deposits', requireAdmin, (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const items = [
      ...store.bookings.filter((b) => b.deposit).map((b) => ({
        type: 'booking' as const,
        id: b.id,
        reference: b.referenceCode,
        title: b.talentName,
        client: b.clientCompany,
        contactEmail: b.contactEmail,
        expectedAmount: b.deposit!.expectedAmount,
        submittedAmount: b.deposit!.submittedAmount,
        proofUrl: b.deposit!.proofUrl,
        referenceNote: b.deposit!.reference,
        note: b.deposit!.note,
        submittedAt: b.deposit!.submittedAt,
        approvalStatus: b.approvalStatus,
        deposit: b.deposit!,
      })),
      ...store.fanCards.filter((f) => f.deposit).map((f) => ({
        type: 'fancard' as const,
        id: f.id,
        reference: f.cardNumber,
        title: `${f.talentName} — ${f.tier.toUpperCase()} Fan Card`,
        client: f.holderName,
        contactEmail: f.holderEmail,
        expectedAmount: f.deposit!.expectedAmount,
        submittedAmount: f.deposit!.submittedAmount,
        proofUrl: f.deposit!.proofUrl,
        referenceNote: f.deposit!.reference,
        note: f.deposit!.note,
        submittedAt: f.deposit!.submittedAt,
        approvalStatus: f.approvalStatus,
        deposit: f.deposit!,
      })),
    ].filter((item) => !status || item.approvalStatus === status);
    items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    res.json({ deposits: items });
  });

  app.get('/api/admin/deposits/:type/:id', requireAdmin, (req, res) => {
    const { type, id } = req.params;
    if (type === 'booking') {
      const booking = store.bookings.find((b) => b.id === id);
      if (!booking || !booking.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      res.json({ type, booking, deposit: booking.deposit });
      return;
    }
    if (type === 'fancard') {
      const card = store.fanCards.find((f) => f.id === id);
      if (!card || !card.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      res.json({ type, fanCard: card, deposit: card.deposit });
      return;
    }
    res.status(400).json({ error: 'Invalid deposit type.' });
  });

  app.post('/api/admin/deposits/:type/:id/approve', requireAdmin, (req, res) => {
    const { type, id } = req.params;
    const reviewer = 'Platform Admin';

    if (type === 'booking') {
      const booking = store.bookings.find((b) => b.id === id);
      if (!booking || !booking.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      if (booking.approvalStatus !== 'pending_review') {
        res.status(400).json({ error: `Deposit is already ${booking.approvalStatus}.` });
        return;
      }
      const nowIso = new Date().toISOString();
      booking.approvalStatus = 'approved';
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.updatedAt = nowIso;
      booking.deposit.reviewedAt = nowIso;
      booking.deposit.reviewedBy = reviewer;
      booking.receiptSignature = crypto
        .createHmac('sha256', RECEIPT_SECRET)
        .update(`${booking.referenceCode}:${booking.totalAmount}`)
        .digest('hex')
        .slice(0, 24);

      for (const d of booking.dates) {
        const idx = store.availability.findIndex((s) => s.talentId === booking.talentId && s.date === d);
        const slot: AvailabilitySlot = {
          talentId: booking.talentId,
          date: d,
          status: 'booked',
          bookingId: booking.id,
          note: `Confirmed — ${booking.clientCompany}`,
        };
        if (idx === -1) store.availability.push(slot);
        else store.availability[idx] = slot;
      }

      const thread = store.threads.find((t) => t.talentId === booking.talentId);
      if (thread) {
        const message: ChatMessage = {
          id: `msg-${crypto.randomUUID().slice(0, 8)}`,
          threadId: thread.id,
          senderRole: 'system',
          senderName: 'Escrow Settlement',
          body: `Deposit approved. Booking ${booking.referenceCode} is confirmed and your dates are locked. Receipt signature: ${booking.receiptSignature}.`,
          createdAt: nowIso,
          attachment: {
            type: 'payment_receipt',
            title: `Confirmed Engagement Receipt ${booking.referenceCode}`,
            dates: booking.dates,
            amount: booking.totalAmount,
            eventType: booking.eventType,
            referenceId: booking.referenceCode,
          },
        };
        store.messages.push(message);
        thread.lastMessageAt = nowIso;
        thread.lastMessagePreview = `Deposit approved — ${booking.referenceCode}`;
        thread.unreadForClient += 1;
        broadcast('chat:message', { message, thread });
      }

      const notification: AppNotification = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        recipientRole: 'client',
        title: 'Deposit Approved — Booking Confirmed',
        message: `${booking.referenceCode} for ${booking.talentName} is confirmed. Your dates are locked.`,
        category: 'deposit',
        bookingId: booking.id,
        talentId: booking.talentId,
        read: false,
        createdAt: nowIso,
      };
      store.notifications.unshift(notification);
      saveStore(store);
      broadcast('deposit:approved', { type: 'booking', id: booking.id, reference: booking.referenceCode });
      broadcast('booking:updated', booking);
      broadcast('calendar:updated', { availability: store.availability });
      broadcast('notification:created', notification);
      res.json({ booking });
      return;
    }

    if (type === 'fancard') {
      const card = store.fanCards.find((f) => f.id === id);
      if (!card || !card.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      if (card.approvalStatus !== 'pending_review') {
        res.status(400).json({ error: `Deposit is already ${card.approvalStatus}.` });
        return;
      }
      const { cardImageUrl } = req.body as { cardImageUrl?: string };
      const safeCardImage = sanitizeSafeUrl(cardImageUrl, true);
      if (!safeCardImage) {
        res.status(400).json({ error: 'Upload the official Fan Card image before approving.' });
        return;
      }
      const nowIso = new Date().toISOString();
      card.approvalStatus = 'approved';
      card.paymentStatus = 'paid';
      card.active = true;
      card.cardImageUrl = safeCardImage;
      card.approvedAt = nowIso;
      card.approvedBy = reviewer;
      card.deposit.reviewedAt = nowIso;
      card.deposit.reviewedBy = reviewer;
      card.receiptSignature = crypto
        .createHmac('sha256', RECEIPT_SECRET)
        .update(`${card.cardNumber}:${card.annualFee}`)
        .digest('hex')
        .slice(0, 20);

      const notification: AppNotification = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        recipientRole: 'client',
        title: 'Fan Card Approved',
        message: `Your ${card.tier.toUpperCase()} Fan Card for ${card.talentName} is now active.`,
        category: 'deposit',
        talentId: card.talentId,
        read: false,
        createdAt: nowIso,
      };
      store.notifications.unshift(notification);
      saveStore(store);
      broadcast('deposit:approved', { type: 'fancard', id: card.id, reference: card.cardNumber });
      broadcast('fancard:created', card);
      broadcast('notification:created', notification);
      res.json({ fanCard: card });
      return;
    }

    res.status(400).json({ error: 'Invalid deposit type.' });
  });

  app.post('/api/admin/deposits/:type/:id/reject', requireAdmin, (req, res) => {
    const { type, id } = req.params;
    const { reason } = req.body as { reason?: string };
    if (typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(400).json({ error: 'A rejection reason is required.' });
      return;
    }
    const nowIso = new Date().toISOString();

    if (type === 'booking') {
      const booking = store.bookings.find((b) => b.id === id);
      if (!booking || !booking.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      booking.approvalStatus = 'rejected';
      booking.paymentStatus = 'rejected';
      booking.deposit.rejectionReason = reason.trim().slice(0, 500);
      booking.deposit.reviewedAt = nowIso;
      booking.deposit.reviewedBy = 'Platform Admin';
      booking.updatedAt = nowIso;
      store.availability = store.availability.filter((s) => s.bookingId !== booking.id);
      const notification: AppNotification = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        recipientRole: 'client',
        title: 'Deposit Rejected',
        message: `${booking.referenceCode}: ${reason.trim().slice(0, 200)}`,
        category: 'deposit',
        bookingId: booking.id,
        read: false,
        createdAt: nowIso,
      };
      store.notifications.unshift(notification);
      saveStore(store);
      broadcast('deposit:rejected', { type: 'booking', id: booking.id, reason: booking.deposit.rejectionReason });
      broadcast('booking:updated', booking);
      broadcast('calendar:updated', { availability: store.availability });
      broadcast('notification:created', notification);
      res.json({ booking });
      return;
    }

    if (type === 'fancard') {
      const card = store.fanCards.find((f) => f.id === id);
      if (!card || !card.deposit) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      card.approvalStatus = 'rejected';
      card.paymentStatus = 'rejected';
      card.active = false;
      card.rejectionReason = reason.trim().slice(0, 500);
      card.deposit.rejectionReason = card.rejectionReason;
      card.deposit.reviewedAt = nowIso;
      card.deposit.reviewedBy = 'Platform Admin';
      const notification: AppNotification = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        recipientRole: 'client',
        title: 'Fan Card Deposit Rejected',
        message: `${card.cardNumber}: ${reason.trim().slice(0, 200)}`,
        category: 'deposit',
        read: false,
        createdAt: nowIso,
      };
      store.notifications.unshift(notification);
      saveStore(store);
      broadcast('deposit:rejected', { type: 'fancard', id: card.id, reason: card.rejectionReason });
      broadcast('notification:created', notification);
      res.json({ fanCard: card });
      return;
    }

    res.status(400).json({ error: 'Invalid deposit type.' });
  });

  app.post('/api/admin/fan-cards/:id/image', requireAdmin, (req, res) => {
    const card = store.fanCards.find((f) => f.id === req.params.id);
    if (!card) {
      res.status(404).json({ error: 'Fan Card not found.' });
      return;
    }
    const { cardImageUrl } = req.body as { cardImageUrl?: string };
    const safeCardImage = sanitizeSafeUrl(cardImageUrl, true);
    if (!safeCardImage) {
      res.status(400).json({ error: 'Invalid card image URL.' });
      return;
    }
    card.cardImageUrl = safeCardImage;
    saveStore(store);
    broadcast('fancard:created', card);
    res.json({ fanCard: card });
  });



  // Cancel booking & release dates
  app.post('/api/bookings/:id/cancel', (req, res) => {
    const booking = store.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    booking.status = 'cancelled';
    if (booking.paymentStatus === 'paid') {
      booking.paymentStatus = 'refunded';
    }
    if (booking.approvalStatus === 'pending_review') {
      booking.approvalStatus = 'rejected';
      if (booking.deposit) {
        booking.deposit.rejectionReason = 'Booking cancelled before deposit approval.';
      }
    }
    booking.updatedAt = new Date().toISOString();

    store.availability = store.availability.filter((s) => s.bookingId !== booking.id);

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'all',
      title: 'Engagement Cancelled',
      message: `${booking.referenceCode} (${booking.talentName}) was cancelled and calendar dates were released.`,
      category: 'status_update',
      bookingId: booking.id,
      talentId: booking.talentId,
      read: false,
      createdAt: booking.updatedAt,
    };
    store.notifications.unshift(notification);

    saveStore(store);
    broadcast('booking:updated', booking);
    broadcast('calendar:updated', { availability: store.availability });
    broadcast('notification:created', notification);

    res.json({ booking });
  });

  // Mark notifications read
  app.post('/api/notifications/read', (req, res) => {
    const { id } = req.body as { id?: string };
    if (id === 'all') {
      for (const n of store.notifications) n.read = true;
    } else if (typeof id === 'string') {
      const target = store.notifications.find((n) => n.id === id);
      if (target) target.read = true;
    }
    saveStore(store);
    broadcast('notifications:synced', store.notifications);
    res.json({ notifications: store.notifications });
  });

  // Submit a manual bank deposit for an Official Fan Card. Admin approval + image upload required.
  app.post('/api/fan-cards', (req, res) => {
    const {
      talentId,
      tier,
      holderName,
      holderEmail,
      submittedAmount,
      proofUrl,
      reference,
      note,
    } = req.body as {
      talentId?: string;
      tier?: FanCardTier;
      holderName?: string;
      holderEmail?: string;
      submittedAmount?: number;
      proofUrl?: string;
      reference?: string;
      note?: string;
    };

    const talent = store.talents.find((t) => t.id === talentId);
    if (!talent) {
      res.status(404).json({ error: 'Selected celebrity not found.' });
      return;
    }

    const prices = store.adminSettings.fanCardPrices;
    if (!tier || !prices[tier]) {
      res.status(400).json({ error: 'Please select a valid Fan Card tier.' });
      return;
    }

    const cleanName = typeof holderName === 'string' ? holderName.trim().slice(0, 80) : '';
    const cleanEmail = typeof holderEmail === 'string' ? holderEmail.trim().slice(0, 120) : '';
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Cardholder full name is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'A valid member email address is required.' });
      return;
    }

    const safeProofUrl = sanitizeSafeUrl(proofUrl, true);
    if (!safeProofUrl) {
      res.status(400).json({ error: 'Please upload a deposit receipt/proof image.' });
      return;
    }
    if (typeof submittedAmount !== 'number' || !Number.isFinite(submittedAmount) || submittedAmount <= 0) {
      res.status(400).json({ error: 'Please enter the deposit amount you sent.' });
      return;
    }

    const annualFee = prices[tier];
    const nowIso = new Date().toISOString();
    const prefix = talent.name
      .split(' ')
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 3);
    const serial = `FC-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const validUntilDate = new Date(nowIso);
    validUntilDate.setUTCFullYear(validUntilDate.getUTCFullYear() + 1);

    const deposit: DepositRecord = {
      id: `dep-${crypto.randomUUID().slice(0, 8)}`,
      type: 'fancard',
      targetId: `fc-${crypto.randomUUID().slice(0, 8)}`,
      submittedAt: nowIso,
      submittedBy: cleanEmail,
      expectedAmount: annualFee,
      submittedAmount,
      method: 'bank_transfer',
      proofUrl: safeProofUrl,
      reference: typeof reference === 'string' ? reference.trim().slice(0, 120) : undefined,
      note: typeof note === 'string' ? note.trim().slice(0, 500) : undefined,
    };

    const fanCard: FanCard = {
      id: deposit.targetId,
      cardNumber: serial,
      talentId: talent.id,
      talentName: talent.name,
      tier,
      holderName: cleanName,
      holderEmail: cleanEmail,
      ownerKey: cleanEmail.toLowerCase(),
      annualFee,
      currency: 'USD',
      active: false,
      paymentStatus: 'submitted',
      approvalStatus: 'pending_review',
      paymentMethodSummary: 'Bank Deposit',
      receiptSignature: '',
      deposit,
      validUntil: validUntilDate.toISOString().slice(0, 10),
      createdAt: nowIso,
    };

    store.fanCards.unshift(fanCard);

    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      recipientRole: 'admin',
      title: 'Fan Card Deposit Submitted',
      message: `${cleanName} submitted a $${submittedAmount.toLocaleString('en-US')} deposit for a ${tier.toUpperCase()} Fan Card (${talent.name}).`,
      category: 'deposit',
      talentId: talent.id,
      read: false,
      createdAt: nowIso,
    };
    store.notifications.unshift(notification);
    if (store.notifications.length > 50) store.notifications.length = 50;

    saveStore(store);
    broadcast('deposit:submitted', { type: 'fancard', id: fanCard.id, reference: serial, amount: submittedAmount });
    broadcast('fancard:pending', fanCard);
    broadcast('notification:created', notification);

    res.status(201).json({ fanCard });
  });


  // Update Normal User Account Profile, KYC Details & Settings
  app.put('/api/user-account', (req, res) => {
    const body = req.body as Partial<UserAccountProfile> & {
      kycDocumentNumber?: string;
    };

    const nextFullName =
      typeof body.fullName === 'string' && body.fullName.trim().length >= 2
        ? body.fullName.trim().slice(0, 80)
        : store.userAccount.fullName;

    const nextEmail =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().slice(0, 120)
        : store.userAccount.email;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      res.status(400).json({ error: 'Please provide a valid login email address.' });
      return;
    }

    const nextUsername =
      typeof body.username === 'string' && body.username.trim().length >= 2
        ? body.username.trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40)
        : store.userAccount.username;

    const nextDob =
      typeof body.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)
        ? body.dateOfBirth
        : store.userAccount.dateOfBirth;

    const allowedDocTypes = new Set(['Passport', 'Drivers License', 'National ID']);
    let nextKyc = { ...store.userAccount.kyc };
    if (body.kyc && typeof body.kyc === 'object') {
      const legalName =
        typeof body.kyc.legalName === 'string' && body.kyc.legalName.trim()
          ? body.kyc.legalName.trim().slice(0, 100)
          : nextKyc.legalName;
      const docType =
        body.kyc.documentType && allowedDocTypes.has(body.kyc.documentType)
          ? body.kyc.documentType
          : nextKyc.documentType;
      const issuingCountry =
        typeof body.kyc.issuingCountry === 'string' && body.kyc.issuingCountry.trim()
          ? body.kyc.issuingCountry.trim().slice(0, 80)
          : nextKyc.issuingCountry;
      const docExpiry =
        typeof body.kyc.documentExpiry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.kyc.documentExpiry)
          ? body.kyc.documentExpiry
          : nextKyc.documentExpiry;
      const docFileUrl = body.kyc.documentFileUrl
        ? sanitizeSafeUrl(body.kyc.documentFileUrl, true) || nextKyc.documentFileUrl
        : nextKyc.documentFileUrl;

      let maskedNumber = nextKyc.documentNumberMasked;
      if (typeof body.kycDocumentNumber === 'string' && body.kycDocumentNumber.trim().length >= 4) {
        const cleanDoc = body.kycDocumentNumber.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanDoc.length >= 4) {
          maskedNumber = `•••• ${cleanDoc.slice(-4).toUpperCase()}`;
        }
      }

      const kycChanged =
        Boolean(body.kycDocumentNumber && body.kycDocumentNumber.trim().length >= 4) ||
        legalName !== nextKyc.legalName ||
        docType !== nextKyc.documentType ||
        docExpiry !== nextKyc.documentExpiry ||
        docFileUrl !== nextKyc.documentFileUrl;

      nextKyc = {
        status: kycChanged ? 'verified' : nextKyc.status,
        legalName,
        documentType: docType,
        documentNumberMasked: maskedNumber,
        documentExpiry: docExpiry,
        issuingCountry,
        documentFileUrl: docFileUrl,
        submittedAt: kycChanged ? new Date().toISOString() : nextKyc.submittedAt,
      };
    }

    const nextPrefs = body.preferences
      ? {
          bookingAlerts: Boolean(body.preferences.bookingAlerts),
          messageAlerts: Boolean(body.preferences.messageAlerts),
          fanCardPerks: Boolean(body.preferences.fanCardPerks),
          marketingEmails: Boolean(body.preferences.marketingEmails),
        }
      : store.userAccount.preferences;

    store.userAccount = {
      ...store.userAccount,
      fullName: nextFullName,
      username: nextUsername || store.userAccount.username,
      email: nextEmail,
      phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : store.userAccount.phone,
      dateOfBirth: nextDob,
      addressLine: typeof body.addressLine === 'string' ? body.addressLine.trim().slice(0, 140) : store.userAccount.addressLine,
      city: typeof body.city === 'string' ? body.city.trim().slice(0, 80) : store.userAccount.city,
      postalCode: typeof body.postalCode === 'string' ? body.postalCode.trim().slice(0, 24) : store.userAccount.postalCode,
      country: typeof body.country === 'string' ? body.country.trim().slice(0, 80) : store.userAccount.country,
      twoFactorEnabled:
        typeof body.twoFactorEnabled === 'boolean' ? body.twoFactorEnabled : store.userAccount.twoFactorEnabled,
      timezone: typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim().slice(0, 60) : store.userAccount.timezone,
      preferredCurrency: 'USD',
      kyc: nextKyc,
      preferences: nextPrefs,
      updatedAt: new Date().toISOString(),
    };

    saveStore(store);
    broadcast('user:updated', store.userAccount);
    res.json({ userAccount: store.userAccount });
  });

  // Update User Login Password (hashed with random salt via scrypt; never stored in plaintext)
  app.put('/api/user-account/password', requireClient, (req, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, store.userPasswordHash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    store.userPasswordHash = hashPassword(newPassword);
    store.userAccount.updatedAt = new Date().toISOString();

    saveStore(store);
    res.json({ updated: true, updatedAt: store.userAccount.updatedAt });
  });

  // Submit a Client / Event Review
  app.post('/api/reviews', (req, res) => {
    const { reviewerName, reviewerRole, companyName, talentName, eventType, rating, comment } = req.body as {
      reviewerName?: string;
      reviewerRole?: string;
      companyName?: string;
      talentName?: string;
      eventType?: string;
      rating?: number;
      comment?: string;
    };

    const cleanName = typeof reviewerName === 'string' ? reviewerName.trim().slice(0, 80) : '';
    const cleanComment = typeof comment === 'string' ? comment.trim().slice(0, 600) : '';
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Reviewer name is required.' });
      return;
    }
    if (cleanComment.length < 10) {
      res.status(400).json({ error: 'Please write at least 10 characters for your review.' });
      return;
    }

    const numericRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    const review: ClientReview = {
      id: `rev-${crypto.randomUUID().slice(0, 8)}`,
      reviewerName: cleanName,
      reviewerRole: typeof reviewerRole === 'string' && reviewerRole.trim() ? reviewerRole.trim().slice(0, 80) : 'Event Organizer',
      companyName: typeof companyName === 'string' && companyName.trim() ? companyName.trim().slice(0, 100) : 'Private Client',
      talentName: typeof talentName === 'string' && talentName.trim() ? talentName.trim().slice(0, 80) : 'Mercer & Sterling Roster',
      eventType: typeof eventType === 'string' && eventType.trim() ? eventType.trim().slice(0, 80) : 'Private Engagement',
      rating: numericRating,
      comment: cleanComment,
      createdAt: new Date().toISOString(),
    };

    store.reviews.unshift(review);
    saveStore(store);
    broadcast('review:created', review);
    res.status(201).json({ review });
  });

  return app;
}

async function startLocalServer() {
  const app = await createApiApp();
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mercer & Sterling server running on http://0.0.0.0:${PORT}`);
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  startLocalServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

