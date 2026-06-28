'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Image from 'next/image';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import type { UserRole } from '@/types/user';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<UserRole>('RIDER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDriver = role === 'DRIVER';

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name.');
          setLoading(false);
          return;
        }
        const res = await api.post('/auth/register', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        });
        login(res.data.user, res.data.token);
        router.replace('/dashboard');
      } else {
        const res = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
          role,
        });
        login(res.data.user, res.data.token);
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const msg = axiosErr?.response?.data?.message;
      const status = axiosErr?.response?.status;

      if (msg) setError(msg);
      else if (status === 403)
        setError('Access denied. This email may be registered under a different role.');
      else if (status === 401) setError('Invalid email or password.');
      else if (status === 404)
        setError('No account found with this email. Please sign up first.');
      else if (status) setError(`Server error (${status}). Please try again.`);
      else setError('Cannot connect to server. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Hero Panel ────────────────────── */}
      <div
        className={`hidden lg:flex flex-col justify-center w-[45%] relative overflow-hidden px-14 py-16 ${
          isDriver ? 'bg-[#071a0e]' : 'bg-[#0c0c0c]'
        }`}
      >
        {/* Subtle gradient overlays */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className={`absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 bottom-0 left-0 ${
              isDriver ? 'bg-green-500' : 'bg-indigo-500'
            }`}
          />
          <div
            className={`absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 top-20 right-10 ${
              isDriver ? 'bg-emerald-400' : 'bg-blue-500'
            }`}
          />
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/40 mb-6 tracking-wide font-light">
            {isDriver
              ? 'Drive with purpose — earn on your schedule.'
              : 'Real-time rides, real-time trust.'}
          </p>
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-12">
            {isDriver ? (
              <>
                Earn on
                <br />
                your terms
              </>
            ) : (
              <>
                Book rides
                <br />
                instantly
              </>
            )}
          </h1>

          {/* Stats */}
          <div className="flex items-center gap-6 pt-8 border-t border-white/8">
            {[
              { value: '10K+', label: 'Active Riders' },
              { value: '99.9%', label: 'Uptime' },
              { value: '4.9★', label: 'Rating' },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-6">
                {i > 0 && <div className="w-px h-9 bg-white/8" />}
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-bold text-white">{stat.value}</span>
                  <span className="text-xs text-white/35 font-medium">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-8 left-14 text-xs text-white/20">
          © {new Date().getFullYear()} RideShare Inc.
        </p>
      </div>

      {/* ── Right Form Panel ───────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <Image
              src="/favicon.png"
              alt="RideShare"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              RideShare
            </span>
          </div>
        </div>

        {/* Form */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex-1 flex flex-col justify-center max-w-[400px] w-full mx-auto px-6 sm:px-10"
        >
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-7">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>

          {/* Role Selector */}
          <div className="flex gap-1.5 mb-6 bg-gray-100 rounded-xl p-1">
            {(['RIDER', 'DRIVER'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  role === r
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r === 'RIDER' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><path d="M16 8h4l3 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                )}
                {r === 'RIDER' ? 'Rider' : 'Driver'}
              </button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-600 overflow-hidden"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Name (signup) */}
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 overflow-hidden"
                >
                  <label htmlFor="name" className="text-sm font-semibold text-gray-700">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    minLength={2}
                    autoComplete="name"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => toast.info('Password reset will be available soon.')}
                    className="text-sm font-semibold text-red-500 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full px-4 py-3 pr-11 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 mt-1 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                isDriver
                  ? 'bg-gradient-to-r from-green-500 via-green-600 to-green-700 shadow-lg shadow-green-500/30 hover:shadow-green-500/40 hover:-translate-y-0.5'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3.5 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Social */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => toast.info('Google sign-in requires OAuth setup in .env')}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-sm transition-all cursor-pointer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => toast.info('Apple sign-in requires OAuth setup in .env')}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-sm transition-all cursor-pointer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#111"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.27c1.28.07 2.16.72 2.91.76.96-.2 1.88-.76 2.96-.69 1.26.1 2.2.6 2.82 1.5-2.58 1.54-1.97 4.92.54 5.87-.45 1.18-.98 2.35-1.99 3.57zM12.03 9.2C11.88 7.15 13.5 5.45 15.43 5.3c.27 2.34-2.13 4.1-3.4 3.9z"/></svg>
              Apple
            </button>
          </div>

          {/* Toggle */}
          <p className="text-center mt-6 text-sm text-gray-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-2 transition-colors cursor-pointer"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </motion.div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-5 text-xs text-gray-400 shrink-0">
          <span>© {new Date().getFullYear()} RideShare Inc.</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => toast.info('Contact support: support@rideshare.app')}
              className="text-gray-600 font-medium hover:text-gray-900 transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span className="text-gray-500 font-medium">English</span>
          </div>
        </div>
      </div>
    </div>
  );
}
