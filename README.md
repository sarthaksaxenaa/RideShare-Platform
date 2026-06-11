# 🚗 RideShare

**Real-Time Ride-Hailing Platform**

A full-stack monorepo connecting riders with nearby drivers using live GPS tracking, instant trip matching, and secure card payments — mirroring the core flow of production apps like Uber and Ola.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express, TypeScript, Socket.io |
| **Database** | PostgreSQL + Prisma ORM |
| **Frontend** | React 18, Vite, TypeScript |
| **Maps** | Leaflet + React-Leaflet (OpenStreetMap) |
| **Payments** | Stripe (authorize-then-capture) |
| **Auth** | JWT + bcryptjs |
| **Styling** | CSS Modules (component-scoped) |

## Monorepo Structure

```
rideshare/
├── server/          # Node.js + Express + Socket.io backend (TypeScript)
├── rider-app/       # React (Vite) frontend for riders (TypeScript)
├── driver-app/      # React (Vite) frontend for drivers (TypeScript)
├── package.json     # Root workspace scripts
└── .gitignore
```

## Getting Started

### Prerequisites
- Node.js >= 18 LTS
- PostgreSQL >= 14
- Stripe CLI (for Phase 4)

### Installation
```bash
# Install all dependencies across the monorepo
npm run install:all

# Set up the database
npm run db:migrate

# Start all three apps (in separate terminals)
npm run dev:server    # Backend → http://localhost:3001
npm run dev:rider     # Rider App → http://localhost:5173
npm run dev:driver    # Driver App → http://localhost:5174
```

### Environment Setup
Copy the `.env` template in each directory and fill in your values:
- `server/.env` — Database URL, JWT secret, Stripe keys
- `rider-app/.env` — API URL, Stripe publishable key
- `driver-app/.env` — API URL

---

## Development Log

### Iteration #1 — Phase 1: Authentication & Project Setup
> **Status**: ✅ Complete — 10 June 2026

**Scope:**
- Monorepo scaffolding (root package.json, .gitignore)
- Express + TypeScript backend with health check endpoint
- Prisma schema with User model and Role enum
- JWT authentication: `/api/auth/register` and `/api/auth/login`
- Auth middleware (JWT verification) and Role guard middleware
- Rider App: Vite + React + TypeScript with login/register page
- Driver App: Vite + React + TypeScript with login/register page
- CSS Modules with premium dark theme and glassmorphism UI

**Design Decisions Made:**
| # | Decision | Choice |
|---|----------|--------|
| 1 | Frontend Language | TypeScript (TSX) — full type safety across the monorepo |
| 2 | CSS Strategy | CSS Modules (`.module.css`) — Vite-native, component-scoped |
| 3 | Driver Matching | In-memory Haversine — skip PostGIS at this scale |
| 4 | Stripe Setup | Deferred to Phase 4 |

**Files Created (36 total):**

<details>
<summary><strong>Root (3 files)</strong></summary>

| File | Purpose |
|------|---------|
| `package.json` | Monorepo root with workspace scripts (`dev:server`, `dev:rider`, `dev:driver`, `install:all`, `db:migrate`) |
| `.gitignore` | Ignores node_modules, .env, dist, IDE files, OS artifacts |
| `README.md` | Project documentation and iteration log |

</details>

<details>
<summary><strong>server/ (10 files)</strong></summary>

| File | Purpose |
|------|---------|
| `package.json` | Backend deps (Express, Socket.io, Prisma, JWT, bcrypt, Stripe) |
| `tsconfig.json` | Strict TS config — ES2020, NodeNext module resolution |
| `.env` | Placeholder env vars (DATABASE_URL, JWT_SECRET, PORT, Stripe keys) |
| `prisma/schema.prisma` | PostgreSQL datasource, `Role` enum, `User` model with UUID PK |
| `src/index.ts` | Entry point — Express + HTTP server + Socket.io init + CORS + routes |
| `src/lib/prisma.ts` | Prisma client singleton (globalThis cache for hot reload) |
| `src/lib/socket.ts` | `getIO()`/`setIO()` registry for Socket.io instance |
| `src/middleware/auth.ts` | JWT verification — extracts Bearer token, attaches `req.user` |
| `src/middleware/role.ts` | `requireRole()` factory — checks user role, returns 403 |
| `src/routes/auth.ts` | `POST /register` (hash + create + JWT) and `POST /login` (verify + JWT) |

</details>

<details>
<summary><strong>rider-app/ (13 files)</strong></summary>

