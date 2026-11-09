# Weyro Mobile Frontend Plan

**Goal:** Rebuild the Expo/React Native mobile app from scratch so every screen connects to an existing backend endpoint. Zero new backend work required — all endpoints are live and privacy-shaped.

**Tech stack (Expo SDK 57, matching AGENTS.md):**
- Expo Router (file-based navigation in `src/app/`)
- React Native 0.86.3, React 19.2.3
- TypeScript strict
- `@tanstack/react-query` for server state
- `expo-secure-store` for JWTs, `expo-notifications` for push, `expo-location` for geolocation
- `expo-image-picker` for media, `expo-web-browser` for OAuth/payment redirect
- Zod for client-side validation (shared `@weyro/validation` where possible)
- `@weyro/api-contracts` for all response/request types

---

## 1. Project Structure

```
apps/mobile/
├── src/
│   ├── app/                    # Expo Router routes (every file = screen)
│   │   ├── _layout.tsx         # Root layout + providers
│   │   ├── (auth)/             # Auth group (no tabs)
│   │   │   ├── _layout.tsx     # Auth stack
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   ├── verify-otp.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── (app)/              # Authenticated group (tabs)
│   │   │   ├── _layout.tsx     # Tab navigator
│   │   │   ├── index.tsx       # Home / Dashboard (role-based)
│   │   │   ├── bookings.tsx    # My bookings
│   │   │   ├── messages.tsx    # Chat threads
│   │   │   ├── shop.tsx        # Spare parts catalogue
│   │   │   └── profile.tsx     # Profile & settings
│   │   ├── booking/[id].tsx    # Booking detail + tracking
│   │   ├── request/create.tsx  # Create damage request
│   │   ├── request/[id].tsx    # Request detail + quotes
│   │   ├── quote/[id].tsx      # Quote detail + accept/withdraw
│   │   ├── part/[id].tsx       # Spare part detail
│   │   ├── part/[id]/checkout.tsx
│   │   ├── provider/[id].tsx   # Public provider profile
│   │   ├── notifications.tsx   # Inbox
│   │   └── __dev.tsx           # Dev-only screen (excluded from prod)
│   ├── components/
│   │   ├── ui/                 # Base design system (Button, Input, Card, etc.)
│   │   ├── booking/            # BookingCard, TrackingMap, StatusBadge
│   │   ├── request/            # RequestCard, QuoteCard, MediaPicker
│   │   ├── parts/              # PartCard, StockBadge
│   │   ├── provider/           # ProviderCard, Badge
│   │   └── common/             # EmptyState, ErrorState, Skeleton
│   ├── hooks/
│   │   ├── useApi.ts           # React Query client + base fetch
│   │   ├── useAuth.ts          # Auth state (JWT, role, profile)
│   │   ├── useBookings.ts      # GET /bookings, GET /bookings/:id
│   │   ├── useRequests.ts      # GET /damage-requests/my, broadcast-feed
│   │   ├── useQuotations.ts    # GET /quotations/my, accept, withdraw
│   │   ├── usePayments.ts      # create-order, verify, release
│   │   ├── useChat.ts          # threads, messages, unread-count
│   │   ├── useNotifications.ts # unread-count, read-all
│   │   ├── useProfile.ts       # customers/me, providers/me
│   │   └── useParts.ts         # spare-parts/mine, findAll
│   ├── services/
│   │   ├── api-client.ts       # Axios/fetch wrapper with auth header
│   │   ├── token-storage.ts    # expo-secure-store wrapper
│   │   └── notification.ts     # expo-notifications registration
│   ├── types/
│   │   └── index.ts            # Re-exports from @weyro/api-contracts
│   ├── constants/
│   │   └── colors.ts           # Design tokens
│   └── assets/
│       ├── images/
│       └── fonts/
├── app.json
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## 2. Navigation Architecture

**Root layout (`src/app/_layout.tsx`)**
- Wraps everything in `QueryClientProvider`, `AuthProvider`
- Conditional: if no token → `(auth)` group; if token → `(app)` group

**Auth group (`(auth)/`)**
- Stack: Login → Register → Verify OTP → Forgot Password
- No tabs, no header sharing with app group

**App group (`(app)/`)**
- Bottom tabs (role-specific):
  - **Customer:** Home, Bookings, Messages, Shop, Profile
  - **Provider:** Dashboard, Opportunities (feed), Orders, Messages, Profile
  - **Admin:** Overview, Providers, Escrow Ledger, Activity, Profile
- Each tab is its own stack navigator for deep linking

**Modal screens (stack, presented over tabs)**
- `request/create` — Create damage request wizard
- `request/[id]` — Request detail + quotes
- `quote/[id]` — Quote detail + accept/withdraw
- `booking/[id]` — Booking detail + tracking + payment
- `part/[id]` — Spare part detail
- `part/[id]/checkout` — Checkout flow
- `provider/[id]` — Public provider profile
- `notifications` — Inbox

---

## 3. Screen Inventory Mapped to Backend Endpoints

Every screen below maps 1:1 to an existing backend endpoint. No screen requires new backend work.

### Auth Screens

| Screen | Route | Backend Endpoint | Method | Auth |
|--------|-------|-----------------|--------|------|
| Login | `(auth)/login` | `/auth/login` | POST | public |
| Register | `(auth)/register` | `/auth/register` | POST | public |
| Verify OTP | `(auth)/verify-otp` | `/auth/verify-otp` | POST | public |
| Forgot Password | `(auth)/forgot-password` | `/auth/send-otp` | POST | public |

### Customer App Screens

| Screen | Route | Backend Endpoint | Method | Auth |
|--------|-------|-----------------|--------|------|
| Home / Dashboard | `(app)/index` | None (aggregates local state) | — | authenticated |
| My Bookings | `(app)/bookings` | `/bookings` | GET | customer |
| Booking Detail | `booking/[id]` | `/bookings/:id` | GET | customer |
| Create Request | `request/create` | `/damage-requests` | POST | customer |
| Request Detail | `request/[id]` | `/damage-requests/:id` | GET | customer |
| Request Quotes | `request/[id]` | `/damage-requests/:id/quotations` | GET | customer |
| Accept Quote | `quote/[id]` | `/quotations/:id/accept` | POST | customer |
| Cancel Request | `request/[id]` | `/damage-requests/:id/cancel` | POST | customer |
| Spare Parts Catalogue | `(app)/shop` | `/spare-parts` | GET | public |
| Part Detail | `part/[id]` | `/spare-parts/:id` | GET | public |
| Checkout | `part/[id]/checkout` | `/spare-parts/orders` | POST | customer |
| Verify Payment | `part/[id]/checkout` | `/spare-parts/orders/:orderId/verify` | POST | customer |
| My Orders | (tab: Shop) | `/spare-parts/orders/my` | GET | customer |
| Profile | `(app)/profile` | `/auth/me`, `/customers/me` | GET | customer |
| Edit Profile | `profile/edit` | `/customers/me` | PATCH | customer |
| Addresses | `profile/addresses` | `/customers/me/addresses` | GET/PUT | customer |
| Vehicles | `profile/vehicles` | `/customers/me/vehicles` | GET/POST/PATCH/DELETE | customer |
| Notifications | `notifications` | `/notifications/unread-count`, `/notifications/read-all` | GET/PATCH | customer |
| Chat Threads | `(app)/messages` | `/chat/threads` | GET | customer |
| Chat Messages | `messages/[threadId]` | `/chat/threads/:id/messages` | GET/POST | customer |
| Create Thread | `messages/new/[providerId]` | `/chat/threads` | POST | customer |

### Provider App Screens

| Screen | Route | Backend Endpoint | Method | Auth |
|--------|-------|-----------------|--------|------|
| Dashboard | `(app)/index` | `/providers/me` | GET | provider |
| Opportunities Feed | `(app)/opportunities` | `/damage-requests/broadcast-feed` | GET | provider |
| Create Quote | `request/[id]/quote` | `/damage-requests/:requestId/quotations` | POST | provider |
| My Quotes | `(app)/quotes` | `/quotations/my` | GET | provider |
| Withdraw Quote | `quote/[id]` | `/quotations/:id/withdraw` | POST | provider |
| My Orders (Dealer) | `(app)/orders` | `/spare-parts/orders/dealer` | GET | provider |
| My Listings | `listings` | `/spare-parts/mine` | GET | provider |
| Create Listing | `listings/create` | `/spare-parts` | POST | provider |
| Edit Listing | `listings/[id]` | `/spare-parts/:id` | PATCH | provider |
| Delete Listing | `listings/[id]` | `/spare-parts/:id` | DELETE | provider |
| Provider Profile | `(app)/profile` | `/providers/me` | GET | provider |
| Edit Provider Profile | `profile/edit` | `/providers/me` | PATCH | provider |
| Public Provider Page | `provider/[id]` | `/providers/:id` | GET | public |
| Provider Reviews | `provider/[id]/reviews` | `/providers/:id/reviews` | GET | public |
| Chat Threads | `(app)/messages` | `/chat/threads` | GET | provider |

### Admin Screens

| Screen | Route | Backend Endpoint | Method | Auth |
|--------|-------|-----------------|--------|------|
| Overview | `(app)/overview` | `/admin/overview` | GET | admin |
| Providers | `(app)/providers` | `/admin/providers` | GET | admin |
| Provider Detail | `providers/[id]` | `/admin/providers/:id` | GET | admin |
| Verify Provider | `providers/[id]/verify` | `/admin/providers/:id/verify` | PATCH | admin |
| Escrow Ledger | `(app)/escrow` | `/admin/escrow-ledger` | GET | admin |
| Release Payment | `escrow/release/[paymentId]` | `/payments/release` | POST | admin |
| Activity Logs | `(app)/activity` | `/admin/activity-logs` | GET | admin |

---

## 4. API Layer (React Query)

**File:** `src/hooks/useApi.ts`

```ts
// Base fetch wrapper with:
- Base URL from EXPO_PUBLIC_API_URL
- Auto-attach Bearer token from secure store
- 401 → clear token, redirect to login
- 403 → show error toast
- Request/response logging in dev
```

**Custom hooks (one per domain):**

| Hook | Endpoints Covered | React Query Keys |
|------|-------------------|------------------|
| `useAuth()` | login, register, me, refresh, logout | `['auth', 'me']` |
| `useBookings()` | GET /bookings, GET /bookings/:id, PATCH /bookings/:id/status | `['bookings']`, `['booking', id]` |
| `useRequests()` | GET /damage-requests/my, POST /damage-requests, GET /damage-requests/:id, POST /damage-requests/:id/cancel | `['requests']`, `['request', id]` |
| `useQuotations()` | GET /quotations/my, POST /damage-requests/:requestId/quotations, POST /quotations/:id/accept, POST /quotations/:id/withdraw | `['quotations']`, `['quote', id]` |
| `usePayments()` | POST /payments/create-order, POST /payments/verify, POST /payments/release | `['payments']` |
| `useChat()` | GET /chat/threads, GET /chat/unread-count, POST /chat/threads, GET/POST /chat/threads/:id/messages | `['threads']`, `['unreadCount']` |
| `useNotifications()` | GET /notifications/unread-count, PATCH /notifications/read-all, DELETE /notifications/push-token | `['notifications', 'unreadCount']` |
| `useProfile()` | GET/PATCH /customers/me, GET/PUT /customers/me/addresses, GET/POST/PATCH/DELETE /customers/me/vehicles | `['profile']`, `['vehicles']` |
| `useProvider()` | GET/PATCH /providers/me, GET /providers/:id, GET /providers/:id/reviews | `['provider']`, `['publicProvider', id]` |
| `useParts()` | GET /spare-parts, GET /spare-parts/mine, POST /spare-parts, PATCH/DELETE /spare-parts/:id | `['parts']`, `['myParts']` |

**Invalidation strategy:** After any mutation (create, update, delete), invalidate the relevant query key so React Query refetches on next screen focus.

---

## 5. Authentication Flow

```
App Launch
  └─ Check secure store for access token
       ├─ No token → Show (auth) stack (Login screen)
       ├─ Token exists → Validate with GET /auth/me
       │     ├─ 200 → Show (app) tabs (role-based)
       │     └─ 401 → Clear token, show (auth) stack
