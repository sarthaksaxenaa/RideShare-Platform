/**
 * ────────────────────────────────────────────────────────────
 * Rate Limiting Middleware — Brute-Force Protection
 * ────────────────────────────────────────────────────────────
 *
 * 📚 WHAT IS RATE LIMITING?
 * Rate limiting restricts how many requests a single client
 * (identified by their IP address) can make in a given time
 * window. Think of it like a bouncer at a club — you can enter,
 * but if you try to rush in 100 times in a minute, you're
 * blocked.
 *
 * 📚 WHY DO WE NEED IT?
 * Without rate limiting, an attacker could:
 *   1. Try millions of password combinations (brute-force)
 *   2. Create thousands of fake accounts (spam)
 *   3. Overwhelm our server with requests (DDoS)
 *
 * 📚 HOW DOES `express-rate-limit` WORK INTERNALLY?
 * It maintains an in-memory store (a Map) that maps:
 *   IP address → { count: number, resetTime: Date }
 *
 * On each request:
 *   1. Look up the IP in the store
 *   2. If count >= max → respond with 429 (Too Many Requests)
 *   3. If count < max → increment count, call next()
 *   4. When resetTime expires → reset count to 0
 *
 * 📚 PRODUCTION NOTE:
 * The default in-memory store works fine for a single server.
 * If you scale to multiple servers (behind a load balancer),
 * switch to `rate-limit-redis` so all servers share the same
 * counter. Otherwise, an attacker could hit different servers
 * and bypass the limit.
 *
 * 📚 `windowMs` AND `max` EXPLAINED:
 * - windowMs: 15 * 60 * 1000 = 15 minutes (in milliseconds)
 * - max: 20 = maximum 20 requests per window
 * - So: a user can try to login 20 times in 15 minutes.
 *   On the 21st attempt, they get a 429 error and must wait.
 * ────────────────────────────────────────────────────────────
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes.
 *
 * Settings:
 * - 20 requests per 15-minute window per IP
 * - Applies to: /api/auth/login, /api/auth/register, /api/auth/reset-password
 *
 * WHY 20 REQUESTS / 15 MIN?
 * A legitimate user might fail their password 2-3 times, then
 * succeed. Even with frustration retries, 20 is generous.
 * An attacker trying a password dictionary needs thousands of
 * attempts — 20 makes that effectively impossible.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 20,                      // 20 requests per window
  message: {
    error: 'Too many attempts',
    message: 'Too many login/registration attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,        // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,         // Disable the old `X-RateLimit-*` headers
});

/**
 * General API rate limiter — less strict, for all routes.
 *
 * Settings:
 * - 100 requests per 15-minute window per IP
 *
 * WHY A GENERAL LIMITER?
 * Even non-auth routes should be protected against abuse.
 * 100 requests / 15 min = ~7 requests per minute — plenty
 * for normal usage, but stops automated scraping.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                     // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'You\'ve made too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
