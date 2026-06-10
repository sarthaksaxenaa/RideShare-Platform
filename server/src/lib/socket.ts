/**
 * ────────────────────────────────────────────────────────────
 * Socket.io — Instance Registry
 * ────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS:
 * Socket.io is used in Phase 3 (real-time ride tracking) to
 * push location updates, ride-status changes, and driver
 * assignments to connected clients.
 *
 * The Socket.io `Server` is created in `src/index.ts` (the
 * entry point) but needs to be accessible from route handlers
 * and services deeper in the call tree. Rather than passing
 * the instance through every function signature (prop-drilling),
 * we use a simple module-level getter/setter pair.
 *
 * This is effectively a lightweight service-locator pattern —
 * appropriate here because there is exactly ONE io instance
 * per process and it is set once at startup.
 * ────────────────────────────────────────────────────────────
 */

import { Server } from "socket.io";

/** Module-scoped reference — set once at boot. */
let io: Server | null = null;

/**
 * Store the Socket.io server instance.
 * Called exactly once from `src/index.ts` after creating the
 * HTTP server.
 *
 * @param server - The initialized Socket.io Server instance.
 */
export function setIO(server: Server): void {
  io = server;
}

/**
 * Retrieve the Socket.io server instance.
 * Throws if called before `setIO()` — a programming error that
 * should be caught immediately during development.
 *
 * @returns The active Socket.io Server instance.
 */
export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.io has not been initialized. Call setIO() in the entry point before accessing getIO()."
    );
  }
  return io;
}
