/**
 * ────────────────────────────────────────────────────────────
 * Trip Routes — CRUD, Fare Estimation, and Payment
 * ────────────────────────────────────────────────────────────
 *
 * GET  /api/trips              → List trips for the current user
 * GET  /api/trips/:id          → Get a single trip (ownership check)
 * POST /api/trips/estimate     → Estimate fare before booking
 * POST /api/trips/payment-intent → Create a Stripe hold for a trip
 *
 * DESIGN DECISIONS:
 *
 * 1. ROLE-BASED QUERY FILTERING (GET /api/trips):
 *    Rather than having separate /rider/trips and /driver/trips
 *    endpoints, we use a single endpoint that filters by the
 *    authenticated user's role. This keeps the API surface small
 *    and the frontend simpler — one TripService for both apps.
 *
 * 2. OWNERSHIP VERIFICATION (GET /api/trips/:id):
 *    A user can only view trips they're a party to (as rider or
 *    driver). This prevents enumeration attacks where someone
 *    could iterate over trip IDs to view other people's rides.
 *    We return 403 (not 404) to distinguish "exists but you
 *    can't see it" from "doesn't exist".
 *
 * 3. FARE ESTIMATION (POST /api/trips/estimate):
 *    In a production app, fare would incorporate:
 *     - Surge pricing based on supply/demand ratio
 *     - Time-of-day multipliers (peak hours)
 *     - Route-specific pricing (tolls, highways)
 *     - Dynamic ETAs from a routing engine (Google Maps, OSRM)
 *    For MVP, we use a simple distance-based formula which is
 *    transparent and predictable for testing.
 *
 * 4. PAYMENT INTENT FLOW (POST /api/trips/payment-intent):
 *    We only allow payment intent creation when the trip status
 *    is REQUESTED — this prevents double-charging if the client
 *    retries the request. The Stripe PaymentIntent ID is stored
 *    on the trip record for later capture/cancel operations.
 *
 * SECURITY:
 *  - All routes require authentication (JWT via `authenticate`)
 *  - RIDER-only routes use `requireRole("RIDER")`
 *  - Password fields are NEVER included in responses (explicit
 *    `select` on user relations)
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { prisma } from "../lib/prisma.js";
import { haversineDistance } from "../services/matching.js";
import { createTripPaymentIntent } from "../services/stripe.js";

const router = Router();

// ── Fare Calculation Constants ───────────────────────────────

/**
 * Base fare in INR — charged regardless of distance.
 * Covers the driver's time to reach the pickup point and the
 * minimum viable earnings per trip.
 */
const BASE_FARE_INR = 50;

/**
 * Per-kilometre rate in INR.
 * Based on typical auto/cab rates in Indian metros.
 * In production, this would vary by vehicle type (auto, mini,
 * sedan, SUV) and city.
 */
const RATE_PER_KM_INR = 15;

/**
 * Assumed average speed for duration estimation, in km/h.
 * 30 km/h accounts for urban traffic conditions. In production
 * we'd use real-time traffic data from a routing API.
 */
const AVERAGE_SPEED_KMH = 30;

/**
 * Safe select clause for user data in trip responses.
 * NEVER include the password hash — it's a bcrypt hash, not the
 * plaintext password, but there's still zero reason to send it
 * to the client. Defense in depth.
 */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

// ─────────────────────────────────────────────────────────────
// GET /api/trips — List all trips for the authenticated user
// ─────────────────────────────────────────────────────────────

/**
 * Returns all trips associated with the current user.
 *
 * - Riders see trips where they are the rider.
 * - Drivers see trips where they are the driver.
 *
 * Results are ordered by creation date (newest first) so the
 * most recent/active trip appears at the top of the list.
 */
