'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

/* ─── Reusable scroll-triggered reveal ─────────────────────── */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Data ─────────────────────────────────────────────────── */
const features = [
  {
    icon: '⚡',
    title: 'Real-Time Socket.io Tracking',
    desc: 'Every 500ms, your driver\'s position streams directly to your map. No polling. No delays. Pure WebSocket precision.',
    tag: 'LIVE',
  },
  {
    icon: '🔒',
    title: 'Stripe Hold & Capture',
    desc: 'We hold your fare when you book and only capture on completion. Cancel anytime — zero charge, zero friction.',
    tag: 'SECURE',
  },
  {
    icon: '🧠',
    title: 'Dijkstra-Optimized Routing',
    desc: 'OSRM Contraction Hierarchies on OpenStreetMap data. Every route follows real roads, real turns, real traffic.',
    tag: 'SMART',
  },
  {
    icon: '📍',
    title: 'POI-Level GPS Precision',
    desc: 'Dual-query Nominatim search with building-level reverse geocoding. We find "NIET College", not "Noida Expressway".',
    tag: 'PRECISE',
  },
];

const stats = [
  { value: '500ms', label: 'Location updates' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<3s', label: 'Driver matching' },
  { value: '12+', label: 'Vehicle types' },
];

const steps = [
  { num: '01', title: 'Set your pickup', desc: 'GPS auto-detects your location down to the building. Or type any address.' },
  { num: '02', title: 'Choose your ride', desc: 'Bike, Auto, Mini, Economy, Sedan, SUV — real-time fare estimates, no surge surprises.' },
  { num: '03', title: 'Track in real time', desc: 'Watch your driver approach on a live map. ETA updates every half-second via WebSocket.' },
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });

  // Parallax transforms
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-15%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="bg-[#0a0a0f] text-white overflow-hidden">

      {/* ━━ Navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span className="text-lg font-bold tracking-tight">RideShare</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">
              Sign in
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 bg-white text-[#0a0a0f] text-sm font-semibold rounded-full hover:bg-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ━━ Hero — Parallax ━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Parallax grid background */}
        <motion.div
          style={{ y: bgY }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
          {/* Gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px]" />
        </motion.div>

        {/* Foreground text (moves at different speed) */}
        <motion.div style={{ y: textY, opacity }} className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300 mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live in Greater Noida
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-6"
          >
            <span className="block">Motion,</span>
            <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mastered.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Real-time rides with sub-second tracking, Dijkstra-optimized routes, 
            and enterprise-grade payments. Built for those who refuse to wait.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/login"
              className="group px-8 py-3.5 bg-white text-[#0a0a0f] font-semibold rounded-full text-sm hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-white/10"
            >
              Book a Ride
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 border border-white/15 text-gray-300 font-medium rounded-full text-sm hover:bg-white/5 hover:border-white/25 transition-all"
            >
              See How
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-5 h-8 border-2 border-white/20 rounded-full flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 h-2 bg-white/40 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* ━━ Stats Bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1} className="text-center">
                <p className="text-3xl sm:text-4xl font-black bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 mt-1.5 font-medium uppercase tracking-wider">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Features — Stagger Reveal ━━━━━━━━━━━━━ */}
      <section id="features" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">The Technical Edge</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
              Engineered for<br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">real-time precision.</span>
            </h2>
            <p className="text-gray-500 max-w-lg mb-16 text-base leading-relaxed">
              Every layer of our stack is purpose-built for sub-second responsiveness and zero-compromise reliability.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.1}>
                <div className="group relative p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-500">
                  <div className="flex items-start justify-between mb-5">
                    <span className="text-3xl">{f.icon}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-400/10 rounded-full border border-indigo-400/20">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-indigo-300 transition-colors">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ Sticky How-It-Works ━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-20">
              Three steps.<br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Zero friction.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left: Sticky visual */}
            <div className="hidden lg:block">
              <div className="sticky top-32">
                <Reveal>
                  <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-[#12121a] to-[#1a1a2e] border border-white/[0.06] shadow-2xl">
                    {/* Fake app interface */}
                    <div className="absolute inset-6">
                      {/* Status bar */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                          </div>
                          <span className="text-xs font-medium text-gray-400">RideShare</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                          <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[9px] font-semibold text-green-400">LIVE</span>
                        </div>
                      </div>
                      {/* Fake map */}
                      <div className="relative h-32 rounded-xl bg-[#1e1e2a] border border-white/5 mb-4 overflow-hidden">
                        <div className="absolute inset-0 opacity-20" style={{
                          backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
                          backgroundSize: '20px 20px',
                        }} />
                        <div className="absolute top-6 left-10 w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/30" />
                        <div className="absolute bottom-8 right-12 w-3 h-3 rounded-full bg-red-400 shadow-lg shadow-red-400/30" />
                        <svg className="absolute top-6 left-11 opacity-40" width="120" height="60" viewBox="0 0 120 60"><path d="M0 0 Q60 60 120 20" fill="none" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 4" /></svg>
                      </div>
                      {/* Ride option */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🚗</span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-white">Economy</p>
                            <p className="text-[10px] text-gray-500">4 min away</p>
                          </div>
                          <p className="text-sm font-bold text-white">₹97</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>

            {/* Right: Steps scroll past */}
            <div className="space-y-12 lg:space-y-24">
              {steps.map((step, i) => (
                <Reveal key={step.num} delay={i * 0.15}>
                  <div className="flex gap-6">
                    <div className="shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/[0.06] flex items-center justify-center">
                        <span className="text-lg font-black text-indigo-400">{step.num}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed max-w-sm">{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━ CTA Banner ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-12 sm:p-20 text-center">
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                  Ready to move?
                </h2>
                <p className="text-indigo-200 max-w-md mx-auto mb-8 text-base">
                  Join thousands of riders who trust RideShare for safe, fast, and transparent rides.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-700 font-bold rounded-full text-sm hover:bg-indigo-50 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
                >
                  Start Riding Now
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
              {/* Decorative */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-400/10 rounded-full blur-3xl" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━ Footer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <span className="text-sm font-bold tracking-tight">RideShare</span>
            </div>
            <p className="text-xs text-gray-600">
              © {new Date().getFullYear()} RideShare Platform. Built with precision.
            </p>
            <div className="flex items-center gap-6 text-xs text-gray-600">
              <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
