<div align="center">
  <h1>🚗 RideShare Platform</h1>
  <p><strong>A full-stack real-time ride-booking platform built with Next.js, Express, Socket.io & PostgreSQL</strong></p>
  
  <p>
    <a href="https://rideshare-platform.vercel.app">🌐 Live Demo</a> •
    <a href="#features">✨ Features</a> •
    <a href="#tech-stack">🛠 Tech Stack</a> •
    <a href="#architecture">🏗 Architecture</a>
  </p>

  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Express-4.x-green?logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Socket.io-4.x-white?logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
</div>

<br/>

## 📖 Overview

RideShare is a production-ready, full-stack ride-hailing platform designed to connect riders with drivers in real-time. It handles the entire ride lifecycle—from fare estimation and live driver tracking to secure payments and trip history. Built from the ground up to solve complex engineering challenges, the platform features sub-second location streaming via WebSocket rooms, PCI-compliant payments using Stripe, and enterprise-grade authentication with silent token refresh.

## 🌐 Live Demo

Experience the platform live: **[https://rideshare-platform.vercel.app](https://rideshare-platform.vercel.app)**

## ✨ Features

### 🚗 Ride Booking
- **Multi-Vehicle Support**: Choose between Bike, Auto, Sedan, or SUV with icons.
- **Dynamic Fare Estimation**: Real-time fare calculation using Haversine formula + road factor.
- **Surge Pricing**: Peak hours (1.3x), late night (1.5x), weekend (1.4x).
- **Promo Codes**: Database-driven promo codes with admin CRUD.
- **Ride Scheduling**: Book rides up to 7 days in advance.
- **Fare Split**: Share fares using WhatsApp/Web Share API.
- **Cancellation Fees**: Free < 1min, ₹25 before driver arrives, ₹50 after trip starts.

### 📍 Real-time Tracking
- **Live Driver Location**: Sub-second GPS coordinate streaming over Socket.io.
- **Animated Route Polyline**: Powered by OSRM routing API.
- **Driver ETA**: Accurate time-to-arrival calculations via OSRM.
- **Locate on Map**: Click to set exact pickup/drop locations.
- **Multi-source Geocoding**: Powered by Nominatim and Photon.

### 💬 Communication & Safety
- **In-App Chat**: Real-time rider ↔ driver messaging during trips.
- **Call Driver**: Direct calling integration using `tel:` link.
- **Emergency SOS**: Live location sharing and one-tap emergency call buttons.
- **In-App Notifications**: Notification center with bell icon and auto-alerts on trip events.

### 🔐 Authentication & Security
- **JWT + HttpOnly Cookies**: Secure stateless authentication flow.
- **Email OTP Password Reset**: 6-digit PIN with a 3-step secure flow.
- **Role-Based Access**: Distinct permissions for Rider, Driver, and Admin.
- **Rate Limiting**: Auth (10/15min), API (60/min), Uploads (5/min).
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, XSS Protection.
- **Input Sanitization**: Comprehensive HTML tag stripping.
- **Referral System**: Invite friends to earn credits (₹50 for referrer, ₹30 for referee).

### 🚘 Driver Features
- **Earnings Dashboard**: CSS bar charts displaying daily/weekly/monthly revenue.
- **Online Timer**: Elapsed time tracking for active shifts.
- **Driver Profile Card**: Detailed view with vehicle info, masked Aadhaar, and face photo.
- **Approval Workflow**: Admin approval pipeline (PENDING → APPROVED/REJECTED).
- **Comprehensive Onboarding**: Signup requires Aadhaar, phone, and 2-5 vehicle photos.

### 🛡️ Admin Panel
- **User Management**: View all users across roles and delete if necessary.
- **Promo Code Management**: Create, toggle, and delete discount codes.
- **Document Verification**: Viewer for driver face photos, vehicle images, and Aadhaar.
- **Application Review**: Approve or reject new driver applications.

### 📄 Trip Experience
- **Detailed Trip Receipt**: Fare breakdown including base fare + distance + time + platform fee.
- **Downloadable Receipt**: Print-optimized PDF receipts for expense tracking.
- **Trip History**: Comprehensive logs with "View Receipt" links.
- **Custom 404 Page**: Engaging error page with animations.

### ⚙️ Technical Highlights
- **PWA Ready**: Installable app with offline caching and service worker support.
- **Socket UI Resiliency**: Connection lost banner and auto-reconnection UI.
- **Dark Mode**: Fully supported and persisted to localStorage.
- **Responsive Design**: Mobile-first architecture.
- **TypeScript**: End-to-end type safety across the stack.
- **Database**: Prisma ORM with PostgreSQL hosted on Neon.

### 🚀 Deployment
- **Frontend**: Deployed on Vercel (https://rideshare-platform.vercel.app).
- **Backend**: Hosted on Render with auto-deploy from GitHub.
- **Database**: Serverless PostgreSQL on Neon.

## 🛠 Tech Stack

| Domain | Technology | Description |
|--------|------------|-------------|
| **Frontend** | Next.js 16 (App Router), TypeScript, Zustand, Tailwind CSS | High-performance React framework with lightweight state management. |
| **Backend** | Node.js, Express, Socket.io, TypeScript | Robust REST API server with real-time bidirectional WebSocket events. |
| **Database** | PostgreSQL (Neon), Prisma ORM | Serverless cloud relational database with type-safe queries. |
| **Security** | Helmet.js, bcrypt, JWT | HttpOnly cookie auth, brute-force protection, and HTTP security headers. |
| **Deployment** | Vercel (Frontend), Render/Railway (Backend) | Scalable cloud hosting and CI/CD pipelines. |

## 🏗 Architecture

```mermaid
graph TB
    subgraph "Frontend — Next.js 16"
        UI["🖥️ React UI<br/>(App Router)"]
        Store["📦 Zustand Store<br/>(Auth + State)"]
        WS["⚡ Socket.io Client"]
    end

    subgraph "Backend — Node.js + Express"
        API["🔌 REST API<br/>(Express + Helmet)"]
        Auth["🔐 Auth Middleware"]
        Socket["📡 Socket.io Server"]
        Rate["🛡️ Rate Limiter"]
    end

    subgraph "Infrastructure"
        DB[("🐘 PostgreSQL<br/>(Neon Serverless)")]
        Stripe["💳 Stripe API"]
        OSRM["🗺️ OSRM API"]
    end

    UI <-->|"HTTP + Cookies"| API
    UI <-->|"WebSocket"| Socket
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

## 🗄️ Database Schema

```mermaid
erDiagram
    User ||--o{ Trip : "rides / drives"
    User ||--o{ Rating : "gives / receives"
    User ||--o{ SavedLocation : "manages"
    User ||--o{ EmergencyContact : "has"
    User ||--o{ Notification : "receives"
    User ||--o{ Referral : "refers"
    Trip ||--o| Rating : "rated by"
    Trip ||--o{ Message : "contains chat"
    Trip ||--o{ FareSplit : "has splits"
    Trip ||--o| DriverLocation : "tracked via"
    User ||--o{ OTP : "requests"
    
    User {
        uuid id PK
        string email UK
        string password
        string name
        string role "RIDER | DRIVER | ADMIN"
        string phone
        string avatarUrl
        string vehicleModel
        string vehicleNumber
        string aadhaarMasked
        string status "PENDING | APPROVED | REJECTED"
        datetime createdAt
    }

    Trip {
        uuid id PK
        string status "REQUESTED | MATCHED | STARTED | COMPLETED | CANCELLED"
        uuid riderId FK
        uuid driverId FK
        float pickupLat
        float pickupLng
        float dropLat
        float dropLng
        float distanceKm
        int fare
        string vehicleType
        string paymentStatus
        string rideOtp
        datetime scheduledTime
        datetime createdAt
    }

    PromoCode {
        uuid id PK
        string code UK
        float discountPercentage
        float maxDiscount
        boolean isActive
    }

    Message {
        uuid id PK
        uuid tripId FK
        uuid senderId FK
        string content
        datetime timestamp
    }

    Notification {
        uuid id PK
        uuid userId FK
        string title
        string body
        boolean isRead
        datetime createdAt
    }

    DriverLocation {
        uuid id PK
        uuid tripId FK
        float lat
        float lng
        datetime timestamp
    }

    EmergencyContact {
        uuid id PK
        uuid userId FK
        string name
        string phone
    }

    SavedLocation {
        uuid id PK
        uuid userId FK
        string label
        float lat
        float lng
    }

    FareSplit {
        uuid id PK
        uuid tripId FK
        uuid requestedBy FK
        string status
    }

    Referral {
        uuid id PK
        uuid referrerId FK
        uuid refereeId FK
        string status
    }

    OTP {
        uuid id PK
        string email
        string pin
        datetime expiresAt
    }

    Rating {
        uuid id PK
        uuid tripId FK
        int stars
        string comment
    }
```

## 🔌 API Endpoints

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Authenticate and set HttpOnly cookies |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Clear authentication cookies |
| `POST` | `/api/auth/reset-password/request` | Step 1: Request Email OTP |
| `POST` | `/api/auth/reset-password/verify` | Step 2: Verify 6-digit PIN |
| `POST` | `/api/auth/reset-password/confirm` | Step 3: Set new password |

### Users
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/users/me` | Retrieve current user profile |
| `PUT` | `/api/users/me` | Update user profile details |
| `GET` | `/api/users/me/locations` | Get user saved locations |
| `POST` | `/api/users/referral` | Generate/redeem referral code |

### Trips
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/trips/estimate` | Calculate fare estimates (Haversine + surge) |
| `POST` | `/api/trips/book` | Create new trip / schedule ride |
| `GET` | `/api/trips/:id` | Retrieve specific trip details |
| `GET` | `/api/trips/history` | Get user trip history |
| `GET` | `/api/trips/:id/receipt` | Download printable trip receipt |

### Admin
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `DELETE` | `/api/admin/users/:id` | Delete user account |
| `GET` | `/api/admin/drivers/pending`| View pending driver applications |
| `PUT` | `/api/admin/drivers/:id/approve`| Approve/reject driver |
| `POST` | `/api/admin/promo-codes` | Create new promo code |

### Emergency & Communication
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/emergency/sos` | Trigger SOS and alert contacts |
| `GET` | `/api/emergency/contacts` | List emergency contacts |

## 📡 Socket Events

| Event Name | Direction | Description |
|------------|-----------|-------------|
| `trip:request` | Client → Server | Rider initiates a new ride request |
| `trip:matched` | Server → Client | Driver is successfully assigned to a trip |
| `trip:accept` | Client → Server | Driver accepts an incoming ride request |
| `trip:start` | Client → Server | Driver starts trip (post OTP verification) |
| `trip:complete` | Client → Server | Driver marks trip as completed |
| `trip:cancel` | Bidirectional | Trip cancelled by rider or driver |
| `driver:location` | Client → Server | Driver broadcasts live GPS coordinates |
| `driver:location_update`| Server → Client | Rider receives driver's updated position |
| `chat:send` | Client → Server | Send in-app message to ride participant |
| `chat:receive` | Server → Client | Receive incoming message |
| `notification:receive` | Server → Client | Receive system alert/notification |

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Stripe Account (Optional)

### Local Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/sarthaksaxenaa/RideShare-Platform.git
   cd RideShare-Platform
   ```

2. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../rider-app && npm install
   ```

3. **Configure Environment Variables**
   Copy `.env.example` to `.env` in both `server/` and `rider-app/` directories and fill in the values.

4. **Database Setup**
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1 (Backend)
   cd server && npm run dev
   
   # Terminal 2 (Frontend)
   cd rider-app && npm run dev
   ```

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon) | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key for signing tokens | `your-super-secret-jwt-key` |
| `STRIPE_SECRET_KEY`| Stripe API secret for payments | `sk_test_...` |
| `NEXT_PUBLIC_API_URL`| Backend API URL | `http://localhost:3001` |
| `PORT` | Backend port number | `3001` |
| `OSRM_API_URL` | OpenSRM routing API URL | `http://router.project-osrm.org` |
| `GEOCODING_API_URL`| Nominatim/Photon Geocoding URL | `https://nominatim.openstreetmap.org` |
| `SMTP_HOST` | Email OTP provider SMTP host | `smtp.mailgun.org` |

## 📁 Project Structure

```text
RideShare-Platform/
├── rider-app/                    # Next.js Frontend (PWA)
│   ├── src/
│   │   ├── app/                  # App Router, Pages, and custom 404
│   │   ├── components/           # Reusable UI components & Icons
│   │   ├── stores/               # Zustand state management
│   │   └── lib/                  # Utilities, API clients, Haversine
│   ├── public/                   # Static assets & PWA manifest/Service Worker
│   └── next.config.mjs           # Next.js config
├── server/                       # Node.js/Express Backend
│   ├── src/
│   │   ├── routes/               # REST API endpoints (Auth, Trips, Admin)
│   │   ├── socket/               # WebSocket event handlers & Rooms
│   │   ├── middleware/           # Auth, Security, Rate Limiters
│   │   └── lib/                  # Helpers and Prisma setup
│   └── prisma/                   # Database schema (Models)
└── README.md                     # Documentation
```

## 📸 Screenshots

> *Add application screenshots here to showcase the beautiful UI and features.*
> 
> * [Home/Landing Page]
> * [Ride Booking Map View]
> * [Driver Dashboard]
> * [Trip History & Receipt]
> * [Admin Panel]

## 🤝 Contributing

Contributions are always welcome! 

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
