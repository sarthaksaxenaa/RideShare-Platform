'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

interface AdminStats {
  users: { total: number; riders: number; drivers: number };
  trips: { total: number; completed: number; cancelled: number; active: number; today: number; thisWeek: number };
  revenue: { total: number; today: number };
  recentTrips: {
    id: string; status: string; fare?: number; createdAt: string; vehicleType?: string;
    rider?: { name: string; email: string };
    driver?: { name: string; email: string };
  }[];
}

const statusColors: Record<string, { color: string; bg: string }> = {
  COMPLETED: { color: 'text-green-700', bg: 'bg-green-50' },
  CANCELLED: { color: 'text-red-600', bg: 'bg-red-50' },
  REQUESTED: { color: 'text-amber-700', bg: 'bg-amber-50' },
  MATCHED: { color: 'text-blue-700', bg: 'bg-blue-50' },
  STARTED: { color: 'text-indigo-700', bg: 'bg-indigo-50' },
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">

        {/* ── Header ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Platform overview & analytics</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to App
          </button>
        </motion.div>

        {/* ── Stats Grid ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
        >
          {/* Revenue */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm">💰</div>
              <p className="text-[11px] text-indigo-200 font-medium uppercase tracking-wider">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats?.revenue.total || 0)}</p>
            <p className="text-xs text-indigo-200 mt-1">Today: {formatCurrency(stats?.revenue.today || 0)}</p>
          </div>

          {/* Total Trips */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm">🛣️</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Total Trips</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.trips.total || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Today: {stats?.trips.today || 0} · This week: {stats?.trips.thisWeek || 0}</p>
          </div>

          {/* Users */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm">👥</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Total Users</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.users.total || 0}</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.users.riders || 0} riders · {stats?.users.drivers || 0} drivers</p>
          </div>

          {/* Completion Rate */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-sm">📊</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Completion Rate</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats && stats.trips.total > 0
                ? `${Math.round((stats.trips.completed / stats.trips.total) * 100)}%`
                : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">{stats?.trips.completed || 0} completed · {stats?.trips.cancelled || 0} cancelled</p>
          </div>
        </motion.div>

        {/* ── Main Grid ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Live Activity */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Live Activity</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700">Active Trips</span>
                </div>
                <span className="text-lg font-bold text-green-700">{stats?.trips.active || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  <span className="text-sm font-medium text-blue-700">Online Drivers</span>
                </div>
                <span className="text-lg font-bold text-blue-700">{stats?.users.drivers || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  <span className="text-sm font-medium text-amber-700">Today&apos;s Trips</span>
                </div>
                <span className="text-lg font-bold text-amber-700">{stats?.trips.today || 0}</span>
              </div>
            </div>

            {/* Quick breakdown bar */}
            {stats && stats.trips.total > 0 && (
              <div className="mt-5">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2">Trip Breakdown</p>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  <div
                    className="bg-green-500 rounded-l-full transition-all"
                    style={{ width: `${(stats.trips.completed / stats.trips.total) * 100}%` }}
                    title={`Completed: ${stats.trips.completed}`}
                  />
                  <div
                    className="bg-red-400 transition-all"
                    style={{ width: `${(stats.trips.cancelled / stats.trips.total) * 100}%` }}
                    title={`Cancelled: ${stats.trips.cancelled}`}
                  />
                  <div
                    className="bg-amber-400 rounded-r-full transition-all"
                    style={{ width: `${(stats.trips.active / stats.trips.total) * 100}%` }}
                    title={`Active: ${stats.trips.active}`}
                  />
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Completed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full inline-block" /> Cancelled</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> Active</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Recent Trips Feed */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Recent Trips</h3>
              <button
                onClick={() => router.push('/dashboard/history')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                View all →
              </button>
            </div>

            {!stats?.recentTrips?.length ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No trips yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">Rider</th>
                      <th className="text-left py-2 px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">Driver</th>
                      <th className="text-left py-2 px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">Status</th>
                      <th className="text-right py-2 px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">Fare</th>
                      <th className="text-right py-2 px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTrips.map((trip) => {
                      const sc = statusColors[trip.status] || statusColors.REQUESTED;
                      return (
                        <tr key={trip.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                                {trip.rider?.name?.[0] || 'R'}
                              </div>
                              <span className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{trip.rider?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <span className="text-xs text-gray-500 truncate max-w-[100px] block">{trip.driver?.name || '—'}</span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.color} ${sc.bg}`}>
                              {trip.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className="text-xs font-semibold text-gray-900">{trip.fare ? formatCurrency(trip.fare) : '—'}</span>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className="text-[11px] text-gray-400">{formatDate(trip.createdAt)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Footer spacer */}
      <div className="h-16 md:h-0" />
    </div>
  );
}
