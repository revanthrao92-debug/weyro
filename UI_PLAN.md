# Weyro Mobile UI Plan

**Version:** 1.0  
**Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router, TypeScript strict  
**Backend:** All endpoints implemented & privacy-shaped (see `BACKEND_READINESS_PLAN.md`)

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Clarity first** | Every screen has one primary action; secondary actions are visually subordinate |
| **Trust through transparency** | Show status, cost breakdown, provider badge, and verification state everywhere money or safety is involved |
| **One-handed zones** | Primary actions within thumb reach (bottom 40% of screen) |
| **No surprises** | Loading, empty, error, and success states are explicit; never show a blank screen |
| **India-first** | INR currency, Devanagari/Telugu font fallback, phone-first auth, UPI-first payments |

---

## 2. Design Tokens

### 2.1 Color Palette

| Role | Light (White Theme) | Dark | Usage |
|------|---------------------|------|-------|
| Primary | `#FFFFFF` | `#1A1A1A` | Button backgrounds |
| Primary Text | `#208AEF` | `#3DA9F5` | Button text, links |
| Primary Border | `#E5E7EB` | `#374151` | Button borders |
| Primary Pressed Border | `#F59E0B` | `#FBBF24` | **Orange outline on button press** |
| Primary Pressed BG | `#FFF7ED` | `#451A03` | Light orange tint when pressed |
| Background | `#FFFFFF` | `#0A0A0A` | App background |
| Surface | `#F9FAFB` | `#1A1A1A` | Cards, sheets, modals |
| Surface Elevated | `#FFFFFF` | `#252525` | Floating elements |
| Text Primary | `#111827` | `#F9FAFB` | Headings, labels |
| Text Secondary | `#6B7280` | `#9CA3AF` | Captions, helper text |
| Text Inverse | `#FFFFFF` | `#111827` | Text on dark buttons |
| Border | `#E5E7EB` | `#374151` | Dividers, input borders |
| Focus / Active | `#F59E0B` | `#FBBF24` | **Orange outline for focused inputs & pressed buttons** |
| Success | `#10B981` | `#34D399` | Paid, completed, verified |
| Warning | `#F59E0B` | `#FBBF24` | Pending, quotes received |
| Destructive | `#EF4444` | `#F87171` | Cancel, delete, failed |
| Info | `#208AEF` | `#3DA9F5` | Informational badges |

### 2.2 Typography

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading-xl` | 32sp | 800 | 40px | Screen titles |
| `heading-lg` | 24sp | 800 | 32px | Section titles |
| `heading-md` | 20sp | 700 | 28px | Card titles |
| `body-lg` | 16sp | 400 | 24px | Body text |
| `body-md` | 14sp | 400 | 20px | Secondary body |
| `body-sm` | 13sp | 400 | 18px | Helper text |
| `caption` | 12sp | 400 | 16px | Timestamps, metadata |
| `button-lg` | 16sp | 600 | 20px | Primary buttons |
| `button-sm` | 14sp | 600 | 18px | Secondary buttons |
| `badge` | 10sp | 700 | 14px | Status badges |

**Font family:** System default (San Francisco on iOS, Roboto on Android) with Devanagari/Telugu fallback via `expo-font`.

### 2.3 Spacing (4dp Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4dp | Tight padding |
| `space-2` | 8dp | Component gaps |
| `space-3` | 12dp | Section gaps |
| `space-4` | 16dp | Standard padding |
| `space-5` | 20dp | Section margins |
| `space-6` | 24dp | Screen padding |
| `space-8` | 32dp | Large section gaps |
| `space-10` | 40dp | Extra large gaps |

### 2.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8dp | Small buttons, chips |
| `radius-md` | 12dp | Cards, inputs, modals |
| `radius-lg` | 16dp | Large sheets, hero sections |
| `radius-full` | 9999dp | Avatars, pills |

### 2.5 Elevation (iOS shadow / Android elevation)

| Token | iOS Shadow | Android Elevation | Usage |
|-------|------------|-------------------|-------|
| `none` | none | 0dp | Flat elements |
| `sm` | 0 1px 2px rgba(0,0,0,0.05) | 1dp | Dropdowns, chips |
| `md` | 0 4px 6px rgba(0,0,0,0.1) | 4dp | Cards, sheets |
| `lg` | 0 10px 15px rgba(0,0,0,0.1) | 8dp | Modals, FAB |

---

## 3. Component Library

### 3.1 Atoms

| Component | Props | States | Notes |
|-----------|-------|--------|-------|
| `Button` | title, onPress, variant, disabled, loading, accessibilityLabel | default, pressed (orange outline), disabled, loading | Variants: primary (white bg, blue text), secondary (light gray bg), destructive (white bg, red text). **Pressed state: orange `#F59E0B` outline + light orange `#FFF7ED` background** |
| `Input` | value, onChangeText, placeholder, label, error, keyboardType, secureTextEntry, autoCompleteType, accessibilityLabel | default, focused (orange outline), error (red border), disabled | Use `expo-secure-store` for passwords |
| `Text` | children, variant, color, align | — | Variants map to typography tokens |
| `Icon` | name, size, color, onPress | default, pressed | Use `expo-symbols` (SF Symbols) on iOS, Material on Android |
| `Badge` | text, variant | default | Variants: success, warning, destructive, info, neutral |
| `Chip` | label, onPress, selected | default, selected | Filter chips, category chips |
| `Avatar` | source, size, label | default, error | Falls back to initials |
| `Divider` | orientation, variant | — | horizontal / vertical |
| `Skeleton` | height, width, count | animating | Shimmer placeholder |
| `Spinner` | size, color | animating | Activity indicator wrapper |
| `Switch` | value, onValueChange, disabled | on, off | Availability toggle |
| `Radio` | value, onValueChange, options | selected, unselected | Single-select groups |
| `Checkbox` | value, onValueChange, label | checked, unchecked | Multi-select |

