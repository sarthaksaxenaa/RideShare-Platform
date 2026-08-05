<div align="center">
  <h1>🚗 RideShare Platform</h1>
  <p><strong>A full-stack real-time ride-booking platform built with Next.js, Express, Socket.io & PostgreSQL</strong></p>
  
  <p>
    <a href="https://rideshare-platform.vercel.app">🌐 Live Demo</a> •
    <a href="#features">✨ Features</a> •
    <a href="#tech-stack">🛠 Tech Stack</a> •
    <a href="#architecture">🏗 Architecture</a>
  </p>

  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Express-4.x-green?logo=express" />
  <img src="https://img.shields.io/badge/Socket.io-4.x-white?logo=socket.io" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" />
</div>

<br/>

## 📖 Overview

RideShare is a production-ready, full-stack ride-hailing platform designed to connect riders with drivers in real-time. It handles the entire ride lifecycle—from fare estimation and live driver tracking to secure payments and trip history. Built from the ground up to solve complex engineering challenges, the platform features sub-second location streaming via WebSocket rooms, PCI-compliant payments using Stripe, and enterprise-grade authentication with silent token refresh.

## 🌐 Live Demo

Experience the platform live: **[https://rideshare-platform.vercel.app](https://rideshare-platform.vercel.app)**

## ✨ Features

### 🚗 Ride Booking
- **Multi-Vehicle Support**: Choose between Auto, Sedan, SUV, or Premium rides.
- **Dynamic Fare Estimation**: Real-time fare calculation with integrated surge pricing models.
- **Promo Codes**: Real-time fare adjustments and discounts.
- **Stripe Payments**: Secure, PCI-compliant hold-and-capture payment flow.

### 📍 Real-time Tracking
- **Live Interactive Map**: Powered by React Leaflet and OpenStreetMap.
- **Driver Location**: Sub-second GPS coordinate streaming over WebSockets.
- **Live ETA**: Accurate time-to-arrival estimations during pickup and trip.

### 💬 Communication & Safety
- **In-App Chat**: Real-time communication between riders and drivers.
- **Emergency SOS**: Live location sharing and one-tap emergency alerts.
- **Call Driver**: Direct calling integration.

### 👤 User Management
- **Role-Based Authentication**: Distinct experiences for Riders, Drivers, and Admins.
- **Secure Auth Flow**: HttpOnly cookies with silent JWT refresh token rotation.
- **Profile Management**: Manage saved places, emergency contacts, and ride history.
- **OTP Reset**: Secure password recovery workflow.

### 🚘 Driver Features
- **Earnings Dashboard**: Track daily and weekly revenue.
- **Online Timer**: Toggle availability and track active hours.
- **Ride OTP Verification**: Ensure passenger safety with ride-start PINs.
- **Vehicle Profile**: Manage vehicle make, model, and registration details.

### 🛡️ Admin Panel
- **User Management**: Search, filter, edit, and delete users.
- **Driver Verification**: Review and approve driver registrations.
- **Promo Code Management**: Create and track discount codes.
- **Platform Analytics**: Revenue tracking and system monitoring.

### 📱 PWA Support
- **Installable**: Add to home screen functionality.
- **Offline Mode**: Custom offline fallback page.
- **Network-First Strategy**: Cached app shell for faster loading.

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
    User ||--o{ Trip : "rides as rider"
    User ||--o{ Trip : "drives as driver"
    User ||--o{ Rating : "gives rating"
    User ||--o{ Rating : "receives rating"
    User ||--o{ SavedLocation : "has saved places"
    User ||--o{ EmergencyContact : "has contacts"
    Trip ||--o| Rating : "has rating"

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
        string paymentStatus "PENDING | PAID"
        string rideOtp
        datetime createdAt
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
| `POST` | `/api/auth/reset-password` | Initiate password reset flow |

### Users
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/users/me` | Retrieve current user profile |
| `PUT` | `/api/users/me` | Update user profile details |
| `GET` | `/api/users/me/locations` | Get user saved locations |

### Trips
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/trips/estimate` | Calculate fare estimates |
| `POST` | `/api/trips/book` | Create new trip & Stripe intent |
| `GET` | `/api/trips/:id` | Retrieve specific trip details |
| `GET` | `/api/trips/history` | Get user trip history |

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
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key for signing tokens | `your-super-secret-jwt-key` |
| `STRIPE_SECRET_KEY`| Stripe API secret | `sk_test_...` |
| `NEXT_PUBLIC_API_URL`| Backend URL | `http://localhost:3001` |
| `PORT` | Backend port number | `3001` |

## 🚀 Deployment

- **Frontend**: Hosted on **Vercel** with optimized Edge caching and Server Actions.
- **Backend**: Hosted on **Render** (or Railway) for robust WebSocket support and scalable Express APIs.
- **Database**: Managed on **Neon**, leveraging serverless PostgreSQL for automatic scaling.

## 📁 Project Structure

```text
RideShare-Platform/
├── rider-app/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/                  # App Router & Pages
│   │   ├── components/           # Reusable UI components
│   │   ├── stores/               # Zustand state management
│   │   └── lib/                  # Utilities and API clients
│   └── public/                   # Static assets & PWA files
├── server/                       # Node.js/Express Backend
│   ├── src/
│   │   ├── routes/               # REST API endpoints
│   │   ├── socket/               # WebSocket event handlers
│   │   ├── middleware/           # Auth and security middlewares
│   │   └── lib/                  # Helpers and Prisma setup
│   └── prisma/                   # Database schema
└── README.md
```

## 📸 Screenshots

> *Add application screenshots here to showcase the beautiful UI and features.*
> 
> * [Home/Landing Page]
> * [Ride Booking Map View]
> * [Driver Dashboard]
> * [Trip History]

## 🤝 Contributing

Contributions are always welcome! 

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
