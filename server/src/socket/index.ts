/**
 * ────────────────────────────────────────────────────────────
 * Socket.io — Initialization & Authentication
 * ────────────────────────────────────────────────────────────
 *
 * This module is the central wiring point for all real-time
 * communication in the RideShare platform. It performs two jobs:
 *
 *  1. **JWT Authentication Middleware** — every WebSocket
 *     connection must carry a valid JWT in the handshake auth
 *     payload. This reuses the same JWT_SECRET and token format
 *     as the REST API's `authMiddleware`, so a user who is logged
 *     in on the REST layer is automatically authenticated for
 *     WebSocket connections too. No separate auth flow needed.
 *
 *  2. **Connection Lifecycle** — once authenticated, the socket
 *     is routed to the appropriate event handler module based on
 *     the user's role. Drivers and riders share some handlers
 *     (e.g., trip events) but have role-specific ones too (e.g.,
 *     driver location updates).
 *
 * WHY AUTHENTICATE AT THE MIDDLEWARE LEVEL?
 * Socket.io's `io.use()` middleware runs BEFORE the `connection`
 * event fires. If auth fails, the socket is rejected immediately
 * and never reaches any handler — reducing attack surface. This
 * is the same pattern Express uses for route-level middleware.
 *
 * WHY ATTACH USER DATA TO `socket.data`?
 * `socket.data` is Socket.io's built-in mechanism for per-socket
 * state. It survives across event handlers and is type-safe when
 * extended. By attaching decoded JWT claims here, every handler
 * can access the user's id, role, and email without re-verifying
 * the token on each event.
 * ────────────────────────────────────────────────────────────
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { registerDriverHandlers } from './driverHandlers.js';
import { registerTripHandlers } from './tripHandlers.js';

// ── Types ────────────────────────────────────────────────────

/**
 * Shape of the decoded JWT payload we attach to each socket.
 * Mirrors the claims set during login in the auth service.
 */
interface SocketUser {
  id: string;
  role: 'RIDER' | 'DRIVER';
  email: string;
}

// ── Initialization ───────────────────────────────────────────

/**
 * Configure Socket.io with authentication and event handlers.
 *
 * Called once from `src/index.ts` after the io instance is created.
 * This function is the ONLY public API of this module — it wires
 * up everything internally.
 *
 * @param io - The Socket.io server instance (already attached to
 *             the HTTP server with CORS configured).
 */
export function initSocket(io: SocketIOServer): void {
  // ── 1. JWT Authentication Middleware ────────────────────────
  //
  // Socket.io middleware works like Express middleware: call
  // `next()` to proceed, or `next(new Error(...))` to reject.
  //
  // The token is expected in `socket.handshake.auth.token`,
  // which the client sets when connecting:
  //   io("http://localhost:3001", { auth: { token: "eyJ..." } })
  //
  // WHY NOT USE COOKIES?
  // Mobile apps (React Native) can't easily send cookies with
  // WebSocket upgrade requests. The `auth` payload is transport-
  // agnostic and works identically on web and mobile.
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        // Fail loudly if the server is misconfigured — this should
        // never happen in a properly deployed environment.
        console.error('[socket] JWT_SECRET is not set in environment variables');
        return next(new Error('Authentication error'));
      }

      // Verify the token and extract claims.
      // The `as SocketUser` cast is safe because we control the
      // token creation in our auth service and always include
      // id, role, and email.
      const decoded = jwt.verify(token, secret) as SocketUser;

      // Attach user data to the socket for use in all handlers.
      socket.data.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
      };

      next();
    } catch (err) {
      // Covers both missing/malformed tokens and expired tokens.
      // We intentionally don't leak the specific error reason to
      // the client (security best practice — don't help attackers
      // distinguish between "token expired" and "token invalid").
      console.error('[socket] Authentication failed:', (err as Error).message);
      next(new Error('Authentication error'));
    }
  });

  // ── 2. Connection Handler ──────────────────────────────────
  //
  // This fires ONLY for authenticated sockets (the middleware
  // above already rejected unauthenticated ones).
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    console.log(`[socket] User connected: ${user.email} (role: ${user.role})`);

    // ── Role-Based Room Assignment & Handler Registration ────
    //
    // WHY ROOMS?
    // Socket.io rooms are lightweight groups that let us broadcast
    // events to subsets of connected clients without iterating all
    // sockets manually. A driver in the 'drivers' room receives
    // new ride requests; a driver NOT in the room doesn't.
    //
    // HANDLER REGISTRATION STRATEGY:
    // - Drivers get both driverHandlers (location, online/offline)
    //   AND tripHandlers (accept, start, complete, cancel)
    // - Riders get only tripHandlers (request, cancel)
    // This avoids checking roles inside every handler.

    if (user.role === 'DRIVER') {
      // Auto-join the 'drivers' room on connect.
      // The driver can explicitly leave/rejoin via go_offline/go_online.
      socket.join('drivers');

      // Register driver-specific handlers (location updates, go_online/offline).
      registerDriverHandlers(io, socket);
    }

    if (user.role === 'RIDER') {
      // Register trip lifecycle handlers for riders (trip:request, trip:cancel).
      registerTripHandlers(io, socket);
    }

    // Both drivers AND riders need trip event handlers.
    // Drivers need trip:accept, trip:start, trip:complete, trip:cancel.
    // We register trip handlers for drivers too (riders already got theirs above).
    if (user.role === 'DRIVER') {
      registerTripHandlers(io, socket);
    }

    // ── Disconnect Handler ───────────────────────────────────
    //
    // WHY CHECK FOR ACTIVE TRIPS ON DISCONNECT?
    // If a driver disconnects mid-trip (app crash, network loss),
    // the rider needs to know immediately so they can:
    //  - See a "driver disconnected" message
    //  - Decide whether to wait or cancel
    //
    // We emit to the `trip:{tripId}` room, which the rider is
    // already in (both parties join when a trip is matched).
    //
    // Note: We use an async IIFE inside the handler because
    // Socket.io disconnect handlers don't natively support async.
    socket.on('disconnect', () => {
      console.log(`[socket] User disconnected: ${user.email} (role: ${user.role})`);

      // Only check for active trips if the disconnected user is a driver.
      // Rider disconnects don't require DB lookups — the driver continues
      // driving to the destination regardless.
      if (user.role === 'DRIVER') {
        (async () => {
          try {
            // Find any trip this driver is actively handling.
            // MATCHED = driver accepted, en route to pickup.
            // STARTED = rider picked up, trip in progress.
            // In both cases, the rider should be notified.
            const activeTrip = await prisma.trip.findFirst({
              where: {
                driverId: user.id,
                status: { in: ['MATCHED', 'STARTED'] },
              },
              select: { id: true },
            });

            if (activeTrip) {
              // Notify everyone in the trip room (mainly the rider)
              // that the driver has disconnected. The frontend can
              // show a reconnection timer or cancellation option.
              io.to(`trip:${activeTrip.id}`).emit('driver:disconnected', {
                tripId: activeTrip.id,
                driverId: user.id,
              });

              console.log(
                `[socket] Driver ${user.email} disconnected during active trip ${activeTrip.id}`
              );
            }
          } catch (err) {
            // Log but don't crash — disconnect cleanup is best-effort.
            // The trip will eventually time out or be manually cancelled.
            console.error(
              '[socket] Error checking active trips on driver disconnect:',
              (err as Error).message
            );
          }
        })();
      }
    });
  });
}
