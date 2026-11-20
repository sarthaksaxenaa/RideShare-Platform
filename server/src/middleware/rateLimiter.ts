import rateLimit from "express-rate-limit";

/**
 * Rate limiters built on express-rate-limit.
 *
 * Each limiter owns its own counter store, so hitting one route group never
 * consumes another group's budget.
 *
 * The client IP comes from `req.ip`. Behind Render's reverse proxy that is
 * only the real client address when Express is told how many proxy hops to
 * trust: see `app.set("trust proxy", 1)` in index.ts. Without it every user
 * would share the proxy's IP and therefore one single bucket.
 *
 * The in-memory store is per process and resets on restart. That is fine for
 * one instance; move to a shared store (for example Redis) before scaling out.
 */

const WINDOW_1_MIN = 60 * 1000;
const WINDOW_5_MIN = 5 * 60 * 1000;

function createLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  });
}

/** Auth routes: 30 requests per 5 minutes per IP */
export const authLimiter = createLimiter(WINDOW_5_MIN, 30);

/** General API routes: 120 requests per minute per IP */
export const apiLimiter = createLimiter(WINDOW_1_MIN, 120);

/** Registration: 10 requests per minute per IP */
export const uploadLimiter = createLimiter(WINDOW_1_MIN, 10);
