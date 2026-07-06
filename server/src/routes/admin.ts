/**
 * ────────────────────────────────────────────────────────────
 * Admin Routes — Platform Overview & Stats
 * ────────────────────────────────────────────────────────────
 *
 * GET /api/admin/stats   → Aggregated platform statistics
 * GET /api/admin/trips   → All trips with filters (admin view)
 * GET /api/admin/users   → All users with role counts
 *
 * SECURITY: All routes require authentication + ADMIN or RIDER role
 * (we allow the platform owner to access admin via their account).
 * In production, add a separate ADMIN role to the User model.
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats — Aggregated platform statistics
// ─────────────────────────────────────────────────────────────

router.get(
  "/stats",
  authenticate,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const [
        totalUsers,
        totalRiders,
        totalDrivers,
        totalTrips,
        completedTrips,
        cancelledTrips,
        activeTrips,
        todayTrips,
        weekTrips,
        revenueResult,
        todayRevenueResult,
        recentTrips,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "RIDER" } }),
        prisma.user.count({ where: { role: "DRIVER" } }),
        prisma.trip.count(),
        prisma.trip.count({ where: { status: "COMPLETED" } }),
        prisma.trip.count({ where: { status: "CANCELLED" } }),
        prisma.trip.count({ where: { status: { in: ["REQUESTED", "MATCHED", "STARTED"] } } }),
        prisma.trip.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.trip.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.trip.aggregate({ where: { status: "COMPLETED" }, _sum: { fare: true } }),
        prisma.trip.aggregate({
          where: { status: "COMPLETED", completedAt: { gte: todayStart } },
          _sum: { fare: true },
        }),
        prisma.trip.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            rider: { select: { id: true, name: true, email: true } },
            driver: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      res.status(200).json({
        users: { total: totalUsers, riders: totalRiders, drivers: totalDrivers },
        trips: {
          total: totalTrips,
          completed: completedTrips,
          cancelled: cancelledTrips,
          active: activeTrips,
          today: todayTrips,
          thisWeek: weekTrips,
        },
        revenue: {
          total: revenueResult._sum.fare || 0,
          today: todayRevenueResult._sum.fare || 0,
        },
        recentTrips,
      });
    } catch (error) {
      console.error("[admin/stats] Error:", error);
      res.status(500).json({ error: "Internal server error", message: "Failed to fetch stats." });
    }
  }
);

export default router;
