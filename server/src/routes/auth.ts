/**
 * ────────────────────────────────────────────────────────────
 * Auth Routes — Registration & Login
 * ────────────────────────────────────────────────────────────
 *
 * POST /api/auth/register  → Create a new user account
 * POST /api/auth/login     → Authenticate & receive a JWT
 *
 * DESIGN DECISIONS:
 *
 * 1. PASSWORD HASHING — bcrypt with 12 salt rounds
 *    - 12 rounds strikes a balance between security and speed.
 *      Each additional round doubles the computation time.
 *    - At 12 rounds, hashing takes ~250 ms on modern hardware,
 *      which is fast enough for login but makes brute-force
 *      attacks impractical (~250 ms × 10^9 guesses = centuries).
 *    - OWASP currently recommends ≥ 10 rounds; 12 gives us
 *      headroom as hardware improves.
 *
 * 2. JWT PAYLOAD — minimal claims (id, role, email)
 *    - The token is sent on every request, so we keep it small.
 *    - Sensitive data (password, payment info) is NEVER included.
 *    - `role` is included so the role-guard middleware can
 *      authorize without a DB lookup on every request.
 *
 * 3. RESPONSE FORMAT — { token, user }
 *    - The client stores the token (e.g., in memory or
 *      localStorage) and sends it via `Authorization: Bearer`.
 *    - The `user` object is returned so the client can
 *      immediately hydrate the UI without an extra /me request.
 *
 * 4. ERROR RESPONSES — specific HTTP status codes
 *    - 409 for duplicate email (Conflict) — tells the client
 *      "this resource already exists", not a generic 400.
 *    - 401 for wrong password — standard "unauthorized".
 *    - 404 for unknown email — debatable (can leak whether an
 *      email is registered). In a production app you might
 *      return a generic 401 for both cases to prevent user
 *      enumeration. Kept separate here for clarity.
 * ────────────────────────────────────────────────────────────
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * Number of bcrypt salt rounds.
 * @see Design decision #1 above for rationale.
 */
const SALT_ROUNDS = 12;

/**
 * 📚 COOKIE CONFIGURATION
 *
 * HttpOnly cookies are the secure way to store JWTs:
 *  - httpOnly: true  → JavaScript CANNOT read this cookie (blocks XSS theft)
 *  - secure: true    → Only sent over HTTPS (prevents interception)
 *  - sameSite: 'lax' → Sent on same-site requests + top-level navigations
 *                       ('strict' would break OAuth redirects)
 *  - maxAge: 7 days  → Cookie expires automatically
 *  - path: '/'       → Available on all routes
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/',
};

// ─────────────────────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!email || !password || !name || !role) {
      res.status(400).json({
        error: "Validation error",
        message: "All fields are required: email, password, name, role.",
      });
      return;
    }

    // Ensure role is one of the allowed values.
    if (!["RIDER", "DRIVER", "ADMIN"].includes(role)) {
      res.status(400).json({
        error: "Validation error",
        message: 'Role must be "RIDER", "DRIVER", or "ADMIN".',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "Validation error",
        message: "Please provide a valid email address.",
      });
      return;
    }

    // ── Check for existing user ─────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        error: "Conflict",
        message: "An account with this email already exists.",
      });
      return;
    }

    // ── Hash password ───────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ── Create user ─────────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    });

    // ── Sign JWT ────────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Set JWT as HttpOnly cookie (secure, invisible to JavaScript)
    res.cookie('jwt', token, COOKIE_OPTIONS);

    // ── Respond ─────────────────────────────────────────────
    // Never return the hashed password to the client.
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[auth/register] Unexpected error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Something went wrong. Please try again later.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!email || !password || !role) {
      res.status(400).json({
        error: "Validation error",
        message: "Email, password, and role are required.",
      });
      return;
    }

    // ── Find user ───────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        error: "Not found",
        message: "No account found with this email address.",
      });
      return;
    }

    if (user.role !== role) {
      res.status(403).json({
        error: "Forbidden",
        message: `This email is registered as a ${user.role}. Please switch roles or create a new account.`,
      });
      return;
    }

    // ── Verify password ─────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password.",
      });
      return;
    }

    // ── Sign JWT ────────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Set JWT as HttpOnly cookie (secure, invisible to JavaScript)
    res.cookie('jwt', token, COOKIE_OPTIONS);

    // ── Respond ─────────────────────────────────────────────
    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[auth/login] Unexpected error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Something went wrong. Please try again later.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/reset-password — Reset password for an account
// ─────────────────────────────────────────────────────────────

router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role, newPassword } = req.body;

    if (!email || !role || !newPassword) {
      res.status(400).json({
        error: "Validation error",
        message: "Email, role, and new password are required.",
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        error: "Validation error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      res.status(404).json({
        error: "Not found",
        message: "No account found with this email.",
      });
      return;
    }

    if (user.role !== role) {
      res.status(403).json({
        error: "Role mismatch",
        message: `This email is registered as a ${user.role}. Please select the correct role.`,
      });
      return;
    }

    // Hash new password and update
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      message: "Password reset successful. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("[auth/reset-password] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to reset password.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout — Clear the auth cookie
// ─────────────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response): void => {
  /**
   * 📚 WHY A LOGOUT ENDPOINT?
   * With HttpOnly cookies, the frontend can't clear the cookie
   * via JavaScript (that's the whole point of HttpOnly!).
   * So the server must clear it by setting maxAge to 0.
   */
  res.cookie('jwt', '', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
