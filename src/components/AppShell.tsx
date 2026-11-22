import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ReceiptText,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { useLanguage, type Language } from '../context/LanguageContext.tsx';
import { SafeImage } from './SafeImage.tsx';
import { AppOverlays } from './AppOverlays.tsx';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    route,
    navigate,
    workspace,
    isAdmin,
    logout,
    adminLogout,
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const roleNotifications = useMemo(
    () => notifications.filter((n) => n.recipientRole === 'all' || n.recipientRole === workspace.role),
    [notifications, workspace.role]
  );
  const unreadNotifCount = roleNotifications.filter((n) => !n.read).length;
  const unreadMsgCount = useMemo(
    () =>
      threads.reduce((acc, thread) => {
        if (workspace.role === 'admin') return acc + (thread.unreadForAdmin || 0);
        if (workspace.role === 'manager') return acc + thread.unreadForManager;
        return acc + thread.unreadForClient;
      }, 0),
    [threads, workspace.role]
  );
  const pendingInquiriesCount = bookings.filter((b) => b.status === 'pending').length;

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return { talents: [] as typeof talents, bookings: [] as typeof bookings };
    const tokens = q.split(/\s+/).filter(Boolean);
    return {
      talents: talents
        .filter((talent) =>
          tokens.every((token) =>
            [talent.name, talent.category, talent.location, talent.tagline, talent.biography]
              .join(' ')
              .toLowerCase()
              .includes(token)
          )
        )
        .slice(0, 5),
      bookings: bookings
        .filter((booking) =>
          tokens.every((token) =>
            [booking.referenceCode, booking.talentName, booking.clientCompany, booking.eventType, booking.status]
              .join(' ')
              .toLowerCase()
              .includes(token)
          )
        )
        .slice(0, 3),
    };
  }, [globalQuery, talents, bookings]);

  const navItems: NavItem[] = [
    {
      label: t('Roster'),
      path: '/roster',
      icon: <Users className="w-[18px] h-[18px]" />,
      active: route.page === 'roster' || route.page === 'talent',
    },
    {
      label: t('Calendar'),
      path: '/calendar',
      icon: <CalendarDays className="w-[18px] h-[18px]" />,
      active: route.page === 'calendar',
    },
    {
      label: t('Messages'),
      path: '/messages',
      icon: <MessageSquare className="w-[18px] h-[18px]" />,
      active: route.page === 'messages',
      badge: unreadMsgCount || undefined,
    },
    {
      label: t('Bookings'),
      path: '/bookings',
      icon: <ReceiptText className="w-[18px] h-[18px]" />,
      active: route.page === 'bookings' || route.page === 'checkout',
    },
    isAdmin
      ? {
          label: t('Admin'),
          path: '/admin',
          icon: <ShieldCheck className="w-[18px] h-[18px]" />,
          active: route.page === 'admin',
        }
      : {
          label: pendingInquiriesCount > 0 ? `${t('Dashboard')} (${pendingInquiriesCount})` : t('Dashboard'),
          path: '/manager',
          icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
          active: route.page === 'manager',
        },
  ];

  const go = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
    setNotifOpen(false);
    setSearchFocused(false);
  };

  const renderNavButton = (item: NavItem, compact = false) => (
    <button
      key={`${item.path}-${compact ? 'compact' : 'full'}`}
      type="button"
      onClick={() => go(item.path)}
      className={`w-full flex items-center gap-3 rounded-xl text-left transition-colors cursor-pointer ${
        compact ? 'flex-col gap-1 px-1 py-2' : 'px-3 py-2.5 text-sm font-medium'
      } ${
        item.active
          ? 'bg-zinc-950 text-white'
          : compact
            ? 'text-zinc-500 hover:text-zinc-950'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
      }`}
    >
      <span className="relative shrink-0">
        {item.icon}
        {item.badge ? (
          <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        ) : null}
      </span>
      <span className={compact ? 'text-[10px] leading-none whitespace-nowrap' : 'truncate'}>{item.label}</span>
    </button>
  );

  const searchPanel = (
    <div
      ref={searchRef}
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setSearchFocused(false);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearchFocused(false);
          go(globalQuery.trim() ? `/roster?q=${encodeURIComponent(globalQuery.trim())}` : '/roster');
        }}
      >
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={globalQuery}
          onChange={(event) => {
            setGlobalQuery(event.target.value);
            setSearchFocused(true);
          }}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search talent, bookings…"
          aria-label="Search platform"
          className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-100 border border-transparent rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-300"
        />
        {globalQuery && (
          <button
            type="button"
            onClick={() => setGlobalQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950 cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {searchFocused && globalQuery.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {searchResults.talents.length === 0 && searchResults.bookings.length === 0 ? (
            <p className="p-4 text-center text-xs text-zinc-500">No matches found.</p>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
              {searchResults.talents.map((talent) => (
                <button
                  key={talent.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setGlobalQuery('');
                    go(`/talent/${talent.slug}`);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 cursor-pointer"
                >
                  <SafeImage
                    src={talent.portraitUrl}
                    alt={talent.name}
                    fallbackText={talent.name}
                    className="w-8 h-8 rounded-lg object-cover object-top shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{talent.name}</span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {talent.category} · {talent.location}
                    </span>
                  </span>
                </button>
              ))}
              {searchResults.bookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setGlobalQuery('');
                    go('/bookings');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-50 cursor-pointer"
                >
                  <span className="block text-xs font-semibold truncate">
                    {booking.talentName} — {booking.eventType}
                  </span>
                  <span className="block text-[11px] text-zinc-500 font-mono truncate">{booking.referenceCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-zinc-50 text-zinc-950">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => go('/')}
          className="h-14 px-5 flex items-center gap-2 border-b border-zinc-100 text-left cursor-pointer"
        >
          <span className="w-8 h-8 rounded-xl bg-zinc-950 text-[#c9a227] font-display text-sm font-bold flex items-center justify-center">
            M
          </span>
          <span className="font-display text-sm font-bold tracking-tight leading-none">
            Mercer <span className="text-zinc-400">&amp;</span> Sterling
          </span>
        </button>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Workspace navigation">
          {navItems.map((item) => renderNavButton(item))}
        </nav>
        <div className="border-t border-zinc-100 p-3 space-y-1">
          <button
            type="button"
            onClick={() => go('/client-profile')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
              route.page === 'client-profile' ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <UserRound className="w-[18px] h-[18px]" />
            <span className="truncate">Client Profile</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void (isAdmin ? adminLogout() : logout()).catch(() => undefined);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="h-14 shrink-0 border-b border-zinc-200 bg-white flex items-center gap-2 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="lg:hidden font-display text-sm font-bold whitespace-nowrap">M&amp;S</span>
          <div className="hidden md:block w-full max-w-sm ml-2">{searchPanel}</div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => go('/roster')}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
            <label className="hidden sm:flex items-center gap-1 text-zinc-500">
              <Globe className="w-3.5 h-3.5" />
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="text-xs font-medium bg-transparent text-zinc-700 cursor-pointer focus:outline-none"
                aria-label="Language"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
              </select>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((value) => !value)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadNotifCount > 0 && (
                  <span className="absolute right-1 top-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Notifications ({roleNotifications.length})</span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead('all')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                    {roleNotifications.length === 0 ? (
                      <p className="p-6 text-center text-xs text-zinc-500">No notifications yet.</p>
                    ) : (
                      roleNotifications.slice(0, 12).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(notification.id);
                            setNotifOpen(false);
                            if (notification.category === 'inquiry') go('/manager');
                            else if (notification.category === 'message') go('/messages');
                            else go('/bookings');
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-zinc-50 cursor-pointer ${
                            notification.read ? 'bg-white' : 'bg-blue-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold">{notification.title}</span>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              {new Date(notification.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{notification.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => go('/client-profile')}
              className="w-9 h-9 rounded-full bg-zinc-950 text-white flex items-center justify-center text-xs font-semibold cursor-pointer shrink-0"
              aria-label="Client profile"
            >
              {(userAccount?.fullName || workspace.displayName || 'M')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-20 lg:pb-0">{children}</main>
      </div>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 h-16">{navItems.map((item) => renderNavButton(item, true))}</div>
      </nav>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/50"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-100">
              <span className="font-display text-sm font-bold">Mercer &amp; Sterling</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map((item) => renderNavButton(item))}
            </nav>
            <div className="border-t border-zinc-100 p-3 space-y-1">
              <button
                type="button"
                onClick={() => go('/client-profile')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                <UserRound className="w-[18px] h-[18px]" />
                Client Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  void (isAdmin ? adminLogout() : logout()).catch(() => undefined);
                  setMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-[18px] h-[18px]" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <AppOverlays />
    </div>
  );
};
