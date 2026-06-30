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

const MapView = lazy(() => import('@/components/map/map-view'));

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

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

  // Get precise location on mount
  useEffect(() => {
    acquirePreciseLocation();
  }, [acquirePreciseLocation]);

  // If driver, redirect to driver dashboard
  useEffect(() => {
    if (isDriver) {
      router.replace('/dashboard/driver');
    }
  }, [isDriver, router]);

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
    (pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }, fare: number) => {
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
      });
      toast.success('Searching for nearby drivers...');
    },
    [socket, setSearching]
  );

  const handleCancelBooking = useCallback((reason: string) => {
    if (!socket) return;
    const tripId = useTripStore.getState().data?.tripId;
    if (!tripId) {
      // If we don't have a tripId yet (network race condition), just reset local state
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          <Suspense
            fallback={
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            }
          >
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
  );
}
