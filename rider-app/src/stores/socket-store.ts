import { create } from 'zustand';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useTripStore } from './trip-store';
import type { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';

  // Actions
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>()((set, get) => ({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',

  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = getSocket();
    if (!socket) return;

    set({ socket, connectionStatus: 'connecting' });

    socket.on('connect', () => {
      if (process.env.NODE_ENV === 'development') console.log('[Socket] Connected:', socket.id);
      set({ isConnected: true, connectionStatus: 'connected' });
    });

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV === 'development') console.log('[Socket] Disconnected:', reason);
      set({ isConnected: false, connectionStatus: 'disconnected' });
    });

    socket.io.on('reconnect_attempt', () => {
      set({ connectionStatus: 'connecting' });
    });

    socket.on('connect_error', (err) => {
      if (process.env.NODE_ENV === 'development') console.error('[Socket] Connection error:', err.message);
      // Don't redirect to login on socket errors — the socket has
      // auto-reconnection enabled and will keep trying. REST API
      // interceptor already handles 401s with proper token refresh.
      set({ isConnected: false, connectionStatus: 'disconnected' });
    });

    // ── Trip events → Zustand trip store ──
    const trip = useTripStore.getState();

    socket.on('trip:requested', (data) => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Requested:', data);
      const current = useTripStore.getState().data;
      if (current) {
        useTripStore.setState({
          state: 'SEARCHING',
          data: { ...current, tripId: data.tripId || current.tripId },
        });
      }
    });

    socket.on('trip:matched', (data) => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Matched:', data);
      trip.setMatched({
        tripId: data.tripId,
        driverId: data.driverId,
        driverName: data.driverName,
        fare: data.fare,
      });
    });

    socket.on('trip:started', () => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Started');
      useTripStore.getState().setInTransit();
    });

    socket.on('trip:completed', (data) => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Completed:', data);
      useTripStore.getState().setCompleted(data?.fare);
    });

    socket.on('trip:cancelled', () => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Cancelled');
      useTripStore.getState().setCancelled();
    });

    socket.on('trip:already_taken', () => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Already taken');
      useTripStore.getState().reset();
    });

    socket.on('driver:location', (data: { lat: number; lng: number }) => {
      useTripStore.getState().updateDriverLocation(data);
    });

    socket.on('driver:disconnected', () => {
      if (process.env.NODE_ENV === 'development') console.log('[Trip] Driver disconnected');
      useTripStore.getState().setDriverDisconnected(true);
    });

    socket.connect();
  },

  disconnect: () => {
    disconnectSocket();
    set({ socket: null, isConnected: false, connectionStatus: 'disconnected' });
  },
}));
