'use client';

import { useEffect, useState, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useTripStore } from '@/stores/trip-store';
import { useLocationStore } from '@/stores/location-store';
import BookingCard from '@/components/booking/booking-card';
import MapSkeleton from '@/components/map/map-skeleton';

const MapView = lazy(() => import('@/components/map/map-view'));

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

const quickActions = [
  { icon: '🏠', label: 'Home', sub: 'Set home address', color: 'bg-amber-50 text-amber-600 border-amber-100', href: '/dashboard/profile' },
  { icon: '💼', label: 'Work', sub: 'Set office address', color: 'bg-blue-50 text-blue-600 border-blue-100', href: '/dashboard/profile' },
  { icon: '🕐', label: 'History', sub: 'Past rides', color: 'bg-purple-50 text-purple-600 border-purple-100', href: '/dashboard/history' },
  { icon: '⭐', label: 'My Rating', sub: 'View feedback', color: 'bg-green-50 text-green-600 border-green-100', href: '/dashboard/profile' },
];

const steps = [
  { num: '1', title: 'Set Location', desc: 'Enter your pickup and drop-off points', icon: '📍' },
  { num: '2', title: 'Choose Ride', desc: 'Pick from bikes, autos, or cars', icon: '🚗' },
  { num: '3', title: 'Enjoy Trip', desc: 'Track your driver in real time', icon: '🎯' },
];

const trustBadges = [
  { icon: '🛡️', label: 'Verified Drivers', desc: 'Background-checked & rated' },
  { icon: '📍', label: 'Live Tracking', desc: 'Share trip with family' },
  { icon: '💳', label: 'Secure Payments', desc: 'Encrypted transactions' },
  { icon: '🆘', label: 'SOS Button', desc: 'Emergency help 24/7' },
];

