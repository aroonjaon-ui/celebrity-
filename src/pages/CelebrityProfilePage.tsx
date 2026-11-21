import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Landmark,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AvailabilityGrid } from '../components/AvailabilityGrid.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { ExperienceItem, FanCard, FanCardTier, PortfolioItem, SocialLinks, Talent } from '../types.ts';

export const CelebrityProfilePage: React.FC<{ slug: string }> = ({ slug }) => {
  const {
    talents,
    clientProfile,
    availability,
    threads,
    fanCards,
    workspace,
    adminSettings,
    escrowDepositInfo,
    navigate,
    updateTalentProfile,
    uploadMediaFile,
    submitInquiry,
    purchaseFanCard,
    setCheckoutDraft,
    pushToast,
  } = usePlatform();

  const talent = useMemo(() => talents.find((t) => t.slug === slug), [talents, slug]);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [eventType, setEventType] = useState('');
  const [eventLocation, setEventLocation] = useState('New York, NY');
  const [clientCompany, setClientCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editTagline, setEditTagline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDailyRate, setEditDailyRate] = useState(25000);
  const [editBio, setEditBio] = useState('');
  const [editExperience, setEditExperience] = useState<ExperienceItem[]>([]);
  const [editPortfolio, setEditPortfolio] = useState<PortfolioItem[]>([]);
  const [editSocials, setEditSocials] = useState<SocialLinks>({});
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaCaption, setNewMediaCaption] = useState('');
  const [newMediaYear, setNewMediaYear] = useState('2026');
  const [savingProfile, setSavingProfile] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);

  const [fanCardOpen, setFanCardOpen] = useState(false);
  const [fanCardTier, setFanCardTier] = useState<FanCardTier>('gold');
  const [fanHolderName, setFanHolderName] = useState('');
  const [fanHolderEmail, setFanHolderEmail] = useState('');
  const [fanProofUrl, setFanProofUrl] = useState('');
  const [fanProofName, setFanProofName] = useState('');
  const [uploadingFanProof, setUploadingFanProof] = useState(false);
  const [fanSubmittedAmount, setFanSubmittedAmount] = useState('');
  const [fanDepositReference, setFanDepositReference] = useState('');
  const [fanDepositNote, setFanDepositNote] = useState('');
  const [fanCardSubmitting, setFanCardSubmitting] = useState(false);
  const [fanCardError, setFanCardError] = useState('');
  const [submittedFanCard, setSubmittedFanCard] = useState<FanCard | null>(null);

  const fanCardPrices = adminSettings?.fanCardPrices;

  useEffect(() => {
    if (talent) {
      setEventType(talent.engagementTypes[0] || 'Brand Campaign');
      setEditTagline(talent.tagline);
      setEditLocation(talent.location);
      setEditDailyRate(talent.dailyRate);
      setEditBio(talent.biography);
      setEditExperience(talent.experience);
      setEditPortfolio(talent.portfolio);
      setEditSocials(talent.socialLinks || {});
    }
  }, [talent]);

  useEffect(() => {
    if (clientProfile) {
      setClientCompany(clientProfile.companyName);
      setContactName(clientProfile.contactName);
      setContactEmail(clientProfile.contactEmail);
      setFanHolderName((prev) => prev || clientProfile.contactName);
      setFanHolderEmail((prev) => prev || clientProfile.contactEmail);
    }
  }, [clientProfile]);

  useEffect(() => {
    const tierPrice = adminSettings?.fanCardPrices?.[fanCardTier];
    if (tierPrice != null) setFanSubmittedAmount(String(tierPrice));
  }, [adminSettings, fanCardTier]);

  if (!talent) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-zinc-950">Celebrity Profile Not Found</h1>
        <button
          type="button"
          onClick={() => navigate('/roster')}
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
        >
          Back to Roster
        </button>
      </div>
    );
  }

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const subtotal = talent.dailyRate * selectedDates.length;
  const escrowPercent =
    (talent as Talent & { escrowFeePercent?: number }).escrowFeePercent ?? adminSettings?.escrowFeePercent;
  const escrowFee = escrowPercent == null ? null : Math.round(subtotal * (escrowPercent / 100));
  const totalEstimate = subtotal + (escrowFee ?? 0);

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError('');
    if (selectedDates.length === 0) {
      setInquiryError('Select at least one open date on the calendar.');
      return;
    }
    setSubmitting(true);
    try {
      const { booking } = await submitInquiry({
        talentId: talent.id,
        dates: selectedDates,
        eventType,
        eventLocation,
        clientCompany,
        contactName,
        contactEmail,
        notes,
      });
      setSelectedDates([]);
      setNotes('');
      pushToast(
        'Booking Inquiry Sent',
        `Request ${booking.referenceCode} sent to ${talent.name}'s management for review.`,
        'success'
      );
      navigate('/bookings');
    } catch (err) {
      setInquiryError(err instanceof Error ? err.message : 'Unable to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantCheckout = () => {
    setInquiryError('');
    if (selectedDates.length === 0) {
      setInquiryError('Select at least one open date on the calendar before proceeding to payment.');
      return;
    }
    setCheckoutDraft({ talentId: talent.id, dates: selectedDates });
    navigate('/checkout');
  };

  const talentFanCards = useMemo(
    () => fanCards.filter((c) => c.talentId === talent.id),
    [fanCards, talent.id]
  );

  const isFanCardActive = (card: FanCard) =>
    card.active && card.approvalStatus === 'approved' && Boolean(card.cardImageUrl);
  const activeFanCards = talentFanCards.filter(isFanCardActive);
  const pendingFanCards = talentFanCards.filter((card) => !isFanCardActive(card));

  const latestSubmittedFanCard = submittedFanCard
    ? fanCards.find((c) => c.id === submittedFanCard.id) || submittedFanCard
    : null;
  const submittedCardActive = latestSubmittedFanCard ? isFanCardActive(latestSubmittedFanCard) : false;

  const handleFanProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFanProof(true);
    setFanCardError('');
    try {
      const { url } = await uploadMediaFile(file);
      setFanProofUrl(url);
      setFanProofName(file.name);
      pushToast('Receipt Uploaded', 'Deposit receipt attached to your Fan Card request.', 'success');
    } catch (err) {
      setFanCardError(err instanceof Error ? err.message : 'Could not upload deposit receipt.');
    } finally {
      setUploadingFanProof(false);
      e.target.value = '';
    }
  };

  const handleSubmitFanCardDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFanCardError('');
    if (!fanProofUrl) {
      setFanCardError('Upload your bank deposit receipt before submitting.');
      return;
    }
    const amount = Number(fanSubmittedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFanCardError('Enter the amount you deposited.');
      return;
    }
    setFanCardSubmitting(true);
    try {
      const card = await purchaseFanCard({
        talentId: talent.id,
        tier: fanCardTier,
        holderName: fanHolderName,
        holderEmail: fanHolderEmail,
        submittedAmount: amount,
        proofUrl: fanProofUrl,
        reference: fanDepositReference.trim() || undefined,
        note: fanDepositNote.trim() || undefined,
      });
      setSubmittedFanCard(card);
      setFanProofUrl('');
      setFanProofName('');
      setFanDepositReference('');
      setFanDepositNote('');
    } catch (err) {
      setFanCardError(err instanceof Error ? err.message : 'Unable to submit Fan Card deposit.');
    } finally {
      setFanCardSubmitting(false);
    }
  };

  const handleUploadPortfolioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const { url, mediaType } = await uploadMediaFile(file);
      const item: PortfolioItem = {
        id: `port-${Date.now()}`,
        title: newMediaTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
        mediaType: mediaType === 'video' ? 'video' : 'image',
        url,
        caption: newMediaCaption.trim() || 'Uploaded portfolio asset',
        year: newMediaYear.trim() || '2026',
      };
      setEditPortfolio((prev) => [item, ...prev]);
      setNewMediaTitle('');
      setNewMediaCaption('');
      pushToast('Media Uploaded', `${item.title} added to portfolio draft. Click Save Profile to publish.`, 'success');
    } catch (err) {
      pushToast('Upload Failed', err instanceof Error ? err.message : 'Failed to upload file.', 'error');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleAddExperience = () => {
    setEditExperience((prev) => [
      {
        id: `exp-${Date.now()}`,
        yearRange: '2026',
        role: '',
        organization: '',
        description: '',
      },
      ...prev,
    ]);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateTalentProfile(talent.id, {
        tagline: editTagline,
        location: editLocation,
        dailyRate: Number(editDailyRate),
        biography: editBio,
        experience: editExperience.filter((ex) => ex.role.trim() && ex.organization.trim()),
        portfolio: editPortfolio,
        socialLinks: editSocials,
      });
      setEditing(false);
      pushToast('Celebrity Profile Updated', `${talent.name}'s biography, portfolio, and links are live.`, 'success');
    } catch (err) {
      pushToast('Update Failed', err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const socialEntries = [
    { key: 'instagram', label: 'Instagram', url: talent.socialLinks?.instagram },
    { key: 'imdb', label: 'IMDb', url: talent.socialLinks?.imdb },
    { key: 'linkedin', label: 'LinkedIn', url: talent.socialLinks?.linkedin },
    { key: 'youtube', label: 'YouTube', url: talent.socialLinks?.youtube },
    { key: 'x', label: 'X / Twitter', url: talent.socialLinks?.x },
    { key: 'website', label: 'Official Site', url: talent.socialLinks?.website },
  ].filter((s) => Boolean(s.url));

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/roster')}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Roster</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              const existing = threads.find((t) => t.talentId === talent.id);
              navigate(existing ? `/messages/${existing.id}` : `/messages/talent/${talent.id}`);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl cursor-pointer transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Message Manager</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (workspace.role === 'manager') {
                setEditing((v) => !v);
              } else {
                document.getElementById('booking-availability-panel')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
              editing && workspace.role === 'manager'
                ? 'bg-zinc-200 text-zinc-950'
                : 'bg-zinc-950 text-white hover:bg-blue-600'
            }`}
          >
            {workspace.role === 'manager' ? <Edit3 className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
            <span>
              {workspace.role === 'manager'
                ? editing
                  ? 'Close Editor'
                  : 'Manage Listing'
                : 'Book Appearance'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Profile Column */}
        <div className="lg:col-span-7 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
            <div className="sm:col-span-5 aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100">
              <SafeImage
                src={talent.portraitUrl}
                alt={`${talent.name} portrait`}
                fallbackText={talent.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="sm:col-span-7 space-y-4">
              <p className="text-xs text-zinc-500">
                {talent.category} <span aria-hidden="true">·</span> {talent.location}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
                {talent.name}
              </h1>
              <p className="text-sm text-zinc-700 leading-relaxed">{talent.tagline}</p>

              <div className="border-t border-b border-zinc-200 py-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-zinc-500">Daily Appearance Fee</p>
                  <p className="mt-1 font-mono tabular-nums text-base font-semibold text-zinc-950">
                    ${talent.dailyRate.toLocaleString('en-US')} USD
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Representation</p>
                  <p className="mt-1 font-semibold text-zinc-950">{talent.representationManager}</p>
                  <p className="text-[11px] text-zinc-500">{talent.responseTime}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1.5">Available Formats</p>
                <p className="text-xs text-zinc-800 leading-relaxed">
                  {talent.engagementTypes.join(' · ')}
                </p>
              </div>

              {socialEntries.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Social Media &amp; Official Links</p>
                  <div className="flex flex-wrap gap-2">
                    {socialEntries.map((s) => (
                      <a
                        key={s.key}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl transition-colors"
                      >
                        <span>{s.label}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <h2 className="font-display text-lg font-bold text-zinc-950">Edit Celebrity Profile</h2>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-700">Headline Tagline</span>
                  <input
                    type="text"
                    value={editTagline}
                    onChange={(e) => setEditTagline(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Base Location</span>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Daily Rate (USD)</span>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={editDailyRate}
                    onChange={(e) => setEditDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Biography</span>
                <textarea
                  rows={5}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>

              <div className="space-y-3 border-t border-zinc-200 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-950">Experience &amp; Credits</h3>
                  <button
                    type="button"
                    onClick={handleAddExperience}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entry</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {editExperience.map((exp, idx) => (
                    <div key={exp.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Years (e.g. 2022–2026)"
                          value={exp.yearRange}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditExperience((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, yearRange: val } : item))
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Role / Title"
                          value={exp.role}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditExperience((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, role: val } : item))
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Organization / Production"
                            value={exp.organization}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditExperience((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, organization: val } : item))
                              );
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setEditExperience((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-zinc-500 hover:text-red-600 cursor-pointer"
                            aria-label="Remove experience entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Short description"
                        value={exp.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditExperience((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, description: val } : item))
                          );
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-5">
                <h3 className="text-sm font-semibold text-zinc-950">Portfolio Media Upload (Image or Video)</h3>
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Work title"
                      value={newMediaTitle}
                      onChange={(e) => setNewMediaTitle(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Caption / Context"
                      value={newMediaCaption}
                      onChange={(e) => setNewMediaCaption(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Year"
                      value={newMediaYear}
                      onChange={(e) => setNewMediaYear(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-300 hover:border-zinc-950 rounded-xl cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingMedia ? 'Uploading media...' : 'Upload Image or Video (JPG, PNG, WebP, MP4, WebM)'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={handleUploadPortfolioFile}
                      disabled={uploadingMedia}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {editPortfolio.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 border border-zinc-200 rounded-xl bg-white text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.mediaType === 'video' ? (
                          <Film className="w-4 h-4 text-zinc-500 shrink-0" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <span className="font-medium text-zinc-950 truncate">{item.title}</span>
                        <span className="text-zinc-400 font-mono">{item.year}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditPortfolio((prev) => prev.filter((p) => p.id !== item.id))}
                        className="text-zinc-500 hover:text-red-600 p-1 cursor-pointer"
                        aria-label="Remove portfolio item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-5">
                <h3 className="text-sm font-semibold text-zinc-950">Social Media Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      ['instagram', 'Instagram URL'],
                      ['imdb', 'IMDb URL'],
                      ['linkedin', 'LinkedIn URL'],
                      ['youtube', 'YouTube URL'],
                      ['x', 'X / Twitter URL'],
                      ['website', 'Official Website URL'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-1">
                      <span className="text-xs text-zinc-600">{label}</span>
                      <input
                        type="url"
                        value={editSocials[key] || ''}
                        onChange={(e) => setEditSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <section className="border-t border-zinc-200 pt-8 space-y-3">
                <h2 className="font-display text-xl font-bold text-zinc-950">Biography</h2>
                <p className="text-sm text-zinc-700 leading-relaxed max-w-[70ch]">{talent.biography}</p>
              </section>

              <section className="border-t border-zinc-200 pt-8 space-y-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-bold text-zinc-950">Experience &amp; Selected Credits</h2>
                  <span className="text-xs font-mono tabular-nums text-zinc-500">{talent.yearsActive} years active</span>
                </div>
                <div className="divide-y divide-zinc-200 border-t border-b border-zinc-200">
                  {talent.experience.map((exp) => (
                    <div key={exp.id} className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4">
                      <div className="sm:col-span-3 font-mono tabular-nums text-xs text-zinc-500">
                        {exp.yearRange}
                      </div>
                      <div className="sm:col-span-9 space-y-1">
                        <p className="text-sm font-semibold text-zinc-950">
                          {exp.role} <span className="font-normal text-zinc-500">· {exp.organization}</span>
                        </p>
                        <p className="text-xs text-zinc-600 leading-relaxed">{exp.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-zinc-200 pt-8 space-y-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-bold text-zinc-950">Portfolio &amp; Media Reel</h2>
                  <span className="text-xs text-zinc-500">{talent.portfolio.length} works</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {talent.portfolio.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setLightboxItem(item)}
                      className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-950 transition-colors cursor-pointer"
                    >
                      <div className="aspect-[4/3] bg-zinc-100 overflow-hidden">
                        {item.mediaType === 'video' ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <SafeImage
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        )}
                      </div>
                      <div className="p-4 space-y-1">
                        <p className="text-[11px] font-mono text-zinc-500">
                          {item.mediaType === 'video' ? 'Video Reel' : 'Editorial Image'} · {item.year}
                        </p>
                        <h3 className="text-sm font-semibold text-zinc-950">{item.title}</h3>
                        <p className="text-xs text-zinc-600 line-clamp-2">{item.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Right Booking & Real-Time Availability Panel */}
        <aside
          id="booking-availability-panel"
          className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-6 lg:sticky lg:top-24"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-950 inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-600" />
                <span>Real-Time Availability</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">Select open dates to inquire or lock via escrow.</p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-zinc-950">
              ${talent.dailyRate.toLocaleString('en-US')}/d
            </span>
          </div>

          <AvailabilityGrid
            talentId={talent.id}
            availability={availability}
            selectedDates={selectedDates}
            onToggleDate={toggleDate}
            compact
          />

          <form onSubmit={handleSubmitInquiry} className="space-y-4 border-t border-zinc-200 pt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 font-medium">Selected Dates</span>
              <span className="font-mono tabular-nums font-semibold text-zinc-950">
                {selectedDates.length === 0 ? 'None selected' : selectedDates.join(', ')}
              </span>
            </div>

            {inquiryError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">{inquiryError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Event Type</span>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                >
                  {talent.engagementTypes.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Event City / Venue</span>
                <input
                  type="text"
                  required
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Company</span>
                <input
                  type="text"
                  required
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-700">Contact Email</span>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700">Event Brief &amp; Deliverables</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Outline schedule, audience size, media rights, or technical notes..."
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
              />
            </label>

            {selectedDates.length > 0 && (
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>
                    Appearance Fee ({selectedDates.length} day{selectedDates.length > 1 ? 's' : ''})
                  </span>
                  <span className="font-mono tabular-nums">${subtotal.toLocaleString('en-US')}</span>
                </div>
                {escrowPercent != null && escrowFee != null && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Escrow &amp; Contract Protection ({escrowPercent}%)</span>
                    <span className="font-mono tabular-nums">${escrowFee.toLocaleString('en-US')}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-zinc-950 border-t border-zinc-200 pt-1.5">
                  <span>Estimated Total</span>
                  <span className="font-mono tabular-nums">${totalEstimate.toLocaleString('en-US')} USD</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Booking Request'}
              </button>
              <button
                type="button"
                onClick={handleInstantCheckout}
                className="px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-zinc-300 hover:border-zinc-950 rounded-xl transition-colors cursor-pointer"
              >
                Deposit &amp; Lock Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setFanCardError('');
                  setSubmittedFanCard(null);
                  setFanProofUrl('');
                  setFanProofName('');
                  setFanDepositReference('');
                  setFanDepositNote('');
                  setFanCardOpen(true);
                }}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-600 rounded-xl transition-colors cursor-pointer"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>
                  {activeFanCards.length > 0 || pendingFanCards.length > 0
                    ? `Fan Card (${activeFanCards.length} Active${
                        pendingFanCards.length ? `, ${pendingFanCards.length} Pending` : ''
                      })`
                    : 'Get Official Fan Card'}
                </span>
              </button>
            </div>
          </form>
        </aside>
      </div>

      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">{lightboxItem.title}</h3>
                <p className="text-xs text-zinc-500">{lightboxItem.year}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-1.5 text-zinc-500 hover:text-zinc-950 cursor-pointer"
                aria-label="Close lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-zinc-950 max-h-[65vh] flex items-center justify-center">
              {lightboxItem.mediaType === 'video' ? (
                <video src={lightboxItem.url} controls autoPlay className="max-h-[65vh] w-full" />
              ) : (
                <SafeImage src={lightboxItem.url} alt={lightboxItem.title} className="max-h-[65vh] object-contain" />
              )}
            </div>
            <div className="p-5 text-xs text-zinc-600">{lightboxItem.caption}</div>
          </div>
        </div>
      )}

      {fanCardOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFanCardOpen(false)}
        >
          <div
            className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-blue-600">Official Digital Membership</p>
                <h3 className="font-display text-lg font-bold text-zinc-950">
                  {talent.name} — Fan Card
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFanCardOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-950 cursor-pointer"
                aria-label="Close fan card modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {latestSubmittedFanCard ? (
                <div className="space-y-5">
                  <div
                    className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs ${
                      submittedCardActive
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {submittedCardActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <Clock3 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {submittedCardActive
                          ? 'Official Fan Card Active'
                          : 'Deposit submitted — awaiting admin approval'}
                      </p>
                      <p className={`mt-0.5 ${submittedCardActive ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {submittedCardActive
                          ? `Card ${latestSubmittedFanCard.cardNumber} is active through ${latestSubmittedFanCard.validUntil}.`
                          : `Card ${latestSubmittedFanCard.cardNumber} is not active yet. Admin will review your bank deposit and upload the official card image before it becomes active.`}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                    {latestSubmittedFanCard.cardImageUrl ? (
                      <SafeImage
                        src={latestSubmittedFanCard.cardImageUrl}
                        alt={`${talent.name} official Fan Card`}
                        className="w-full rounded-xl border border-zinc-200"
                      />
                    ) : (
                      <p className="py-3 text-center text-[11px] text-zinc-500">
                        Official card image will appear here after admin approval.
                      </p>
                    )}
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-zinc-200 py-4 text-xs">
                    <div>
                      <dt className="text-zinc-500">Card Number</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-zinc-950">
                        {latestSubmittedFanCard.cardNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Member</dt>
                      <dd className="mt-0.5 font-semibold text-zinc-950">
                        {latestSubmittedFanCard.holderName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Tier</dt>
                      <dd className="mt-0.5 font-semibold capitalize text-zinc-950">
                        {latestSubmittedFanCard.tier}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Deposit Submitted</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-zinc-950">
                        ${(latestSubmittedFanCard.deposit?.submittedAmount ?? 0).toLocaleString('en-US')} USD
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Status</dt>
                      <dd
                        className={`mt-0.5 font-semibold ${
                          submittedCardActive ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {submittedCardActive ? 'Active' : 'Pending admin approval'}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSubmittedFanCard(null)}
                      className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                    >
                      Submit Another Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setFanCardOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitFanCardDeposit} className="space-y-5">
                  {fanCardError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                      {fanCardError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-700">Select Membership Tier</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          { id: 'silver', label: 'Silver Pass', perk: 'Digital serial & event alerts' },
                          { id: 'gold', label: 'Gold VIP', perk: 'Priority presale & signed drops' },
                          { id: 'platinum', label: 'Platinum Patron', perk: 'Meet & greet lottery priority' },
                        ] as const
                      ).map((tierOption) => {
                        const selected = fanCardTier === tierOption.id;
                        const price = fanCardPrices?.[tierOption.id];
                        return (
                          <button
                            key={tierOption.id}
                            type="button"
                            onClick={() => setFanCardTier(tierOption.id)}
                            className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                              selected
                                ? 'bg-zinc-950 text-white border-zinc-950'
                                : 'bg-zinc-50 text-zinc-950 border-zinc-200 hover:border-zinc-950'
                            }`}
                          >
                            <p className="text-xs font-semibold">{tierOption.label}</p>
                            <p className="font-mono tabular-nums text-sm font-bold mt-1">
                              {price != null ? (
                                <>
                                  ${price}
                                  <span
                                    className={`text-[11px] font-normal ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}
                                  >
                                    {' '}/ yr
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] font-normal">Price unavailable</span>
                              )}
                            </p>
                            <p className={`text-[11px] mt-1 ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                              {tierOption.perk}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-700">Member Full Name</span>
                      <input
                        type="text"
                        required
                        value={fanHolderName}
                        onChange={(e) => setFanHolderName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-700">Member Email</span>
                      <input
                        type="email"
                        required
                        value={fanHolderEmail}
                        onChange={(e) => setFanHolderEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 border-t border-zinc-200 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-700 inline-flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-zinc-600" />
                        Bank Deposit Instructions
                      </p>
                      <span className="text-[11px] text-zinc-500">No card required</span>
                    </div>

                    <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1">
                      <p className="font-semibold text-zinc-950">
                        {escrowDepositInfo?.bankName || 'Deposit bank'}
                      </p>
                      <p className="text-zinc-600">
                        {escrowDepositInfo?.accountHolder || 'Mercer & Sterling Escrow LLC'}
                      </p>
                      <p className="font-mono tabular-nums text-zinc-600">
                        Account •••• {escrowDepositInfo?.accountNumberLast4 || '----'} · Routing ••••{' '}
                        {escrowDepositInfo?.routingNumberLast4 || '----'}
                      </p>
                      {escrowDepositInfo?.swift && (
                        <p className="font-mono text-zinc-600">SWIFT {escrowDepositInfo.swift}</p>
                      )}
                      {escrowDepositInfo?.ibanLast4 && (
                        <p className="font-mono text-zinc-600">IBAN •••• {escrowDepositInfo.ibanLast4}</p>
                      )}
                      {escrowDepositInfo?.minimumDeposit != null && (
                        <p className="text-[11px] text-zinc-500">
                          Minimum deposit: ${escrowDepositInfo.minimumDeposit.toLocaleString('en-US')} USD
                        </p>
                      )}
                      {escrowDepositInfo?.depositInstructions && (
                        <p className="whitespace-pre-wrap pt-1 text-zinc-600">
                          {escrowDepositInfo.depositInstructions}
                        </p>
                      )}
                      {!escrowDepositInfo && (
                        <p className="text-[11px] text-amber-700">
                          Deposit details are loading. Contact management before transferring funds.
                        </p>
                      )}
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-700">
                        Deposit Receipt / Proof (image or PDF)
                      </span>
                      <span className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 hover:border-zinc-950 rounded-xl cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingFanProof ? 'Uploading…' : fanProofName || 'Choose receipt file'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleFanProofUpload}
                          disabled={uploadingFanProof}
                          className="sr-only"
                        />
                      </span>
                      {fanProofUrl && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Receipt attached successfully.
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-zinc-700">Amount Sent (USD)</span>
                        <input
                          type="number"
                          min={1}
                          required
                          value={fanSubmittedAmount}
                          onChange={(e) => setFanSubmittedAmount(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-zinc-700">Bank Reference (optional)</span>
                        <input
                          type="text"
                          value={fanDepositReference}
                          onChange={(e) => setFanDepositReference(e.target.value)}
                          placeholder="Transfer reference number"
                          className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                        />
                      </label>
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-xs font-medium text-zinc-700">Note for Admin (optional)</span>
                        <textarea
                          rows={2}
                          value={fanDepositNote}
                          onChange={(e) => setFanDepositNote(e.target.value)}
                          placeholder="Anything admin should know about this deposit..."
                          className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-950"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={fanCardSubmitting || uploadingFanProof || !fanProofUrl}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {fanCardSubmitting
                      ? 'Submitting deposit...'
                      : `Submit ${fanCardTier.charAt(0).toUpperCase() + fanCardTier.slice(1)} Fan Card Deposit`}
                  </button>
                </form>
              )}

              {!latestSubmittedFanCard && (activeFanCards.length > 0 || pendingFanCards.length > 0) && (
                <div className="border-t border-zinc-200 pt-4 space-y-4">
                  {activeFanCards.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-950">
                        Active Fan Cards for {talent.name} ({activeFanCards.length})
                      </p>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {activeFanCards.map((fc) => (
                          <div
                            key={fc.id}
                            className="flex items-center justify-between gap-3 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-zinc-950">{fc.cardNumber}</p>
                              <p className="text-[11px] text-zinc-500">
                                {fc.holderName} · <span className="capitalize">{fc.tier}</span>
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {fc.cardImageUrl && (
                                <SafeImage
                                  src={fc.cardImageUrl}
                                  alt={`${talent.name} Fan Card`}
                                  className="w-10 h-7 object-cover rounded border border-zinc-200"
                                />
                              )}
                              <span className="font-mono text-[11px] text-zinc-500">Exp {fc.validUntil}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingFanCards.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-950">
                        Pending Fan Card Deposits ({pendingFanCards.length})
                      </p>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {pendingFanCards.map((fc) => (
                          <div
                            key={fc.id}
                            className="flex items-center justify-between gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-zinc-950">{fc.cardNumber}</p>
                              <p className="text-[11px] text-zinc-500">
                                {fc.holderName} · <span className="capitalize">{fc.tier}</span>
                              </p>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                                fc.approvalStatus === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {fc.approvalStatus === 'rejected' ? (
                                <X className="w-3 h-3" />
                              ) : (
                                <Clock3 className="w-3 h-3" />
                              )}
                              {fc.approvalStatus === 'rejected'
                                ? 'Rejected'
                                : fc.active && !fc.cardImageUrl
                                  ? 'Card image pending'
                                  : 'Pending approval'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
