/**
 * ────────────────────────────────────────────────────────────
 * Emergency Routes — SOS & Emergency Contacts
 * ────────────────────────────────────────────────────────────
 *
 * GET    /api/emergency/contacts     → List emergency contacts
 * POST   /api/emergency/contacts     → Add emergency contact
 * DELETE /api/emergency/contacts/:id → Remove emergency contact
 * POST   /api/emergency/alert        → Trigger SOS alert
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/emergency/contacts — List emergency contacts
// ─────────────────────────────────────────────────────────────

router.get(
  "/contacts",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const contacts = await prisma.emergencyContact.findMany({
        where: { userId },
      });

      res.status(200).json(contacts);
    } catch (error) {
      console.error("[emergency/list] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch emergency contacts.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/emergency/contacts — Add emergency contact
// ─────────────────────────────────────────────────────────────

router.post(
  "/contacts",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { name, phone } = req.body;

      if (!name || !phone) {
        res.status(400).json({
          error: "Validation error",
          message: "Name and phone are required.",
        });
        return;
      }

      // Limit to 5 emergency contacts per user
      const count = await prisma.emergencyContact.count({
        where: { userId },
      });

      if (count >= 5) {
        res.status(400).json({
          error: "Limit reached",
          message: "Maximum 5 emergency contacts allowed.",
        });
        return;
      }

      const contact = await prisma.emergencyContact.create({
        data: { userId, name, phone },
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("[emergency/create] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to add emergency contact.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// DELETE /api/emergency/contacts/:id — Remove emergency contact
// ─────────────────────────────────────────────────────────────

router.delete(
  "/contacts/:id",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const existing = await prisma.emergencyContact.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== userId) {
        res.status(404).json({
          error: "Not found",
          message: "Emergency contact not found.",
        });
        return;
      }

      await prisma.emergencyContact.delete({ where: { id } });
      res.status(200).json({ message: "Contact removed." });
    } catch (error) {
      console.error("[emergency/delete] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to remove contact.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/emergency/alert — Trigger SOS alert
// ─────────────────────────────────────────────────────────────

router.post(
  "/alert",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { tripId, lat, lng } = req.body;

      console.log(
        `[SOS ALERT] User ${req.user!.email} triggered SOS at (${lat}, ${lng}) for trip ${tripId}`
      );

      // In production: send SMS to emergency contacts, alert admin, etc.
      // For MVP: log the event and return success
      const contacts = await prisma.emergencyContact.findMany({
        where: { userId },
      });

      res.status(200).json({
        message: "SOS alert triggered successfully.",
        contactsNotified: contacts.length,
        contacts: contacts.map((c) => ({ name: c.name, phone: c.phone })),
      });
    } catch (error) {
      console.error("[emergency/alert] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to trigger SOS alert.",
      });
    }
  }
);

export default router;
