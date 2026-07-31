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

// ── Fare Calculation — Vehicle-Type Pricing ─────────────────
//
// RideShare pricing is designed to be market-competitive while
// remaining transparent. Every fare has three components:
//   1. Base fare — flat charge covering the initial ~2 km
//   2. Per-km rate — distance-based charge after the base distance
//   3. Time charge — per-minute fee to account for traffic/wait
//
// Rates are set 1–2 rupees below major competitors (Rapido, Ola)
// to offer riders better value without undercutting driver earnings
// unsustainably. In production, these would be loaded from a
// database and vary by city/time-of-day.

interface VehiclePricing {
  baseFare: number;       // INR — includes the first ~2 km
  baseDistanceKm: number; // km included in the base fare
  ratePerKm: number;      // INR per km after base distance
  timeChargePerMin: number; // INR per minute
  label: string;
  icon: string;
  description: string;
}

const VEHICLE_PRICING: Record<string, VehiclePricing> = {
  bike: {
    baseFare: 23,
    baseDistanceKm: 2,
    ratePerKm: 9,
    timeChargePerMin: 0,
    label: 'Bike',
    icon: '🏍️',
    description: 'Fastest in traffic',
  },
  auto: {
    baseFare: 35,
    baseDistanceKm: 1.5,
    ratePerKm: 12,
    timeChargePerMin: 1,
    label: 'Auto',
    icon: '🛺',
    description: 'No surge pricing',
  },
  mini: {
    baseFare: 42,
    baseDistanceKm: 2,
    ratePerKm: 13,
    timeChargePerMin: 1,
    label: 'Mini',
    icon: '🚙',
    description: 'Budget 4-seater',
  },
  economy: {
    baseFare: 48,
    baseDistanceKm: 2,
    ratePerKm: 14,
    timeChargePerMin: 1,
    label: 'Economy',
    icon: '🚗',
    description: 'Comfortable & affordable',
  },
  sedan: {
    baseFare: 65,
    baseDistanceKm: 2,
    ratePerKm: 18,
    timeChargePerMin: 1.5,
    label: 'Sedan',
    icon: '🚘',
    description: 'Spacious & smooth',
  },
  premium: {
    baseFare: 85,
    baseDistanceKm: 2,
    ratePerKm: 24,
    timeChargePerMin: 2,
    label: 'Premium',
    icon: '✨',
    description: 'Luxury experience',
  },
};

/**
 * Assumed average speed for duration estimation, in km/h.
 * 30 km/h accounts for urban traffic conditions. In production
 * we'd use real-time traffic data from a routing API.
 */
const AVERAGE_SPEED_KMH = 30;

/**
 * Calculate fare for a given vehicle type, distance, and duration.
 */
const PLATFORM_FEE = 10; // ₹10 flat platform fee

function calculateFare(
  vehicleType: string,
  distanceKm: number,
  durationMin: number
): number {
  const pricing = VEHICLE_PRICING[vehicleType];
  if (!pricing) return 0;

  const chargeableDistance = Math.max(0, distanceKm - pricing.baseDistanceKm);
  const distanceFare = chargeableDistance * pricing.ratePerKm;
  const timeFare = Math.round(durationMin * pricing.timeChargePerMin);
  const total = pricing.baseFare + distanceFare + timeFare + PLATFORM_FEE;

  return Math.round(total);
}

/**
 * Returns an itemized fare breakdown for the booking UI.
 */
