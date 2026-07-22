'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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

  // User management state
  interface AdminUser {
    id: string; name: string; email: string; role: string; createdAt: string;
    _count: { tripsAsRider: number; tripsAsDriver: number };
  }
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

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

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(usersPage) });
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      const res = await api.get(`/admin/users?${params}`);
      setUsers(res.data.users);
      setUsersTotalPages(res.data.pagination.totalPages);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, [usersPage, searchQuery, roleFilter]);

  useEffect(() => { if (activeTab === 'users') fetchUsers(); }, [fetchUsers, activeTab]);

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      fetchUsers();
    } catch { toast.error('Failed to change role'); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success(`${userName} deleted`);
      fetchUsers();
      fetchStats();
    } catch { toast.error('Failed to delete user'); }
  };

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

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 User Management
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Stats and Recent Trips — existing code stays the same above */}
        </div>
      ) : (
        /* ── User Management Tab ────────────────────────────── */
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setUsersPage(1); }}
                placeholder="Search users by name or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500 focus:ring-3 focus:ring-purple-500/10 placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              {['', 'RIDER', 'DRIVER', 'ADMIN'].map((r) => (
                <button
                  key={r}
                  onClick={() => { setRoleFilter(r); setUsersPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
          >
            {usersLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">👥</p>
                <p className="text-sm text-gray-400">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Trips</th>
                      <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                      <th className="text-right py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer outline-none focus:border-purple-500"
                          >
                            <option value="RIDER">🧑 Rider</option>
                            <option value="DRIVER">🚗 Driver</option>
                            <option value="ADMIN">🛡️ Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs text-gray-500">
                            {u._count.tripsAsRider + u._count.tripsAsDriver}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-gray-400">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                            title="Delete user"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">Page {usersPage} of {usersTotalPages}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setUsersPage(Math.max(1, usersPage - 1))}
                    disabled={usersPage <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setUsersPage(Math.min(usersTotalPages, usersPage + 1))}
                    disabled={usersPage >= usersTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Footer spacer */}
      <div className="h-16 md:h-0" />
    </div>
  );
}
