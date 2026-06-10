/**
 * ────────────────────────────────────────────────────────────
 * Socket.io — Trip Lifecycle Event Handlers
 * ────────────────────────────────────────────────────────────
 *
 * This module manages the real-time trip state machine:
 *
 *   REQUESTED → MATCHED → STARTED → COMPLETED
 *                  ↓          ↓
 *              CANCELLED  CANCELLED
 *
 * Each transition is triggered by a Socket.io event and results
 * in a database update + broadcast to the relevant parties.
 *
 * CONCURRENCY & RACE CONDITIONS:
 * The trickiest scenario is multiple drivers trying to accept
 * the same trip simultaneously. We solve this with Prisma's
 * `updateMany` using a WHERE clause that includes the current
 * status. Only the first driver to execute the update will
 * succeed (count > 0); subsequent drivers get count === 0 and
 * receive a "trip:already_taken" event. This is effectively
 * an optimistic lock without explicit locking — simple and
 * performant at our scale.
 *
 * ROOM STRATEGY:
 * When a trip is matched, both the rider and driver sockets
 * join a `trip:{tripId}` room. All subsequent trip events
 * (started, completed, location updates) are scoped to this
 * room, ensuring:
 *   - Only the involved parties receive updates
 *   - No cross-trip data leakage
 *   - Clean teardown when the trip ends
 *
 * PAYMENT INTEGRATION:
 * Trip completion triggers payment capture, and cancellation
 * triggers payment release. Both are wrapped in try/catch to
 * ensure the trip state always updates even if Stripe is
 * temporarily unavailable (we can reconcile later via webhooks).
 * ────────────────────────────────────────────────────────────
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { findNearbyDrivers } from '../services/matching.js';
import { capturePayment, cancelPayment } from '../services/stripe.js';

// ── Types ────────────────────────────────────────────────────

/** Payload shape for the `trip:request` event (sent by rider). */
interface TripRequestPayload {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
}

/** Payload shape for the `trip:accept` event (sent by driver). */
interface TripAcceptPayload {
  tripId: string;
}

/** Payload shape for the `trip:start` event (sent by driver). */
interface TripStartPayload {
  tripId: string;
}

/** Payload shape for the `trip:complete` event (sent by driver). */
interface TripCompletePayload {
  tripId: string;
}

/** Payload shape for the `trip:cancel` event (sent by either role). */
interface TripCancelPayload {
  tripId: string;
  reason?: string;
}

/** Shape of the user object attached to each authenticated socket. */
interface SocketUser {
  id: string;
  role: 'RIDER' | 'DRIVER';
  email: string;
}

// ── Handler Registration ─────────────────────────────────────

/**
 * Register all trip lifecycle Socket.io event listeners on the
 * given socket.
 *
 * Called for BOTH riders and drivers from `socket/index.ts`:
 *   - Riders trigger: trip:request, trip:cancel
 *   - Drivers trigger: trip:accept, trip:start, trip:complete, trip:cancel
 *
 * Role checks inside each handler enforce that only the allowed
 * role can trigger the event, so registering all handlers on
 * both roles is safe (unauthorized events are silently ignored
 * with an error emission).
 *
 * @param io     - The Socket.io server instance (for room broadcasts
 *                 and remote socket lookups).
 * @param socket - The individual user's socket connection.
 */
