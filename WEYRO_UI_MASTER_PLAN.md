# WEYRO — UI TEARDOWN & REDESIGN MASTER PLAN
**Date:** 2026-11-05 · **Mode:** ANALYSIS & PLANNING ONLY — no code modified
**Prepared by:** Principal UI/UX Architect review · **Scope:** `apps/mobile` (the front end)

**New identity (approved):** PREMIUM AUTOMOTIVE / MOTORSPORT LUXURY — Carbon Black `#080B0E`, Graphite `#10151A`, Elevated `#171D23`, Metallic Grey `#303941`, Titanium White `#F5F6F7`, Secondary Text `#A3ADB6`, Racing Orange `#F47721`, Orange Highlight `#FF8A32`.

---

## 1. EXISTING UI INVENTORY (verified on disk)

### 1.1 Navigation & shells
| Path | Purpose |
|---|---|
| `src/app/_layout.tsx` | Root: query client, auth gate `(auth)`↔`(app)`, Sora font load |
| `src/app/(app)/_layout.tsx` | Bottom tabs; role-aware screen arrays (CUSTOMER / PROVIDER / BOTH / ADMIN) |
| `src/app/(auth)/_layout.tsx` | Auth stack (headers hidden) |

### 1.2 Screens (30 route files)
| Path | Role |
|---|---|
| `(auth)/login.tsx` | Splash+role buttons+login |
| `(auth)/register.tsx` | Registration w/ role prefill |
| `(auth)/forgot-password.tsx`, `reset-password.tsx` | Recovery |
| `(app)/index.tsx` | Home (customer) / provider gate → `ProviderDashboard` / admin notice |
| `(app)/service-selection.tsx` | "What do you need help with?" |
| `(app)/shop.tsx`, `shop/[id].tsx` | Parts discovery + detail |
| `(app)/bookings.tsx` | Request/booking list w/ filters |
| `(app)/orders.tsx` | Dealer orders |
| `(app)/opportunities.tsx` | Broadcast feed (provider) |
| `(app)/messages.tsx`, `messages/[threadId].tsx` | Chat |
| `(app)/profile.tsx`, `profile-edit.tsx` | Profile |
| `(app)/providers.tsx` | Admin verification |
| `(app)/escrow.tsx`, `activity.tsx`, `notifications.tsx` | Admin tabs |
| `addresses.tsx` | Address CRUD |
| `vehicles.tsx`, `vehicles/[id].tsx` | Garage |
| `requests/create.tsx`, `requests/[id].tsx`, `requests/my.tsx` | Requests |
| `booking/[id].tsx` | Booking detail/tracking |
| `provider/[id].tsx` | Public provider profile |
| `listings/create.tsx`, `listings/[id].tsx`, `my-listings.tsx`, `my-quotes.tsx` | Dealer inventory/quotes |
| `my-orders.tsx` (flagged dead earlier — re-verify) | — |
| `notifications/push-token.tsx` | Device token settings |
| `gallery.tsx` (dead, pending removal) | — |

### 1.3 Reusable components
`components/ui/` (20 files, 1199 LOC): AppHeader, ScreenContainer(+Card), Button, Input, Chip(+FilterChips), StatusPill, StatusDot, Badge, ListItem, SectionCard, FilterBar, IconButton, BackButton, Avatar, EmptyState, ErrorState, Skeleton, Toast, ButtonRow, OfflineBanner, PromoBanner, dialog.tsx, BottomSheet, text.tsx, icon.tsx, AdBanner, SectionHeader.
`components/art/PorscheSketch911.tsx` · `components/booking/{BookingCard,CostBreakdown,TrackingMap}.tsx` · `components/dashboard/ProviderDashboard.tsx` · `components/requests/PhotoPicker.tsx`.

### 1.4 Theme & styling system
`theme/colors.ts` (83L, palette+statusColors) · `theme/typography.ts` (Sora display) · `theme/spacing.ts` (4-8-12-16-24-32) · `theme/radii.ts` (sm8/md12/lg20/pill) · `theme/elevation.ts` · `theme/index.ts` (barrel) · `lib/theme.ts` (NAV_THEME) · `lib/photos.ts` (curated imagery) · `lib/utils.ts` (cn) · `utils/format.ts` · `constants/spacing.ts` (legacy dup) · NativeWind (`global.css`, `tailwind.config.js`, `babel.config.js`, `nativewind-env.d.ts`).

