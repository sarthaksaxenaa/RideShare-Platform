<div align="center">
  <img src="https://img.icons8.com/color/96/000000/taxi.png" alt="RideShare Logo" width="80" />
  <h1>RideShare Platform</h1>
  <p><strong>A production-ready, real-time ride-hailing monorepo architecture.</strong></p>

  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma"></a>
  <a href="https://stripe.com/"><img src="https://img.shields.io/badge/Stripe-626CD9?style=for-the-badge&logo=Stripe&logoColor=white" alt="Stripe"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
</div>

<br />

The RideShare Platform is a comprehensive, full-stack monorepo demonstrating modern web architecture patterns. It facilitates real-time ride booking, GPS tracking, and secure financial transactions through concurrent Rider and Driver applications powered by a Node.js/Socket.io backend.

---

## ⚡ Core Capabilities

- **Real-Time Event Streaming**: Sub-second GPS synchronization and state-machine transitions powered by Socket.io.
- **Privacy-First WebSockets**: Drivers broadcast raw GPS coordinates exclusively to their assigned `trip:{id}` room, preventing location leaks.
- **Atomic Concurrency**: Prisma `updateMany` constraints prevent double-booking race conditions when multiple drivers attempt to accept the same trip simultaneously.
- **PCI-Compliant Payments**: Stripe Elements handles card collection, using an authorize-and-capture flow that only charges the rider upon successful trip completion.
- **Interactive Mapping**: React-Leaflet integration with OpenStreetMap tiles, dynamic center point tracking, and custom localized markers.

---

## 🛠️ Monorepo Architecture

This project strictly adheres to a domain-driven monorepo structure, ensuring type-safety boundaries and synchronized deployments.

```mermaid
graph TD
    Client_Rider[Rider App<br/>React + Vite]
    Client_Driver[Driver App<br/>React + Vite]
    
    sublayer_gateway[Socket.io + Express API<br/>Node.js Engine]
    
    Client_Rider <-->|WebSockets & REST| sublayer_gateway
    Client_Driver <-->|WebSockets & REST| sublayer_gateway
    
    sublayer_gateway <--> DB[(PostgreSQL + Prisma)]
    sublayer_gateway <--> Stripe[Stripe Payment Gateway]
```

### 1. `server/` (Backend Engine)
- **Framework**: Express.js + Node.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Stateless JWT via HTTP headers
- **Real-time**: Socket.io middleware validating JWTs on handshake

### 2. `rider-app/` (Consumer Client)
- **Framework**: React 18 + Vite
- **UI Architecture**: Glassmorphism CSS Modules, protected routing via React Router DOM
- **Key Hooks**: `useSocket` (persistent connection), `useTrip` (client-side state machine tracking idle -> matched -> completed)

### 3. `driver-app/` (Provider Client)
- **Framework**: React 18 + Vite
- **Tracking**: `useLocation` hook utilizing `navigator.geolocation.watchPosition` with throttled 2-second socket emissions.
- **Experience**: 15-second auto-dismissing trip request overlays, earnings dashboard, and online/offline availability toggles.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+ LTS)
- PostgreSQL (v14+)
- Stripe Test Account keys

### 1. Installation
Clone the repository and install the monorepo dependencies:
```bash
npm install
```

### 2. Environment Configuration
Create `.env` files based on the provided examples.
- `server/.env`: Requires `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`
- `rider-app/.env`: Requires `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`
- `driver-app/.env`: Requires `VITE_API_URL`, `VITE_SOCKET_URL`

### 3. Database Initialization
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Bootstrapping
Launch the entire stack concurrently from the root directory:
```bash
npm start
```
The services will be available at:
- **API Server**: `http://localhost:3001`
- **Rider Client**: `http://localhost:5173`
- **Driver Client**: `http://localhost:5174`

---

## 📖 Iteration History

1. **Phase 1: Scaffolding & Auth**: Monorepo structure, Express + React Vite setups, JWT + bcrypt authentication.
2. **Phase 2: Data Modeling**: Prisma schema implementation (User, Trip, DriverLocation), REST endpoints, and Haversine distance-based driver matching algorithms.
3. **Phase 3: Real-Time Logistics**: Socket.io integration, driver tracking hooks, atomic database updates, Leaflet map implementation.
4. **Phase 4: Financial Security**: Stripe authorization-capture pipeline, webhook signature verification, React Stripe Elements integration.

---
<div align="center">
  <i>Engineered for scale, speed, and real-time reliability.</i>
</div>