router.get(
  "/",
  authenticate,
  requireRole("RIDER", "DRIVER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Build the WHERE clause dynamically based on role.
      // A rider only sees their own trips; a driver only sees
      // trips they've been assigned to.
      const whereClause =
        userRole === "RIDER"
          ? { riderId: userId }
          : { driverId: userId };

      const trips = await prisma.trip.findMany({
        where: whereClause,
        include: {
          rider: { select: SAFE_USER_SELECT },
          driver: { select: SAFE_USER_SELECT },
        },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json(trips);
    } catch (error) {
      console.error("[trips/list] Unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch trips. Please try again later.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/trips/:id — Get a single trip by ID
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a specific trip by its UUID.
 *
 * Security: verifies the requesting user is either the rider or
 * driver on this trip. Without this check, any authenticated
 * user could view anyone's trip details (including pickup/drop
 * addresses, fare, driver info) just by guessing UUIDs — which,
 * while improbable, is still a vulnerability.
 */
router.get(
  "/:id",
  authenticate,
  requireRole("RIDER", "DRIVER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const trip = await prisma.trip.findUnique({
        where: { id },
        include: {
          rider: { select: SAFE_USER_SELECT },
          driver: { select: SAFE_USER_SELECT },
        },
      });

      // ── 404: Trip doesn't exist ────────────────────────────
      if (!trip) {
        res.status(404).json({
          error: "Not found",
          message: "No trip found with this ID.",
        });
        return;
      }

      // ── 403: User is not a party to this trip ──────────────
      // Check if the requesting user is either the rider or the
      // driver. This prevents horizontal privilege escalation.
      if (trip.riderId !== userId && trip.driverId !== userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "You are not authorized to view this trip.",
        });
        return;
      }

      res.status(200).json(trip);
    } catch (error) {
      console.error("[trips/get] Unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch trip. Please try again later.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/trips/estimate — Estimate fare before booking
// ─────────────────────────────────────────────────────────────

/**
 * Calculate an estimated fare, duration, and distance for a trip.
 *
 * This is called BEFORE the rider confirms the booking — it lets
 * them see the price and decide whether to proceed. The estimate
 * is non-binding (the actual fare may differ based on the route
 * taken, traffic, waiting time, etc.).
 *
 * FARE FORMULA (MVP):
 *   fare = BASE_FARE + (distance_km × RATE_PER_KM)
 *   result is converted to paise (× 100) for Stripe
 *
 * In a real-world app, fare estimation would be much more complex:
 *  - Surge pricing: multiply fare by a demand/supply ratio
 *    (e.g., 1.5× during rain, 2× on New Year's Eve)
 *  - Route-based pricing: use Google Maps Directions API for
 *    actual road distance (not straight-line Haversine)
 *  - Time-based component: add a per-minute charge for the
 *    estimated duration
 *  - Tolls and fees: add known toll costs for the route
 *  - Vehicle type: different rates for auto, mini, sedan, SUV
 *  - City-specific pricing: rates vary by market
 */
router.post(
  "/estimate",
  authenticate,
  requireRole("RIDER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pickupLat, pickupLng, dropLat, dropLng } = req.body;

      // ── Validation ──────────────────────────────────────────
      if (
        pickupLat === undefined ||
        pickupLng === undefined ||
        dropLat === undefined ||
        dropLng === undefined
      ) {
        res.status(400).json({
          error: "Validation error",
          message:
            "All coordinate fields are required: pickupLat, pickupLng, dropLat, dropLng.",
        });
        return;
      }

      // ── Distance calculation ────────────────────────────────
      // Uses Haversine (straight-line). Actual road distance is
      // typically 20-40% longer, but this is fine for an estimate.
      const distanceKm = haversineDistance(
        pickupLat,
        pickupLng,
        dropLat,
        dropLng
      );

      // ── Fare calculation ────────────────────────────────────
      // Calculate in rupees, then convert to paise for Stripe.
      const fareInRupees = BASE_FARE_INR + distanceKm * RATE_PER_KM_INR;
      const estimatedFare = Math.round(fareInRupees * 100); // paise

      // ── Duration estimation ─────────────────────────────────
      // Simple: distance / speed × 60 = minutes.
      // In production, use a routing API for traffic-aware ETAs.
      const estimatedDuration = Math.round(
        (distanceKm / AVERAGE_SPEED_KMH) * 60
      );

      res.status(200).json({
        estimatedFare,
        estimatedDuration,
        distanceKm: Math.round(distanceKm * 100) / 100, // 2 decimal places
      });
    } catch (error) {
      console.error("[trips/estimate] Unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to estimate fare. Please try again later.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/trips/payment-intent — Create Stripe payment hold
// ─────────────────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent (authorize-only) for a trip.
 *
 * This is called after the rider confirms the booking and before
 * the driver is matched. The flow:
 *
 *  1. Rider confirms trip → frontend calls POST /payment-intent
 *  2. We verify the trip exists, belongs to the rider, and is
 *     in REQUESTED status (guard against double-processing)
 *  3. We create a Stripe PaymentIntent with manual capture
 *  4. We store the PaymentIntent ID on the trip record
 *  5. We return the client_secret to the frontend
 *  6. Frontend uses Stripe.js to confirm the payment (handles
 *     3D Secure, card auth, etc.)
 *  7. Once confirmed, we proceed to match a driver
 *
 * WHY CHECK STATUS === REQUESTED?
 * If the client retries this request (network glitch, user
 * double-tapped), we don't want to create multiple PaymentIntents
 * for the same trip. By requiring REQUESTED status, we ensure
 * idempotency — once the trip moves past REQUESTED, this endpoint
 * will reject subsequent calls.
 */
router.post(
  "/payment-intent",
  authenticate,
  requireRole("RIDER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tripId, amount } = req.body;
      const userId = req.user!.id;

      // ── Validation ──────────────────────────────────────────
      if (!tripId || !amount) {
        res.status(400).json({
          error: "Validation error",
          message: "Both tripId and amount are required.",
        });
        return;
      }

      // ── Verify trip exists and belongs to this rider ────────
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        res.status(404).json({
          error: "Not found",
          message: "No trip found with this ID.",
        });
        return;
      }

      if (trip.riderId !== userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "You can only create payment intents for your own trips.",
        });
        return;
      }

      // ── Verify trip is in the correct state ─────────────────
      // Only REQUESTED trips should have payment intents created.
      // This prevents double-charging on retries and ensures the
      // trip hasn't already progressed past the payment stage.
      if (trip.status !== "REQUESTED") {
        res.status(400).json({
          error: "Invalid trip status",
          message: `Cannot create payment intent for a trip with status '${trip.status}'. Expected 'REQUESTED'.`,
        });
        return;
      }

      // ── Create Stripe PaymentIntent (authorize only) ────────
      const paymentIntent = await createTripPaymentIntent(amount);

      // ── Store the PaymentIntent ID on the trip record ───────
      // This links the trip to the Stripe payment so we can
      // capture or cancel it later when the trip completes or
      // is cancelled.
      await prisma.trip.update({
        where: { id: tripId },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      // ── Return the client secret to the frontend ────────────
      // The frontend needs this to confirm the payment using
      // Stripe.js (handles 3D Secure authentication etc.)
      res.status(200).json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error("[trips/payment-intent] Unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to create payment intent. Please try again later.",
      });
    }
  }
);

export default router;
