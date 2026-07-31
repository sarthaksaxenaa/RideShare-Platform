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
import { requireRole } from "../middleware/role.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats — Aggregated platform statistics
// ─────────────────────────────────────────────────────────────

router.get(
  "/stats",
  authenticate,
  requireRole("ADMIN"),
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
// ─────────────────────────────────────────────────────────────
// GET /api/admin/users — Paginated user list with search
// ─────────────────────────────────────────────────────────────
//
// 📚 PAGINATION
// Instead of returning ALL users (which could be thousands),
// we return a "page" at a time (20 users per page). The frontend
// sends ?page=1 or ?page=2 to navigate. This keeps responses
// fast and memory usage low.
//
// 📚 SEARCH
// The `search` query param filters users by name OR email using
// Prisma's `contains` with `mode: 'insensitive'` — this is a
// case-insensitive LIKE query under the hood.

router.get(
  "/users",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = 20;
      const skip = (page - 1) * pageSize;
      const search = (req.query.search as string) || '';
      const role = req.query.role as string;

      // Build the WHERE clause dynamically
      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (role && ['RIDER', 'DRIVER', 'ADMIN'].includes(role)) {
        where.role = role;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: {
              select: {
                tripsAsRider: true,
                tripsAsDriver: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error("[admin/users] Error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/role — Change a user's role
// ─────────────────────────────────────────────────────────────
//
// 📚 WHY PATCH (not PUT)?
// PATCH means "partially update a resource" — we're only
// changing the role field, not the entire user object.
// PUT would imply replacing the whole user record.

router.patch(
  "/users/:id/role",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !['RIDER', 'DRIVER', 'ADMIN'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be RIDER, DRIVER, or ADMIN.' });
        return;
      }

      // Prevent admin from changing their own role (safety net)
      if (id === (req as Request & { user: { id: string } }).user.id) {
        res.status(400).json({ error: 'You cannot change your own role.' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });

      res.json({ message: `Role updated to ${role}`, user: updated });
    } catch (error) {
      console.error("[admin/users/role] Error:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id — Delete a user account
// ─────────────────────────────────────────────────────────────
//
// 📚 CASCADING DELETES
// When we delete a user, we need to also delete their related
// records (ratings, saved locations, emergency contacts, etc.)
// to avoid orphaned records. Prisma's onDelete cascade handles
// some of this, but we explicitly clean up to be safe.
//
// 📚 WHY NOT SOFT DELETE?
// Our Prisma schema doesn't have a `banned` field, so we do a
// real delete for now. In production, add a `banned: Boolean`
// field and filter banned users from login instead.

router.delete(
  "/users/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (id === (req as Request & { user: { id: string } }).user.id) {
        res.status(400).json({ error: 'You cannot delete your own account.' });
        return;
      }

      // Check user exists
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      // Delete related records first, then the user.
      // ORDER MATTERS: ratings reference trips, so delete ratings first.
      // Trips have a non-nullable riderId, so we must delete rider trips
      // (not just nullify driverId). Driver trips get unlinked instead.
      await prisma.$transaction([
        // 1. First delete all ratings for the user's trips
        prisma.rating.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } }),
        // 2. Delete all trips where user is rider
        prisma.trip.deleteMany({ where: { riderId: id } }),
        // 3. Nullify driverId on trips where user is driver
        prisma.trip.updateMany({ where: { driverId: id }, data: { driverId: null } }),
        // 4. Delete related records (emergency contacts, saved locations, driver location)
        prisma.emergencyContact.deleteMany({ where: { userId: id } }),
        prisma.savedLocation.deleteMany({ where: { userId: id } }),
        prisma.driverLocation.deleteMany({ where: { driverId: id } }),
        // 5. Then delete the user
        prisma.user.delete({ where: { id } }),
      ]);

      res.json({ message: `User ${user.name} (${user.email}) has been deleted.` });
    } catch (error) {
      console.error("[admin/users/delete] Error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

export default router;
