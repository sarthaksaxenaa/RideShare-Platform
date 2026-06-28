import { create } from 'zustand';
import type { SelectedLocation } from '@/types/booking';

interface LocationState {
  // User's GPS position
  userPosition: { lat: number; lng: number } | null;
  positionAccuracy: number | null;
  isLocating: boolean;
  locationError: string | null;

  // Booking selections
  pickup: SelectedLocation | null;
  dropoff: SelectedLocation | null;

  // Actions
  setUserPosition: (lat: number, lng: number, accuracy?: number) => void;
  setLocating: (val: boolean) => void;
  setLocationError: (err: string | null) => void;
  setPickup: (loc: SelectedLocation | null) => void;
  setDropoff: (loc: SelectedLocation | null) => void;
  clearLocations: () => void;

  // Precise GPS
  acquirePreciseLocation: () => void;
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  userPosition: null,
  positionAccuracy: null,
  isLocating: false,
  locationError: null,
  pickup: null,
  dropoff: null,

  setUserPosition: (lat, lng, accuracy) =>
    set({ userPosition: { lat, lng }, positionAccuracy: accuracy ?? null }),

  setLocating: (val) => set({ isLocating: val }),

  setLocationError: (err) => set({ locationError: err }),

  setPickup: (loc) => set({ pickup: loc }),

  setDropoff: (loc) => set({ dropoff: loc }),

  clearLocations: () => set({ pickup: null, dropoff: null }),

  acquirePreciseLocation: () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      set({ locationError: 'Geolocation not supported' });
      return;
    }

    set({ isLocating: true, locationError: null });

    let bestPosition: GeolocationPosition | null = null;
    let settled = false;

    const finalize = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      set({
        userPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        positionAccuracy: pos.coords.accuracy,
        isLocating: false,
      });
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }
        if (pos.coords.accuracy <= 100) {
          finalize(pos);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (bestPosition) {
            finalize(bestPosition);
          } else {
            set({ locationError: err.message, isLocating: false });
          }
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    const timer = setTimeout(() => {
      if (!settled) {
        if (bestPosition) {
          finalize(bestPosition);
        } else {
          settled = true;
          navigator.geolocation.clearWatch(watchId);
          set({ locationError: 'Location timeout', isLocating: false });
        }
      }
    }, 8000);
  },
}));
