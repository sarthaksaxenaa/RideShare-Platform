/**
 * ────────────────────────────────────────────────────────────
 * Rating Routes — Post-Trip Feedback System
 * ────────────────────────────────────────────────────────────
 *
 * POST /api/ratings        → Submit a rating for a completed trip
 * GET  /api/ratings/:userId → Get average rating for a user
 * GET  /api/ratings/trip/:tripId → Get rating for a specific trip
 *
 * BUSINESS RULES:
 * - Only COMPLETED trips can be rated
 * - Each trip can only be rated once (tripId is @unique in schema)
 * - Riders rate drivers, drivers rate riders
 * - Stars must be 1-5
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/ratings — Submit a rating
// ─────────────────────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { tripId, stars, comment, tags } = req.body;

      // Validate stars
      if (!tripId || !stars || stars < 1 || stars > 5) {
        res.status(400).json({
          error: "Validation error",
          message: "tripId and stars (1-5) are required.",
        });
        return;
      }

      // Verify trip exists and is completed
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, status: true, riderId: true, driverId: true },
      });

      if (!trip) {
        res.status(404).json({ error: "Not found", message: "Trip not found." });
        return;
      }

      if (trip.status !== "COMPLETED") {
        res.status(400).json({
          error: "Invalid state",
          message: "Can only rate completed trips.",
        });
        return;
      }

      // Determine who is being rated
      let toId: string;
      if (userId === trip.riderId && trip.driverId) {
        // Rider is rating the driver
        toId = trip.driverId;
      } else if (userId === trip.driverId) {
        // Driver is rating the rider
        toId = trip.riderId;
      } else {
        res.status(403).json({
          error: "Forbidden",
          message: "You are not a participant of this trip.",
        });
        return;
      }

      // Check if already rated
      const existing = await prisma.rating.findUnique({
        where: { tripId },
      });

      if (existing) {
        res.status(409).json({
          error: "Conflict",
          message: "This trip has already been rated.",
        });
        return;
      }

      // Create rating
      const rating = await prisma.rating.create({
        data: {
          tripId,
          fromId: userId,
          toId,
          stars,
          comment: comment || null,
          tags: tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : null,
        },
      });

      res.status(201).json(rating);
    } catch (error) {
      console.error("[ratings/create] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to submit rating.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/ratings/:userId — Get average rating for a user
// ─────────────────────────────────────────────────────────────

router.get(
  "/user/:userId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const ratings = await prisma.rating.findMany({
        where: { toId: userId },
        select: { stars: true },
      });

      if (ratings.length === 0) {
        res.status(200).json({ averageRating: 0, totalRatings: 0 });
        return;
      }

      const total = ratings.reduce((sum, r) => sum + r.stars, 0);
      const average = Math.round((total / ratings.length) * 10) / 10;

      res.status(200).json({
        averageRating: average,
        totalRatings: ratings.length,
      });
    } catch (error) {
      console.error("[ratings/average] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch rating.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/ratings/trip/:tripId — Get rating for a trip
// ─────────────────────────────────────────────────────────────

router.get(
  "/trip/:tripId",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tripId } = req.params;

      const rating = await prisma.rating.findUnique({
        where: { tripId },
      });

      if (!rating) {
        res.status(200).json({ rated: false });
        return;
      }

      res.status(200).json({ rated: true, rating });
    } catch (error) {
      console.error("[ratings/trip] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch rating.",
      });
    }
  }
);

export default router;
