import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Star } from 'lucide-react';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';

export const HomePage: React.FC = () => {
  const { talents, reviews, userAccount, submitReview, pushToast, navigate } = usePlatform();

  const featuredTalents = talents.slice(0, 6);

  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState(userAccount?.fullName || '');
  const [reviewerRole, setReviewerRole] = useState('Event Organizer');
  const [companyName, setCompanyName] = useState('');
  const [talentName, setTalentName] = useState(talents[0]?.name || 'Elena Rostova');
  const [eventType, setEventType] = useState('Keynote & Fireside Chat');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setSubmittingReview(true);
    try {
      await submitReview({
        reviewerName: reviewerName || userAccount?.fullName || 'Client Member',
        reviewerRole,
        companyName,
        talentName,
        eventType,
        rating,
        comment,
      });
      setComment('');
      setReviewFormOpen(false);
      pushToast('Review Published', 'Your client review is now live on the homepage.', 'success');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-20 pb-8">
      {/* Modern Architectural Hero */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 py-2">
            <p className="text-xs font-medium text-zinc-500">
              Talent Representation <span aria-hidden="true">·</span> Live Scheduling <span aria-hidden="true">·</span>{' '}
              Escrow Settlement
            </p>
            <h1
              className="font-display font-bold tracking-tight text-zinc-950 leading-[1.06]"
              style={{ fontSize: 'clamp(2.5rem, 4.2vw, 3.75rem)' }}
            >
              Direct booking for global cultural talent.
            </h1>
            <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
              Explore verified celebrity dossiers, lock real-time calendar dates, message representation directly, and
              settle engagements through protected escrow.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/roster')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl transition-colors cursor-pointer"
              >
                <span>Browse Talent Roster</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-900 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl transition-colors cursor-pointer"
              >
                <span>Live Availability</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-80 sm:h-[420px] lg:h-full min-h-[380px] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100">
              <SafeImage
                src="/src/assets/images/hero_agency_salon_1795207489851.jpg"
                alt="Mercer & Sterling Tribeca representation salon"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-zinc-950/85 via-zinc-950/40 to-transparent text-white flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-mono text-zinc-300">Tribeca Salon · New York</p>
                  <p className="mt-0.5 font-display text-base font-semibold">
                    Synchronized WebSocket Scheduling &amp; Escrow
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-100 rounded-lg cursor-pointer"
                >
                  <span>Open Chat</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Metric Strip */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="bg-white p-6">
            <p className="font-mono tabular-nums text-2xl font-semibold text-zinc-950">400</p>
            <p className="mt-1 text-xs text-zinc-500">Represented Principals</p>
          </div>
          <div className="bg-white p-6">
            <p className="font-mono tabular-nums text-2xl font-semibold text-zinc-950">2 Million</p>
            <p className="mt-1 text-xs text-zinc-500">Open Booking Windows (30d)</p>
          </div>
          <div className="bg-white p-6">
            <p className="font-mono tabular-nums text-2xl font-semibold text-zinc-950">100,000</p>
            <p className="mt-1 text-xs text-zinc-500">Active Inquiries &amp; Contracts</p>
          </div>
          <div className="bg-white p-6">
            <p className="font-mono tabular-nums text-2xl font-semibold text-zinc-950">100%</p>
            <p className="mt-1 text-xs text-zinc-500">Escrow Protection Fee</p>
          </div>
        </div>
      </section>

      {/* Modern Asymmetric Bento Roster Showcase */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Featured Roster
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Inspect biographies, uploaded media reels, and real-time calendar availability.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="text-sm font-semibold text-zinc-950 hover:text-blue-600 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <span>Explore all talent</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {featuredTalents.map((talent) => (
            <article
              key={talent.id}
              onClick={() => navigate(`/talent/${talent.slug}`)}
              className="group relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-[3/4] cursor-pointer hover:border-zinc-950 transition-colors"
            >
              <SafeImage
                src={talent.portraitUrl}
                alt={`${talent.name} portrait`}
                fallbackText={talent.name}
                className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-zinc-950/90 via-zinc-950/45 to-transparent text-white">
                <p className="text-[10px] text-zinc-300 truncate">{talent.category}</p>
                <h3 className="mt-0.5 font-display text-sm font-bold tracking-tight truncate">{talent.name}</h3>
                <p className="mt-0.5 font-mono tabular-nums text-[11px] text-zinc-200">
                  ${talent.dailyRate.toLocaleString('en-US')}/d
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Modern Dark Obsidian Contrast Band */}
      <section className="bg-zinc-950 text-zinc-50 py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Built for Real-Time Precision
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Synchronized availability, live client-agent messaging, and atomic escrow clearance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/client-profile')}
              className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Configure Client Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
              <p className="font-mono text-xs text-blue-400">01.</p>
              <h3 className="font-display text-lg font-semibold text-white">Live Calendar Holds</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Select open appearance windows and submit structured event requests that reserve dates across all
                connected sessions.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
              <p className="font-mono text-xs text-blue-400">02.</p>
              <h3 className="font-display text-lg font-semibold text-white">Seamless Agent Chat</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Discuss riders, staging, and schedules directly with representation over WebSocket threads with live
                proposal attachments.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
              <p className="font-mono text-xs text-blue-400">03.</p>
              <h3 className="font-display text-lg font-semibold text-white">Verified Escrow Checkout</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Server-calculated totals, manual bank deposits with admin approval, and signed receipts lock
                dates atomically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Client & Event Reviews */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs font-medium text-zinc-500 inline-flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-mono tabular-nums font-semibold text-zinc-950">{avgRating} / 5.0</span>
              <span>· Based on {reviews.length} verified client reviews</span>
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Client &amp; Event Reviews
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Feedback from production directors, brand partners, and private event organizers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setReviewerName((prev) => prev || userAccount?.fullName || '');
              setReviewFormOpen((v) => !v);
            }}
            className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
          >
            {reviewFormOpen ? 'Cancel' : 'Write a Review'}
          </button>
        </div>

        {reviewFormOpen && (
          <form
            onSubmit={handleSubmitReview}
            className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-zinc-950">Share Your Experience</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setRating(starVal)}
                    className="p-1 cursor-pointer"
                    aria-label={`Rate ${starVal} stars`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        starVal <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {reviewError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{reviewError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Your Name *</span>
                <input
                  type="text"
                  required
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Jordan Reyes"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Role / Title</span>
                <input
                  type="text"
                  value={reviewerRole}
                  onChange={(e) => setReviewerRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Company / Event</span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Northbridge Holdings"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Celebrity Booked</span>
                <select
                  value={talentName}
                  onChange={(e) => setTalentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                >
                  {talents.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Engagement Type</span>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-zinc-700">Your Review *</span>
                <input
                  type="text"
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share how booking, messaging, and event delivery went..."
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
              >
                {submittingReview ? 'Publishing...' : 'Publish Review'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev) => (
            <article
              key={rev.id}
              className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5" aria-label={`${rev.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-zinc-700 leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-1">
                <p className="text-xs font-semibold text-zinc-950">{rev.reviewerName}</p>
                <p className="text-[11px] text-zinc-500">
                  {rev.reviewerRole} · {rev.companyName}
                </p>
                <p className="text-[11px] font-medium text-blue-600 pt-0.5">
                  {rev.talentName} · {rev.eventType}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
