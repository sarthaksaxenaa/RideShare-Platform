'use client';

import { useEffect, useCallback, lazy, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useTripStore } from '@/stores/trip-store';
import { formatCurrency } from '@/lib/utils';

const MapView = lazy(() => import('@/components/map/map-view'));

const stateConfig: Record<string, { label: string; color: string; bg: string }> = {
  SEARCHING: { label: 'Finding your driver...', color: 'text-amber-600', bg: 'bg-amber-50' },
  MATCHED: { label: 'Driver is on the way', color: 'text-blue-600', bg: 'bg-blue-50' },
  ARRIVED: { label: 'Driver has arrived', color: 'text-green-600', bg: 'bg-green-50' },
  IN_TRANSIT: { label: 'Trip in progress', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  COMPLETED: { label: 'Trip completed', color: 'text-green-600', bg: 'bg-green-50' },
  CANCELLED: { label: 'Trip cancelled', color: 'text-red-600', bg: 'bg-red-50' },
};

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

  const isDriver = user?.role === 'DRIVER';
  const config = stateConfig[tripState] || stateConfig.SEARCHING;

  // If trip is idle, redirect back
  useEffect(() => {
    if (tripState === 'IDLE') {
      router.replace('/dashboard');
    }
  }, [tripState, router]);

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

  const mapCenter: [number, number] = tripData
    ? [tripData.pickupLat, tripData.pickupLng]
    : [28.6139, 77.209];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Status Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center justify-between px-4 py-3 rounded-xl mb-6 ${config.bg}`}
      >
        <div className="flex items-center gap-3">
          {tripState === 'SEARCHING' && (
            <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          )}
          {tripState === 'IN_TRANSIT' && (
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
          )}
          <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
        </div>
        {tripData?.fare && (
          <span className="text-sm font-bold text-gray-900">{formatCurrency(tripData.fare)}</span>
        )}
      </motion.div>

      {/* Driver disconnected warning */}
      {driverDisconnected && tripState !== 'COMPLETED' && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Driver connection lost. Attempting to reconnect...
        </div>
      )}

      {/* Map */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="h-[350px] sm:h-[400px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-6"
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

      {/* Trip Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        {tripData?.driverName && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {tripData.driverName[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{tripData.driverName}</p>
              <p className="text-xs text-gray-400">Your driver</p>
            </div>
          </div>
        )}

        {/* Trip info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            <span className="text-gray-500 truncate">
              {tripData ? `${tripData.pickupLat.toFixed(4)}, ${tripData.pickupLng.toFixed(4)}` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            <span className="text-gray-500 truncate">
              {tripData ? `${tripData.dropLat.toFixed(4)}, ${tripData.dropLng.toFixed(4)}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {/* Rider actions */}
        {!isDriver && tripState === 'SEARCHING' && (
          <button onClick={handleCancel}
            className="flex-1 py-3.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer">
            Cancel Request
          </button>
        )}

        {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
          <button onClick={handleCancel}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
            Cancel Trip
          </button>
        )}

        {/* Driver actions */}
        {isDriver && tripState === 'MATCHED' && (
          <button onClick={handleStartTrip}
            className="flex-1 py-3.5 rounded-xl bg-green-500 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:bg-green-600 transition-all cursor-pointer">
            Start Trip
          </button>
        )}

        {isDriver && tripState === 'IN_TRANSIT' && (
          <button onClick={handleCompleteTrip}
            className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all cursor-pointer">
            Complete Trip
          </button>
        )}

        {/* Completed / Cancelled */}
        {(tripState === 'COMPLETED' || tripState === 'CANCELLED') && (
          <button onClick={handleBackHome}
            className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer">
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}
