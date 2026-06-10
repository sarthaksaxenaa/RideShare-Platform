/**
 * ────────────────────────────────────────────────────────────
 * Role-Guard Middleware — Authorization
 * ────────────────────────────────────────────────────────────
 *
 * WHY A FACTORY FUNCTION?
 * Express middleware has a fixed (req, res, next) signature, so
 * we can't directly pass extra arguments like allowed roles.
 * The factory pattern (`requireRole(...roles)`) returns a fresh
 * middleware closure that captures the allowed roles in its
 * scope — a clean, composable approach.
 *
 * USAGE:
 * ```ts
 * // Only drivers can accept rides
 * router.post("/accept", authenticate, requireRole("DRIVER"), handler);
 *
 * // Both roles can view their own profile
 * router.get("/me", authenticate, requireRole("RIDER", "DRIVER"), handler);
 * ```
 *
 * NOTE: This middleware MUST run AFTER `authenticate` because
 * it reads from `req.user` which is set by the auth middleware.
 * ────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from "express";

/**
 * Creates an Express middleware that restricts access to users
 * whose `req.user.role` matches one of the provided roles.
 *
 * @param roles - One or more role strings (e.g. "RIDER", "DRIVER").
 * @returns Express middleware that sends 403 if the user's role
 *          is not in the allowed list.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Guard: authenticate middleware should have run first.
    if (!req.user) {
      res.status(401).json({
        error: "Authentication required",
        message: "You must be logged in to access this resource.",
      });
      return;
    }

    // Check if the user's role is in the allowed list.
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `This action requires one of the following roles: ${roles.join(", ")}. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
}