### 3.2 Molecules

| Component | Props | Notes |
|-----------|-------|-------|
| `FormField` | label, inputProps, error, helperText | Label + Input + error text |
| `PasswordField` | value, onChangeText, error | Input + visibility toggle |
| `SearchBar` | value, onChangeText, placeholder | Input + clear button |
| `Card` | children, elevation, padding | Base card container |
| `ListItem` | leading, title, subtitle, trailing, onPress | Single row |
| `StatItem` | label, value | Number + label pair |
| `StatusBadge` | status | Color-coded by status type |
| `CostBreakdown` | parts, labour, shipping, tax, total | Itemised cost table |
| `ProviderCard` | provider, onPress | Name, badge, rating, distance |
| `BookingCard` | booking, onPress | Status, provider, amount, date |
| `QuoteCard` | quotation, onAccept | Price, ETA, warranty, accept button |
| `PartCard` | part, onPress | Name, part number, price, stock badge |
| `MediaPicker` | value, onChange, maxCount | Image gallery + camera |
| `LocationInput` | value, onChange, onPickLocation | Address + map picker |

### 3.3 Organisms

| Component | Props | Notes |
|-----------|-------|-------|
| `AppTabs` | screens, activeTab | Bottom tab navigator |
| `AppHeader` | title, subTitle, actions | Screen header with back |
| `EmptyState` | title, subtitle, action, illustration | No data view |
| `ErrorState` | error, onRetry | Retry button |
| `TrackingMap` | providerLocation, customerLocation | Map with markers |
| `CostSummary` | breakdown, paymentStatus | Payment section |
| `ActionSheet` | title, options, cancelText | Bottom sheet actions |
| `ConfirmationDialog` | title, message, confirmText, cancelText | Destructive confirm |
| `BottomSheet` | children, snapPoints | Draggable sheet |

---

## 4. Screen Specifications

### 4.1 Auth Screens

#### 4.1.1 Login (`(auth)/login`)
**Layout:** Centered card, 24dp horizontal padding

| Element | Spec |
|---------|------|
| Header | "Welcome back" (heading-xl), "Sign in to your Weyro account" (body-md) |
| Email/Phone Input | label "Email or phone", keyboardType email/phone-pad, autoCompleteType |
| Password Input | label "Password", secureTextEntry, autoCompleteType |
| Primary Button | "Log in", full width, space-6 margin top |
| Footer | "Don't have an account? Register" + "Forgot password?" links |

**Backend:** `POST /auth/login`

#### 4.1.2 Register (`(auth)/register`)
**Layout:** ScrollView, 24dp padding

