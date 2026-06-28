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
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const tripState = useTripStore((s) => s.state);

  const userPosition = useLocationStore((s) => s.userPosition);
  const acquirePreciseLocation = useLocationStore((s) => s.acquirePreciseLocation);

  const [isOnline, setIsOnline] = useState(false);
  const [tripRequests, setTripRequests] = useState<TripRequest[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);

  const isDriver = user?.role === 'DRIVER';

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
      setTripRequests((prev) => {
        if (prev.find((r) => r.tripId === data.tripId)) return prev;
        return [...prev, data];
      });
      toast('New ride request!', { description: `${data.riderName} · ${formatCurrency(data.fare)}` });
    };
    const handleCancelled = (data: { tripId: string }) => {
      setTripRequests((prev) => prev.filter((r) => r.tripId !== data.tripId));
    };
    socket.on('trip:incoming_request', handleRequest);
    socket.on('trip:request_cancelled', handleCancelled);
    return () => {
      socket.off('trip:incoming_request', handleRequest);
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
    socket.emit('driver:toggle', { online: next });
    toast(next ? 'You are now online' : 'You are now offline');
    if (!next) setTripRequests([]);
  }, [socket, isOnline]);

  const acceptTrip = useCallback(
    (tripId: string) => {
      if (!socket) return;
      socket.emit('trip:accept', { tripId });
      setTripRequests((prev) => prev.filter((r) => r.tripId !== tripId));
      toast.success('Trip accepted! Navigating to rider...');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Driver Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            {isOnline ? 'Listening for ride requests...' : 'Go online to start earning'}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
            isOnline
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 hover:bg-green-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          {isOnline ? '● Online' : '○ Go Online'}
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 font-medium">Today&apos;s Earnings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(todayEarnings)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 font-medium">Trips Completed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{todayTrips}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 h-[400px] lg:h-[500px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
        >
          <Suspense
            fallback={
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-green-500 rounded-full animate-spin" />
              </div>
            }
          >
            <MapView center={mapCenter} zoom={14} />
          </Suspense>
        </motion.div>

        {/* Trip Requests */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-500">
            Incoming Requests ({tripRequests.length})
          </h3>

          {!isOnline && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">You&apos;re offline</p>
              <p className="text-xs text-gray-400 mt-1">Go online to receive ride requests</p>
            </div>
          )}

          {isOnline && tripRequests.length === 0 && (
            <div className="bg-green-50/50 rounded-xl border border-green-200 p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Waiting for requests</p>
              <p className="text-xs text-gray-400 mt-1">Stay online, requests will appear here</p>
            </div>
          )}

          <AnimatePresence>
            {tripRequests.map((req) => (
              <motion.div
                key={req.tripId}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                        {req.riderName?.[0] || 'R'}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{req.riderName}</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(req.fare)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {req.distanceKm ? `${req.distanceKm} km away` : 'Nearby'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectTrip(req.tripId)}
                      className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => acceptTrip(req.tripId)}
                      className="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 shadow-sm transition-all cursor-pointer"
                    >
                      Accept Ride
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
