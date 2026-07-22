'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useTripStore } from '@/stores/trip-store';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import RatingModal from '@/components/rating-modal';
import MapSkeleton from '@/components/map/map-skeleton';

const MapView = lazy(() => import('@/components/map/map-view'));

/* ─── Status config ────────────────────────────────────────── */
const stateConfig: Record<string, {
  label: string; sub: string; icon: string;
  color: string; bg: string; border: string; accent: string;
  step: number;
}> = {
  SEARCHING: {
    label: 'Finding your driver', sub: 'Scanning nearby drivers...',
    icon: '🔍', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', accent: 'bg-amber-500',
    step: 1,
  },
  MATCHED: {
    label: 'Driver on the way', sub: 'Your driver is heading to pickup',
    icon: '🚗', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-500',
    step: 2,
  },
  ARRIVED: {
    label: 'Driver has arrived', sub: 'Your driver is waiting at pickup',
    icon: '📍', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-500',
    step: 2,
  },
  IN_TRANSIT: {
    label: 'Trip in progress', sub: 'Enjoy your ride!',
    icon: '🛣️', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'bg-indigo-500',
    step: 3,
  },
  COMPLETED: {
    label: 'Trip completed', sub: 'Thanks for riding with us!',
    icon: '✅', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-500',
    step: 4,
  },
  CANCELLED: {
    label: 'Trip cancelled', sub: 'No charges applied',
    icon: '❌', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', accent: 'bg-red-500',
    step: 0,
  },
};

const stepLabels = ['Searching', 'Matched', 'In Transit', 'Completed'];

