/**
 * ────────────────────────────────────────────────────────────
 * RideShare Server — Entry Point
 * ────────────────────────────────────────────────────────────
 *
 * This file wires together all the pieces:
 *  1. Loads environment variables (dotenv)
 *  2. Creates the Express app + raw HTTP server
 *  3. Initializes Socket.io (stored via setIO for later use)
 *  4. Applies global middleware (CORS, JSON body parser)
 *  5. Mounts route modules
 *  6. Starts listening
 *
 * WHY A SEPARATE HTTP SERVER?
 * Express creates an HTTP server internally when you call
 * `app.listen()`, but Socket.io needs a reference to that
 * server to attach its WebSocket upgrade handler. By creating
 * `http.createServer(app)` ourselves, we can pass the same
 * server to both Express and Socket.io.
 *
 * WHY CORS_ORIGIN IS SPLIT BY COMMA?
 * The `cors` package accepts a string (single origin) or an
 * array of strings (multiple origins). Our `.env` stores them
 * as a comma-separated string for simplicity, and we split
 * them here. This lets us easily add the production domain
 * later without changing code.
 * ────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "./lib/socket.js";
import authRouter from "./routes/auth.js";
import tripsRouter from "./routes/trips.js";
import usersRouter from "./routes/users.js";
import webhooksRouter from "./routes/webhooks.js";
import ratingsRouter from "./routes/ratings.js";
import locationsRouter from "./routes/locations.js";
import emergencyRouter from "./routes/emergency.js";
import adminRouter from "./routes/admin.js";
import { initSocket } from "./socket/index.js";
import { authLimiter, generalLimiter } from "./middleware/rate-limit.js";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// ── App & Server ────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ── Socket.io ───────────────────────────────────────────────
// Initialize now so it's ready when Phase 3 adds real-time
// ride tracking. The `cors` config mirrors Express's so the
// frontend can connect without issues.

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

// Store the io instance so other modules can access it via getIO().
setIO(io);

// Register Socket.io JWT auth middleware, connection handler,
// and all real-time event handlers (driver location, trip lifecycle).
initSocket(io);

// ── Global Middleware ───────────────────────────────────────

app.use(
  cors({
    origin: corsOrigins,
    credentials: true, // Allow cookies / auth headers
  })
);

/**
 * 📚 HELMET — Security Headers
 * Sets HTTP headers that protect against common attacks:
 *  - X-Content-Type-Options: nosniff (prevents MIME-type sniffing)
 *  - X-Frame-Options: DENY (prevents clickjacking)
 *  - X-XSS-Protection: 1 (enables browser XSS filters)
 *  - Strict-Transport-Security (forces HTTPS)
 */
app.use(helmet());

/**
 * 📚 COOKIE PARSER
 * Parses the Cookie header and populates req.cookies.
 * Needed for HttpOnly cookie-based JWT authentication.
 * Without this, req.cookies would be undefined.
 */
app.use(cookieParser());

/**
 * STRIPE WEBHOOK ROUTE — must be registered BEFORE express.json().
 *
 * WHY? Stripe's webhook signature verification (constructEvent)
 * requires the raw, unparsed request body bytes. If express.json()
 * parses the body first, the raw bytes are lost, and signature
 * verification ALWAYS fails — a subtle bug that's hard to debug.
 *
 * By mounting this route with express.raw() first, only requests
 * to /webhooks/stripe get the raw body. All other routes get
 * the normal JSON parsing below.
 */
app.use("/webhooks/stripe", express.raw({ type: "application/json" }), webhooksRouter);

/**
 * Parse JSON request bodies for all other routes.
 */
app.use(express.json({ limit: '10mb' }));

// ── Routes ──────────────────────────────────────────────────

/**
 * Health check — used by load balancers, uptime monitors, and
 * docker HEALTHCHECK to verify the server is alive.
 *
 * 📚 WHY INCLUDE UPTIME & MEMORY?
 * - `uptime`: How long the server has been running (in seconds).
 *   If this is very low and keeps resetting, it means the server
 *   is crashing and restarting — a sign of an OOM or startup error.
 * - `memory`: Heap usage in MB. If this keeps growing, you have
 *   a memory leak. If it's near the Node.js limit (~1.7GB), the
 *   process will crash with OOM.
 */
app.get("/health", (_req, res) => {
  const memUsage = process.memoryUsage();
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    node: process.version,
    env: process.env.NODE_ENV || 'development',
  });
});

/** Lightweight ping — just returns 200 for the fastest possible check */
app.get("/api/ping", (_req, res) => { res.send("pong"); });

/** Auth routes: /api/auth/register, /api/auth/login
 *  Rate limited to 20 req/15min to prevent brute-force attacks */
app.use("/api/auth", authLimiter, authRouter);

/** Apply general rate limit (100 req/15min) to all other API routes */
app.use("/api", generalLimiter);

/** Trip routes: /api/trips — CRUD, estimation, payment intents */
app.use("/api/trips", tripsRouter);

/** User routes: /api/users — Profile management */
app.use("/api/users", usersRouter);

/** Rating routes: /api/ratings — Post-trip feedback */
app.use("/api/ratings", ratingsRouter);

/** Saved location routes: /api/locations — Home/Work/Custom */
app.use("/api/locations", locationsRouter);

/** Emergency routes: /api/emergency — SOS & contacts */
app.use("/api/emergency", emergencyRouter);

/** Admin routes: /api/admin — Platform stats & overview */
app.use("/api/admin", adminRouter);

// ── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Bind to all interfaces (required by Render/Docker)

server.listen(Number(PORT), HOST, () => {
  console.log(`🚗 RideShare Server running on ${HOST}:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment:  ${process.env.NODE_ENV || "development"}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// ── Graceful Shutdown ───────────────────────────────────────
//
// 📚 WHAT IS GRACEFUL SHUTDOWN?
// When a server needs to stop (deployment, scaling, crash recovery),
// it should:
//   1. Stop accepting NEW connections
//   2. Let in-progress requests FINISH
//   3. Close database connections
//   4. Then exit cleanly
//
// 📚 WHY DOES THIS MATTER?
// Without graceful shutdown:
//   - Active WebSocket connections drop immediately
//   - In-progress database writes may corrupt data
//   - Users see "connection lost" errors during deployments
//
// 📚 SIGTERM vs SIGINT:
//   - SIGTERM: Sent by process managers (Docker, Kubernetes, Render)
//     when they want the process to stop cleanly.
//   - SIGINT: Sent when you press Ctrl+C in the terminal.
//   Both should trigger the same cleanup.

const gracefulShutdown = async (signal: string) => {
  console.log(`\n⏳ ${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('   ✅ HTTP server closed (no new connections)');
  });

  // 2. Disconnect all Socket.io clients
  io.close(() => {
    console.log('   ✅ Socket.io connections closed');
  });

  // 3. Disconnect from the database
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$disconnect();
    console.log('   ✅ Database connection closed');
  } catch (err) {
    console.error('   ❌ Error closing database:', err);
  }

  console.log('👋 Shutdown complete. Goodbye!');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
