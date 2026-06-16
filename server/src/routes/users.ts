/**
 * ────────────────────────────────────────────────────────────
 * User Routes — Profile Management
 * ────────────────────────────────────────────────────────────
 *
 * GET  /api/users/me            → Fetch authenticated user's profile
 * PUT  /api/users/me            → Update name and/or phone
 * PUT  /api/users/me/password   → Change password
 *
 * All routes require authentication via JWT.
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/users/me — Fetch profile
// ─────────────────────────────────────────────────────────────

router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({
          error: "Not found",
          message: "User account not found.",
        });
        return;
      }

      res.status(200).json(user);
    } catch (error) {
      console.error("[users/me] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch profile.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PUT /api/users/me — Update profile
// ─────────────────────────────────────────────────────────────

router.put(
  "/me",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { name, phone } = req.body;

      // Build update data — only include provided fields
      const updateData: { name?: string; phone?: string } = {};
      if (name !== undefined) updateData.name = name.trim();
      if (phone !== undefined) updateData.phone = phone.trim() || null;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          error: "Validation error",
          message: "Please provide at least one field to update (name, phone).",
        });
        return;
      }

      if (updateData.name !== undefined && updateData.name.length < 2) {
        res.status(400).json({
          error: "Validation error",
          message: "Name must be at least 2 characters.",
        });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      res.status(200).json({
        message: "Profile updated successfully.",
        user: updatedUser,
      });
    } catch (error) {
      console.error("[users/me] Update error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to update profile.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PUT /api/users/me/password — Change password
// ─────────────────────────────────────────────────────────────

router.put(
  "/me/password",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: "Validation error",
          message: "Both currentPassword and newPassword are required.",
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          error: "Validation error",
          message: "New password must be at least 6 characters.",
        });
        return;
      }

      // Fetch current password hash
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        res.status(404).json({
          error: "Not found",
          message: "User account not found.",
        });
        return;
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        res.status(401).json({
          error: "Authentication error",
          message: "Current password is incorrect.",
        });
        return;
      }

      // Hash and save new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      res.status(200).json({
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("[users/me/password] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to change password.",
      });
    }
  }
);

export default router;
