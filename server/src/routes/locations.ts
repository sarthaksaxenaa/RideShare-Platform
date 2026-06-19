/**
 * ────────────────────────────────────────────────────────────
 * Saved Locations Routes — Home / Work / Custom Places
 * ────────────────────────────────────────────────────────────
 *
 * GET    /api/locations        → List user's saved locations
 * POST   /api/locations        → Save a new location
 * PUT    /api/locations/:id    → Update a saved location
 * DELETE /api/locations/:id    → Delete a saved location
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/locations — List saved locations
// ─────────────────────────────────────────────────────────────

router.get(
  "/",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const locations = await prisma.savedLocation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json(locations);
    } catch (error) {
      console.error("[locations/list] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch locations.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/locations — Save a new location
// ─────────────────────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { label, icon, lat, lng, address } = req.body;

      if (!label || lat == null || lng == null || !address) {
        res.status(400).json({
          error: "Validation error",
          message: "label, lat, lng, and address are required.",
        });
        return;
      }

      // Upsert — if "Home" already exists for this user, update it
      const location = await prisma.savedLocation.upsert({
        where: {
          userId_label: { userId, label },
        },
        update: { lat, lng, address, icon: icon || "📍" },
        create: {
          userId,
          label,
          icon: icon || "📍",
          lat,
          lng,
          address,
        },
      });

      res.status(201).json(location);
    } catch (error) {
      console.error("[locations/create] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to save location.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PUT /api/locations/:id — Update a saved location
// ─────────────────────────────────────────────────────────────

router.put(
  "/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { label, icon, lat, lng, address } = req.body;

      // Verify ownership
      const existing = await prisma.savedLocation.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== userId) {
        res.status(404).json({
          error: "Not found",
          message: "Saved location not found.",
        });
        return;
      }

      const updated = await prisma.savedLocation.update({
        where: { id },
        data: {
          ...(label && { label }),
          ...(icon && { icon }),
          ...(lat != null && { lat }),
          ...(lng != null && { lng }),
          ...(address && { address }),
        },
      });

      res.status(200).json(updated);
    } catch (error) {
      console.error("[locations/update] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to update location.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// DELETE /api/locations/:id — Delete a saved location
// ─────────────────────────────────────────────────────────────

router.delete(
  "/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      // Verify ownership
      const existing = await prisma.savedLocation.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== userId) {
        res.status(404).json({
          error: "Not found",
          message: "Saved location not found.",
        });
        return;
      }

      await prisma.savedLocation.delete({ where: { id } });

      res.status(200).json({ message: "Location deleted." });
    } catch (error) {
      console.error("[locations/delete] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to delete location.",
      });
    }
  }
);

export default router;