| File | Purpose |
|------|---------|
| `package.json` | React, Vite, Axios, Leaflet, Socket.io, Stripe deps |
| `tsconfig.json` | React TS config (ES2020, react-jsx, strict) |
| `tsconfig.node.json` | TS config for vite.config.ts |
| `vite.config.ts` | Vite config — port 5173 |
| `index.html` | HTML entry — "RideShare — Rider" with SEO meta tags |
| `.env` | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_STRIPE_PUBLISHABLE_KEY` |
| `src/vite-env.d.ts` | TypeScript env variable declarations |
| `src/main.tsx` | React 18 createRoot + StrictMode |
| `src/index.css` | Global reset, Inter font, dark theme, scrollbar styles |
| `src/App.tsx` | BrowserRouter with AuthGuard, 3 routes |
| `src/lib/api.ts` | Axios instance with JWT interceptors |
| `src/pages/Login.tsx` | Premium login/register page — RIDER role, cyan accent |
| `src/pages/Login.module.css` | Glassmorphism card, animated orbs, gradient button, glow effects |
| `src/pages/Home.tsx` | Dashboard placeholder with logout |
| `src/pages/TripActive.tsx` | Trip tracking placeholder |

</details>

<details>
<summary><strong>driver-app/ (13 files)</strong></summary>

| File | Purpose |
|------|---------|
| `package.json` | React, Vite, Axios, Leaflet, Socket.io deps (no Stripe) |
| `tsconfig.json` | React TS config |
| `tsconfig.node.json` | TS config for vite.config.ts |
| `vite.config.ts` | Vite config — port 5174 |
| `index.html` | HTML entry — "RideShare — Driver" |
| `.env` | `VITE_API_URL`, `VITE_SOCKET_URL` |
| `src/vite-env.d.ts` | TypeScript env variable declarations |
| `src/main.tsx` | React 18 createRoot + StrictMode |
| `src/index.css` | Global reset, Inter font, dark theme |
| `src/App.tsx` | BrowserRouter with AuthGuard, 3 routes |
| `src/lib/api.ts` | Axios instance with JWT interceptors |
| `src/pages/Login.tsx` | Premium login/register page — DRIVER role, emerald accent |
| `src/pages/Login.module.css` | Glassmorphism card, animated orbs, emerald gradient |
| `src/pages/Home.tsx` | Dashboard placeholder with logout |
| `src/pages/TripActive.tsx` | Trip tracking placeholder |

</details>

**Key Design Highlights:**
- 🔐 12 bcrypt salt rounds (OWASP ≥ 10 recommended)
- 🆔 UUID primary keys (prevents enumeration attacks)
- 🔄 Prisma singleton via `globalThis` (prevents connection exhaustion on hot reload)
- 🎨 Premium dark UI with glassmorphism, animated floating orbs, gradient buttons
- 🔵 Rider accent: Cyan/Blue (`#00d4ff`) | 🟢 Driver accent: Emerald (`#00d68f`)

**Setup Steps:**
```bash
# 1. Install dependencies
cd server && npm install
cd ../rider-app && npm install
cd ../driver-app && npm install

# 2. Configure environment
# Edit server/.env → set your PostgreSQL password

# 3. Initialize database
cd server
npx prisma migrate dev --name init
npx prisma generate

# 4. Start all apps (separate terminals)
npm run dev          # server → http://localhost:3001
cd ../rider-app && npm run dev   # → http://localhost:5173
cd ../driver-app && npm run dev  # → http://localhost:5174
```

---

### Iteration #2 — Phase 2: Database & Trip Management
> **Status**: ✅ Complete — 10 June 2026

**Scope:**
- Expanded Prisma schema with Trip model, DriverLocation model, TripStatus and PaymentStatus enums
- Trip CRUD routes with role-based filtering and ownership verification
- Fare estimation endpoint using Haversine distance formula
- Stripe payment service (authorize-then-capture pattern)
- Stripe webhook handler with signature verification and raw body parsing
- Driver matching service with Haversine formula and proximity sorting