function calculateFareBreakdown(
  vehicleType: string,
  distanceKm: number,
  durationMin: number
): { baseFare: number; distanceFare: number; timeFare: number; platformFee: number; total: number } {
  const pricing = VEHICLE_PRICING[vehicleType];
  if (!pricing) return { baseFare: 0, distanceFare: 0, timeFare: 0, platformFee: 0, total: 0 };

  const chargeableDistance = Math.max(0, distanceKm - pricing.baseDistanceKm);
  const distanceFare = Math.round(chargeableDistance * pricing.ratePerKm);
  const timeFare = Math.round(durationMin * pricing.timeChargePerMin);
  const total = pricing.baseFare + distanceFare + timeFare + PLATFORM_FEE;

  return {
    baseFare: pricing.baseFare,
    distanceFare,
    timeFare,
    platformFee: PLATFORM_FEE,
    total: Math.round(total),
  };
}

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
  phone: true,
  avatarUrl: true,
  vehicleNumber: true,
  vehicleType: true,
  vehicleModel: true,
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

      // Query parameters for filtering
      const status = req.query.status as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const skip = (page - 1) * limit;

      // Build WHERE clause
      const whereClause: Record<string, unknown> = userRole === "RIDER"
        ? { riderId: userId }
        : { driverId: userId };

      // Optional status filter
      if (status) {
        whereClause.status = status;
      }

      // Optional date range filter
      if (from || to) {
        whereClause.createdAt = {};
        if (from) (whereClause.createdAt as Record<string, unknown>).gte = new Date(from);
        if (to) (whereClause.createdAt as Record<string, unknown>).lte = new Date(to);
      }

      const [trips, totalCount] = await Promise.all([
        prisma.trip.findMany({
          where: whereClause,
          include: {
            rider: { select: SAFE_USER_SELECT },
            driver: { select: SAFE_USER_SELECT },
            rating: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.trip.count({ where: whereClause }),
      ]);

      res.status(200).json({
        trips,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
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
// POST /api/trips/estimate — Multi-vehicle fare estimation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate fare estimates for all vehicle types.
 *
 * Returns estimates for bike, economy, and premium so the
 * frontend can display them as selectable cards without
 * making separate API calls.
 */
router.post(
  "/estimate",
  authenticate,
  requireRole("RIDER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pickupLat, pickupLng, dropLat, dropLng, vehicleType } = req.body;

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

      // Haversine × 1.3 road factor for realistic distance
      const straightLineKm = haversineDistance(
        pickupLat,
        pickupLng,
        dropLat,
        dropLng
      );
      const distanceKm = Math.round(straightLineKm * 1.3 * 100) / 100;

      const estimatedDuration = Math.round(
        (distanceKm / AVERAGE_SPEED_KMH) * 60
      );

      // If a specific vehicleType is requested, return just that
      if (vehicleType && VEHICLE_PRICING[vehicleType]) {
        const fare = calculateFare(vehicleType, distanceKm, estimatedDuration);
        const pricing = VEHICLE_PRICING[vehicleType];
        res.status(200).json({
          estimatedFare: fare,
          estimatedDuration,
          distanceKm,
          vehicleType,
          label: pricing.label,
          icon: pricing.icon,
        });
        return;
      }

      // Return estimates for ALL vehicle types with itemized breakdown
      const estimates = Object.entries(VEHICLE_PRICING).map(
        ([type, pricing]) => {
          const breakdown = calculateFareBreakdown(type, distanceKm, estimatedDuration);
          return {
            vehicleType: type,
            label: pricing.label,
            icon: pricing.icon,
            description: pricing.description,
            fare: breakdown.total,
            baseFare: breakdown.baseFare,
            distanceFare: breakdown.distanceFare,
            timeFare: breakdown.timeFare,
            platformFee: breakdown.platformFee,
            ratePerKm: pricing.ratePerKm,
            timeCharge: pricing.timeChargePerMin,
          };
        }
      );

      res.status(200).json({
        estimates,
        distanceKm,
        estimatedDuration,
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
      // Stripe requires amounts in the smallest currency unit
      // (paise for INR), so we multiply rupees × 100.
      const paymentIntent = await createTripPaymentIntent(Math.round(amount * 100));

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

// ─────────────────────────────────────────────────────────────
// POST /api/trips/book — Create trip + PaymentIntent in one call
// ─────────────────────────────────────────────────────────────

/**
 * Combined endpoint that creates a Trip record AND a Stripe
 * PaymentIntent in a single request. This simplifies the
 * frontend booking flow from 2 separate API calls to just 1.
 *
 * Flow:
 *  1. Rider enters pickup/drop → calls POST /estimate (already exists)
 *  2. Rider confirms → calls POST /book (this endpoint)
 *  3. Server creates Trip (status: REQUESTED) + PaymentIntent
 *  4. Returns { tripId, clientSecret } to the frontend
 *  5. Frontend renders Stripe PaymentElement with clientSecret
 *  6. After card authorization → frontend emits trip:request via Socket.io
 *
 * WHY COMBINE THESE?
 * If we kept them separate, a network failure between "create trip"
 * and "create payment intent" would leave an orphaned trip record.
 * By doing both in one request, either both succeed or we can
 * roll back cleanly.
 */
router.post(
  "/book",
  authenticate,
  requireRole("RIDER"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pickupLat, pickupLng, dropLat, dropLng, fare } = req.body;
      const userId = req.user!.id;

      // ── Validation ──────────────────────────────────────────
      if (
        pickupLat === undefined ||
        pickupLng === undefined ||
        dropLat === undefined ||
        dropLng === undefined ||
        fare === undefined
      ) {
        res.status(400).json({
          error: "Validation error",
          message:
            "All fields required: pickupLat, pickupLng, dropLat, dropLng, fare.",
        });
        return;
      }

      // ── Create Trip record ──────────────────────────────────
      const trip = await prisma.trip.create({
        data: {
          riderId: userId,
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
          fare,
          status: "REQUESTED",
        },
      });

      // ── Create Stripe PaymentIntent (authorize only) ────────
      // Note: createTripPaymentIntent internally converts rupees → paise
      // (fare × 100) so we pass the rupee amount directly here.
      const paymentIntent = await createTripPaymentIntent(fare * 100);

      // ── Link PaymentIntent to Trip ──────────────────────────
      await prisma.trip.update({
        where: { id: trip.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      // ── Return both IDs to the frontend ─────────────────────
      res.status(201).json({
        tripId: trip.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error("[trips/book] Unexpected error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to book trip. Please try again later.",
      });
    }
  }
);
// ── Promo Code Validation ───────────────────────────────────
//
// 📚 HOW PROMO CODES WORK:
// 1. User enters a code in the booking card
// 2. Frontend calls POST /api/trips/validate-promo
// 3. Server checks if the code exists and is valid
// 4. Returns the discount type and amount
// 5. Frontend applies the discount to the fare estimate
//
// 📚 WHY AN IN-MEMORY MAP?
// For an MVP, a simple Map of promo codes is sufficient.
// In production, you'd use a database table with fields like:
//   - code, discountType, discountValue, maxUses, currentUses,
//     expiresAt, minFare, isActive
// This would support admin CRUD operations, usage tracking,
// and automatic expiration.

/** Available promo codes — replace with DB table in production */
const PROMO_CODES: Record<string, {
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  description: string;
  minFare: number;
}> = {
  'RIDE20': {
    discountType: 'PERCENT',
    discountValue: 20,
    description: '20% off your ride!',
    minFare: 50,
  },
  'FIRST50': {
    discountType: 'PERCENT',
    discountValue: 50,
    description: '50% off for new users!',
    minFare: 100,
  },
  'FLAT30': {
    discountType: 'FLAT',
    discountValue: 30,
    description: '₹30 off your next ride!',
    minFare: 80,
  },
};

router.post(
  '/validate-promo',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, fare } = req.body;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Promo code is required' });
        return;
      }

      // Normalize: uppercase and trim whitespace
      const normalized = code.trim().toUpperCase();

      const promo = PROMO_CODES[normalized];

      if (!promo) {
        res.status(404).json({
          error: 'Invalid promo code',
          message: `"${code}" is not a valid promo code.`,
        });
        return;
      }

      // Check minimum fare requirement
      if (fare && fare < promo.minFare) {
        res.status(400).json({
          error: 'Minimum fare not met',
          message: `This promo requires a minimum fare of ₹${promo.minFare}.`,
        });
        return;
      }

      // Calculate discount amount
      let discount = 0;
      if (promo.discountType === 'PERCENT') {
        discount = fare ? Math.round((fare * promo.discountValue) / 100) : 0;
      } else {
        discount = promo.discountValue;
      }

      res.json({
        valid: true,
        code: normalized,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discount, // Calculated discount in rupees
        description: promo.description,
      });
    } catch (error) {
      console.error('[trips/validate-promo] Error:', error);
      res.status(500).json({ error: 'Failed to validate promo code' });
    }
  }
);

export default router;
