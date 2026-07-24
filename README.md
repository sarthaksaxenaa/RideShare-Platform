<div align="center">
  <img src="./docs/banner.jpg" alt="RideShare Platform Banner" width="100%" />
  
  <br />
  <br />

  <h1>🚗 RideShare Platform</h1>
  <p><strong>A production-grade, real-time ride-hailing platform built from scratch.</strong></p>
  <p>Real-time GPS tracking • Stripe payments • WebSocket matching • PostgreSQL • JWT refresh tokens</p>

  <br />

  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"></a>
    <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma"></a>
    <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"></a>
    <a href="https://stripe.com/"><img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe"></a>
  </p>

  <p>
    <img src="https://img.shields.io/github/stars/sarthaksaxenaa/RideShare-Platform?style=social" alt="Stars">
    <img src="https://img.shields.io/github/forks/sarthaksaxenaa/RideShare-Platform?style=social" alt="Forks">
    <img src="https://img.shields.io/github/last-commit/sarthaksaxenaa/RideShare-Platform?color=blue" alt="Last Commit">
    <img src="https://img.shields.io/github/languages/top/sarthaksaxenaa/RideShare-Platform?color=blue" alt="Top Language">
    <img src="https://img.shields.io/github/repo-size/sarthaksaxenaa/RideShare-Platform" alt="Repo Size">
  </p>

  <br />

  <p>
    <a href="#-features">Features</a> •
    <a href="#-system-architecture">Architecture</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-security">Security</a> •
    <a href="#-database-schema">Database</a>
  </p>
</div>

<br />

---

## 🎯 What Is This?

RideShare is a **full-stack ride-hailing platform** (like Uber/Ola) built entirely from scratch — no templates, no starters. It handles everything from user authentication to real-time GPS tracking to payment processing.

This isn't a tutorial project. It solves **real engineering problems**:

- 🏎️ **Race condition handling** when multiple drivers accept the same ride
- 📡 **Sub-second location streaming** via WebSocket rooms
- 💳 **PCI-compliant payments** using Stripe's authorize-then-capture flow
- 🔐 **Enterprise-grade auth** with HttpOnly cookies + refresh token rotation
- 🗄️ **Cloud PostgreSQL** with Prisma ORM on Neon (serverless)

<br />

## ✨ Features

<table>
<tr>
<td width="50%">

### 🧑‍💼 For Riders
- 📍 Live GPS tracking on interactive map
- 🚘 Multiple vehicle types (Auto, Sedan, SUV, Premium)
- 💰 Dynamic fare estimation with surge pricing
- 🎫 Promo code system with real-time fare adjustment
- 📜 Complete trip history with ratings
- 🆘 Emergency SOS with live location sharing
- 📞 Emergency contacts management
- 🌙 Dark mode support
- 📍 Saved locations (Home, Work, etc.)

</td>
<td width="50%">

### 🚗 For Drivers
- 🔔 Real-time ride request notifications
- ✅ Accept/reject ride requests
- 🗺️ Turn-by-turn navigation to pickup & drop
- 📊 Earnings dashboard
- 🔑 Ride OTP verification for safety
- 📍 Live location broadcasting
- 🟢 Online/Offline toggle
- 🏷️ Vehicle management (model, number, type)

</td>
</tr>
<tr>
<td width="50%">

### 👨‍💼 For Admins
- 📊 Platform analytics dashboard
- 👥 User management (view, edit, delete)
- 🚕 All trips monitoring
- 💵 Revenue tracking
- 🔍 Search & filter users
- 🛡️ Role-based access control

</td>
<td width="50%">

### 🔧 Engineering
- ⚡ Real-time WebSocket event system
- 🔄 Silent token refresh (zero-downtime auth)
- 🛡️ Rate limiting on all endpoints
- 🧩 Error boundaries + loading skeletons
- 📱 Fully responsive (mobile-first)
- 🩺 Health check endpoint
- ♻️ Graceful server shutdown (SIGTERM)

