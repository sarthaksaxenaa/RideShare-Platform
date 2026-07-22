'use client';

import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const tripState = useTripStore((s) => s.state);
  const setSearching = useTripStore((s) => s.setSearching);

  const userPosition = useLocationStore((s) => s.userPosition);
  const acquirePreciseLocation = useLocationStore((s) => s.acquirePreciseLocation);

  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<{ lat: number; lng: number }[]>([]);

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
    const handleNearby = (data: { drivers: { lat: number; lng: number }[] }) => {
      setNearbyDrivers(data.drivers || []);
    };
    socket.on('nearby:drivers', handleNearby);
    return () => { socket.off('nearby:drivers', handleNearby); };
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
    (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number, paymentMethod: string = 'UPI') => {
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
      });
      socket.emit('trip:request', {
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        fare,
        paymentMethod,
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

  const firstName = user?.name?.split(' ')[0] || 'Rider';

  if (isDriver) return null;

  return (
    <div className="min-h-screen">
      {/* ── Hero Section: Map + Booking ──────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Hey, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Ready for your next ride?</p>
        </motion.div>

        {/* Grid: Map + Booking */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map (3 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3 h-[400px] lg:h-[600px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
          >
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                center={mapCenter}
                pickup={pickupCoords}
                dropoff={dropCoords}
                nearbyDrivers={nearbyDrivers}
              />
            </Suspense>
          </motion.div>

          {/* Booking Card (2 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <BookingCard
              onBook={handleBook}
              loading={tripState === 'SEARCHING'}
              onLocationChange={handleLocationChange}
              onCancelBooking={handleCancelBooking}
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
            <button className="px-5 py-2.5 bg-white text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg cursor-pointer">
              Apply Code
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

