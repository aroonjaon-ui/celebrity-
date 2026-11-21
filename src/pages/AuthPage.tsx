import React, { useEffect, useState } from 'react';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 transition-colors';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5';

export const AuthPage: React.FC<{ mode: 'login' | 'signup' }> = ({ mode }) => {
  const { signup, login, hasClientAccount, navigate, isAuthenticated } = usePlatform();
  const [activeMode, setActiveMode] = useState<'login' | 'signup'>(mode);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  useEffect(() => {
    if (hasClientAccount) setActiveMode('login');
  }, [hasClientAccount]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (activeMode === 'signup') {
        await signup({ fullName, email, password, companyName });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="font-display text-2xl font-bold text-zinc-950">
          {activeMode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {activeMode === 'signup'
            ? 'Sign up to submit booking inquiries, track deposits, and chat with talent teams.'
            : 'Log in to continue with your bookings and Fan Cards.'}
        </p>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 w-full py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:border-blue-500 cursor-pointer"
          >
            You are signed in — continue browsing
          </button>
        )}

        <div className="mt-6 flex gap-1 p-1 bg-zinc-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveMode('login');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              activeMode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasClientAccount) {
                setError('An account already exists. Please log in instead.');
                return;
              }
              setActiveMode('signup');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              activeMode === 'signup' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {activeMode === 'signup' && (
            <>
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Reyes"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Company (optional)</label>
                <input
                  className={inputClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Northline Brands"
                />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={activeMode === 'signup' ? 'At least 8 characters' : 'Your password'}
              minLength={activeMode === 'signup' ? 8 : undefined}
              required
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {activeMode === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {busy ? 'Please wait…' : activeMode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};
