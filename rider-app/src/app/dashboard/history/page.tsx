'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

/* ─── Types ────────────────────────────────────────────────── */
interface TripRecord {
  id: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string;
  dropLat: number;
  dropLng: number;
  dropAddress?: string;
  fare?: number;
  distanceKm?: number;
  durationMin?: number;
  vehicleType?: string;
  createdAt: string;
  completedAt?: string;
  rider?: { name: string; email: string };
  driver?: { name: string; email: string };
  rating?: { stars: number; comment?: string };
}

/* ─── Status badge config ──────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  REQUESTED: { label: 'Requested', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  MATCHED: { label: 'Matched', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  STARTED: { label: 'In Progress', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
};

const filters = ['All', 'Completed', 'Cancelled'] as const;

export default function RideHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const isDriver = user?.role === 'DRIVER';

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (activeFilter !== 'All') params.status = activeFilter.toUpperCase();
      const res = await api.get('/trips', { params });
      setTrips(res.data.trips || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatTimeShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">

        {/* ── Header ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Ride History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your past rides and trip details</p>
        </motion.div>

        {/* ── Filters ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-5"
        >
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                activeFilter === f
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </motion.div>

        {/* ── Trip List ──────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-2 w-16 bg-gray-100 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
                <div className="h-2 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">
              🗺️
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No rides found</p>
            <p className="text-xs text-gray-400">
              {activeFilter !== 'All'
                ? `No ${activeFilter.toLowerCase()} rides yet. Try a different filter.`
                : 'Your ride history will appear here after your first trip.'}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {trips.map((trip, idx) => {
                const sc = statusConfig[trip.status] || statusConfig.REQUESTED;
                const otherPerson = isDriver ? trip.rider : trip.driver;
                const isExpanded = expandedId === trip.id;

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Main row — always visible */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : trip.id)}
                      className="w-full p-5 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          trip.status === 'COMPLETED'
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {otherPerson?.name?.[0] || (isDriver ? 'R' : 'D')}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {otherPerson?.name || (isDriver ? 'Rider' : 'Driver')}
                            </p>
                            {trip.rating && (
                              <span className="text-xs text-amber-500">★ {trip.rating.stars}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-400">{formatDate(trip.createdAt)}</span>
                            <span className="text-gray-200">·</span>
                            <span className="text-[11px] text-gray-400">{formatTimeShort(trip.createdAt)}</span>
                            {trip.vehicleType && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-[11px] text-gray-400 capitalize">{trip.vehicleType}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Fare + status */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          {trip.fare && (
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(trip.fare)}</p>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color} ${sc.bg} ${sc.border}`}>
                            {sc.label}
                          </span>
                        </div>

                        {/* Expand chevron */}
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                            {/* Route */}
                            <div className="flex items-start gap-3 mb-4">
                              <div className="flex flex-col items-center gap-0.5 mt-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow" />
                                <div className="w-px h-6 bg-gray-200" />
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow" />
                              </div>
                              <div className="flex flex-col gap-3 flex-1 text-xs">
                                <div>
                                  <p className="font-semibold text-gray-700">Pickup</p>
                                  <p className="text-gray-400">{trip.pickupAddress || `${trip.pickupLat.toFixed(4)}, ${trip.pickupLng.toFixed(4)}`}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-700">Drop-off</p>
                                  <p className="text-gray-400">{trip.dropAddress || `${trip.dropLat.toFixed(4)}, ${trip.dropLng.toFixed(4)}`}</p>
                                </div>
                              </div>
                            </div>

                            {/* Stats pills */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {trip.distanceKm && (
                                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                                  📍 {trip.distanceKm.toFixed(1)} km
                                </span>
                              )}
                              {trip.durationMin && (
                                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                                  ⏱️ {trip.durationMin} min
                                </span>
                              )}
                              {trip.completedAt && (
                                <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                                  ✅ {formatTimeShort(trip.completedAt)}
                                </span>
                              )}
                            </div>

                            {/* Rating comment */}
                            {trip.rating?.comment && (
                              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                                <span className="font-semibold">Your review:</span> &quot;{trip.rating.comment}&quot;
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ── Pagination ─────────────────────────── */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mt-6"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              ← Prev
            </button>
            <span className="px-3 py-2 text-xs font-semibold text-gray-900">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              Next →
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer spacer for mobile nav */}
      <div className="h-16 md:h-0" />
    </div>
  );
}