### 1.5 Loading/empty/error/modal
Loading: Skeleton. Empty: EmptyState (911 sketch). Error: ErrorState. Dialog: dialog.tsx (vendored `@rn-primitives/dialog`). BottomSheet: BottomSheet.tsx (unused — candidate). Toast: Toast.tsx (unused — candidate).

### 1.6 Assets
`assets/images/`: icon, splash-icon, weyro-logo, android icons, favicon (all needed for app config).

---

## 2. DEPRECATION / REPLACEMENT INVENTORY

| File | Current purpose | Proposed action | Dependencies | Risk |
|---|---|---|---|---|
| `theme/colors.ts` | Teal/navy palette | **REPLACE** with carbon.tmpl racing palette (same token names where possible) | every screen | MED — token renames cascade |
| `theme/typography.ts` | System+Sora | **UPDATE** (display → motorsport face; consider Archivo/Space Grotesk w/ Sora) | every screen | LOW |
| `theme/elevation.ts` | soft shadows | **REPLACE** (metallic hairlines + surface steps on dark; shadows out) | many | LOW |
| `theme/radii.ts` | 8/12/20 | **RETUNE** (angular: 6/10/16, radius-expensive pill→multi-state) | many | MED |
| `global.css` / `tailwind.config.js` | NativeWind vars | **SYNC** with new palette (mirrors colors.ts) | Button/NativeWind components | MED |
| `components/ui/*` (most) | presentational, logic-free | **RESTYLE in place** (keep public props) | all screens | LOW per component |
| `ui/Toast.tsx`, `ui/BottomSheet.tsx`, `ui/PromoBanner.tsx`, `ui/dialog.tsx`, `ui/SectionHeader.tsx` | unused/dead | **DELETE** (verified unused) | barrel only | LOW |
| `ui/OfflineBanner.tsx` | network notice (wired?) | **VERIFY → keep or delete** | — | LOW |
| `components/art/PorscheSketch911.tsx` | signature (teal) | **RECOLOR → orange/metallic; possibly retire if conflicts with new direction** | EmptyState, heroes | LOW |
| `lib/photos.ts` | teal-era imagery | **KEEP + EXPAND** (automotive photography fits new identity) | screens | LOW |
| `components/booking/TrackingMap.tsx` | placeholder text | **DELETE or build** (maps dep removed) | bookings/[id] | LOW |
| `constants/spacing.ts` | legacy duplicate | **DELETE** (unused) | — | LOW |
| `app/gallery.tsx` | dead route | **DELETE** | none | LOW |
| `app/my-orders.tsx` | likely dead | **VERIFY → delete** | none | LOW |
| `assets/images/*` | app icons/splash | **REPLACE candidates** (orange-branded splash/icon per new identity) | app.json | MED (store config) |

**Preserve (business logic, do not touch):** all `hooks/*`, `services/*` (api-client, token-storage, uploads), `utils/format.ts`, types, route paths/slug names, providers/`QueryClient` wiring, `app.json` plugin config.

**UI+logic mixed (needs separation during redesign):**
- `hooks/useAuth.tsx` (renders AuthProvider + registers api-client handlers) → split context from UI shell when touched.
- `components/booking/BookingCard.tsx` (props→hooks) — presentational, but consumes hook type only: safe.
- `components/dashboard/ProviderDashboard.tsx` — screen-as-component with 5 hooks: treat as a screen during redesign, not a shared component.
- `app/(app)/profile-edit.tsx` / form screens with inline validation state — extract form state only if the screen is rebuilt.

---

## 3. FUNCTIONALITY PROTECTION (must keep working)

Auth (login/register/OTP/reset/refresh-family) · role badges CUSTOMER/DEALER/MECHANIC/ADMIN/ BOTH + providerType mapping · customer: requests CRUD+photos, garage, quotes compare+accept, bookings+tracking, chat, addresses · dealer: broadcast feed, quote submit, listings CRUD, orders admin, escrow viewer · mechanic: same dealer minus listings · admin: overview, provider verify (PATCH w/ status), escrow ledger, activity logs · forms validation (Zod schemas via metatype) · image uploads (presigned/finalize) · notifications (push registration, unread counts) · search+filters (parts, feed, bookings) · payment verify/release/webhook surfaces · api-client single-flight refresh + SecureStore · route slugs (`/requests/[id]`, `/shop/[id]`, `/messages/[threadId]`, `/booking/[id]`, `/provider/[id]`, `/listings/*`, `/vehicles/*`, `/addresses`) must survive UI swaps so deep links keep working.

