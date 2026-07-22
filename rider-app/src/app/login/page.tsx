'use client';

import React, { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import type { UserRole } from '@/types/user';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Auto-redirect if already logged in (persisted session)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<UserRole>('RIDER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || !resetPassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: resetEmail.trim().toLowerCase(),
        role,
        newPassword: resetPassword,
      });
      toast.success('Password reset! You can now sign in.');
      setShowResetModal(false);
      setResetEmail('');
      setResetPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const isDriver = role === 'DRIVER';
  const isAdmin = role === 'ADMIN';

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
    <div className="flex min-h-screen w-full bg-[#0a0a0f] overflow-hidden">

      {/* ── Left Hero Panel ────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[44%] relative flex-col justify-between overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 ${
            isDriver ? 'bg-emerald-500' : isAdmin ? 'bg-purple-500' : 'bg-indigo-500'
          }`} />
          <div className={`absolute -top-10 -right-10 w-[300px] h-[300px] rounded-full blur-[100px] opacity-15 ${
            isDriver ? 'bg-green-400' : isAdmin ? 'bg-violet-400' : 'bg-purple-500'
          }`} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-blue-500/5 rounded-full blur-[80px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 xl:px-16">
          {/* Back to home */}
          <Link href="/" className="flex items-center gap-2 text-[13px] text-white/30 hover:text-white/60 transition-colors mb-10 w-fit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <p className="text-[13px] text-white/30 mb-5 tracking-wide font-light leading-relaxed">
              {isDriver
                ? 'Drive with purpose — earn on your schedule.'
                : isAdmin
                  ? 'Full platform control — manage everything.'
                  : 'Real-time rides, real-time trust.'}
            </p>

            <h1 className="text-[clamp(40px,4.5vw,60px)] font-black text-white leading-[1.05] tracking-[-2px] mb-0">
              {isDriver ? (
                <>
                  Earn on
                  <br />
                  <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">your terms</span>
                </>
              ) : isAdmin ? (
                <>
                  Manage
                  <br />
                  <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">everything</span>
                </>
              ) : (
                <>
                  Book rides
                  <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">instantly</span>
                </>
              )}
            </h1>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-0 mt-14 pt-8 border-t border-white/[0.06]"
          >
            {[
              { value: '10K+', label: 'Active Riders' },
              { value: '99.9%', label: 'Uptime' },
              { value: '4.9★', label: 'Rating' },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center">
                {i > 0 && <div className="w-px h-8 bg-white/[0.06] mx-6" />}
                <div className="flex flex-col gap-1">
                  <span className="text-[22px] font-black text-white tracking-tight">{stat.value}</span>
                  <span className="text-[11px] text-white/25 font-medium tracking-wider uppercase">{stat.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-12 xl:px-16 pb-8">
          <p className="text-[11px] text-white/15 font-medium">
            © {new Date().getFullYear()} RideShare Platform. Built with precision.
          </p>
        </div>
      </div>

      {/* ── Right Form Panel (Dark Glassmorphism) ──────────── */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f18] via-[#0a0a0f] to-[#0d0d15] pointer-events-none" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-8 sm:px-10 py-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span className="text-[17px] font-bold text-white tracking-tight">
              RideShare
            </span>
          </div>
          {/* Mobile: Back to home */}
          <Link href="/" className="lg:hidden flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Home
          </Link>
        </div>

        {/* Form — centered */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-10">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-[400px]"
          >
            {/* Glassmorphism card */}
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 sm:p-8 shadow-2xl shadow-black/20">
              <h2 className="text-[26px] font-bold text-white tracking-tight mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-sm text-white/30 mb-6">
                {mode === 'signin' ? 'Sign in to continue your journey' : 'Start riding in under 30 seconds'}
              </p>

              {/* Role Selector */}
              <div className="flex gap-1 mb-5 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
                {(['RIDER', 'DRIVER', 'ADMIN'] as UserRole[]).map((r) => {
                  const roleConfig: Record<string, { active: string; icon: React.ReactNode; label: string }> = {
                    RIDER: {
                      active: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                      label: 'Rider',
                    },
                    DRIVER: {
                      active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><path d="M16 8h4l3 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
                      label: 'Driver',
                    },
                    ADMIN: {
                      active: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                      label: 'Admin',
                    },
                  };
                  const cfg = roleConfig[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2.5 rounded-[10px] text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                        role === r
                          ? cfg.active
                          : 'text-white/30 hover:text-white/50 border border-transparent'
                      }`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 text-[13px] text-red-400 overflow-hidden"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="leading-snug">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Name (signup) */}
                <AnimatePresence>
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-1.5 overflow-hidden"
                    >
                      <label htmlFor="name" className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">
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
                        className="w-full px-3.5 py-[11px] bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder:text-white/20 outline-none transition-all hover:border-white/[0.15] focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">
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
                    className="w-full px-3.5 py-[11px] bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder:text-white/20 outline-none transition-all hover:border-white/[0.15] focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { setShowResetModal(true); setResetEmail(email); }}
                        className="text-[11px] font-semibold text-indigo-400/70 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        Forgot?
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
                      className="w-full px-3.5 py-[11px] pr-10 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder:text-white/20 outline-none transition-all hover:border-white/[0.15] focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-white/20 hover:text-white/40 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 mt-2 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] ${
                    isDriver
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5'
                      : isAdmin
                        ? 'bg-gradient-to-r from-purple-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:-translate-y-0.5'
                        : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </>
                  )}
                </button>
              </form>


              {/* Toggle */}
              <p className="text-center mt-5 text-[13px] text-white/30">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
                >
                  {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between px-8 sm:px-10 py-5 text-[11px] text-white/15 shrink-0">
          <span>© {new Date().getFullYear()} RideShare Inc.</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => toast.info('Contact support: support@rideshare.app')}
              className="text-white/20 font-medium hover:text-white/40 transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span className="text-white/15 font-medium">English</span>
          </div>
        </div>
      </div>

      {/* ── Reset Password Modal ──────────────────── */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-[#12121a] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-[16px] font-bold text-white mb-1">Reset Password</h3>
              <p className="text-[12px] text-white/30 mb-5">Enter your email and choose a new password</p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3.5 py-[10px] bg-white/[0.04] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none transition-all focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">New Password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    className="w-full px-3.5 py-[10px] bg-white/[0.04] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none transition-all focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[13px] font-medium text-white/40 hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