```

**Token storage:** `expo-secure-store` (hardware-backed on iOS/Android)
**Refresh:** On 401, attempt `POST /auth/refresh`; if that fails, redirect to login
**Role-based tabs:** `BOTH` users see customer tabs by default, can switch in profile

---

## 6. Component Inventory

### Base UI (`src/components/ui/`)
- `Button` — primary, secondary, destructive, outline, ghost, loading states
- `Input` — text, email, password, number with validation error states
- `Text` — typography scale (h1-h6, body, caption, label)
- `Card` — elevated, outlined, with image support
- `Chip` — status badges (booking status, quotation status, verification)
- `Avatar` — circular user/provider image with fallback initials
- `Skeleton` — loading placeholders for lists
- `EmptyState` — illustration + title + action button
- `ErrorState` — error message + retry action
- `Modal` — full-screen and bottom sheet variants
- `Checkbox`, `Switch`, `RadioGroup` — form controls

### Domain Components (`src/components/{domain}/`)
- `BookingCard` — booking summary with status badge, provider name, amount
- `TrackingMap` — provider location on map (expo-location)
- `StatusBadge` — booking/quotation/request status color-coded
- `RequestCard` — damage request summary for feed
- `QuoteCard` — quotation with cost breakdown, accept/decline actions
- `MediaPicker` — expo-image-picker with preview grid
- `PartCard` — spare part with stock badge, add to cart
- `StockBadge` — in stock / low stock / out of stock
- `ProviderCard` — public provider with badge, rating, distance
- `CostBreakdown` — parts, labour, shipping, tax, total (for checkout)

---

## 7. State Management

| State | Tool | Reason |
|-------|------|--------|
| Auth (token, role, profile) | React Context + secure store | Global, persists across app launches |
| Server data (bookings, requests, parts) | `@tanstack/react-query` | Caching, background refetch, mutations |
| UI state (modals, form drafts, navigation) | React `useState` / `useReducer` | Local, ephemeral |
| Offline queue | AsyncStorage (deferred to F7) | Not in MVP scope |

---

## 8. Design System (Tokens)

**File:** `src/constants/colors.ts`

| Role | Light | Dark |
|------|-------|------|
| Primary | `#208AEF` | `#3DA9F5` |
| Background | `#FFFFFF` | `#0A0A0A` |
| Surface | `#F5F5F5` | `#1A1A1A` |
| Text Primary | `#111827` | `#F9FAFB` |
| Text Secondary | `#6B7280` | `#9CA3AF` |
| Success | `#10B981` | `#34D399` |
| Warning | `#F59E0B` | `#FBBF24` |
| Destructive | `#EF4444` | `#F87171` |