A screen can be visually replaced **file-by-file behind its route declaration** without touching navigation contracts (names in `(app)/_layout.tsx` + file names).

---

## 4. NEW DESIGN SYSTEM PROPOSAL — "Carbon Motorsport"

**Tokens (single source: `theme/colors.ts` renamed surface set):**

```
surface.canvas        Carbon Black #080B0E   (page bg)
surface.chrome        Graphite     #10151A   (header/hero/tab bg)
surface.elevated      Elevated     #171D23   (cards)
surface.inset         #1B222A (new)          (inputs, wells)
line.metallic         Metallic Grey#303941   (borders)
text.primary          Titanium     #F5F6F7
text.secondary        #A3ADB6
text.muted            #6B7680 (new, derived)
accent                Racing Orange #F47721
accent.pressed        #E0591A (derived)
accent.highlight      Orange Highlight #FF8A32 (progress/live moments only)
status.success/warn/danger — muted variants compatible w/ orange (green #3E9B6B, amber #C9922E, red #D4544C)
```

**Typography:** display = Sora (already) **700→keep 600** w/ slightly wider tracking for AUTO feel; mono = SF Mono/Menlo for figures, tabular-nums; body = system. Weights 400/500/600.

**Shape/radius:** angular — radii: xs 4, sm 6, md 10, lg 14, sheet 18 (top corners), "angular panels": corners 0 with 1 metallic hairline for spec-sheet blocks (new `Edge` component).

**Signature details (new-world versions):**
- Metallic hairline borders on graphite cards (1px `#303941` + inner 1px `#171D23`)
- Orange corner ticks (L-shaped 10px marks) on the primary card per screen
- Spec-sheet rows: uppercase micro-labels in mono + right-aligned titanium values
- Carbon-fibre texture = skip (gimmicks); express via noise-free flat graphite + hairlines
- Live dot stays (orange highlight)
- Sketch 911: recolor strokes to titanium@0.15 (the drawing Lives in the motorsport world)

**Component restyle directives:** inputs = graphite wells + metallic border + orange focus line; buttons = solid Racing Orange w/ Titanium text, pressed #E0591A; chips = angular (radius 6) selected = orange tint `#F477211F`+orange border; cards = Elevated bg + metallic border, no shadows (dark-theme depth rules); tab bar = Graphite bg, titanium icons, orange active; header = chrome bg + hairline bottom.

---

## 5. SCREEN REDESIGN INVENTORY

**Authentication:** Login (hero w/ orange accent on CTA + corner ticks), Register, Forgot, Reset, OTP (verify-otp route can be dropped; flow unused).

**Customer:** Home (dark scene hero replace teal sketch w/ orange corner-ticks + orange accent button; garage cards graphite) · Service selection (angular photo panels w/ orange labels) · Requests create/detail/list · Bookings list/detail w/ tracking · Shop list/detail (product cards: Elevated + metallic + orange price) · Orders (done in teal, restyle pass) · Messages/threads · Profile/edit · Addresses · Notifications · Push-token.

**Dealer:** Provider Dashboard → carbon hero, orange KPIs, angular cards · Opportunities · my-quotes · listings create/detail/my-listings · orders (restyle only) · provider/[id] public profile.

**Mechanic:** shares provider screens — no separate implementation needed beyond role copy + hiding listings (exists already).

**Admin:** providers verification (graphite cards + orange Verify) · escrow · activity · overview — dashboard-appropriate: denser, mono figures, no orange flooding (accent on one figure per card).

**Missing / incomplete (documented separately):** cart/checkout UI on spare-part orders (verify flow exists as screens `bookings/pay/*` deleted earlier — verify), ratings UI submission on booking detail (endpoint exists), address autocomplete, dealer analytics (no API), offline mode UI.

---

## 6. COMPONENT ARCHITECTURE (rebuild list)