</td>
</tr>
</table>

<br />

## 🏗 System Architecture

```mermaid
graph TB
    subgraph "Frontend — Next.js 16"
        UI["🖥️ React UI<br/>(App Router + Turbopack)"]
        Store["📦 Zustand Store<br/>(Auth + Trip State)"]
        WS["⚡ Socket.io Client<br/>(withCredentials: true)"]
    end

    subgraph "Backend — Node.js + Express"
        API["🔌 REST API<br/>(Express + Helmet)"]
        Auth["🔐 Auth Middleware<br/>(HttpOnly Cookie → JWT)"]
        Socket["📡 Socket.io Server<br/>(Rooms + Namespaces)"]
        Rate["🛡️ Rate Limiter"]
    end

    subgraph "Infrastructure"
        DB[("🐘 PostgreSQL<br/>(Neon Serverless)")]
        Stripe["💳 Stripe API<br/>(Hold & Capture)"]
        OSRM["🗺️ OSRM API<br/>(Route Polylines)"]
    end

    UI <-->|"HTTP + Cookies"| API
    UI <-->|"WebSocket + Cookies"| Socket
    Store --- UI
    WS --- UI
    API --- Auth
    Socket --- Auth
    API --- Rate
    API <--> DB
    Socket <--> DB
    API <--> Stripe
    UI <--> OSRM
```

### Request Flow

```
📱 User Action
    ↓
🔐 HttpOnly Cookie sent automatically
    ↓
🛡️ Rate Limiter (100 req/15min)
    ↓
🔑 JWT Middleware (cookie → verify → req.user)
    ↓  
🎯 Route Handler
    ↓
🐘 Prisma ORM → PostgreSQL (Neon)
    ↓
📤 JSON Response + Set-Cookie (if auth)
```

<br />

## 💻 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router + Turbopack |
| **TypeScript** | Type safety across the entire codebase |
| **Zustand** | Lightweight state management with persist middleware |
| **Socket.io Client** | Real-time bidirectional WebSocket communication |
| **React Leaflet** | Interactive maps with OpenStreetMap tiles |
| **Framer Motion** | Smooth animations and page transitions |
| **Tailwind CSS** | Utility-first styling with dark mode |
| **Axios** | HTTP client with refresh token interceptor |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express** | REST API server with modular routing |
| **Socket.io** | WebSocket server for real-time events |
| **Prisma ORM** | Type-safe database queries + migrations |
| **PostgreSQL (Neon)** | Serverless cloud database (AWS Singapore) |
| **JWT + bcrypt** | HttpOnly cookie auth + password hashing (12 rounds) |
| **Helmet.js** | Security HTTP headers (11+ protections) |
| **Stripe SDK** | Payment processing with hold-and-capture |
| **express-rate-limit** | Brute-force and DDoS protection |

<br />

## 🔐 Security

This project implements **production-grade security** — not just basic auth:

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔒 Layer 1: HttpOnly Cookies                           │
│     └─ JWT stored in HttpOnly cookie                    │
│     └─ JavaScript CANNOT read it (XSS-proof)           │
│                                                         │
│  🔄 Layer 2: Refresh Token Rotation                     │
│     └─ Access Token:  15 min (short-lived)              │
│     └─ Refresh Token: 7 days (restricted path)          │
│     └─ Silent auto-refresh via axios interceptor        │
│                                                         │
│  🔑 Layer 3: Password Security                          │
│     └─ bcrypt hashing with 12 salt rounds               │
│     └─ Passwords are NEVER stored in plaintext          │
│                                                         │
│  🛡️ Layer 4: HTTP Security Headers (Helmet.js)          │
│     └─ X-Content-Type-Options: nosniff                  │
│     └─ X-Frame-Options: DENY (anti-clickjacking)       │
│     └─ Strict-Transport-Security (force HTTPS)          │
│                                                         │
│  ⏱️ Layer 5: Rate Limiting                               │
│     └─ Auth routes: 20 req/15min                        │
│     └─ General API: 100 req/15min                       │
│                                                         │
│  🎭 Layer 6: Role-Based Access Control                  │
│     └─ RIDER, DRIVER, ADMIN roles                       │
│     └─ Server validates role on every request           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Auth Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as PostgreSQL

    C->>S: POST /api/auth/login {email, password}
    S->>DB: Find user by email
    DB-->>S: User record (with bcrypt hash)
    S->>S: bcrypt.compare(password, hash)
    S-->>C: Set-Cookie: jwt (15min) + jwt_refresh (7 days)
    
    Note over C,S: 15 minutes later...
    
    C->>S: GET /api/trips (jwt cookie expired)
    S-->>C: 401 Unauthorized
    C->>S: POST /api/auth/refresh (jwt_refresh cookie)
    S->>DB: Verify user still exists
    S-->>C: Set-Cookie: jwt (new 15min token)
    C->>S: GET /api/trips (retry with new token)
    S-->>C: 200 OK ✅