Spacing: 4dp grid (4, 8, 12, 16, 20, 24, 32, 48)
Radius: 8dp (small), 16dp (medium), 24dp (large)
Typography: System fonts, Devanagari/Telugu fallback for Indian language support

---

## 9. Implementation Phases (Backend Already Done)

| Phase | Scope | Screens | Backend Endpoints Needed | Status |
|-------|-------|---------|-------------------------|--------|
| **F1** | Navigation + Auth | Login, Register, OTP, Forgot Password, Root layout, Auth provider | `/auth/*` | Ready |
| **F2** | Booking Payment + Escrow Release | Booking detail, Checkout, Payment verify, Release payment | `/bookings/:id`, `/payments/*` | Ready |
| **F3** | Notifications Inbox | Notifications list, unread badge, read-all | `/notifications/*`, `/chat/unread-count` | Ready |
| **F4** | Profile / Vehicles | Profile edit, Addresses, Vehicles CRUD | `/customers/me*`, `/providers/me` | Ready |
| **F5** | Shop / Dealer Inventory | Parts catalogue, Part detail, My listings, Create/Edit/Delete listing | `/spare-parts/*` | Ready |
| **F6** | Requests / Quotes | Create request, Request detail, Quotes feed, Accept/Withdraw quote | `/damage-requests/*`, `/quotations/*` | Ready |
| **F7** | Polish / A11y / Tests | Accessibility, animations, empty states, unit tests, EAS build config | All | Deferred |

