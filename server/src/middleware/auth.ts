/**
 * ────────────────────────────────────────────────────────────
 * Authentication Middleware — JWT Verification
 * ────────────────────────────────────────────────────────────
 *
 * HOW IT WORKS:
 * 1. Client sends `Authorization: Bearer <token>` header.
 * 2. This middleware extracts the token, verifies it against
 *    JWT_SECRET, and attaches the decoded payload to `req.user`.
 * 3. Downstream handlers can then access `req.user.id`,
 *    `req.user.role`, etc. without re-verifying.
 *
 * WHY BEARER SCHEME?
 * The Bearer token scheme (RFC 6750) is the de-facto standard
 * for API authentication. It is stateless, works across origins
 * (unlike cookies which need SameSite/CORS gymnastics), and
 * plays nicely with mobile clients and SPAs.
 *
 * SECURITY NOTES:
 * - Tokens are verified synchronously with `jwt.verify()`.
 *   An invalid or expired token immediately returns 401.
 * - We do NOT store tokens server-side (stateless JWT). For
 *   token revocation, a future phase can add a Redis-backed
 *   deny-list.
 * ────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── Types ────────────────────────────────────────────────────

/**
 * Shape of the data we embed inside every JWT.
 * Kept intentionally minimal — only include claims that are
 * needed on EVERY authenticated request so the token stays
 * small (it's sent with every HTTP call).
 */
export interface JwtPayload {
  /** User's UUID primary key */
  id: string;
  /** RIDER or DRIVER — used by the role-guard middleware */
  role: string;
  /** Email — handy for logging / audit without a DB lookup */
  email: string;
}

/**
 * Extend Express's Request type so `req.user` is strongly typed
 * across all route handlers.
 *
 * We use module augmentation (declare global) rather than a
 * separate `.d.ts` file so the type stays co-located with the
 * middleware that populates it.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Middleware ────────────────────────────────────────────────

/**
 * Express middleware that verifies the JWT in the Authorization
 * header and attaches the decoded payload to `req.user`.
 *
 * Usage:
 * ```ts
 * router.get("/profile", authenticate, (req, res) => {
 *   res.json({ userId: req.user!.id });
 * });
 * ```
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // ── 1. Extract the token ──────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please provide a valid Bearer token in the Authorization header.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // ── 2. Verify & decode ────────────────────────────────
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      // Fail fast — this is a server misconfiguration, not a
      // client error. Log it but don't leak internals.
      console.error("[auth] JWT_SECRET is not set in environment variables.");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // ── 3. Attach to request ──────────────────────────────
    req.user = decoded;
    next();
  } catch (error) {
    // jwt.verify throws on expiry, malformed tokens, etc.
    res.status(401).json({
      error: "Invalid or expired token",
      message: "Your session has expired. Please log in again.",
    });
  }
}