**New API Endpoints:**
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/trips` | JWT (both) | Trip history filtered by user role |
| GET | `/api/trips/:id` | JWT (both) | Single trip with ownership check |
| POST | `/api/trips/estimate` | JWT (RIDER) | Fare estimation from coordinates |
| POST | `/api/trips/payment-intent` | JWT (RIDER) | Create Stripe PaymentIntent hold |
| POST | `/webhooks/stripe` | Stripe sig | Payment event handler (raw body) |

**Files Created (4 new):**

| File | Purpose |
|------|---------|
| `server/src/services/matching.ts` | Haversine formula + `findNearbyDrivers()` with busy-driver exclusion |
| `server/src/services/stripe.ts` | `createTripPaymentIntent()`, `capturePayment()`, `cancelPayment()` |
| `server/src/routes/trips.ts` | Trip CRUD, fare estimation, Stripe payment intent creation |
| `server/src/routes/webhooks.ts` | Stripe webhook handler (authorized → paid → cancelled) |

**Files Modified (2):**

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | Added `TripStatus`, `PaymentStatus` enums, `Trip` model, `DriverLocation` model, User relations |
| `server/src/index.ts` | Mounted webhook route (with `express.raw()` BEFORE `express.json()`), mounted trips route |

**Key Design Highlights:**
- 📐 Haversine formula for great-circle distance (< 0.3% error vs WGS-84)
- 💳 Authorize-then-capture Stripe pattern (hold → charge on completion, or release on cancel)
- 🔒 Webhook signature verification (HMAC-SHA256 on raw bytes)
- 🛡️ Trip ownership verification prevents horizontal privilege escalation
- 💰 Fare in paise (smallest currency unit) to avoid floating-point precision issues
- 🚫 Busy driver exclusion (MATCHED/STARTED status) using O(1) Set lookup

**After this iteration, run:**
```bash
cd server
npx prisma migrate dev --name add-trips-and-locations
npx prisma generate
```

---

### Iteration #3 — Phase 3: Real-Time Socket.io Layer
> **Status**: ✅ Complete — 11 June 2026

**Scope:**
- Socket.io server with JWT auth middleware and room-based event isolation
- Driver event handlers: location_update (privacy-aware), go_online, go_offline
- Trip lifecycle handlers: request → match (atomic) → start → complete (Stripe capture) → cancel
- Rider-app: useSocket + useTrip hooks, Map component, BookingCard, Home page, TripActive page
- Driver-app: useSocket + useLocation hooks, Map component, TripRequest overlay, Dashboard, TripActive page

**Real-Time Socket Events:**
| Event | Direction | Description |
|-------|-----------|-------------|
| `driver:location_update` | Driver → Server | GPS position upsert (2s interval) |
| `driver:location` | Server → Rider/Room | Position broadcast (public or room-scoped) |
| `driver:go_online/offline` | Driver → Server | Toggle availability |
| `trip:request` | Rider → Server | Create trip, notify nearby drivers |
| `trip:new_request` | Server → Drivers | Incoming ride notification |
| `trip:accept` | Driver → Server | Atomic trip claim (prevents double-match) |
| `trip:matched` | Server → Room | Driver + rider notified |
| `trip:start` | Driver → Server | Rider picked up |
| `trip:complete` | Driver → Server | Stripe capture + trip finalization |
| `trip:cancel` | Either → Server | Stripe release + status rollback |

**Files Created (16 new):**

<details>
<summary><strong>server/src/socket/ (3 files)</strong></summary>

| File | Purpose |
|------|---------|
| `socket/index.ts` | initSocket() — JWT auth middleware, room join, disconnect handler |
| `socket/driverHandlers.ts` | location upsert with privacy branching, online/offline toggle |
| `socket/tripHandlers.ts` | Full trip lifecycle — request, accept (atomic), start, complete, cancel |

</details>

<details>
<summary><strong>rider-app/ (8 files)</strong></summary>

| File | Purpose |
|------|---------|
| `hooks/useSocket.ts` | Socket.io connection with JWT + auto-reconnect |
| `hooks/useTrip.ts` | Trip state machine (idle → requesting → matched → started → completed) |
| `components/Map.tsx` | Leaflet wrapper with emoji markers, dynamic centering |
| `components/Map.module.css` | Map container styling |
| `components/BookingCard.tsx` | Fare estimation, preset locations, booking flow |
| `components/BookingCard.module.css` | Glassmorphism card, gradient buttons |
| `pages/Home.tsx` + `.module.css` | Full-screen map, driver markers, booking overlay |
| `pages/TripActive.tsx` + `.module.css` | Live driver tracking, status panel, fare summary |

</details>

<details>
<summary><strong>driver-app/ (8 files)</strong></summary>

| File | Purpose |
|------|---------|
| `hooks/useSocket.ts` | Socket.io connection with JWT + auto-reconnect |
| `hooks/useLocation.ts` | GPS watchPosition with 2s throttled emission |
| `components/Map.tsx` | Leaflet wrapper with dark-themed tiles |
| `components/Map.module.css` | Map container styling |
| `components/TripRequest.tsx` | Incoming ride overlay — 15s countdown, accept/decline |
| `components/TripRequest.module.css` | Slide-up animation, pulsing glow |
| `pages/Home.tsx` + `.module.css` | Dashboard — online/offline toggle, earnings, trip history |
| `pages/TripActive.tsx` + `.module.css` | Navigation view — trip controls, completion celebration |

</details>

**Files Modified (1):**

| File | Change |
|------|--------|
| `server/src/index.ts` | Added `initSocket(io)` call to activate the real-time layer |

**Key Design Highlights:**
- 🔐 Socket JWT auth — tokens verified on handshake, decoded user attached to `socket.data.user`
- 🏠 Room-based isolation — `trip:{id}` rooms ensure location data is private to trip participants
- ⚡ Atomic matching — `updateMany WHERE status='REQUESTED'` prevents double-accept race conditions
- 📍 Privacy-aware location — active trip drivers emit only to their trip room, not globally
- 🗺️ Leaflet maps — OpenStreetMap tiles (free), emoji-based markers, dynamic fly-to animations
- ⏱️ 15-second auto-dismiss — driver trip request overlay with visual countdown progress bar
- 🎉 Celebration overlay — confetti-style animation when driver completes a trip