```

<br />

## 🗄️ Database Schema

```mermaid
erDiagram
    User ||--o{ Trip : "rides as rider"
    User ||--o{ Trip : "drives as driver"
    User ||--o{ Rating : "gives rating"
    User ||--o{ Rating : "receives rating"
    User ||--o{ SavedLocation : "has saved places"
    User ||--o{ EmergencyContact : "has contacts"
    User ||--o| DriverLocation : "has live location"
    Trip ||--o| Rating : "has rating"

    User {
        uuid id PK
        string email UK
        string password "bcrypt hashed"
        string name
        string role "RIDER | DRIVER | ADMIN"
        string phone
        string avatarUrl
        string vehicleModel
        string vehicleNumber
        datetime createdAt
    }

    Trip {
        uuid id PK
        string status "REQUESTED → MATCHED → STARTED → COMPLETED"
        uuid riderId FK
        uuid driverId FK
        float pickupLat
        float pickupLng
        float dropLat
        float dropLng
        float distanceKm
        int fare
        string vehicleType
        string paymentStatus "PENDING | PAID"
        string rideOtp
        datetime createdAt
    }

    Rating {
        uuid id PK
        uuid tripId FK
        int stars "1-5"
        string comment
        string tags
    }
```

<br />

## 🚦 Quick Start

### Prerequisites
- **Node.js** v18+ 
- **Python** v3.8+ (for the launcher)

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/sarthaksaxenaa/RideShare-Platform.git
cd RideShare-Platform

# Run the automated launcher
python run.py
```

The launcher automatically:
1. ✅ Installs all NPM dependencies
2. ✅ Generates `.env` with secure defaults
3. ✅ Sets up Prisma Client and database schema
4. ✅ Boots both servers concurrently

### Manual Setup

```bash
# 1. Install dependencies
cd server && npm install
cd ../rider-app && npm install

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL and JWT_SECRET

# 3. Setup database
cd server
npx prisma db push
npx prisma generate

# 4. Start development servers
npm run dev          # Start backend (port 3001)
cd ../rider-app
npm run dev          # Start frontend (port 3000)
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 Web App | http://localhost:3000 | Next.js frontend |
| 🔌 API Server | http://localhost:3001 | Express + Socket.io |
| 🩺 Health Check | http://localhost:3001/health | Server status |

<br />

## 📖 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Create account → sets HttpOnly cookies |
| `POST` | `/api/auth/login` | ❌ | Login → sets access + refresh cookies |
| `POST` | `/api/auth/refresh` | 🍪 | Refresh access token using refresh cookie |
| `POST` | `/api/auth/logout` | 🍪 | Clear both auth cookies |
| `POST` | `/api/auth/reset-password` | ❌ | Reset password by email |

### Trips

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/trips/estimate` | 🔐 | Calculate fare estimates for route |
| `POST` | `/api/trips/book` | 🔐 | Create trip + Stripe PaymentIntent |
| `GET` | `/api/trips/:id` | 🔐 | Get trip details |
| `GET` | `/api/trips/history` | 🔐 | Paginated trip history |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/users/me` | 🔐 | Current user profile |
| `PUT` | `/api/users/me` | 🔐 | Update profile |
| `PUT` | `/api/users/me/password` | 🔐 | Change password |
| `GET` | `/api/users/me/emergency-contacts` | 🔐 | List emergency contacts |
| `GET` | `/api/users/me/saved-locations` | 🔐 | List saved places |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `trip:request` | Client → Server | Rider requests a ride |
| `trip:matched` | Server → Client | Driver assigned to trip |
| `trip:accept` | Client → Server | Driver accepts ride request |
| `trip:start` | Client → Server | Driver confirms pickup (OTP verified) |
| `trip:complete` | Client → Server | Driver completes drop-off |
| `trip:cancel` | Bidirectional | Either party cancels the trip |
| `driver:location` | Client → Server | Driver streams GPS coordinates |
| `driver:location_update` | Server → Client | Rider receives driver position |
| `driver:disconnected` | Server → Client | Driver went offline mid-trip |

<br />

## 📁 Project Structure

```
RideShare-Platform/
├── rider-app/                    # Next.js 16 Frontend
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── dashboard/        # Authenticated pages
│   │   │   │   ├── admin/        # Admin panel
│   │   │   │   ├── driver/       # Driver-specific views
│   │   │   │   ├── history/      # Trip history
│   │   │   │   └── profile/      # User profile
│   │   │   ├── login/            # Authentication
│   │   │   ├── sitemap.ts        # Dynamic SEO sitemap
│   │   │   ├── robots.ts         # Dynamic robots.txt
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/           # Reusable UI components
│   │   │   ├── booking/          # Ride booking flow
│   │   │   ├── layout/           # Navbar, sidebar
│   │   │   ├── map/              # Map & tracking
│   │   │   └── trip/             # Trip cards & status
│   │   ├── stores/               # Zustand state management
│   │   └── lib/                  # API client, socket, utils
│   └── public/                   # Static assets
│
├── server/                       # Express.js Backend
│   ├── src/
│   │   ├── routes/               # API route handlers
│   │   │   ├── auth.ts           # Register, Login, Refresh, Logout
│   │   │   ├── trips.ts          # Booking, estimates, history
│   │   │   └── users.ts          # Profile, contacts, locations
│   │   ├── socket/               # WebSocket handlers
│   │   │   ├── index.ts          # Socket auth + connection
│   │   │   ├── driverHandlers.ts # Driver location, online/offline
│   │   │   └── tripHandlers.ts   # Trip lifecycle events
│   │   ├── middleware/           # Auth, rate limiting
│   │   └── lib/                  # Prisma client, helpers
│   └── prisma/
│       └── schema.prisma         # Database schema
│
├── run.py                        # One-command launcher
└── README.md
```

<br />

## 🔧 Environment Variables

### Server (`server/.env`)

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Authentication
JWT_SECRET=your-64-char-random-string
JWT_EXPIRES_IN=7d

# Server
PORT=3001

# Stripe (optional — app works without it in mock mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
CORS_ORIGIN=http://localhost:3000
```

<br />

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br />

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

<br />

---

<div align="center">
  <p><strong>Built with ❤️ by <a href="https://github.com/sarthaksaxenaa">Sarthak Saxena</a></strong></p>
  <p><em>If you found this useful, consider giving it a ⭐</em></p>
  
  <br />
  
  <p>
    <a href="https://github.com/sarthaksaxenaa"><img src="https://img.shields.io/badge/GitHub-sarthaksaxenaa-181717?style=for-the-badge&logo=github" alt="GitHub"></a>
    <a href="https://linkedin.com/in/sarthaksaxenaa"><img src="https://img.shields.io/badge/LinkedIn-sarthaksaxenaa-0A66C2?style=for-the-badge&logo=linkedin" alt="LinkedIn"></a>
  </p>
</div>
