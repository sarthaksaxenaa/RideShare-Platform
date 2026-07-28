/**
 * ────────────────────────────────────────────────────────────
 * Socket.io Client — Cookie-Based Authentication
 * ────────────────────────────────────────────────────────────
 *
 * 📚 HOW SOCKET AUTH WORKS WITH HTTPONLY COOKIES:
 *
 * BEFORE: We read the JWT from localStorage and sent it in
 * the `auth: { token }` handshake payload. This was insecure
 * because XSS could steal the token from localStorage.
 *
 * AFTER: We set `withCredentials: true` on the Socket.io
 * client. This tells the browser to include cookies (including
 * our HttpOnly 'jwt' cookie) in the WebSocket upgrade request.
 * The server's Socket.io middleware reads the cookie to verify
 * the user's identity.
 *
 * The server-side socket middleware (`socket/index.ts`) now
 * checks BOTH cookie and auth payload, so this works with the
 * existing server code.
 * ────────────────────────────────────────────────────────────
 */

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Get or create the Socket.io singleton.
 * Ensures only one connection exists per client session.
 */
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  // Check if user is authenticated (from Zustand store, not localStorage)
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (!isAuthenticated) return null;

  if (socket?.connected) return socket;

  // Disconnect stale socket if exists
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  // Get the stored token for auth payload fallback
  const token = useAuthStore.getState().token;

  socket = io(SOCKET_URL, {
    /**
     * 📚 withCredentials: true
     * This tells the browser to send cookies (including our
     * HttpOnly 'jwt' cookie) with the WebSocket upgrade request.
     * Without this, the cookie won't be sent cross-origin.
     */
    withCredentials: true,
    /**
     * 📚 auth.token fallback
     * Cross-origin cookies between vercel.app and render.com are
     * often blocked by browsers (SameSite policy). We also send
     * the JWT in the auth payload so the server can authenticate
     * via either method.
     */
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

/** Disconnect and cleanup the socket */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
