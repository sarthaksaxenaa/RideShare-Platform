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
import webhooksRouter from "./routes/webhooks.js";
import { initSocket } from "./socket/index.js";

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
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────

/** Health check — used by load balancers, uptime monitors, and
 *  docker HEALTHCHECK to verify the server is alive. */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Auth routes: /api/auth/register, /api/auth/login */
app.use("/api/auth", authRouter);

/** Trip routes: /api/trips — CRUD, estimation, payment intents */
app.use("/api/trips", tripsRouter);

// ── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚗 RideShare Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Environment:  ${process.env.NODE_ENV || "development"}`);
});
