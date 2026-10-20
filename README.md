# Weyro 🚗🔧

> **Next-generation automotive marketplace connecting vehicle owners with verified mechanics, garages, and spare-parts dealers nationwide.**

---

## 📌 Overview

**Weyro** is an asset-light automotive platform engineered to eliminate repair friction, opaque pricing, and part-sourcing bottlenecks. Vehicle owners report mechanical issues or vehicle damage, and our broadcast dispatch engine distributes the request across garages and parts distributors without arbitrary distance or time barriers.

### Key Capabilities

- **📸 Car Damage Photo Broadcast**: Vehicle owners snap a photo of damaged components (e.g. bumpers, headlights, cooling systems). The request is broadcast nationwide to verified mechanics and spare-parts dealers regardless of geographic distance.
- **⚡ Competitive Multi-Bid Quotations**: Mechanics and parts dealers inspect damage photos, supply availability, and submit binding quotations specifying parts cost, labour, component grade (`OEM`, `AFTERMARKET`, `USED`), and delivery ETA.
- **💬 Real-Time In-App Chat**: Customers negotiate directly with quoting providers to verify VIN compatibility, request component close-ups, and clarify fitment.
- **📦 Direct Booking & Escrow Protection**: Customers compare competing offers side-by-side, choose their preferred fulfillment (Parts Courier, Garage Visit, or On-Site Fitment), and confirm bookings with milestone tracking.

---

## 🏗️ Architecture & Technology Stack

The project is structured as a modular monorepo:

```
weyro/
├── apps/
│   ├── mobile/ (root)       # React Native + Expo SDK 57 + Expo Router
│   └── api/                 # NestJS 11 + Prisma ORM + PostgreSQL / PostGIS
└── packages/
    ├── api-contracts/       # Shared TypeScript DTOs & Domain Interfaces
    ├── database/            # Prisma Schema, Migrations & PostGIS Spatial Queries
    └── validation/          # Shared Zod Schemas
```

### Core Technologies

| Layer | Technologies |
|---|---|
| **Mobile Client** | React Native 0.86, Expo SDK 57, Expo Router, React 19, TypeScript |
| **Backend API** | NestJS 11, Express, Prisma Client, RxJS |
| **Database & GIS** | PostgreSQL, PostGIS spatial indexing (`ST_DWithin`, clamped Haversine) |
| **Media & Hardware** | `expo-image`, `expo-image-picker` |
| **State & Cache** | React 19 `useSyncExternalStore` (zero external bloat) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20+ (Node v22 recommended)
- **npm** or **bun**
- **Expo Go** or an iOS / Android simulator

### 1. Mobile Client Setup

```bash
# Clone the repository
git clone https://github.com/revanthrao92-debug/weyro.git
cd weyro

# Install dependencies
npm install

# Run Expo development server
npx expo start
```

Press `i` for iOS Simulator, `a` for Android Emulator, or `w` for Web Browser.

### 2. Backend API Setup

```bash
cd apps/api

# Install backend dependencies
npm install

# Generate Prisma Client
npx prisma generate --schema=../../packages/database/prisma/schema.prisma

# Start API in development mode
npm run start:dev
```

The API boots on `http://localhost:4000/api/v1`.

---

## 🧪 Quality & Verification

Run project-wide diagnostics to ensure complete type safety and SDK conformance:

```bash
# Typecheck mobile client
npx tsc --noEmit

# Lint code quality
npm run lint

# Validate Expo SDK 57 compatibility
npx expo-doctor

# Typecheck backend API
cd apps/api && npm run typecheck
```

---

## 💳 Payments & Regulatory Compliance

Weyro integrates Razorpay for processing Indian Rupee (INR) transactions via UPI, Credit/Debit cards, and Netbanking with cryptographically verified HMAC SHA-256 webhook signatures and idempotent event handling.

> [!IMPORTANT]
> **Regulatory Note (RBI PA/PG Guidelines)**:
> In the application architecture, "escrow" or "held" states represent internal workflow milestones. Under Reserve Bank of India (RBI) Payment Aggregator and Payment Gateway (PA/PG) guidelines, intermediary holding of customer funds requires an authorized PA license or an approved Nodal/Escrow banking arrangement with a scheduled commercial bank. Production marketplace disbursements and split payouts utilize authorized Payment Aggregator marketplace solutions (such as Razorpay Route) with compliant vendor KYC.

---

## 📄 License

MIT License. Designed and developed for Weyro Automotive Technologies.
