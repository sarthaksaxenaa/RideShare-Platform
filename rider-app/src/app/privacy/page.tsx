'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Privacy Policy - RideShare',
  description: 'Privacy Policy for the RideShare platform.',
};

export default function PrivacyPolicy() {
  const sections = [
    { id: 'collect', title: 'Information We Collect' },
    { id: 'use', title: 'How We Use Your Information' },
    { id: 'sharing', title: 'Data Sharing' },
    { id: 'location', title: 'Location Data' },
    { id: 'security', title: 'Data Security' },
    { id: 'retention', title: 'Data Retention' },
    { id: 'rights', title: 'Your Rights' },
    { id: 'contact', title: 'Contact Information' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-indigo-500/30">
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
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-6">Table of Contents</h3>
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
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">Privacy Policy</h1>
            <p className="text-gray-400 mb-12">Last Updated: July 2026</p>

            <div className="space-y-12 text-gray-300 leading-relaxed">
              <section id="collect">
                <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
                <p>We collect various types of information to provide and improve our services, including location data, trip history, and account information such as your name, email, and phone number.</p>
              </section>

              <section id="use">
                <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
                <p>Your information is used to facilitate rides, process payments, enhance safety, provide customer support, and improve the overall RideShare experience.</p>
              </section>

              <section id="sharing">
                <h2 className="text-2xl font-bold text-white mb-4">Data Sharing</h2>
                <p>We share necessary information (like your first name and pickup location) with drivers for trip matching. We do not sell your personal data to third parties.</p>
              </section>

              <section id="location">
                <h2 className="text-2xl font-bold text-white mb-4">Location Data</h2>
                <p>GPS data is used for ride matching and is securely stored in our DriverLocation table. Background location is only accessed when you are actively using the app or on a trip.</p>
              </section>

              <section id="security">
                <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
                <p>We employ enterprise-grade security measures including JWT encryption, HttpOnly cookies, and Helmet headers to protect your data against unauthorized access.</p>
              </section>

              <section id="retention">
                <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
                <p>We retain your personal data only for as long as necessary to fulfill the purposes outlined in this policy, or as required by law.</p>
              </section>

              <section id="rights">
                <h2 className="text-2xl font-bold text-white mb-4">Your Rights</h2>
                <p>You have the right to access, correct, or delete your personal data. You can manage these preferences directly from your account settings.</p>
              </section>

              <section id="contact">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@rideshare.app" className="text-indigo-400 hover:underline">support@rideshare.app</a>.</p>
              </section>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
