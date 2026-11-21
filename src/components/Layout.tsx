import React, { useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCircle2, Globe, LogOut, Menu, Search, ShieldCheck, User, X, XCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { useLanguage, type Language } from '../context/LanguageContext.tsx';
import { SafeImage } from './SafeImage.tsx';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    route,
    navigate,
    workspace,
    setWorkspaceRole,
    isAdmin,
    isAuthenticated,
    hasClientAccount,
    logout,
    approvalPopup,
    dismissApprovalPopup,
    talents,
    notifications,
    markNotificationRead,
    threads,
    bookings,
    toasts,
    dismissToast,
    userAccount,
  } = usePlatform();
  const { language, setLanguage, t } = useLanguage();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return { talents: [], bookings: [] };
    const tokens = q.split(/\s+/).filter(Boolean);

    const matchedTalents = talents.filter((t) => {
      const haystack = [
        t.name,
        t.category,
        t.location,
        t.tagline,
        t.biography,
        t.representationManager,
        ...t.engagementTypes,
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });

    const matchedBookings = bookings.filter((b) => {
      const haystack = [
        b.referenceCode,
        b.talentName,
        b.clientCompany,
        b.eventType,
        b.eventLocation,
        b.status,
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });

    return {
      talents: matchedTalents.slice(0, 5),
      bookings: matchedBookings.slice(0, 3),
    };
  }, [globalQuery, talents, bookings]);

  const roleNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.recipientRole === 'all' || n.recipientRole === workspace.role
      ),
    [notifications, workspace.role]
  );

  const unreadNotifCount = useMemo(
    () => roleNotifications.filter((n) => !n.read).length,
    [roleNotifications]
  );

  const unreadMsgCount = useMemo(
    () =>
      threads.reduce((acc, t) => {
        if (workspace.role === 'admin') return acc + (t.unreadForAdmin || 0);
        if (workspace.role === 'manager') return acc + t.unreadForManager;
        return acc + t.unreadForClient;
      }, 0),
    [threads, workspace.role]
  );

  const pendingInquiriesCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending').length,
    [bookings]
  );

  const navItems = [
    { label: t('Roster'), path: '/roster', active: route.page === 'roster' || route.page === 'talent' },
    { label: t('Calendar'), path: '/calendar', active: route.page === 'calendar' },
    {
      label: unreadMsgCount > 0 ? `${t('Messages')} (${unreadMsgCount})` : t('Messages'),
      path: '/messages',
      active: route.page === 'messages',
    },
    { label: t('Bookings'), path: '/bookings', active: route.page === 'bookings' || route.page === 'checkout' },
    {
      label:
        pendingInquiriesCount > 0 && workspace.role === 'manager'
          ? `${t('Dashboard')} (${pendingInquiriesCount})`
          : t('Dashboard'),
      path: '/manager',
      active: route.page === 'manager',
    },
    ...(isAdmin ? [{ label: t('Admin'), path: '/admin', active: route.page === 'admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      {/* Strict 3-Zone Modern Frosted Top Bar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-display text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            Mercer &amp; Sterling
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-500" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`whitespace-nowrap shrink-0 py-1.5 transition-colors border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm ${
                  item.active
                    ? 'text-zinc-950 border-zinc-950 font-semibold'
                    : 'text-zinc-500 border-transparent hover:text-zinc-950 hover:border-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language, account, primary action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <label className="hidden sm:inline-flex items-center gap-1 text-zinc-500" aria-label="Site language">
              <Globe className="w-3.5 h-3.5" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="text-xs font-medium bg-transparent border-none text-zinc-700 cursor-pointer focus:outline-none"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
              </select>
            </label>

            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/client-profile')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="max-w-[110px] truncate">{userAccount?.fullName || 'Account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => logout().catch(() => undefined)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-red-600 cursor-pointer"
                  aria-label="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(hasClientAccount ? '/auth' : '/signup')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {hasClientAccount ? 'Log in' : 'Sign up'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/roster')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600"
            >
              {t('Book Talent')}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                  item.active ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  navigate('/admin');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {t('Admin')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigate('/client-profile');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t('Client Profile')}
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(isAuthenticated ? '/client-profile' : hasClientAccount ? '/auth' : '/signup');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              {isAuthenticated ? userAccount?.fullName || 'Account' : hasClientAccount ? 'Log in' : 'Sign up'}
            </button>
            <div className="px-3 py-2 flex items-center gap-2 text-xs text-zinc-500">
              <Globe className="w-3.5 h-3.5" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent border border-zinc-200 rounded-lg px-2 py-1 text-zinc-700"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {/* Modern Workspace Strip */}
      <div className="bg-white border-b border-zinc-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Global Live Search */}
          <div
            ref={searchContainerRef}
            className="relative flex-1 max-w-sm"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setSearchFocused(false);
              }
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = globalQuery.trim();
                setSearchFocused(false);
                navigate(q ? `/roster?q=${encodeURIComponent(q)}` : '/roster');
              }}
            >
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search celebrities, categories, bookings..."
                aria-label="Search platform"
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-950 transition-colors"
              />
              {globalQuery && (
                <button
                  type="button"
                  onClick={() => setGlobalQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950 cursor-pointer"
                  aria-label="Clear global search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {searchFocused && globalQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                {searchResults.talents.length === 0 && searchResults.bookings.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No celebrities or bookings matched &ldquo;{globalQuery.trim()}&rdquo;.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                    {searchResults.talents.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Talent Roster
                        </p>
                        {searchResults.talents.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchFocused(false);
                              setGlobalQuery('');
                              navigate(`/talent/${t.slug}`);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-zinc-50 flex items-center gap-3 cursor-pointer"
                          >
                            <SafeImage
                              src={t.portraitUrl}
                              alt={t.name}
                              fallbackText={t.name}
                              className="w-8 h-8 rounded-lg object-cover object-top shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-zinc-950 truncate">{t.name}</p>
                              <p className="text-[11px] text-zinc-500 truncate">
                                {t.category} · {t.location}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                              ${t.dailyRate.toLocaleString('en-US')}/d
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.bookings.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Bookings
                        </p>
                        {searchResults.bookings.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchFocused(false);
                              setGlobalQuery('');
                              navigate('/bookings');
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-zinc-50 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-950 truncate">
                                {b.talentName} — {b.eventType}
                              </p>
                              <p className="text-[11px] text-zinc-500 font-mono truncate">
                                {b.referenceCode} · {b.clientCompany}
                              </p>
                            </div>
                            <span className="text-[11px] capitalize text-zinc-600 shrink-0">{b.status}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const q = globalQuery.trim();
                        setSearchFocused(false);
                        navigate(`/roster?q=${encodeURIComponent(q)}`);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      View all roster matches for &ldquo;{globalQuery.trim()}&rdquo; →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl">
            {(['client', 'manager', ...(isAdmin ? (['admin'] as const) : [])] as Array<'client' | 'manager' | 'admin'>).map(
              (role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setWorkspaceRole(role)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg cursor-pointer transition-colors ${
                    workspace.role === role
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                  {role === 'client' ? t('Client Profile') : role === 'manager' ? t('Dashboard') : t('Admin')}
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/client-profile')}
              className={`font-medium whitespace-nowrap transition-colors cursor-pointer ${
                route.page === 'client-profile'
                  ? 'text-blue-600 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Client Profile
            </button>

            <span className="text-zinc-300" aria-hidden="true">
              ·
            </span>

            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 font-medium text-zinc-700 hover:text-zinc-950 whitespace-nowrap py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-white bg-blue-600 px-1.5 py-0.5 rounded-md">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-950">
                      Activity Notifications ({roleNotifications.length})
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead('all')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                    {roleNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500">
                        No notifications yet. Inquiries, booking updates, and payment confirmations appear here.
                      </div>
                    ) : (
                      roleNotifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(n.id);
                            setNotifOpen(false);
                            if (n.category === 'inquiry') navigate('/manager');
                            else if (n.category === 'message') navigate('/messages');
                            else navigate('/bookings');
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer ${
                            !n.read ? 'bg-blue-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-zinc-950">{n.title}</span>
                            <span className="text-[11px] font-mono tabular-nums text-zinc-400 shrink-0">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      {approvalPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-7 shadow-2xl">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                approvalPopup.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {approvalPopup.status === 'approved' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            <h2 className="font-display text-xl font-bold text-zinc-950">{t(approvalPopup.title)}</h2>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{approvalPopup.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissApprovalPopup();
                  navigate(approvalPopup.type === 'booking' ? '/bookings' : '/client-profile');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 cursor-pointer"
              >
                {approvalPopup.type === 'booking' ? t('View Booking') : t('View Fan Card')}
              </button>
              <button
                type="button"
                onClick={dismissApprovalPopup}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-xl hover:border-zinc-950 cursor-pointer"
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-zinc-950 text-white border border-zinc-800 rounded-2xl shadow-xl p-4 flex items-start justify-between gap-3"
              role="status"
            >
              <div>
                <p className="text-xs font-semibold text-white">{toast.title}</p>
                <p className="mt-0.5 text-xs text-zinc-300 leading-relaxed">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modern Minimal Footer */}
      <footer className="border-t border-zinc-200 bg-white mt-20">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-base font-bold tracking-tight text-zinc-950">Mercer &amp; Sterling</p>
            <p className="mt-1 text-xs text-zinc-500">
              Talent Representation, Live Scheduling &amp; Escrow Settlement · New York · London · Los Angeles
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-zinc-500">
            <button type="button" onClick={() => navigate('/roster')} className="hover:text-zinc-950 cursor-pointer">
              Roster
            </button>
            <button type="button" onClick={() => navigate('/calendar')} className="hover:text-zinc-950 cursor-pointer">
              Availability
            </button>
            <button type="button" onClick={() => navigate('/messages')} className="hover:text-zinc-950 cursor-pointer">
              Messages
            </button>
            <button type="button" onClick={() => navigate('/client-profile')} className="hover:text-zinc-950 cursor-pointer">
              Client Profile
            </button>
            <button type="button" onClick={() => navigate('/manager')} className="hover:text-zinc-950 cursor-pointer">
              Dashboard
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