export default function ActiveTripPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const tripState = useTripStore((s) => s.state);
  const tripData = useTripStore((s) => s.data);
  const driverLocation = useTripStore((s) => s.driverLocation);
  const driverDisconnected = useTripStore((s) => s.driverDisconnected);
  const reset = useTripStore((s) => s.reset);

  const [elapsed, setElapsed] = useState(0);
  const [showSOS, setShowSOS] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [fetchingTrip, setFetchingTrip] = useState(false);

  const isDriver = user?.role === 'DRIVER';
  const config = stateConfig[tripState] || stateConfig.SEARCHING;

  // ── API Fallback: Hydrate trip store on page refresh ──────
  // WHY: After a browser refresh, the Zustand trip-store is empty
  // (state = 'IDLE'). Without this, the page would redirect to
  // /dashboard. Instead, we fetch the trip from the API and
  // restore the store so the page can render correctly.
  useEffect(() => {
    if (tripState !== 'IDLE' || fetchingTrip) return;
    setFetchingTrip(true);
    api.get(`/trips/${tripId}`)
      .then((res) => {
        const trip = res.data;
        // Map API status to our store state
        const statusMap: Record<string, () => void> = {
          REQUESTED: () => useTripStore.getState().setSearching({
            tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
            dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
          }),
          MATCHED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setMatched({
              tripId: trip.id, driverId: trip.driverId,
              driverName: trip.driver?.name, fare: trip.fare,
            });
          },
          STARTED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setInTransit();
          },
          COMPLETED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setCompleted(trip.fare);
          },
          CANCELLED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setCancelled();
          },
        };
        const handler = statusMap[trip.status];
        if (handler) handler();
        else router.replace('/dashboard');
      })
      .catch(() => {
        toast.error('Trip not found');
        router.replace('/dashboard');
      })
      .finally(() => setFetchingTrip(false));
  }, [tripState, tripId, fetchingTrip, router]);

  // Auto-show rating modal when trip completes (riders only)
  useEffect(() => {
    if (tripState === 'COMPLETED' && !isDriver) {
      const timer = setTimeout(() => setShowRating(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tripState, isDriver]);

  // Timer
  useEffect(() => {
    if (tripState !== 'IN_TRANSIT') return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [tripState]);

  // If trip is idle AND we're not fetching, redirect back
  useEffect(() => {
    if (tripState === 'IDLE' && !fetchingTrip) {
      // Don't redirect immediately — give the API fetch a chance
      const timeout = setTimeout(() => {
        if (useTripStore.getState().state === 'IDLE') {
          router.replace('/dashboard');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [tripState, fetchingTrip, router]);

  // Driver location broadcasting
  useEffect(() => {
    if (!isDriver || !socket) return;
    if (tripState !== 'MATCHED' && tripState !== 'IN_TRANSIT') return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit('driver:update_location', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          tripId,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isDriver, socket, tripState, tripId]);

  const handleCancel = useCallback(() => {
    if (!socket || !tripId) return;
    socket.emit('trip:cancel', { tripId, reason: 'Cancelled by user' });
    toast('Trip cancelled');
    reset();
    router.replace('/dashboard');
  }, [socket, tripId, reset, router]);

  const handleStartTrip = useCallback(() => {
    if (!socket) return;
    socket.emit('trip:start', { tripId });
    toast.success('Trip started!');
  }, [socket, tripId]);

  const handleCompleteTrip = useCallback(() => {
    if (!socket) return;
    socket.emit('trip:complete', { tripId });
    toast.success('Trip completed!');
  }, [socket, tripId]);

  const handleBackHome = useCallback(() => {
    reset();
    router.replace('/dashboard');
  }, [reset, router]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const mapCenter: [number, number] = driverLocation
    ? [driverLocation.lat, driverLocation.lng]
    : tripData
      ? [tripData.pickupLat, tripData.pickupLng]
      : [28.6139, 77.209];

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">

        {/* ── Progress Steps ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center gap-1 mb-4">
            {stepLabels.map((label, i) => {
              const active = config.step >= i + 1;
              const current = config.step === i + 1;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-center">
                    <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                      active ? 'bg-indigo-500' : 'bg-gray-200'
                    } ${current ? 'animate-pulse' : ''}`} />
                  </div>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${
                    active ? 'text-indigo-600' : 'text-gray-300'
                  }`}>{label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Status Banner ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between px-5 py-3.5 rounded-xl mb-5 border ${config.bg} ${config.border}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{config.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-[11px] text-gray-400">{config.sub}</p>
            </div>
          </div>
          <div className="text-right">
            {tripData?.fare && (
              <p className="text-sm font-bold text-gray-900">{formatCurrency(tripData.fare)}</p>
            )}
            {tripState === 'IN_TRANSIT' && (
              <p className="text-[11px] text-gray-400 font-mono">{formatTime(elapsed)}</p>
            )}
          </div>
        </motion.div>

        {/* Driver disconnected warning */}
        <AnimatePresence>
          {driverDisconnected && tripState !== 'COMPLETED' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 overflow-hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Driver connection lost. Attempting to reconnect...
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Grid ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Map (2 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 h-[350px] lg:h-[450px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
          >
            <Suspense
              fallback={
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              }
            >
              <MapView
                center={mapCenter}
                pickup={tripData ? [tripData.pickupLat, tripData.pickupLng] : null}
                dropoff={tripData ? [tripData.dropLat, tripData.dropLng] : null}
                driverLocation={driverLocation}
              />
            </Suspense>
          </motion.div>

          {/* Right Panel */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* Driver Info Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
              {tripData?.driverName ? (
                <div className="p-5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Your Driver</p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
                      {tripData.driverName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{tripData.driverName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-amber-500">★</span>
                        <span className="text-xs text-gray-500 font-medium">4.9</span>
                        <span className="text-xs text-gray-300 mx-1">·</span>
                        <span className="text-xs text-gray-400">128 rides</span>
                      </div>
                    </div>
                  </div>
                  {/* Vehicle info */}
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                    <span className="text-lg">🚗</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Maruti Suzuki Swift</p>
                      <p className="text-[10px] text-gray-400">DL 1C AB 1234 · White</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Finding your driver...</p>
                  <p className="text-xs text-gray-400 mt-1">This usually takes less than 30 seconds</p>
                </div>
              )}
            </div>

            {/* Route Info */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Route</p>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
                </div>
                <div className="flex flex-col gap-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Pickup</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {tripData ? `${tripData.pickupLat.toFixed(4)}, ${tripData.pickupLng.toFixed(4)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Drop-off</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {tripData ? `${tripData.dropLat.toFixed(4)}, ${tripData.dropLng.toFixed(4)}` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => toast.info('Calling driver...')}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span className="text-[10px] font-medium text-gray-600">Call</span>
                </button>
                <button
                  onClick={() => toast.info('Trip link copied!')}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  <span className="text-[10px] font-medium text-gray-600">Share</span>
                </button>
                <button
                  onClick={() => setShowSOS(!showSOS)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[10px] font-medium text-red-600">SOS</span>
                </button>
              </div>
            )}

            {/* SOS Expanded */}
            <AnimatePresence>
              {showSOS && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 overflow-hidden"
                >
                  <p className="text-sm font-semibold text-red-700 mb-2">Emergency Help</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toast.info('Calling 112...')}
                      className="w-full py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      Call 112 (Emergency)
                    </button>
                    <button
                      onClick={() => toast.info('Alert sent to emergency contacts')}
                      className="w-full py-2.5 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Alert Emergency Contacts
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Action Buttons ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mt-5"
        >
          {/* Rider: Cancel during search */}
          {!isDriver && tripState === 'SEARCHING' && (
            <button onClick={handleCancel}
              className="flex-1 py-3.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel Search
            </button>
          )}

          {/* Rider: Cancel during matched/transit */}
          {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
            <button onClick={handleCancel}
              className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel Trip
            </button>
          )}

          {/* Driver: Start trip */}
          {isDriver && tripState === 'MATCHED' && (
            <button onClick={handleStartTrip}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Rider Picked Up — Start Trip
            </button>
          )}

          {/* Driver: Complete trip */}
          {isDriver && tripState === 'IN_TRANSIT' && (
            <button onClick={handleCompleteTrip}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Destination Reached — Complete Trip
            </button>
          )}

          {/* Trip ended */}
          {(tripState === 'COMPLETED' || tripState === 'CANCELLED') && (
            <button onClick={handleBackHome}
              className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Home
            </button>
          )}
        </motion.div>
      </div>

      {/* Footer spacer for mobile */}
      <div className="h-16 md:h-0" />

      {/* Rating Modal */}
      {showRating && tripData && (
        <RatingModal
          tripId={tripId}
          driverName={tripData.driverName || 'Driver'}
          fare={tripData.fare || 0}
          onClose={() => {
            setShowRating(false);
            reset();
            router.replace('/dashboard');
          }}
        />
      )}
    </div>
  );
}
