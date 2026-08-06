'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useThemeStore } from '@/stores/theme-store';
import { cn, getInitials } from '@/lib/utils';
import api from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const isConnected = useSocketStore((s) => s.isConnected);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Wait for zustand to hydrate from localStorage before checking auth.
  // Without this, a page refresh would flash-redirect to /login because
  // the initial SSR state has isAuthenticated=false before hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // zustand/persist fires rehydrate synchronously on first render,
    // so by the time this effect runs the store is already hydrated.
    setHydrated(true);
  }, []);

  // Auth guard — only fires after hydration
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }
    return () => disconnect();
  }, [isAuthenticated, connect, disconnect]);

  useEffect(() => {
    if (!isAuthenticated || !hydrated) return;
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/users/notifications');
        setNotifications(res.data);
      } catch (error) {
        console.error('Failed to fetch notifications', error);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, hydrated]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/users/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/users/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error(error);
    }
  };

  if (!hydrated || !isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const isDriver = user.role === 'DRIVER';
  const isAdmin = user.role === 'ADMIN';
  const initials = getInitials(user.name);
  const accent = isAdmin ? 'purple' : isDriver ? 'emerald' : 'indigo';

  const handleLogout = () => {
    disconnect();
    logout();
    router.replace('/login');
  };

  // Navigation items
  const navItems = [
    {
      href: '/dashboard',
      label: 'Home',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      ),
      exact: true,
    },
    {
      href: '/dashboard/history',
      label: 'History',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
    {
      href: '/dashboard/profile',
      label: 'Profile',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      ),
    },
    // Only show Admin nav for ADMIN role users
    ...(isAdmin ? [{
      href: '/dashboard/admin',
      label: 'Admin',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      ),
    }] : []),
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/80 dark:bg-gray-950 transition-colors duration-300">
      {/* ── Top Navigation ─────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[56px]">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-5">
              <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
                <div className="relative">
                  <Image
                    src="/favicon.png"
                    alt="RideShare"
                    width={30}
                    height={30}
                    className="rounded-lg group-hover:scale-105 transition-transform"
                  />
                  {/* Tiny live dot */}
                  {isConnected && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <span className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight hidden sm:block">
                  RideShare
                </span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-0.5 ml-2">
                {navItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200',
                        active
                          ? isDriver ? 'text-emerald-700' : isAdmin ? 'text-purple-700' : 'text-indigo-700'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/70'
                      )}
                    >
                      <span className={cn('transition-transform duration-200', active && 'scale-110')}>
                        {item.icon}
                      </span>
                      {item.label}
                      {active && (
                        <motion.div
                          layoutId="nav-pill"
                          className={cn(
                            'absolute -bottom-[13px] left-2 right-2 h-[2.5px] rounded-full',
                            isDriver ? 'bg-emerald-500' : isAdmin ? 'bg-purple-500' : 'bg-indigo-500'
                          )}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Status + User */}
            <div className="flex items-center gap-2.5">
              {/* Connection status pill */}
              <div className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                isConnected
                  ? 'bg-green-50 text-green-600 border border-green-200/80 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
                  : 'bg-red-50 text-red-500 border border-red-200/80 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
              )}>
                <div className={cn(
                  'w-[5px] h-[5px] rounded-full',
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'
                )} />
                {isConnected ? 'Live' : 'Offline'}
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-all duration-200 relative cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                    />
                  )}
                </button>

                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="fixed right-4 sm:absolute sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-h-[70vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-200/80 dark:border-gray-800/80 overflow-hidden z-50 flex flex-col"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</span>
                        <button onClick={handleMarkAllAsRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">Mark all as read</button>
                      </div>
                      <div className="max-h-[350px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet</div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                              className={cn(
                                "px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 transition-colors",
                                !n.isRead ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500 cursor-pointer" : "opacity-75 hover:bg-gray-50 dark:hover:bg-gray-800"
                              )}
                            >
                              <div className="flex gap-3">
                                <span className="text-xl shrink-0 mt-0.5">{n.type === 'SUCCESS' ? '✅' : n.type === 'WARNING' ? '⚠️' : '🔔'}</span>
                                <div>
                                  <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{n.title}</h4>
                                  <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">{n.message}</p>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                    {new Date(n.createdAt).toLocaleString(undefined, {
                                      hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={() => useThemeStore.getState().toggleTheme()}
                aria-label="Toggle dark mode"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer"
                title="Toggle dark mode"
              >
                {useThemeStore.getState().theme === 'dark' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>

              {/* Role badge */}
              <span
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                  isDriver
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : isAdmin
                      ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                )}
              >
                {isDriver ? '🚗 Driver' : isAdmin ? '🛡️ Admin' : '🧑 Rider'}
              </span>

              {/* User avatar + dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1.5 p-1 pr-1.5 rounded-full hover:bg-gray-100 transition-all duration-200 cursor-pointer">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm',
                      isDriver
                        ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                        : isAdmin
                          ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                          : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    )}
                  >
                    {initials}
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl shadow-gray-200/50 border border-gray-200/80 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
                  <div className="px-3.5 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard/profile"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-lg mx-1"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Profile Settings
                    </Link>
                    <Link
                      href="/dashboard/history"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-lg mx-1"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Ride History
                    </Link>
                    <Link
                      href="/dashboard/admin"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-lg mx-1"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                      Admin Dashboard
                    </Link>
                  </div>
                  <div className="border-t border-gray-100 pt-1 mt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer rounded-lg mx-1"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ──────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-safe">
        <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl transition-all duration-200',
                  active
                    ? isDriver ? 'text-emerald-600' : isAdmin ? 'text-purple-600' : 'text-indigo-600'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-bg"
                    className={cn(
                      'absolute inset-0 rounded-xl',
                      isDriver ? 'bg-emerald-50' : isAdmin ? 'bg-purple-50' : 'bg-indigo-50'
                    )}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className={cn(
                  'relative z-10 text-[9px] font-semibold tracking-wide',
                  active ? 'opacity-100' : 'opacity-60'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl text-gray-400 hover:text-red-500 transition-all duration-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span className="text-[9px] font-semibold tracking-wide opacity-60">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
