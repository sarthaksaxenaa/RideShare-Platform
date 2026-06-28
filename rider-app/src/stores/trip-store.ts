import { create } from 'zustand';
import type { TripState, TripData, DriverLocation } from '@/types/trip';

interface TripStore {
  state: TripState;
  data: TripData | null;
  driverLocation: DriverLocation | null;
  driverDisconnected: boolean;

  // Actions
  setSearching: (data: TripData) => void;
  setMatched: (update: Partial<TripData>) => void;
  setArrived: () => void;
  setInTransit: () => void;
  setCompleted: (fare?: number) => void;
  setCancelled: () => void;
  updateDriverLocation: (loc: DriverLocation) => void;
  setDriverDisconnected: (val: boolean) => void;
  reset: () => void;
}

export const useTripStore = create<TripStore>()((set) => ({
  state: 'IDLE',
  data: null,
  driverLocation: null,
  driverDisconnected: false,

  setSearching: (data) =>
    set({ state: 'SEARCHING', data, driverLocation: null, driverDisconnected: false }),

  setMatched: (update) =>
    set((s) => ({
      state: 'MATCHED',
      driverDisconnected: false,
      data: s.data ? { ...s.data, ...update } : null,
    })),

  setArrived: () => set({ state: 'ARRIVED' }),

  setInTransit: () => set({ state: 'IN_TRANSIT' }),

  setCompleted: (fare) =>
    set((s) => ({
      state: 'COMPLETED',
      data: fare !== undefined && s.data ? { ...s.data, fare } : s.data,
    })),

  setCancelled: () => set({ state: 'CANCELLED' }),

  updateDriverLocation: (loc) => set({ driverLocation: loc }),

  setDriverDisconnected: (val) => set({ driverDisconnected: val }),

  reset: () =>
    set({
      state: 'IDLE',
      data: null,
      driverLocation: null,
      driverDisconnected: false,
    }),
}));
