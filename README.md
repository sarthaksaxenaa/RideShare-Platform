<div align="center">
  <h1>🚗 RideShare</h1>
  <p><strong>Real-time ride-hailing platform built with React, Node.js, Socket.io, and Prisma.</strong></p>

  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma"></a>
  <a href="https://stripe.com/"><img src="https://img.shields.io/badge/Stripe-626CD9?style=for-the-badge&logo=Stripe&logoColor=white" alt="Stripe"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
</div>

---

## What It Does

RideShare connects riders with drivers in real time. Riders request a ride by selecting pickup and drop locations, get a fare estimate, and are matched with nearby drivers. Drivers receive trip requests, accept or decline, navigate to the rider, and complete the trip. Payments are handled via Stripe.

The entire platform runs as a **monorepo** with a single unified frontend — both rider and driver experiences are built into one React app, with role-based routing determining which interface you see after login.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, Vite, TypeScript | SPA with CSS Modules |
| Maps | React-Leaflet + OpenStreetMap | Interactive map with live markers |
| Backend | Express.js, Node.js | REST API + static file serving |
| Real-time | Socket.io | Live GPS tracking, trip state changes |
| Database | SQLite via Prisma ORM | Zero-config local development |
| Payments | Stripe (authorize & capture) | PCI-compliant card handling |
| Auth | JWT + bcrypt (12 rounds) | Stateless token-based auth |

---

## Project Structure

```
RideShare/
├── server/                 # Backend API
│   ├── src/
│   │   ├── routes/         # REST endpoints (auth, trips, users, webhooks)
│   │   ├── socket/         # Socket.io event handlers
│   │   ├── services/       # Stripe integration
│   │   ├── middleware/      # JWT auth middleware
│   │   └── lib/            # Prisma client, socket instance
│   └── prisma/
│       └── schema.prisma   # Database schema
├── rider-app/              # Frontend (serves both Rider + Driver UIs)
│   ├── src/
│   │   ├── pages/          # Login, Home, DriverHome, TripActive, Profile
│   │   ├── components/     # Map, BookingCard, TripRequest, PaymentForm
│   │   ├── hooks/          # useSocket, useTrip, useDriverLocation, useTheme
│   │   └── lib/            # Axios API client
│   └── index.html
├── run.py                  # One-command launcher
└── package.json            # Root scripts (concurrently runs both)
```

---

## Quick Start

### Prerequisites
- **Node.js** v18+ and npm
- **Python** 3.8+ (optional, for the launcher script)

### Option A: Automated (recommended)
```bash
python run.py
```
This installs all dependencies, creates the database, and starts both servers.

### Option B: Manual
```bash
# 1. Install dependencies
npm install                       # Root (concurrently)
cd server && npm install          # Backend
cd ../rider-app && npm install    # Frontend

# 2. Set up the database
cd server
npx prisma generate
npx prisma db push

# 3. Start both servers
cd ..
npm start
```

### Access
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API Server | http://localhost:3001 |
| Health Check | http://localhost:3001/health |

---

## How It Works

### Booking Flow (Rider)
1. Rider opens the app → sees a full-screen map centered on their location
2. Enters pickup and drop coordinates → gets fare estimates for Bike, Economy, Premium
3. Selects a vehicle → server creates a Trip + Stripe PaymentIntent
4. In dev mode: skips payment, goes straight to driver matching
5. In production: Stripe PaymentElement authorizes the card first
6. Socket broadcasts the trip request to nearby online drivers

### Matching Flow (Driver)
1. Driver toggles "Online" → sends GPS every 2 seconds via socket
2. Receives trip request overlay with 15-second auto-decline countdown
3. Accepts → Prisma's `updateMany` ensures only one driver can claim the trip (atomic)
4. Navigates to rider → starts trip → completes trip
5. Stripe captures the authorized payment on completion

### Theme System
The app supports dark and light themes via CSS custom properties. All colors use variables like `--text-primary`, `--bg-primary`, etc. Toggle is available on every page.

---

## Environment Variables

Create `server/.env` (auto-created by `run.py`):

```env
# Database (SQLite, no setup needed)
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="your-secret-key"

# Server
PORT=3001

# Stripe (optional — mock mode works without these)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
CORS_ORIGIN="http://localhost:5173"
```

> **Note:** Without Stripe keys, the app runs in mock payment mode — everything works, just no real card authorization.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account (rider/driver) |
| POST | `/api/auth/login` | No | Get JWT token |
| GET | `/api/trips/estimate` | Yes | Calculate fare for a route |
| POST | `/api/trips/book` | Yes | Create trip + payment intent |
| GET | `/api/trips/:id` | Yes | Get trip details |
| GET | `/api/users/me` | Yes | Get current user profile |
| PUT | `/api/users/me` | Yes | Update name/phone |
| PUT | `/api/users/me/password` | Yes | Change password |

---

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `trip:request` | Client → Server | Rider requests a trip |
| `trip:accept` | Client → Server | Driver accepts a trip |
| `trip:start` | Client → Server | Driver starts the trip |
| `trip:complete` | Client → Server | Driver completes the trip |
| `trip:cancel` | Client → Server | Cancel a trip |
| `trip:matched` | Server → Client | Trip matched with a driver |
| `trip:started` | Server → Client | Trip started |
| `trip:completed` | Server → Client | Trip completed |
| `driver:go_online` | Client → Server | Driver goes online |
| `driver:go_offline` | Client → Server | Driver goes offline |
| `driver:location` | Both | GPS coordinate updates |

---

## License

MIT
