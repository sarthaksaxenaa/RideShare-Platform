import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export type TripState = 'idle' | 'requesting' | 'matched' | 'started' | 'completed' | 'cancelled';

export interface TripData {
  tripId: string;
  driverId?: string;
  driverName?: string;
  fare?: number;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface DriverLocation {
  lat: number;
  lng: number;
}

export function useTrip(socket: Socket | null) {
  const [tripState, setTripState] = useState<TripState>('idle');
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [driverDisconnected, setDriverDisconnected] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onTripRequested = (data: any) => {
      console.log('[Trip] Requested:', data);
      setTripState('requesting');
      setTripData((prev) => prev ? { ...prev, tripId: data.tripId || prev.tripId } : prev);
    };

    const onTripMatched = (data: any) => {
      console.log('[Trip] Matched:', data);
      setTripState('matched');
      setDriverDisconnected(false);
      setTripData((prev) => ({
        tripId: data.tripId || prev?.tripId || '',
        driverId: data.driverId,
        driverName: data.driverName,
        fare: data.fare ?? prev?.fare,
        pickupLat: prev?.pickupLat || 0,
        pickupLng: prev?.pickupLng || 0,
        dropLat: prev?.dropLat || 0,
        dropLng: prev?.dropLng || 0,
      }));
    };

    const onTripStarted = (data: any) => {
      console.log('[Trip] Started:', data);
      setTripState('started');
    };

    const onTripCompleted = (data: any) => {
      console.log('[Trip] Completed:', data);
      setTripState('completed');
      if (data.fare !== undefined) {
        setTripData((prev) => prev ? { ...prev, fare: data.fare } : prev);
      }
    };

    const onTripCancelled = (data: any) => {
      console.log('[Trip] Cancelled:', data);
      setTripState('cancelled');
    };

    const onTripAlreadyTaken = (data: any) => {
      console.log('[Trip] Already taken:', data);
      setTripState('idle');
      setTripData(null);
    };

    const onDriverLocation = (data: { lat: number; lng: number }) => {
      setDriverLocation({ lat: data.lat, lng: data.lng });
    };

    const onDriverDisconnected = () => {
      console.log('[Trip] Driver disconnected');
      setDriverDisconnected(true);
    };

    socket.on('trip:requested', onTripRequested);
    socket.on('trip:matched', onTripMatched);
    socket.on('trip:started', onTripStarted);
    socket.on('trip:completed', onTripCompleted);
    socket.on('trip:cancelled', onTripCancelled);
    socket.on('trip:already_taken', onTripAlreadyTaken);
    socket.on('driver:location', onDriverLocation);
    socket.on('driver:disconnected', onDriverDisconnected);

    return () => {
      socket.off('trip:requested', onTripRequested);
      socket.off('trip:matched', onTripMatched);
      socket.off('trip:started', onTripStarted);
      socket.off('trip:completed', onTripCompleted);
      socket.off('trip:cancelled', onTripCancelled);
      socket.off('trip:already_taken', onTripAlreadyTaken);
      socket.off('driver:location', onDriverLocation);
      socket.off('driver:disconnected', onDriverDisconnected);
    };
  }, [socket]);

  const requestTrip = useCallback(
    (pickupLat: number, pickupLng: number, dropLat: number, dropLng: number, fare: number) => {
      if (!socket) return;
      setTripState('requesting');
      setTripData({
        tripId: '',
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        fare,
      });
      setDriverLocation(null);
      setDriverDisconnected(false);
      socket.emit('trip:request', { pickupLat, pickupLng, dropLat, dropLng, fare });
    },
    [socket]
  );

  const cancelTrip = useCallback(
    (tripId: string, reason?: string) => {
      if (!socket) return;
      socket.emit('trip:cancel', { tripId, reason });
      setTripState('cancelled');
    },
    [socket]
  );

  const resetTrip = useCallback(() => {
    setTripState('idle');
    setTripData(null);
    setDriverLocation(null);
    setDriverDisconnected(false);
  }, []);

  return {
    tripState,
    tripData,
    driverLocation,
    driverDisconnected,
    requestTrip,
    cancelTrip,
    resetTrip,
  };
}

export default useTrip;