| Element | Spec |
|---------|------|
| Header | "Create account" (heading-xl) |
| Role Selector | Three chips: Customer / Provider / Both (Customer default) |
| First Name | Required, max 60 chars |
| Last Name | Required, max 60 chars |
| Email | Required, email validation |
| Phone | Required, 10-15 chars, keyboardType phone-pad |
| Password | Required, min 8 chars, secureTextEntry |
| Business Name | Conditional: shown if Provider/Both |
| Primary Button | "Create account" |
| Footer | "Already have an account? Log in" |

**Backend:** `POST /auth/register`

#### 4.1.3 Verify OTP (`(auth)/verify-otp`)
**Layout:** Centered card

| Element | Spec |
|---------|------|
| Header | "Verify your phone" / "Verify OTP" (heading-xl) |
| Subtitle | "Enter the 6-digit code sent to {phone}" |
| Phone Input | Pre-filled, editable=false |
| OTP Input | 6 digits, keyboardType number-pad, maxLength 6, autoCompleteType one-time-code |
| Primary Button | "Verify" / "Verify & Continue" |
| Footer | "Didn't receive a code? Resend" |

**Backend:** `POST /auth/verify-otp`

#### 4.1.4 Forgot Password (`(auth)/forgot-password`)
**Layout:** Centered card

| Element | Spec |
|---------|------|
| Header | "Forgot Password" |
| Subtitle | "Enter your phone number to receive a verification code" |
| Phone Input | Required, phone-pad |
| Primary Button | "Send verification code" |
| Footer | "Remember your password? Log in" |

**Backend:** `POST /auth/send-otp` (purpose: reset_password)

#### 4.1.5 Reset Password (`(auth)/reset-password`)
**Layout:** Centered card

| Element | Spec |
|---------|------|
| Header | "Reset Password" |
| Subtitle | "Enter your OTP and choose a new password" |
| Phone Input | Pre-filled |
| OTP Input | 6 digits |
| Password Input | "New password", secureTextEntry, min 8 |
| Primary Button | "Reset password" |

**Backend:** `POST /auth/reset-password`

---

### 4.2 Customer App Screens

#### 4.2.1 Home / Dashboard (`(app)/index`)
**Layout:** ScrollView, role-aware content

| Element | Spec |
|---------|------|
| Header | "Hi, {firstName}" + date |
| Quick Actions | Grid of 4: Report Damage, Find Mechanic, Order Spare Part, Roadside Help |
| Active Jobs | List of current bookings with status badge |
| Nearby Providers | Horizontal scroll of provider cards |
| Notification Bell | Top right, shows unread count badge |

**Backend:** None (aggregates local state); navigation to other screens

#### 4.2.2 My Bookings (`bookings.tsx`)
**Layout:** FlatList with pull-to-refresh

| Element | Spec |
|---------|------|
| Header | "My Bookings" + status filter chips (CONFIRMED, EN_ROUTE, IN_PROGRESS, COMPLETED, CANCELLED) |
| List Item | BookingCard: booking ID, provider name, amount, status badge, date |
| Empty | "No bookings found" + "Create Request" button |

**Backend:** `GET /bookings` (with optional status filter)

