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
 * 📚 REFRESH TOKEN MECHANISM
 *
 * WHY TWO TOKENS?
 * A single long-lived token (7 days) is dangerous — if stolen,
 * the attacker has a full week of access. With refresh tokens:
 *
 *   Access Token  (15 min)  → Used for every API call. Short-lived
 *                              so if stolen, damage is limited.
 *   Refresh Token (7 days)  → Used ONLY to get a new access token.
 *                              Stored in a cookie that's sent ONLY
 *                              to /api/auth/* (not every request).
 *
 * FLOW:
 *   1. Login → Server sets both cookies
 *   2. User makes API calls → Access token cookie is sent
 *   3. Access token expires (15 min) → API returns 401
 *   4. Frontend auto-calls /api/auth/refresh → Gets new access token
 *   5. Frontend retries the original request → Works!
 *   6. Refresh token expires (7 days) → User must login again
 *
 * WHY IS THIS SAFER?
 * - Access token stolen? Attacker only has 15 minutes
 * - Refresh token has `path: '/api/auth'` so it's ONLY sent to
 *   auth endpoints, not to every API call — smaller attack surface
 */
const ACCESS_TOKEN_EXPIRY = '15m';   // Short-lived
const REFRESH_TOKEN_EXPIRY = '7d';   // Long-lived

/** Cookie config for the access token (sent on ALL requests) */
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

/** Cookie config for the refresh token (sent ONLY to /api/auth/*) */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth', // 📚 Restricted path — only sent to auth endpoints!
};

/** Helper: generate both tokens and set cookies */
function issueTokens(res: Response, user: { id: string; role: string; email: string }) {
  const payload = { id: user.id, role: user.role, email: user.email };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },  // 'type' distinguishes from access tokens
    process.env.JWT_SECRET!,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  res.cookie('jwt', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('jwt_refresh', refreshToken, REFRESH_COOKIE_OPTIONS);

  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, phone, aadhaarNumber, vehicleNumber, vehicleType, faceImageUrl, vehicleImages } = req.body;

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

    if (role === 'DRIVER') {
      if (!phone || !/^[0-9]{10}$/.test(phone)) {
        res.status(400).json({ error: "Validation error", message: "Phone is required and must be 10 digits." });
        return;
      }
      if (!aadhaarNumber || !/^[0-9]{12}$/.test(aadhaarNumber)) {
        res.status(400).json({ error: "Validation error", message: "Aadhaar number is required and must be 12 digits." });
        return;
      }
      if (!vehicleNumber || typeof vehicleNumber !== 'string' || vehicleNumber.trim() === '') {
        res.status(400).json({ error: "Validation error", message: "Vehicle number is required." });
        return;
      }
      if (!['BIKE', 'AUTO', 'SEDAN', 'SUV'].includes(vehicleType)) {
        res.status(400).json({ error: "Validation error", message: "Vehicle type must be BIKE, AUTO, SEDAN, or SUV." });
        return;
      }
      if (!faceImageUrl || typeof faceImageUrl !== 'string' || faceImageUrl.trim() === '') {
        res.status(400).json({ error: "Validation error", message: "Face image URL is required." });
        return;
      }
      if (!Array.isArray(vehicleImages) || vehicleImages.length < 2 || vehicleImages.length > 5) {
        res.status(400).json({ error: "Validation error", message: "Vehicle images must be an array of 2 to 5 images." });
        return;
      }
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
        isVerified: role !== 'DRIVER',
        verificationStatus: role === 'DRIVER' ? 'PENDING' : 'APPROVED',
        // Driver-specific fields (null for riders)
        ...(role === 'DRIVER' && {
          phone,
          aadhaarNumber,
          vehicleNumber,
          vehicleType,
          faceImageUrl,
          vehicleImages,
        }),
      },
    });

    // ── Issue access + refresh tokens ────────────────────────
    const { accessToken } = issueTokens(res, user);

    // ── Respond ─────────────────────────────────────────────
    // Include accessToken in body for Socket.io auth fallback
    // (cross-origin cookies may be blocked by browsers)
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
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

    // ── Issue access + refresh tokens ────────────────────────
    const { accessToken } = issueTokens(res, user);

    // ── Respond ─────────────────────────────────────────────
    // Include accessToken in body for Socket.io auth fallback
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
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
// POST /api/auth/send-otp — Send OTP for password reset
// ─────────────────────────────────────────────────────────────

