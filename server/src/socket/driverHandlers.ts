/**
 * ────────────────────────────────────────────────────────────
 * Socket.io — Driver Event Handlers
 * ────────────────────────────────────────────────────────────
 *
 * Handles three driver-specific real-time events:
 *
 *  1. **driver:location_update** — GPS position broadcasts.
 *     The mobile app sends these every ~2 seconds while the
 *     driver is online. The handler persists to the database
 *     (for matching queries) AND broadcasts to the appropriate
 *     audience (trip-specific or general).
 *
 *  2. **driver:go_online** — Driver opens the app and is ready
 *     to accept rides. Joins the 'drivers' room to receive
 *     new trip requests.
 *
 *  3. **driver:go_offline** — Driver closes the app or taps
 *     "Go Offline". Leaves the 'drivers' room and removes
 *     their location from the database.
 *
 * LOCATION PRIVACY MODEL:
 * When a driver is on an active trip, their real-time location
 * is sent ONLY to the rider in that trip (via the `trip:{id}`
 * room). Other riders don't see this driver's position — they
 * shouldn't, because the driver is unavailable anyway. When a
 * driver is available (no active trip), their location is
 * broadcast more broadly so nearby riders can see them on the
 * map.
 *
 * WHY UPSERT INSTEAD OF UPDATE?
 * The first location update from a newly online driver creates
 * the DriverLocation record. Subsequent updates modify it.
 * Using `upsert` handles both cases in a single atomic
 * operation, avoiding "record not found" errors and race
 * conditions between go_online and the first location ping.
 * ────────────────────────────────────────────────────────────
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';

// ── Types ────────────────────────────────────────────────────

/** Payload shape for the `driver:location_update` event. */
interface LocationUpdatePayload {
  lat: number;
  lng: number;
}

// ── Handler Registration ─────────────────────────────────────

/**
 * Register all driver-specific Socket.io event listeners on the
 * given socket.
 *
 * Called once per driver connection from `socket/index.ts`.
 * Each listener has access to `io` (for broadcasting) and
 * `socket` (for the individual driver's context).
 *
 * @param io     - The Socket.io server instance (for room broadcasts).
 * @param socket - The individual driver's socket connection.
 */
export function registerDriverHandlers(
  io: SocketIOServer,
  socket: Socket
): void {
  const user = socket.data.user as { id: string; role: string; email: string };

  // ── Event: driver:location_update ──────────────────────────
  //
  // Fired by the driver's mobile app every ~2 seconds while
  // the app is in the foreground. The payload is a simple
  // { lat, lng } object from the device's GPS.
  //
  // Two responsibilities:
  //   1. Persist to DB → keeps the DriverLocation table current
  //      for the matching service (`findNearbyDrivers`)
  //   2. Broadcast to clients → riders see driver markers move
  //      in real time on the map
  //
  // The broadcast target depends on whether the driver is on
  // a trip or available:
  //   - Active trip → emit to `trip:{tripId}` room only (privacy)
  //   - No trip → emit to all connected sockets (so riders on
  //     the home screen see available drivers nearby)

  socket.on('driver:location_update', async (payload: LocationUpdatePayload) => {
    try {
      const { lat, lng } = payload;

      // ── 1. Persist location to the database ────────────────
      // Upsert creates the record on first update, then modifies
      // it on subsequent updates. The `updatedAt` field auto-
      // updates via Prisma's `@updatedAt` directive, which lets
      // us later filter out stale positions.
      await prisma.driverLocation.upsert({
        where: { driverId: user.id },
        create: {
          driverId: user.id,
          lat,
          lng,
        },
        update: {
          lat,
          lng,
        },
      });

      // ── 2. Check if driver has an active trip ──────────────
      // A trip with status STARTED means the driver has picked
      // up the rider and is en route to the drop-off. Only
      // STARTED is checked (not MATCHED) because during MATCHED
      // the driver is heading to the pickup — we still want
      // the rider to see the driver approaching, but that's
      // the trip room's job too.
      const activeTrip = await prisma.trip.findFirst({
        where: {
          driverId: user.id,
          status: 'STARTED',
        },
        select: { id: true },
      });

      // ── 3. Broadcast to the appropriate audience ───────────
      const locationData = {
        lat,
        lng,
        driverId: user.id,
      };

      if (activeTrip) {
        // PRIVACY: Only the rider in this trip should see the
        // driver's live location. Other riders don't need to
        // know where busy drivers are.
        io.to(`trip:${activeTrip.id}`).emit('driver:location', locationData);
      } else {
        // AVAILABILITY: The driver is free and visible to all
        // riders on the home screen. We use `io.emit()` to
        // broadcast to every connected socket. Riders use this
        // to render nearby driver markers on the map.
        //
        // WHY NOT `socket.broadcast.to('riders')`?
        // We don't maintain a 'riders' room — riders connect
        // from various screens and filtering is done client-side.
        // A general broadcast is simpler and the payload is tiny.
        io.emit('driver:location', locationData);
      }
    } catch (err) {
      console.error(
        `[socket] Error processing location update for driver ${user.email}:`,
        (err as Error).message
      );
    }
  });

  // ── Event: driver:go_online ────────────────────────────────
  //
  // Fired when the driver taps "Go Online" in the app.
  // This makes the driver eligible to receive new trip requests
  // by joining the 'drivers' room.
  //
  // Note: The driver already auto-joins 'drivers' on connect
  // (in socket/index.ts). This event exists for cases where
  // the driver went offline (via go_offline) and wants to come
  // back online without reconnecting the socket.

  socket.on('driver:go_online', () => {
    socket.join('drivers');
    console.log(`[socket] Driver ${user.email} went online`);
  });

  // ── Event: driver:go_offline ───────────────────────────────
  //
  // Fired when the driver taps "Go Offline" or the app goes to
  // the background for an extended period.
  //
  // Two cleanup actions:
  //   1. Leave the 'drivers' room → stops receiving new trip
  //      requests immediately
  //   2. Delete the DriverLocation record → the matching service
  //      (`findNearbyDrivers`) won't return this driver for new
  //      requests, and riders won't see a stale marker on the map
  //
  // WHY DELETE INSTEAD OF A BOOLEAN FLAG?
  // The DriverLocation table represents "currently available"
  // drivers. Deleting on offline is semantically cleaner than
  // adding an `isOnline` column that could drift out of sync.
  // The record is recreated automatically on the next
  // `driver:location_update` via upsert.

  socket.on('driver:go_offline', async () => {
    try {
      socket.leave('drivers');

      // Remove the driver's position from the DB so they don't
      // appear in nearby driver searches.
      await prisma.driverLocation.delete({
        where: { driverId: user.id },
      }).catch(() => {
        // Silently ignore "record not found" errors. The driver
        // might go offline before ever sending a location update,
        // meaning no DriverLocation record exists to delete.
      });

      console.log(`[socket] Driver ${user.email} went offline`);
    } catch (err) {
      console.error(
        `[socket] Error going offline for driver ${user.email}:`,
        (err as Error).message
      );
    }
  });
}
