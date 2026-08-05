'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useTripStore } from '@/stores/trip-store';
import { useLocationStore } from '@/stores/location-store';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import MapSkeleton from '@/components/map/map-skeleton';

const MapView = lazy(() => import('@/components/map/map-view'));

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

interface TripRequest {
  tripId: string;
  riderName: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  distanceKm: number;
  pickupAddress?: string;
  dropAddress?: string;
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const tripState = useTripStore((s) => s.state);

  const userPosition = useLocationStore((s) => s.userPosition);
  const acquirePreciseLocation = useLocationStore((s) => s.acquirePreciseLocation);

  const [isOnline, setIsOnline] = useState(false);
  const [onlineSince, setOnlineSince] = useState<Date | null>(null);
  const [onlineElapsed, setOnlineElapsed] = useState(0);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [tripRequests, setTripRequests] = useState<TripRequest[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [earningsData, setEarningsData] = useState<any>(null);

  const isDriver = user?.role === 'DRIVER';
  const firstName = user?.name?.split(' ')[0] || 'Driver';

  // Redirect non-drivers
  useEffect(() => {
    if (!isDriver) {
      router.replace('/dashboard');
    }
  }, [isDriver, router]);

  // Get location
  useEffect(() => {
    acquirePreciseLocation();
  }, [acquirePreciseLocation]);

  // Fetch real driver stats from API
  useEffect(() => {
    if (!isDriver) return;
    api.get('/users/me/stats').then((res) => {
      setTodayEarnings(res.data.todayEarnings || 0);
      setTodayTrips(res.data.todayTrips || 0);
      setDriverRating(res.data.rating);
    }).catch(() => {});
    
    api.get('/trips/driver/earnings').then((res) => {
      setEarningsData(res.data);
      if (res.data.todayEarnings !== undefined) setTodayEarnings(res.data.todayEarnings);
      if (res.data.todayTrips !== undefined) setTodayTrips(res.data.todayTrips);
      if (res.data.averageRating !== undefined) setDriverRating(res.data.averageRating);
    }).catch(() => {});
    
    api.get('/users/me').then((res) => {
      setDriverProfile(res.data);
    }).catch(() => {});
  }, [isDriver]);

  // Send driver location periodically when online
  useEffect(() => {
    if (!socket || !isOnline || !userPosition) return;
    const interval = setInterval(() => {
      if (userPosition) {
        socket.emit('driver:update_location', { lat: userPosition.lat, lng: userPosition.lng });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, isOnline, userPosition]);

  // Listen for trip requests
  useEffect(() => {
    if (!socket) return;
    const handleRequest = (data: TripRequest) => {
      // Reverse-geocode pickup & drop addresses
      const enrichWithAddresses = async (req: TripRequest): Promise<TripRequest> => {
        try {
          const [pickupRes, dropRes] = await Promise.all([
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${req.pickupLat}&lon=${req.pickupLng}&format=json&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en' } }).then(r => r.json()),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${req.dropLat}&lon=${req.dropLng}&format=json&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en' } }).then(r => r.json()),
          ]);
          const fmt = (d: Record<string, unknown>) => {
            const a = (d.address || {}) as Record<string, string>;
            const parts = [a.amenity || a.building || a.road || '', a.neighbourhood || a.suburb || '', a.city || a.town || ''].filter(Boolean);
            return parts.length > 0 ? parts.join(', ') : (d.display_name as string || '').split(',').slice(0, 2).join(',');
          };
          return { ...req, pickupAddress: fmt(pickupRes), dropAddress: fmt(dropRes) };
        } catch {
          return req;
        }
      };
      enrichWithAddresses(data).then((enriched) => {
        setTripRequests((prev) => {
          if (prev.find((r) => r.tripId === enriched.tripId)) return prev;
          return [...prev, enriched];
        });
      });
      toast('New ride request!', { description: `${data.riderName} · ${formatCurrency(data.fare)}` });
    };
    const handleCancelled = (data: { tripId: string }) => {
      setTripRequests((prev) => prev.filter((r) => r.tripId !== data.tripId));
    };
    socket.on('trip:incoming_request', handleRequest);
    socket.on('trip:new_request', handleRequest);
    socket.on('trip:request_cancelled', handleCancelled);
    return () => {
      socket.off('trip:incoming_request', handleRequest);
      socket.off('trip:new_request', handleRequest);
      socket.off('trip:request_cancelled', handleCancelled);
    };
  }, [socket]);

  // Active trip redirect
  useEffect(() => {
    if (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') {
      const tripId = useTripStore.getState().data?.tripId;
      if (tripId) router.push(`/dashboard/trip/${tripId}`);
    }
  }, [tripState, router]);

  const toggleOnline = useCallback(() => {
    if (!socket) { toast.error('Not connected to server'); return; }
    const next = !isOnline;
    setIsOnline(next);
    
    if (next) {
      setOnlineSince(new Date());
      setOnlineElapsed(0);
    } else {
      setOnlineSince(null);
      setOnlineElapsed(0);
    }

    socket.emit('driver:toggle', { online: next });
    toast(next ? 'You are now online — ride requests will appear here' : 'You are now offline');
    if (!next) setTripRequests([]);
  }, [socket, isOnline]);

  // Timer for online elapsed time
  useEffect(() => {
    if (!isOnline || !onlineSince) return;
    const interval = setInterval(() => {
      setOnlineElapsed(Math.floor((new Date().getTime() - onlineSince.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnline, onlineSince]);

  const formatOnlineTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const acceptTrip = useCallback(
    (tripId: string) => {
      if (!socket) return;
      setAcceptingId(tripId);
      socket.emit('trip:accept', { tripId });
      setTimeout(() => {
        setTripRequests((prev) => prev.filter((r) => r.tripId !== tripId));
        setAcceptingId(null);
        setTodayTrips((t) => t + 1);
      }, 1000);
      toast.success('Trip accepted! Navigating to pickup...');
    },
    [socket]
  );

  const rejectTrip = useCallback(
    (tripId: string) => {
      setTripRequests((prev) => prev.filter((r) => r.tripId !== tripId));
    },
    []
  );

  const mapCenter: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lng]
    : DEFAULT_CENTER;

  if (!isDriver) return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        {/* ── Header ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
              Hey, {firstName} 🚗
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isOnline ? 'Listening for ride requests...' : 'Go online to start earning'}
            </p>
          </div>

          {/* Online/Offline toggle */}
          <button
            onClick={toggleOnline}
            disabled={driverProfile?.verificationStatus === 'PENDING' || driverProfile?.verificationStatus === 'REJECTED'}
            className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-400 cursor-pointer ${
              isOnline
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            {isOnline ? 'Online' : 'Go Online'}
          </button>
        </motion.div>

        {driverProfile?.verificationStatus === 'PENDING' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-amber-500 text-xl">⏳</span>
            <p className="text-sm text-amber-800 font-medium">Your account is under review. You can go online once approved.</p>
          </div>
        )}
        {driverProfile?.verificationStatus === 'REJECTED' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-500 text-xl">❌</span>
            <p className="text-sm text-red-800 font-medium">Your account was rejected. Please contact support.</p>
          </div>
        )}

        {/* ── Stats Cards ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-base">💰</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Earnings</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(todayEarnings)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Today</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base">🛣️</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Trips</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{todayTrips}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Completed today</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-base">⭐</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Rating</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{driverRating !== null ? driverRating : '—'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{driverRating !== null ? 'Avg from riders' : 'No ratings yet'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-base">⏱️</div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Online</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{isOnline ? 'Active' : '—'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{isOnline ? `Online for ${formatOnlineTime(onlineElapsed)}` : 'Offline'}</p>
          </div>
        </motion.div>

        {/* ── Driver Profile ───────────────────────── */}
        {driverProfile && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center border-2 border-indigo-50">
                {driverProfile.faceImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={driverProfile.faceImageUrl} alt="Driver" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-indigo-700">{firstName[0]}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{driverProfile.name}</h3>
                <p className="text-sm text-gray-500">{driverProfile.email} • {driverProfile.phone || 'No phone'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">Member since {new Date(driverProfile.createdAt).toLocaleDateString()}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                    Aadhaar: {driverProfile.aadhaarNumber ? `XXXX XXXX ${driverProfile.aadhaarNumber.slice(-4)}` : 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-2xl">
                {driverProfile.vehicleType === 'bike' ? '🏍️' : driverProfile.vehicleType === 'auto' ? '🛺' : driverProfile.vehicleType === 'suv' ? '🚙' : '🚗'}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{driverProfile.vehicleType || 'Vehicle'}</p>
                <p className="text-sm font-bold text-gray-900">{driverProfile.vehicleNumber || '—'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Map + Requests Grid ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3 h-[400px] lg:h-[500px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
          >
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                center={mapCenter}
                zoom={14}
                driverLocation={userPosition ? { lat: userPosition.lat, lng: userPosition.lng } : null}
              />
            </Suspense>
          </motion.div>

          {/* Trip Requests Panel */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Incoming Requests
              </h3>
              {tripRequests.length > 0 && (
                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-200">
                  {tripRequests.length}
                </span>
              )}
            </div>

            {/* Offline state */}
            {!isOnline && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <p className="text-sm font-semibold text-gray-600">You&apos;re offline</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Go online to receive ride requests from nearby riders</p>
                <button
                  onClick={toggleOnline}
                  className="px-5 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-all cursor-pointer shadow-sm"
                >
                  Go Online
                </button>
              </div>
            )}

            {/* Waiting state */}
            {isOnline && tripRequests.length === 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="w-14 h-14 mx-auto mb-4 bg-green-100 rounded-2xl flex items-center justify-center">
                  <div className="w-5 h-5 bg-green-500 rounded-full animate-pulse" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Waiting for requests</p>
                <p className="text-xs text-gray-400 mt-1">Stay online — new ride requests will appear here</p>
                {/* Pulse ring animation */}
                <div className="flex justify-center mt-5 gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-green-400 rounded-full"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Trip request cards */}
            <AnimatePresence>
              {tripRequests.map((req) => (
                <motion.div
                  key={req.tripId}
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 100, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden"
                >
                  {/* Green accent bar */}
                  <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />

                  <div className="p-5">
                    {/* Rider info + fare */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                          {req.riderName?.[0] || 'R'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{req.riderName}</p>
                          <p className="text-[11px] text-gray-400">
                            {req.distanceKm ? `${req.distanceKm} km away` : 'Nearby'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(req.fare)}</p>
                        <p className="text-[10px] text-gray-400">estimated</p>
                      </div>
                    </div>

                    {/* Route summary */}
                    <div className="flex items-start gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                      <div className="flex flex-col items-center gap-1 mt-0.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                        <div className="w-px h-6 bg-gray-300" />
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                      </div>
                      <div className="flex flex-col gap-3 text-xs text-gray-600 flex-1 min-w-0">
                        <span className="truncate">{req.pickupAddress || `${req.pickupLat.toFixed(4)}, ${req.pickupLng.toFixed(4)}`}</span>
                        <span className="truncate">{req.dropAddress || `${req.dropLat.toFixed(4)}, ${req.dropLng.toFixed(4)}`}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => rejectTrip(req.tripId)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => acceptTrip(req.tripId)}
                        disabled={acceptingId === req.tripId}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-green-500/25 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {acceptingId === req.tripId ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Accept Ride
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Earnings Section ───────────────────── */}
        {earningsData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Earnings Overview</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Earnings Cards (horizontal scroll on mobile implicitly via flex-wrap or grid) */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">💰</div>
                    <span className="text-indigo-100 text-xs font-semibold px-2 py-1 bg-white/10 rounded-full">Today</span>
                  </div>
                  <p className="text-3xl font-bold mb-1">{formatCurrency(earningsData.todayEarnings || 0)}</p>
                  <p className="text-sm text-indigo-100">{earningsData.todayTrips || 0} trips completed</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📅</div>
                    <span className="text-purple-100 text-xs font-semibold px-2 py-1 bg-white/10 rounded-full">This Week</span>
                  </div>
                  <p className="text-3xl font-bold mb-1">{formatCurrency(earningsData.weeklyEarnings || 0)}</p>
                  <p className="text-sm text-purple-100">{earningsData.weeklyTrips || 0} trips completed</p>
                </div>

                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg shadow-pink-500/20">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏆</div>
                    <span className="text-pink-100 text-xs font-semibold px-2 py-1 bg-white/10 rounded-full">This Month</span>
                  </div>
                  <p className="text-3xl font-bold mb-1">{formatCurrency(earningsData.monthlyEarnings || 0)}</p>
                  <p className="text-sm text-pink-100">{earningsData.monthlyTrips || 0} trips completed</p>
                </div>
              </div>

              {/* Average Rating */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-center items-center text-center">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Average Rating</p>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-8 h-8 ${star <= Math.round(earningsData.averageRating || 0) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-3xl font-bold text-gray-900">{earningsData.averageRating ? earningsData.averageRating.toFixed(1) : '—'}<span className="text-lg text-gray-400 font-medium">/5.0</span></p>
                <p className="text-sm text-gray-400 mt-1">Based on recent trips</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Bar Chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-6">Weekly Breakdown</h3>
                <div className="h-48 flex items-end justify-between gap-2 px-2">
                  {earningsData.dailyBreakdown?.map((day: any, i: number) => {
                    const maxEarnings = Math.max(...earningsData.dailyBreakdown.map((d: any) => d.earnings), 1);
                    const heightPercent = Math.max((day.earnings / maxEarnings) * 100, 4); // min 4% height
                    
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 group">
                        <div className="w-full relative flex justify-center h-40 items-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ duration: 0.8, delay: 0.1 * i, type: "spring" }}
                            className="w-full max-w-[40px] bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-md relative"
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                              {formatCurrency(day.earnings)}
                            </div>
                          </motion.div>
                        </div>
                        <span className="text-xs font-medium text-gray-500 mt-2">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Trips */}
              <div className="bg-white rounded-2xl border border-gray-200 p-0 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-base font-bold text-gray-900">Recent Trips</h3>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{earningsData.recentTrips?.length || 0} completed</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[220px]">
                  {earningsData.recentTrips?.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                      {earningsData.recentTrips.slice(0, 5).map((trip: any, i: number) => (
                        <motion.li 
                          key={trip.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + (i * 0.05) }}
                          className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                              {trip.riderName?.[0] || 'R'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{trip.riderName}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(trip.date).toLocaleDateString()} • {trip.distance || '—'} km
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(trip.fare)}</p>
                            <p className="text-[10px] text-green-600 font-medium">Completed</p>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                      <div className="text-3xl mb-2 opacity-50">🚕</div>
                      <p className="text-sm font-medium text-gray-600">No recent trips</p>
                      <p className="text-xs text-gray-400 mt-1">Your completed trips will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Quick Tips (fills whitespace below) ───── */}
      <div className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Tips to Earn More</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: '📍', title: 'Stay near hotspots', desc: 'Malls, metro stations, and offices have more ride requests' },
                { icon: '⏰', title: 'Peak hours', desc: '8-10 AM and 5-8 PM have highest demand and surge pricing' },
                { icon: '⭐', title: 'Maintain your rating', desc: 'Drivers with 4.8+ rating get priority ride matching' },
              ].map((tip) => (
                <div key={tip.title} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-base shrink-0">
                    {tip.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{tip.title}</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer spacer for mobile nav */}
      <div className="h-16 md:h-0" />
    </div>
  );
}