router.post("/send-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      res.status(400).json({ error: "Validation error", message: "Email and role are required." });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(404).json({ error: "Not found", message: "No account found with this email." });
      return;
    }
    if (user.role !== role) {
      res.status(403).json({ error: "Role mismatch", message: `This email is registered as a ${user.role}.` });
      return;
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await prisma.oTP.create({
      data: { email: email.toLowerCase(), code, expiresAt }
    });

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'RideShare <noreply@rideshare.com>',
            to: [email.toLowerCase()],
            subject: 'Your Password Reset OTP',
            html: `<p>Your OTP for password reset is: <strong>${code}</strong>. It expires in 10 minutes.</p>`
          })
        });
      } catch (err) {
        console.error("Failed to send email via Resend:", err);
      }
    } else {
      console.log(`[MOCK MODE] OTP for ${email.toLowerCase()} is: ${code}`);
    }

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("[auth/send-otp] Error:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to send OTP." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp — Verify OTP
// ─────────────────────────────────────────────────────────────

router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Validation error", message: "Email and code are required." });
      return;
    }
    
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord) {
      res.status(400).json({ error: "Invalid or expired OTP", message: "The OTP is invalid or has expired." });
      return;
    }

    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { used: true }
    });

    res.status(200).json({ verified: true });
  } catch (error) {
    console.error("[auth/verify-otp] Error:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to verify OTP." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/reset-password — Reset password for an account
// ─────────────────────────────────────────────────────────────

router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role, newPassword, otpCode } = req.body;

    if (!email || !role || !newPassword || !otpCode) {
      res.status(400).json({
        error: "Validation error",
        message: "Email, role, new password, and OTP code are required.",
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

    // Verify OTP was successfully verified
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase(),
        code: otpCode,
        used: true,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord) {
      res.status(400).json({
        error: "Unauthorized",
        message: "Invalid or expired OTP session.",
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

    // Hash new password and update (bcrypt is imported at top of file)
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
// POST /api/auth/refresh — Issue a new access token
// ─────────────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  /**
   * 📚 HOW TOKEN REFRESH WORKS:
   *
   * 1. Frontend's access token expires (15 min)
   * 2. API returns 401
   * 3. Frontend's axios interceptor catches the 401
   * 4. Interceptor calls POST /api/auth/refresh
   * 5. This endpoint reads the refresh token from cookies
   * 6. If valid → issue new access token (new 15 min)
   * 7. If invalid → return 401 (user must login again)
   *
   * The refresh token cookie has path: '/api/auth', so the
   * browser ONLY sends it to this endpoint — not to every
   * API call. This reduces the attack surface.
   */
  try {
    const refreshToken = req.cookies?.jwt_refresh;

    if (!refreshToken) {
      res.status(401).json({
        error: 'No refresh token',
        message: 'Please log in again.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, secret) as {
      id: string; role: string; email: string; type?: string;
    };

    // Ensure it's actually a refresh token, not an access token
    if (decoded.type !== 'refresh') {
      res.status(401).json({
        error: 'Invalid token type',
        message: 'Please log in again.',
      });
      return;
    }

    // Verify user still exists in DB (they might have been deleted)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      res.status(401).json({
        error: 'User not found',
        message: 'Account no longer exists.',
      });
      return;
    }

    // Issue a fresh access token (refresh token stays the same)
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      secret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.cookie('jwt', newAccessToken, ACCESS_COOKIE_OPTIONS);
    res.status(200).json({ message: 'Token refreshed' });
  } catch (error) {
    // Refresh token expired or invalid → user must login again
    res.cookie('jwt', '', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
    res.cookie('jwt_refresh', '', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
    res.status(401).json({
      error: 'Refresh token expired',
      message: 'Your session has expired. Please log in again.',
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout — Clear both auth cookies
// ─────────────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response): void => {
  /**
   * 📚 LOGOUT WITH REFRESH TOKENS
   * Must clear BOTH cookies:
   *  - jwt (access token)  → path: '/'
   *  - jwt_refresh (refresh token) → path: '/api/auth'
   */
  res.cookie('jwt', '', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
  res.cookie('jwt_refresh', '', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
