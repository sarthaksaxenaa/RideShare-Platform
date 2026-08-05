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
          vehicleModel: true,
          vehicleNumber: true,
          vehicleType: true,
          aadhaarNumber: true,
          faceImageUrl: true,
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

// ─────────────────────────────────────────────────────────────
// GET /api/users/me/stats — Driver/Rider stats
// ─────────────────────────────────────────────────────────────

router.get(
  "/me/stats",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const whereClause = userRole === "DRIVER"
        ? { driverId: userId }
        : { riderId: userId };

      const [totalTrips, completedTrips, todayTrips, todayEarnings, avgRating] = await Promise.all([
        prisma.trip.count({ where: whereClause }),
        prisma.trip.count({ where: { ...whereClause, status: "COMPLETED" } }),
        prisma.trip.count({ where: { ...whereClause, status: "COMPLETED", completedAt: { gte: todayStart } } }),
        prisma.trip.aggregate({
          where: { ...whereClause, status: "COMPLETED", completedAt: { gte: todayStart } },
          _sum: { fare: true },
        }),
        prisma.rating.aggregate({
          where: { toId: userId },
          _avg: { stars: true },
          _count: true,
        }),
      ]);

      res.status(200).json({
        totalTrips,
        completedTrips,
        todayTrips,
        todayEarnings: todayEarnings._sum.fare || 0,
        rating: avgRating._avg.stars ? Math.round(avgRating._avg.stars * 10) / 10 : null,
        totalRatings: avgRating._count,
      });
    } catch (error) {
      console.error("[users/me/stats] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch stats.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/users/notifications — Fetch user notifications
// ─────────────────────────────────────────────────────────────

router.get(
  "/notifications",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      res.status(200).json(notifications);
    } catch (error) {
      console.error("[users/notifications] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to fetch notifications.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/notifications/:id/read — Mark as read
// ─────────────────────────────────────────────────────────────

router.patch(
  "/notifications/:id/read",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const notification = await prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });

      if (notification.count === 0) {
        res.status(404).json({ error: "Not found", message: "Notification not found" });
        return;
      }

      res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("[users/notifications/read] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to update notification.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/notifications/read-all — Mark all as read
// ─────────────────────────────────────────────────────────────

router.patch(
  "/notifications/read-all",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("[users/notifications/read-all] Error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to update notifications.",
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/users/referral — Get referral info
// ─────────────────────────────────────────────────────────────

router.get(
  "/referral",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      let user = await prisma.user.findUnique({
        where: { id: userId },
        include: { _count: { select: { referralsMade: true } } },
      });

      if (!user) {
        res.status(404).json({ error: "Not found", message: "User not found" });
        return;
      }

      if (!user.referralCode) {
        const genCode = "REF-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        user = await prisma.user.update({
          where: { id: userId },
          data: { referralCode: genCode },
          include: { _count: { select: { referralsMade: true } } },
        });
      }

      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
      
      res.status(200).json({
        referralCode: user.referralCode,
        referralCredits: user.referralCredits,
        totalReferrals: user._count.referralsMade,
        referralLink: `${FRONTEND_URL}/login?ref=${user.referralCode}`
      });
    } catch (error) {
      console.error("[users/referral] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/users/referral/apply — Apply a referral code
// ─────────────────────────────────────────────────────────────

router.post(
  "/referral/apply",
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const refereeId = req.user!.id;
      const { referralCode } = req.body;

      if (!referralCode) {
        res.status(400).json({ error: "Bad request", message: "Referral code required" });
        return;
      }

      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        res.status(404).json({ error: "Not found", message: "Invalid referral code" });
        return;
      }

      if (referrer.id === refereeId) {
        res.status(400).json({ error: "Bad request", message: "Cannot apply own code" });
        return;
      }

      const existingRef = await prisma.referral.findFirst({
        where: { refereeId },
      });

      if (existingRef) {
        res.status(400).json({ error: "Bad request", message: "Referral already applied" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: refereeId,
            referralCode,
            status: "COMPLETED",
          }
        });

        await tx.user.update({
          where: { id: referrer.id },
          data: { referralCredits: { increment: 50 } },
        });

        await tx.user.update({
          where: { id: refereeId },
          data: { referralCredits: { increment: 30 } },
        });
      });

      res.status(200).json({ message: "Referral applied successfully" });
    } catch (error) {
      console.error("[users/referral/apply] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