export function registerTripHandlers(
  io: SocketIOServer,
  socket: Socket
): void {
  const user = socket.data.user as SocketUser;

  // ── Event: trip:request ────────────────────────────────────
  //
  // FLOW:
  //   1. Rider taps "Request Ride" → frontend emits trip:request
  //   2. Server creates a Trip record (status: REQUESTED)
  //   3. Server finds nearby available drivers via matching service
  //   4. Server sends trip:new_request to each nearby driver
  //   5. Server confirms to rider with trip:requested
  //
  // WHY FIND SOCKETS BY USER ID?
  // The matching service returns driver IDs from the database,
  // but we need their Socket.io sockets to send events. We use
  // `io.fetchSockets()` to get all connected sockets and match
  // by `socket.data.user.id`. This is O(n) on connected sockets
  // but acceptable at MVP scale (~thousands of connections).

  socket.on('trip:request', async (payload: TripRequestPayload) => {
    try {
      // Guard: only riders can request trips.
      if (user.role !== 'RIDER') {
        socket.emit('trip:error', { message: 'Only riders can request trips' });
        return;
      }

      const { pickupLat, pickupLng, dropLat, dropLng, fare } = payload;

      // ── 1. Create the trip in the database ─────────────────
      const trip = await prisma.trip.create({
        data: {
          riderId: user.id,
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
          fare,
          status: 'REQUESTED',
        },
        include: {
          rider: {
            select: { name: true },
          },
        },
      });

      // ── 2. Find nearby available drivers ───────────────────
      // The matching service queries the DriverLocation table
      // and excludes drivers who are already on active trips.
      const nearbyDrivers = await findNearbyDrivers(pickupLat, pickupLng);

      console.log(
        `[socket] Trip ${trip.id} requested by ${user.email} — ` +
        `found ${nearbyDrivers.length} nearby driver(s)`
      );

      // ── 3. Notify each nearby driver ───────────────────────
      // We need to find the Socket.io socket for each driver
      // returned by the matching service. Not all nearby drivers
      // may be connected (e.g., their app might have crashed but
      // their location is still in the DB), so we skip missing ones.
      const allSockets = await io.fetchSockets();

      for (const driver of nearbyDrivers) {
        const driverSocket = allSockets.find(
          (s) => s.data.user?.id === driver.driverId
        );

        if (driverSocket) {
          driverSocket.emit('trip:new_request', {
            tripId: trip.id,
            pickupLat,
            pickupLng,
            dropLat,
            dropLng,
            fare,
            riderName: trip.rider.name,
          });
        }
      }

      // ── 4. Confirm to the rider ────────────────────────────
      socket.emit('trip:requested', { tripId: trip.id });
    } catch (err) {
      console.error(
        `[socket] Error processing trip request for ${user.email}:`,
        (err as Error).message
      );
      socket.emit('trip:error', { message: 'Failed to create trip request' });
    }
  });

  // ── Event: trip:accept ─────────────────────────────────────
  //
  // FLOW:
  //   1. Driver taps "Accept" on a trip request
  //   2. Server atomically updates status REQUESTED → MATCHED
  //      with a WHERE clause (optimistic lock)
  //   3. If update succeeds: both parties join trip room, driver
  //      leaves 'drivers' room
  //   4. If update fails (count=0): another driver already took it
  //
  // WHY `updateMany` INSTEAD OF `update`?
  // `update` throws if the record doesn't match the WHERE clause.
  // `updateMany` returns `{ count: 0 }` — much cleaner for
  // detecting race conditions without try/catch control flow.

  socket.on('trip:accept', async (payload: TripAcceptPayload) => {
    try {
      // Guard: only drivers can accept trips.
      if (user.role !== 'DRIVER') {
        socket.emit('trip:error', { message: 'Only drivers can accept trips' });
        return;
      }

      const { tripId } = payload;

      // ── 1. Atomically claim the trip ───────────────────────
      // The WHERE clause ensures only REQUESTED trips can be
      // claimed. If two drivers race, only one will get count=1.
      const updateResult = await prisma.trip.updateMany({
        where: {
          id: tripId,
          status: 'REQUESTED',
        },
        data: {
          status: 'MATCHED',
          driverId: user.id,
        },
      });

      // ── 2. Handle race condition: trip already taken ───────
      if (updateResult.count === 0) {
        socket.emit('trip:already_taken', { tripId });
        console.log(
          `[socket] Driver ${user.email} tried to accept trip ${tripId} but it was already taken`
        );
        return;
      }

      // ── 3. Fetch the trip to get the rider's ID ────────────
      // We need the riderId to find the rider's socket and make
      // them join the trip room.
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { riderId: true },
      });

      if (!trip) {
        console.error(`[socket] Trip ${tripId} not found after accept`);
        return;
      }

      // ── 4. Find the rider's socket ─────────────────────────
      const allSockets = await io.fetchSockets();
      const riderSocket = allSockets.find(
        (s) => s.data.user?.id === trip.riderId
      );

      // ── 5. Room management ─────────────────────────────────
      // Both parties join the trip-specific room for scoped
      // communication (location updates, status changes).
      const tripRoom = `trip:${tripId}`;

      // Driver joins trip room.
      socket.join(tripRoom);

      // Rider joins trip room (if connected).
      if (riderSocket) {
        riderSocket.join(tripRoom);
      }

      // Driver leaves the 'drivers' room — they're now busy
      // and should not receive new trip requests.
      socket.leave('drivers');

      // ── 6. Fetch driver's name for the rider UI ────────────
      const driver = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });

      // ── 7. Notify both parties ─────────────────────────────
      io.to(tripRoom).emit('trip:matched', {
        tripId,
        driverId: user.id,
        driverName: driver?.name ?? 'Driver',
      });

      console.log(`[socket] Trip ${tripId} matched with driver ${user.email}`);
    } catch (err) {
      console.error(
        `[socket] Error accepting trip for driver ${user.email}:`,
        (err as Error).message
      );
      socket.emit('trip:error', { message: 'Failed to accept trip' });
    }
  });

  // ── Event: trip:start ──────────────────────────────────────
  //
  // Fired when the driver arrives at the pickup location and
  // taps "Start Trip". Updates status MATCHED → STARTED.
  //
  // After this, the rider's app switches to the "in-trip" view
  // with live tracking, ETA to destination, etc.

  socket.on('trip:start', async (payload: TripStartPayload) => {
    try {
      // Guard: only drivers can start trips.
      if (user.role !== 'DRIVER') {
        socket.emit('trip:error', { message: 'Only drivers can start trips' });
        return;
      }

      const { tripId } = payload;

      // Update status to STARTED.
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: 'STARTED' },
      });

      // Notify both parties in the trip room.
      io.to(`trip:${tripId}`).emit('trip:started', { tripId });

      console.log(`[socket] Trip ${tripId} started by driver ${user.email}`);
    } catch (err) {
      console.error(
        `[socket] Error starting trip ${payload.tripId} for driver ${user.email}:`,
        (err as Error).message
      );
      socket.emit('trip:error', { message: 'Failed to start trip' });
    }
  });

  // ── Event: trip:complete ───────────────────────────────────
  //
  // FLOW:
  //   1. Driver taps "Complete Trip" at the destination
  //   2. If a Stripe PaymentIntent exists, capture the payment
  //      (moves money from hold to our balance)
  //   3. Update trip status to COMPLETED with timestamp
  //   4. Both parties leave the trip room
  //   5. Driver rejoins 'drivers' room (available again)
  //
  // WHY CAPTURE PAYMENT BEFORE DB UPDATE?
  // If Stripe capture fails, we still update the trip status
  // to COMPLETED (the ride DID happen). Payment reconciliation
  // can be handled asynchronously via webhooks or manual review.
  // The driver shouldn't be penalized for a Stripe outage.

  socket.on('trip:complete', async (payload: TripCompletePayload) => {
    try {
      // Guard: only drivers can complete trips.
      if (user.role !== 'DRIVER') {
        socket.emit('trip:error', { message: 'Only drivers can complete trips' });
        return;
      }

      const { tripId } = payload;
      const tripRoom = `trip:${tripId}`;

      // ── 1. Fetch trip for payment info ─────────────────────
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          stripePaymentIntentId: true,
          fare: true,
          riderId: true,
        },
      });

      if (!trip) {
        socket.emit('trip:error', { message: 'Trip not found' });
        return;
      }

      // ── 2. Capture payment if a PaymentIntent exists ───────
      // Wrapping in try/catch so a Stripe failure doesn't block
      // trip completion. We log the error for manual reconciliation.
      if (trip.stripePaymentIntentId) {
        try {
          await capturePayment(trip.stripePaymentIntentId);
          console.log(
            `[socket] Payment captured for trip ${tripId} (PaymentIntent: ${trip.stripePaymentIntentId})`
          );
        } catch (paymentErr) {
          console.error(
            `[socket] Failed to capture payment for trip ${tripId}:`,
            (paymentErr as Error).message
          );
          // Continue with trip completion — payment can be retried later.
        }
      }

      // ── 3. Update trip status ──────────────────────────────
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // ── 4. Notify both parties ─────────────────────────────
      io.to(tripRoom).emit('trip:completed', {
        tripId,
        fare: trip.fare,
      });

      // ── 5. Room cleanup ────────────────────────────────────
      // Both sockets leave the trip room since the trip is over.
      // We find the rider socket to remove them too.
      const allSockets = await io.fetchSockets();
      const riderSocket = allSockets.find(
        (s) => s.data.user?.id === trip.riderId
      );

      socket.leave(tripRoom);
      if (riderSocket) {
        riderSocket.leave(tripRoom);
      }

      // ── 6. Driver becomes available again ──────────────────
      // Rejoin the 'drivers' room so the matching service can
      // include this driver in future trip requests.
      socket.join('drivers');

      console.log(`[socket] Trip ${tripId} completed by driver ${user.email}`);
    } catch (err) {
      console.error(
        `[socket] Error completing trip ${payload.tripId} for driver ${user.email}:`,
        (err as Error).message
      );
      socket.emit('trip:error', { message: 'Failed to complete trip' });
    }
  });

  // ── Event: trip:cancel ─────────────────────────────────────
  //
  // Either role can cancel a trip, but only before it's STARTED.
  //
  // FLOW:
  //   1. Verify trip is in REQUESTED or MATCHED status
  //   2. If a Stripe PaymentIntent exists, cancel it (release hold)
  //   3. Update trip status to CANCELLED
  //   4. Notify the trip room
  //   5. If a driver was assigned, return them to the 'drivers' room
  //
  // WHY NOT ALLOW CANCELLATION AFTER STARTED?
  // Once a trip has started (rider is in the car), cancellation
  // would leave the rider stranded. Post-start disputes are
  // handled differently (support tickets, partial charges, etc.)
  // and are out of scope for this phase.

  socket.on('trip:cancel', async (payload: TripCancelPayload) => {
    try {
      const { tripId, reason } = payload;
      const tripRoom = `trip:${tripId}`;

      // ── 1. Fetch the trip and validate cancellability ──────
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          status: true,
          driverId: true,
          stripePaymentIntentId: true,
        },
      });

      if (!trip) {
        socket.emit('trip:error', { message: 'Trip not found' });
        return;
      }

      // Only allow cancellation for REQUESTED and MATCHED trips.
      if (trip.status !== 'REQUESTED' && trip.status !== 'MATCHED') {
        socket.emit('trip:error', {
          message: `Cannot cancel trip with status ${trip.status}`,
        });
        return;
      }

      // ── 2. Release payment hold if applicable ──────────────
      // Wrapping in try/catch: Stripe failure shouldn't prevent
      // cancellation. The hold will expire naturally after 7 days
      // if we can't cancel it programmatically.
      if (trip.stripePaymentIntentId) {
        try {
          await cancelPayment(trip.stripePaymentIntentId);
          console.log(
            `[socket] Payment cancelled for trip ${tripId} (PaymentIntent: ${trip.stripePaymentIntentId})`
          );
        } catch (paymentErr) {
          console.error(
            `[socket] Failed to cancel payment for trip ${tripId}:`,
            (paymentErr as Error).message
          );
          // Continue with trip cancellation anyway.
        }
      }

      // ── 3. Update trip status ──────────────────────────────
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: 'CANCELLED' },
      });

      // ── 4. Notify everyone in the trip room ────────────────
      io.to(tripRoom).emit('trip:cancelled', {
        tripId,
        cancelledBy: user.role,
        reason: reason ?? null,
      });

      // ── 5. Return the assigned driver to the pool ──────────
      // If a driver was assigned (status was MATCHED), we need
      // to make them available for new trips again by rejoining
      // the 'drivers' room.
      if (trip.driverId) {
        const allSockets = await io.fetchSockets();
        const driverSocket = allSockets.find(
          (s) => s.data.user?.id === trip.driverId
        );

        if (driverSocket) {
          driverSocket.join('drivers');
          driverSocket.leave(tripRoom);
        }
      }

      // Clean up the cancelling user's room membership too.
      socket.leave(tripRoom);

      console.log(
        `[socket] Trip ${tripId} cancelled by ${user.role} (${user.email})` +
        (reason ? ` — reason: ${reason}` : '')
      );
    } catch (err) {
      console.error(
        `[socket] Error cancelling trip ${payload.tripId} for ${user.email}:`,
        (err as Error).message
      );
      socket.emit('trip:error', { message: 'Failed to cancel trip' });
    }
  });
}