**Global (design-system level, restyle in place):** AppHeader · ScreenContainer (+ Card→ElevatedCard) · Button (primary orange / secondary metallic / destructive) · Input (+ Zod error line) · Chip/FilterChips · StatusPill (recolored) · StatusDot (orange) · Skeleton (orange shimmer at 0.25 alpha) · EmptyState (recolor sketch) · ErrorState · ListItem · SectionHeader(micro-label mono) · Badge · Avatar · AdBanner (graphite) · BackButton/IconButton · BottomTabBar (restyled in `(app)/_layout`) · PhotoPicker (frame → orange reticle) · Sheet (rebuild bottom-sheet on `@gorhom/bottom-sheet` OR keep modal-free: use full-screen routes — decision point).

**Screen-specific (do NOT globalize):** BookingCard, CostBreakdown, TrackingMap replacement, part/order cards, request wizard sections, provider KPI cards, quote form blocks — each one screen's visual grammar.

**New primitives needed:** `SpecRow` (mono-label/value angular rows), `Edge` (corner-tick wrapper), `MetallicCard` (Elevated+hairline, replaces SectionCard visually via prop, so SectionCard survives API-wise), `PriceTag` (tabular orange figure).

---

## 7. IMPLEMENTATION ROADMAP

| Phase | Work | Files | Risk | Verification |
|---|---|---|---|---|
| **0 Baseline** | git checkpoint `pre-carbon` tag; record current screenshots | — | — | full suite: tsc/eslint/jest mobile+API |
| **1 Design system** | colors/typography/radii/elevation/global.css/tailwind swap; barrel exports stable | `theme/*`, `global.css`, `tailwind.config.js` | MED | tsc+eslint+jest green; old teal hex must return **0 grep hits** |
| **2 Global components** | restyle ui/* in place (props unchanged) | `components/ui/*` | MED | every screen smokes via provider feed |
| **3 Auth** | login/register/forgot/reset + splash+icons | `(auth)/*`, `assets`, `app.json` | LOW-MED | full auth journey on device (incl. wrong creds, forgot flow) |
| **4 Customer** | home, service-selection, requests×3, bookings×2, shop×2, vehicles×2, messages×2, profile×2, addresses, notifications | listed §1.2 | MED-HIGH | click-through: create→quote→accept→booking→track |
| **5 Dealer/mech** | ProviderDashboard, opportunities, listings×3, orders, my-quotes, provider profile | listed | MED | dealer journey end-to-end |
| **6 Admin** | providers/escrow/activity/overview | `(app)/{providers,escrow,activity}` | LOW | verify-flow test |
| **7 Regression sweep** | full journeys (3 roles), manual + existing suites | all | — | see §8 |

**Convert-to-carbon order caveat:** teal→orange is global-feeling the moment `theme/colors.ts` changes. To keep reviews per-checkpoint, introduce palette as **side-by-side tokens** (`surface*` new + legacy alias) and flip screens per phase — hence the new barrel (§6) carries migrations per screen.

---

## 8. REGRESSION PREVENTION

- Git tag `pre-carbon` before Phase 1; every phase = ≥1 commit, verified.
- Suites kept green throughout: mobile tsc+eslint(0-warn)+jest(14), API 145 (untouched — no API work).
- **Component tests to add during phases:** Button/Input render snapshots, palette mapping test (ensure no legacy token), navigation smoke (route names unchanged), auth status flips (login/logout/401), form validation errors render, upload flow (PhotoPicker→presign→finalize) still posts.
- High-risk components (extra protection): `api-client` single-flight (H6 don't regress), `useAuth` bootstrap/refresh callbacks, `(app)/_layout.tsx` role screen arrays (delete any tab → admin loses routes!), ZodValidationPipe consumers (DTO schemas), `app.json` (font config plugin), PhotoPicker upload chain, BookingCard/CostBreakdown money rendering (tabular + toLocaleString), AdBanner placements.
- Manual device matrix: iPhone 15 (your device), dark/light OS setting, RTL off, slow-3G profile for skeletons.

---

## 9. RECOMMENDED IMPLEMENTATION ORDER
Auth (smallest surface, biggest wow) → Home/Service-selection → Requests+Bookings → Shop/Orders → Dealer/Mechanic → Admin → Details pass (ADBanner, sketches recolor, icons) → regression sweep. Total estimate: **3–4 focused sessions** (each ending with explicit checks).

---
*End of master plan. Awaiting explicit approval before any modification. (CC-BY credit: the earlier unslop pass by @heydamir shaped §4's restraint rules.)*
