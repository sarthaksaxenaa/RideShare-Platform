import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface Position {
  lat: number;
  lng: number;
}

export function useLocation(socket: Socket | null, isOnline: boolean) {
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);
  const THROTTLE_MS = 2000;

  const emitLocation = useCallback(
    (pos: Position) => {
      const now = Date.now();
      if (socket && isOnline && now - lastEmitRef.current >= THROTTLE_MS) {
        socket.emit('driver:location_update', { lat: pos.lat, lng: pos.lng });
        lastEmitRef.current = now;
      }
    },
    [socket, isOnline]
  );

  useEffect(() => {
    if (!isOnline) {
      // Stop watching when going offline
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentPosition(pos);
        setError(null);
        emitLocation(pos);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable GPS access.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information unavailable.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out.');
            break;
          default:
            setError('An unknown location error occurred.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOnline, emitLocation]);

  return { currentPosition, error };
}
