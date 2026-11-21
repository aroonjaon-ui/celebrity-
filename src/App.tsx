/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layout } from './components/Layout.tsx';
import { PlatformProvider, usePlatform } from './context/PlatformContext.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { AvailabilityCalendarPage } from './pages/AvailabilityCalendarPage.tsx';
import { BookingsPage } from './pages/BookingsPage.tsx';
import { CelebrityProfilePage } from './pages/CelebrityProfilePage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { ClientProfilePage } from './pages/ClientProfilePage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ManagerDashboardPage } from './pages/ManagerDashboardPage.tsx';
import { MessagesPage } from './pages/MessagesPage.tsx';
import { RosterPage } from './pages/RosterPage.tsx';

const RouteView: React.FC = () => {
  const { route, loading } = usePlatform();

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded-lg" />
          <div className="h-4 w-96 bg-slate-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="h-80 bg-slate-200 rounded-xl" />
            <div className="h-80 bg-slate-200 rounded-xl" />
            <div className="h-80 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  switch (route.page) {
    case 'home':
      return <HomePage />;
    case 'roster':
      return <RosterPage initialQuery={route.query} />;
    case 'talent':
      return <CelebrityProfilePage slug={route.slug} />;
    case 'calendar':
      return <AvailabilityCalendarPage />;
    case 'messages':
      return <MessagesPage initialThreadId={route.threadId} initialTalentId={route.talentId} />;
    case 'checkout':
      return <CheckoutPage />;
    case 'bookings':
      return <BookingsPage />;
    case 'client-profile':
      return <ClientProfilePage />;
    case 'manager':
      return <ManagerDashboardPage />;
    case 'admin':
      return <AdminPage />;
    case 'auth':
      return <AuthPage mode={route.mode} />;
    default:
      return <HomePage />;
  }
};

export default function App() {
  return (
    <PlatformProvider>
      <Layout>
        <RouteView />
      </Layout>
    </PlatformProvider>
  );
}