---

## 10. Security & Privacy (Frontend Enforcement)

- **Never display** provider `phone`, `address`, `verificationDocuments`, `auditorNotes` on customer screens
- **Never display** customer `savedAddresses`, `userId` on provider screens
- **Public provider pages** show only `PublicProvider` fields (businessName, badge, rating, availability)
- **JWT stored in secure store**, never in AsyncStorage or local state
- **API keys** (Razorpay) never embedded in client — all payment creation goes through backend
- **SSL pinning** not required for MVP (Expo handles transport security)

---

## 11. Definition of Done (Frontend Ready to Connect)

- [ ] `npx tsc --noEmit` passes (TypeScript strict)
- [ ] `npx expo lint` passes
- [ ] Auth flow: register → login → OTP → profile works end-to-end
- [ ] Every screen fetches from its mapped backend endpoint (verified against backend audit)
- [ ] No privacy leaks in UI (provider phone/address never shown to customers)
- [ ] Role-based tabs render correctly for CUSTOMER, PROVIDER, BOTH, ADMIN
- [ ] React Query caching + invalidation working (mutations refresh lists)
- [ ] Push token registration works (`/notifications/push-token` POST)
- [ ] Offline error handling (shows error state, retry button)
- [ ] EAS build config (`eas.json`) ready for development build
- [ ] `graphify update .` run after code changes

---

## 12. Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| `@tanstack/react-query` is a new dependency | Approved; add via `npx expo install` |
| `BOTH` role tab selection | Default to customer tabs, add switch in profile |
| Real Razorpay test-mode transaction | Needs user credentials; use mock in dev |
| Physical device push notification pass | Needs real device; unit-test token CRUD |
| No mobile tests exist yet | Add in F7 (deferred per plan) |

---

**Next step:** Create `apps/mobile/` directory, initialize Expo project, install dependencies, and implement F1 (Navigation + Auth). One conventional commit per phase.
