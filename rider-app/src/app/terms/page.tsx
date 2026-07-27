'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Terms of Service - RideShare',
  description: 'Terms of Service for the RideShare platform.',
};

export default function TermsOfService() {
  const sections = [
    { id: 'acceptance', title: 'Acceptance of Terms' },
    { id: 'description', title: 'Description of Service' },
    { id: 'accounts', title: 'User Accounts' },
    { id: 'booking', title: 'Ride Booking & Cancellation' },
    { id: 'payment', title: 'Payment Terms' },
    { id: 'drivers', title: 'Driver Requirements' },
    { id: 'conduct', title: 'User Conduct' },
    { id: 'liability', title: 'Limitation of Liability' },
    { id: 'modifications', title: 'Modifications to Terms' },
    { id: 'contact', title: 'Contact Information' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-purple-500/30">
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span className="text-sm font-bold tracking-tight">RideShare</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row gap-12">
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-32 space-y-4">
            <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-6">Table of Contents</h3>
            <ul className="space-y-3 text-sm text-gray-500">
              {sections.map((s) => (
                <li key={s.id}>
                  <button onClick={() => scrollTo(s.id)} className="hover:text-white transition-colors text-left w-full">
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">Terms of Service</h1>
            <p className="text-gray-400 mb-12">Last Updated: July 2026</p>

            <div className="space-y-12 text-gray-300 leading-relaxed">
              <section id="acceptance">
                <h2 className="text-2xl font-bold text-white mb-4">Acceptance of Terms</h2>
                <p>By accessing and using the RideShare platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
              </section>

              <section id="description">
                <h2 className="text-2xl font-bold text-white mb-4">Description of Service</h2>
                <p>RideShare is a technology platform that connects riders seeking transportation with independent drivers. We do not provide transportation services directly.</p>
              </section>

              <section id="accounts">
                <h2 className="text-2xl font-bold text-white mb-4">User Accounts</h2>
                <p>You must register for an account to use the service. Available roles include Rider, Driver, and Admin. You are responsible for maintaining the confidentiality of your account credentials.</p>
              </section>

              <section id="booking">
                <h2 className="text-2xl font-bold text-white mb-4">Ride Booking & Cancellation</h2>
                <p>Rides are matched based on proximity and availability. You may cancel a ride at any time, though cancellation fees may apply depending on the timing of your cancellation.</p>
              </section>

              <section id="payment">
                <h2 className="text-2xl font-bold text-white mb-4">Payment Terms</h2>
                <p>Payments are processed securely via Stripe. We provide fare estimation before booking. Promo codes must be applied before the trip begins.</p>
              </section>

              <section id="drivers">
                <h2 className="text-2xl font-bold text-white mb-4">Driver Requirements</h2>
                <p>Drivers must maintain valid licenses, insurance, and adhere to local regulations. RideShare reserves the right to suspend driver accounts for non-compliance.</p>
              </section>

              <section id="conduct">
                <h2 className="text-2xl font-bold text-white mb-4">User Conduct</h2>
                <p>Users agree to treat others with respect. Harassment, discrimination, or damage to property will result in immediate account termination.</p>
              </section>

              <section id="liability">
                <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
                <p>RideShare is not liable for indirect, incidental, or consequential damages arising from the use of our services.</p>
              </section>

              <section id="modifications">
                <h2 className="text-2xl font-bold text-white mb-4">Modifications to Terms</h2>
                <p>We may update these terms periodically. Continued use of the platform after changes implies acceptance of the new terms.</p>
              </section>

              <section id="contact">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
                <p>For legal inquiries or questions regarding these terms, contact us at <a href="mailto:support@rideshare.app" className="text-purple-400 hover:underline">support@rideshare.app</a>.</p>
              </section>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