export default function RiderDashboardPage() {
  const router = useRouter();
  const bookingRef = useRef<HTMLDivElement>(null);
  const [initialPromoCode, setInitialPromoCode] = useState('');
  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const connectionStatus = useSocketStore((s) => s.connectionStatus);
  const tripState = useTripStore((s) => s.state);
  const setSearching = useTripStore((s) => s.setSearching);

  const userPosition = useLocationStore((s) => s.userPosition);
  const acquirePreciseLocation = useLocationStore((s) => s.acquirePreciseLocation);

  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<{ lat: number; lng: number }[]>([]);
  const [mapPickMode, setMapPickMode] = useState<'pickup' | 'drop' | null>(null);
  const [mapPickedLocation, setMapPickedLocation] = useState<{ mode: 'pickup' | 'drop'; lat: number; lng: number } | null>(null);

  const isDriver = user?.role === 'DRIVER';
  const isAdmin = user?.role === 'ADMIN';

  // Get precise location on mount
  useEffect(() => {
    acquirePreciseLocation();
  }, [acquirePreciseLocation]);

  // Redirect drivers and admins to their dashboards
  useEffect(() => {
    if (isDriver) {
      router.replace('/dashboard/driver');
    } else if (isAdmin) {
      router.replace('/dashboard/admin');
    }
  }, [isDriver, isAdmin, router]);

  // Listen for nearby drivers
  useEffect(() => {
    if (!socket) return;
    const handleDriverLocation = (data: { lat: number; lng: number; driverId?: string }) => {
      setNearbyDrivers((prev) => {
        const filtered = prev.filter((d) => !(Math.abs(d.lat - data.lat) < 0.0001 && Math.abs(d.lng - data.lng) < 0.0001));
        return [...filtered, { lat: data.lat, lng: data.lng }];
      });
    };
    socket.on('driver:location', handleDriverLocation);
    return () => { socket.off('driver:location', handleDriverLocation); };
  }, [socket]);

  // Redirect if trip is active
  useEffect(() => {
    if (tripState === 'SEARCHING' || tripState === 'MATCHED' || tripState === 'IN_TRANSIT') {
      const tripId = useTripStore.getState().data?.tripId;
      if (tripId) router.push(`/dashboard/trip/${tripId}`);
    }
  }, [tripState, router]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (pickupCoords) return pickupCoords;
    if (userPosition) return [userPosition.lat, userPosition.lng];
    return DEFAULT_CENTER;
  }, [pickupCoords, userPosition]);

  const handleLocationChange = useCallback(
    (pickup: [number, number] | null, dropoff: [number, number] | null) => {
      setPickupCoords(pickup);
      setDropCoords(dropoff);
    },
    []
  );

  const handleBook = useCallback(
    (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number, paymentMethod: string = 'UPI', vehicle?: { type: string; icon: string; label: string }) => {
      if (!socket) {
        toast.error('Not connected to server. Please refresh.');
        return;
      }
      setSearching({
        tripId: '',
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        fare,
        vehicleType: vehicle?.type,
        vehicleIcon: vehicle?.icon,
        vehicleLabel: vehicle?.label,
      });
      socket.emit('trip:request', {
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        fare,
        paymentMethod,
        vehicleType: vehicle?.type,
      });
      toast.success('Searching for nearby drivers...');
    },
    [socket, setSearching]
  );

  const handleCancelBooking = useCallback((reason: string) => {
    if (!socket) return;
    const tripId = useTripStore.getState().data?.tripId;
    if (!tripId) {
      useTripStore.getState().reset();
      return;
    }
    socket.emit('trip:cancel', { tripId, reason });
    useTripStore.getState().reset();
    toast.success('Booking cancelled');
  }, [socket]);

  const handleLocateOnMap = useCallback((mode: 'pickup' | 'drop') => {
    setMapPickMode(mode);
    toast.info(`Tap on the map to set your ${mode === 'pickup' ? 'pickup' : 'drop-off'} location`);
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!mapPickMode) return;
    setMapPickedLocation({ mode: mapPickMode, lat, lng });
    setMapPickMode(null);
    toast.success(`${mapPickMode === 'pickup' ? 'Pickup' : 'Drop-off'} location set!`);
  }, [mapPickMode]);

  const firstName = user?.name?.split(' ')[0] || 'Rider';

  if (isDriver) return null;

  return (
    <div className="min-h-screen">
      {/* ── Socket Connection Banner ──────────── */}
      <AnimatePresence>
        {connectionStatus !== 'connected' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`w-full text-center py-2 text-sm font-medium text-white shadow-md z-50 flex items-center justify-center gap-2 overflow-hidden ${
              connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-amber-500'
            }`}
          >
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            {connectionStatus === 'disconnected' ? 'Connection lost. Reconnecting...' : 'Reconnecting...'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Searching for Driver Overlay ──────────── */}
      <AnimatePresence>
        {tripState === 'SEARCHING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center"
            >
              {/* Radar Animation */}
              <div className="relative w-28 h-28 mb-6">
                {/* Outer pulse rings */}
                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 rounded-full border-2 border-indigo-400/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                <div className="absolute inset-4 rounded-full border-2 border-indigo-400/15 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                {/* Center icon — shows the booked vehicle type */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <span className="text-3xl">{useTripStore.getState().data?.vehicleIcon || '🚗'}</span>
                  </div>
                </div>
              </div>

              {/* Text */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Searching for {useTripStore.getState().data?.vehicleLabel || 'Driver'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Please wait while we find a nearby driver to accept your ride...
              </p>

              {/* Ride Info */}
              <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Fare</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ₹{useTripStore.getState().data?.fare || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                      initial={{ width: '5%' }}
                      animate={{ width: '95%' }}
                      transition={{ duration: 60, ease: 'linear' }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Connecting with nearby drivers
                </p>
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  const tripId = useTripStore.getState().data?.tripId;
                  if (socket && tripId) {
                    socket.emit('trip:cancel', { tripId, reason: 'Cancelled while searching' });
                  }
                  useTripStore.getState().reset();
                  toast.info('Ride search cancelled');
                }}
                className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all cursor-pointer"
              >
                Cancel Search
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero Section: Map + Booking ──────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Hey, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ready for your next ride?</p>
        </motion.div>

        {/* Grid: Map + Booking */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map (3 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3 h-[400px] lg:h-[600px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                center={mapCenter}
                pickup={pickupCoords}
                dropoff={dropCoords}
                nearbyDrivers={nearbyDrivers}
                pickMode={mapPickMode}
                onMapClick={handleMapClick}
              />
            </Suspense>
          </motion.div>

          {/* Booking Card (2 cols) */}
          <motion.div
            ref={bookingRef}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <BookingCard
              initialPromoCode={initialPromoCode}
              onBook={handleBook}
              loading={tripState === 'SEARCHING'}
              onLocationChange={handleLocationChange}
              onCancelBooking={handleCancelBooking}
              onLocateOnMap={handleLocateOnMap}
              mapPickedLocation={mapPickedLocation}
            />
          </motion.div>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────── */}
      <div className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${action.color}`}
                >
                  <span className="text-xl">{action.icon}</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-[11px] opacity-70">{action.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Promo Banner ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 p-6 sm:p-8"
        >
          <div className="relative z-10">
            <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">Limited Offer</p>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Get 20% off your first 3 rides!</h3>
            <p className="text-sm text-indigo-100 mb-4 max-w-md">Use code <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded">RIDE20</span> at checkout. Valid for new users.</p>
            <button 
              onClick={() => {
                setInitialPromoCode('RIDE20');
                bookingRef.current?.scrollIntoView({ behavior: 'smooth' });
                toast.success('Promo code RIDE20 ready! Book a ride to use it.');
              }}
              className="px-5 py-2.5 bg-white text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg cursor-pointer"
            >
              Use RIDE20
            </button>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -right-4 w-24 h-24 bg-white/5 rounded-full" />
          <div className="absolute top-4 right-20 w-16 h-16 bg-white/5 rounded-full" />
        </motion.div>
      </div>

      {/* ── How It Works ─────────────────────────── */}
      <div className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-5">How It Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {steps.map((step, i) => (
                <div key={step.num} className="relative">
                  <div className="flex items-start gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-lg shrink-0">
                      {step.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{step.num}</span>
                        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-1/2 -right-3 w-6 border-t-2 border-dashed border-gray-200" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Safety & Trust ────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Safety Matters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {trustBadges.map((badge) => (
              <div key={badge.label} className="text-center p-4 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="text-2xl mb-2">{badge.icon}</div>
                <p className="text-sm font-semibold text-gray-900 mb-0.5">{badge.label}</p>
                <p className="text-[11px] text-gray-400">{badge.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Footer spacer for mobile nav ──────────── */}
      <div className="h-16 md:h-0" />
    </div>
  );
}