#### 4.2.3 Booking Detail (`booking/[id].tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Header | "Booking #{id}" |
| Status | Large status badge + scheduled date |
| Provider | Name, rating, reviews count, jobs completed |
| Customer | Name (customer's own name) |
| Payment | CostBreakdown + payment status (HELD_IN_ESCROW / CAPTURED / RELEASED) |
| Live Tracking | Map placeholder with provider coordinates (if en route) |
| Actions | "Mark En Route" / "Mark In Progress" / "Mark Completed" (role-dependent) |
| Pay Now | If payment pending: create Razorpay order + verify |

**Backend:** `GET /bookings/:id`, `PATCH /bookings/:id/status`, `PATCH /bookings/:id/location`, `GET /bookings/:id/tracking`

#### 4.2.4 Create Request (`requests/create.tsx`)
**Layout:** ScrollView wizard (single page)

| Field | Spec |
|-------|------|
| Vehicle Make/Model | Text inputs |
| Year | Numeric input |
| Category | Chips: REPAIR, MAINTENANCE, SPARE_PART, TOWING, ROADSIDE, INSPECTION |
| Title | Required, max 150 chars |
| Description | Required, max 2000 chars, multiline |
| Address | Text input |
| Latitude/Longitude | Numeric inputs (auto-fill from location) |
| Urgency | Chips: NORMAL, URGENT, EMERGENCY |
| Broadcast | Toggle: "Broadcast to nearby providers" |
| Primary Button | "Submit Request" |

**Backend:** `POST /damage-requests`

#### 4.2.5 Request Detail (`requests/[id].tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Header | "Request #{id}" + status badge |
| Details | Category, title, description, address, urgency, status |
| Quotes | List of QuoteCard: provider, total cost, ETA, warranty, Accept button |
| Cancel | "Cancel Request" button (if OPEN/QUOTES_RECEIVED) |

**Backend:** `GET /damage-requests/:id`, `GET /damage-requests/:id/quotations`, `POST /damage-requests/:id/cancel`

#### 4.2.6 Shop / Spare Parts Catalogue (`shop.tsx`)
**Layout:** FlatList with filter bar

| Element | Spec |
|---------|------|
| Filter Bar | Search input + Make input + Filter button |
| List Item | PartCard: image placeholder, name, part number, condition, price, stock badge |
| Empty | "No parts found" |

**Backend:** `GET /spare-parts`

#### 4.2.7 Part Detail (`shop/[id].tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Header | Part name + part number |
| Image | Placeholder (install react-native-maps for real images) |
| Details | Condition, compatible makes/models |
| CostBreakdown | Parts price as total |
| Quantity | Stepper (1-10, limited by stock) |
| Stock Status | "In Stock (X available)" or "Out of Stock" |
| Primary Button | "Create Order" (disabled if out of stock) |

**Backend:** `GET /spare-parts/:id`, `POST /spare-parts/:id/orders`

#### 4.2.8 Checkout / Payment (`bookings/pay/[id].tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Header | "Payment" + booking ID |
| CostBreakdown | Itemised cost |
| Order Creation | "Create Payment Order" button → shows Razorpay Order ID |
| Razorpay Checkout | Alert with order details (SDK integration in production) |
| Verify (Dev) | Payment ID + Signature inputs + "Verify Payment" button |

**Backend:** `POST /payments/create-order`, `POST /payments/verify`

#### 4.2.9 My Orders (`my-orders.tsx`)
**Layout:** FlatList

| List Item | Order ID, status, amount, quantity, date |
|-----------|------------------------------------------|

**Backend:** `GET /spare-parts/orders/my`

#### 4.2.10 Profile (`profile.tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Avatar | Placeholder with initials + Avatar URL input |
| First Name / Last Name | Editable inputs |
| Email | Read-only |
| Phone | Read-only |
| Primary Button | "Save changes" |

**Backend:** `GET/PATCH /customers/me`

#### 4.2.11 Addresses (`addresses.tsx`)
**Layout:** ScrollView + FlatList

| Section | Spec |
|---------|------|
| Add New | Title, address, latitude, longitude inputs + "Add Address" button |
| List | Address cards: title, address, coordinates, Remove button |

**Backend:** `GET/PUT /customers/me/addresses`

#### 4.2.12 Vehicles (`vehicles.tsx`)
**Layout:** FlatList + FAB

| Section | Spec |
|---------|------|
| Empty | "No vehicles saved" + "Add your first vehicle" |
| List | Vehicle cards: make/model/year, registration, fuel/color, Remove button |
| FAB | "+" → modal: make, model, year, registration, VIN, fuel type, color |

**Backend:** `GET/POST/PATCH/DELETE /customers/me/vehicles`

#### 4.2.13 Notifications (`notifications.tsx`)
**Layout:** FlatList

| Element | Spec |
|---------|------|
| Header | "Notifications" + "Mark all as read" button (disabled if no unread) |
| List Item | Title, body, timestamp, unread dot |
| Empty | "No notifications" + "You're all caught up" |

**Backend:** `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`

#### 4.2.14 Push Token (`notifications/push-token.tsx`)
**Layout:** Centered

| Element | Spec |
|---------|------|
| Header | "Push Notifications" |
| Primary Button | "Enable Push Notifications" |
| Secondary Button | "Disable Push Notifications" |

**Backend:** `POST/DELETE /notifications/push-token`

#### 4.2.15 Chat Threads (`messages.tsx`)
**Layout:** FlatList

| List Item | Provider name, last message preview, timestamp, unread badge |
|-----------|---------------------------------------------------------------|

**Backend:** `GET /chat/threads`, `GET /chat/unread-count`

#### 4.2.16 Chat Messages (`messages/[threadId].tsx`)
**Layout:** FlatList + input bar

| Element | Spec |
|---------|------|
| Messages | Left-aligned (provider) / right-aligned (customer) bubbles with timestamps |
| Input | TextInput + Send button |

**Backend:** `GET/POST /chat/threads/:id/messages`

---

### 4.3 Provider App Screens

#### 4.3.1 Dashboard (`(app)/index`)
**Layout:** Role-aware (PROVIDER or BOTH)

| Element | Spec |
|---------|------|
| Stats Cards | Active jobs, pending quotes, today's earnings |
| Opportunities | "View nearby requests" → navigate to broadcast feed |
| My Quotes | "View my quotes" → navigate to quotes list |
| Online/Offline | Switch toggle |

**Backend:** `GET /providers/me`

#### 4.3.2 Opportunities Feed (`broadcast-feed.tsx`)
**Layout:** FlatList with category filter

| List Item | FeedRequestCard: title, category, address, urgency, Quote button |
|-----------|-------------------------------------------------------------------|

**Backend:** `GET /damage-requests/broadcast-feed`, `POST /damage-requests/:requestId/quotations`

#### 4.3.3 My Quotes (`my-quotes.tsx`)
**Layout:** FlatList with status filter

| List Item | QuoteItem: amount, status, ETA, Withdraw button (if PENDING) |
|-----------|---------------------------------------------------------------|

**Backend:** `GET /quotations/my`, `POST /quotations/:id/withdraw`

#### 4.3.4 My Listings (`my-listings.tsx`)
**Layout:** FlatList + FAB

| List Item | ListingCard: name, part number, price, stock, status, Edit/Delete buttons |
|-----------|---------------------------------------------------------------------------|

**Backend:** `GET /spare-parts/mine`, `DELETE /spare-parts/:id`

#### 4.3.5 Create/Edit Listing (`listings/create.tsx`, `listings/[id].tsx`)
**Layout:** ScrollView form

| Field | Spec |
|-------|------|
| Part Name | Required |
| Part Number | Required |
| Compatible Makes | Comma-separated |
| Compatible Models | Comma-separated |
| Condition | Chips: OEM, AFTERMARKET, USED |
| Price | Numeric |
| Stock Quantity | Numeric |
| Description | Optional |
| Active Toggle | On/Off |
| Primary Button | "List Part" / "Save Changes" |
| Delete | "Delete Listing" (edit only) |

**Backend:** `POST /spare-parts`, `PATCH /spare-parts/:id`, `DELETE /spare-parts/:id`

#### 4.3.6 Provider Profile (`provider-profile.tsx`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Avatar | Initials placeholder |
| Business Name | Editable |
| Verification Badge | PENDING/VERIFIED/REJECTED/SUSPENDED |
| Provider Type | Read-only |
| Description | Editable |
| Phone | Editable |
| Address | Editable |
| Service Radius | Editable (km) |
| Availability | Toggle: Online/Offline |
| Stats | Rating, reviews, jobs, listings |
| Primary Button | "Save changes" |

**Backend:** `GET/PATCH /providers/me`

---

### 4.4 Admin Screens

#### 4.4.1 Overview (`(app)/index` for ADMIN)
**Layout:** Stats cards + quick actions

| Stats | Total requests, open broadcasts, total quotations, accepted quotations, total bookings, completed bookings, total escrow volume, pending verifications, verified providers |
|-------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Backend:** `GET /admin/overview`

#### 4.4.2 Providers (`(app)/providers`)
**Layout:** FlatList

| List Item | Provider name, type, verification status, navigate to detail |
|-----------|---------------------------------------------------------------|

**Backend:** `GET /admin/providers`

#### 4.4.3 Provider Detail (`(app)/providers/[id]`)
**Layout:** ScrollView

| Section | Spec |
|---------|------|
| Business Info | Name, type, address, phone, email |
| Verification | Status, documents (admin only), auditor notes, verified at |
| Stats | Quotations, bookings, reviews, listings counts |
| Action | Verify/Reject button |

**Backend:** `GET /admin/providers/:id`, `PATCH /admin/providers/:id/verify`

#### 4.4.4 Escrow Ledger (`(app)/escrow`)
**Layout:** FlatList

| List Item | Booking ID, customer name, provider name, amount, status (HELD_IN_ESCROW / RELEASED_TO_PROVIDER / REFUNDED_TO_CUSTOMER), date |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------|

**Backend:** `GET /admin/escrow-ledger`, `POST /payments/release`

#### 4.4.5 Activity Logs (`(app)/activity`)
**Layout:** FlatList

| List Item | Action, actor, timestamp |
|-----------|--------------------------|

**Backend:** `GET /admin/activity-logs`

---

### 4.5 Public Provider Profile (`provider/[id].tsx`)
**Layout:** ScrollView, no auth required

| Section | Spec |
|---------|------|
| Header | Avatar placeholder + business name + provider type + badge |
| Stats | Rating, reviews, jobs completed |
| Details | Description, service radius, availability |
| Reviews | List: customer name, rating stars, comment |
| Action | "Start Chat" button |

**Privacy:** No phone, address, KYC documents shown to customers.

**Backend:** `GET /providers/:id`, `GET /providers/:id/reviews`

---

## 5. Navigation Architecture

```
Root Stack
├── (auth) Stack (no tabs)
│   ├── login
│   ├── register
│   ├── verify-otp
│   ├── reset-password
│   └── forgot-password
└── (app) Tabs (role-based)
    ├── Customer: Home, Bookings, Messages, Shop, Profile, Notifications
    ├── Provider: Dashboard, Opportunities, Orders, Messages, Profile, Notifications
    ├── Admin: Overview, Providers, Escrow, Activity, Profile, Notifications
    └── BOTH: Customer tabs by default + "Switch to Provider Mode" toggle in Profile
    └── Modals (stack over tabs)
        ├── request/create
        ├── request/[id]
        ├── quote/[id]
        ├── booking/[id]
        ├── part/[id]
        ├── part/[id]/checkout
        ├── provider/[id]
        ├── messages/[threadId]
        └── notifications
```

**Deep links:** `weyro://bookings/:id`, `weyro://requests/:id`, `weyro://providers/:id`, `weyro://shop/:id`

---

## 6. Interaction Patterns

### 6.1 Touch Targets
- Minimum 44dp × 44dp for all interactive elements
- 8dp minimum spacing between touch targets

### 6.2 Feedback
- Button press: opacity 0.7, haptic feedback (expo-haptics)
- Form validation: inline error text below field, red border
- Success: toast notification (bottom center, auto-dismiss 3s)
- Error: Alert dialog with retry option
- Loading: full-screen spinner on initial load, skeleton on list refresh

### 6.3 Gestures
- Pull-to-refresh on all lists
- Swipe to delete (vehicle, address, listing)
- Long press for context actions (copy order ID, share booking)

### 6.4 Keyboard
- `KeyboardAvoidingView` on all form screens
- `keyboardShouldPersistTaps="handled"` on ScrollViews with inputs
- Smart keyboard types: email, phone-pad, numeric, number-pad

### 6.5 Platform Differences
| Feature | iOS | Android |
|---------|-----|---------|
| Navigation | Expo Router native stack | Expo Router native stack |
| Status bar | Light content on dark | Light content on dark |
| Back gesture | Swipe from left edge | System back button |
| Fonts | San Francisco | Roboto |
| Haptics | expo-haptics (ImpactFeedback) | expo-haptics (ImpactFeedback) |

---

## 7. Empty, Error, and Loading States

### 7.1 Empty State
```
[Illustration]
Title: "No [items] found"
Subtitle: Context-specific helper text
[Primary Action Button] (optional)
```

### 7.2 Error State
```
[Alert Icon]
Title: "Something went wrong"
Subtitle: Error message
[Retry Button] [Dismiss Button]
```

### 7.3 Loading States
- **Initial load:** Full-screen centered spinner
- **List refresh:** Pull-to-refresh spinner in header
- **Form submission:** Button shows spinner, disabled state
- **Image load:** Placeholder with icon until image loads

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Touch targets | Minimum 44dp × 44dp |
| Color contrast | Minimum 4.5:1 for normal text, 3:1 for large text |
| Screen readers | `accessibilityLabel` on all interactive elements |
| Screen readers | `accessibilityRole` ("button", "text", "image", "button", "link", "adjustable") |
| Dynamic type | Respect system font size settings |
| Reduced motion | Respect `reduceMotion` setting; disable animations |
| Color blindness | Don't rely on color alone; use icons + text |
| Focus management | Logical tab order, focus returns after modal close |

---

## 9. Edge Cases

| Scenario | UI Treatment |
|----------|--------------|
| No internet | Offline banner at top, retry on reconnect |
| Token expired | Auto-redirect to login, preserve attempted route |
| Provider not verified | Show "Verification pending" badge, hide quote ability |
| Out of stock part | Show "Out of Stock", disable order button |
| Payment failed | Error alert, offer retry, preserve order |
| Quote expired | Show "Expired" status, allow new quote request |
| Provider goes offline mid-chat | Show "Provider is offline" in thread header |
| Location permission denied | Show manual address input fallback |
| Camera permission denied | Show gallery-only media picker |

---

## 10. File Structure (UI)

```
apps/mobile/src/
├── app/                    # Expo Router routes
│   ├── _layout.tsx         # Root layout + AuthProvider
│   ├── (auth)/             # Auth group
│   ├── (app)/              # Authenticated tab group
│   ├── booking/[id].tsx
│   ├── bookings.tsx
│   ├── bookings/pay/[id].tsx
│   ├── broadcast-feed.tsx
│   ├── messages.tsx
│   ├── messages/[threadId].tsx
│   ├── my-orders.tsx
│   ├── my-quotes.tsx
│   ├── my-listings.tsx
│   ├── notifications.tsx
│   ├── notifications/push-token.tsx
│   ├── profile.tsx
│   ├── provider-profile.tsx
│   ├── provider/[id].tsx
│   ├── requests/create.tsx
│   ├── requests/my.tsx
│   ├── requests/[id].tsx
│   ├── shop.tsx
│   ├── shop/[id].tsx
│   ├── vehicles.tsx
│   └── addresses.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Spinner.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── EmptyState.tsx
│   │   └── ErrorState.tsx
│   ├── booking/
│   │   ├── BookingCard.tsx
│   │   ├── CostBreakdown.tsx
│   │   └── TrackingMap.tsx
│   ├── request/
│   │   ├── RequestCard.tsx
│   │   ├── QuoteCard.tsx
│   │   └── MediaPicker.tsx
│   ├── parts/
│   │   ├── PartCard.tsx
│   │   └── StockBadge.tsx
│   ├── provider/
│   │   ├── ProviderCard.tsx
│   │   └── Badge.tsx
│   └── common/
│       └── ListItem.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useBookings.ts
│   ├── usePayments.ts
│   ├── useTracking.ts
│   ├── useProfile.ts
│   ├── useParts.ts
│   ├── useRequests.ts
│   └── useNotifications.ts
├── services/
│   ├── api-client.ts
│   ├── token-storage.ts
│   └── notification.ts
├── types/
│   └── index.ts
├── constants/
│   └── colors.ts
└── assets/
    ├── images/
    └── fonts/
```

---

## 11. Definition of Done (UI)

- [ ] `npx tsc --noEmit` passes (TypeScript strict)
- [ ] `npx expo lint` passes (0 errors)
- [ ] Every screen maps to an existing backend endpoint
- [ ] No provider phone/address/KYC shown to customers
- [ ] Role-based tabs render correctly for CUSTOMER / PROVIDER / BOTH / ADMIN
- [ ] All interactive elements have accessibilityLabel and accessibilityRole
- [ ] Empty, error, and loading states implemented on all list screens
- [ ] Form validation with inline error messages
- [ ] EAS build config (`eas.json`) present for development/preview/production
- [ ] Design tokens centralized in `src/constants/colors.ts`

---

## 12. Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| `react-native-maps` not installed | TrackingMap uses placeholder; install via `npx expo install react-native-maps` before production |
| Real Razorpay SDK not integrated | Checkout uses alert-based mock; integrate `expo-web-browser` or Razorpay React Native SDK for production |
| Push notifications not tested on real device | Unit-test token CRUD logic; physical device pass required |
| `BOTH` role tab switching | Default to customer tabs; add Profile toggle to switch |
| No mobile unit tests yet | Add Jest + React Native Testing Library in a follow-up (React 19 compatibility issues with current RNTL version) |

---

**Next step:** Review this plan, approve the design system, then begin screen-by-screen implementation starting with F1 (Navigation + Auth) which is already coded.
