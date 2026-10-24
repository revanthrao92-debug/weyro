# Weyro Mobile — UI Redesign Plan (Phase 0: Audit & Plan)

> Status: **IMPLEMENTED** — approved as Palette B ("Slate Teal"), phases 1–10 + final
> consistency sweep shipped (commits `fa3d495`…`1d7f2f4`); later re-themed to the premium
> automotive **dark** palette with NativeWind/React Native Reusables (`419b716`).
> This document is the Phase 0 audit record it was created as.
> Branch: `feat/ui-redesign` · Scope: `apps/mobile` · Mode: **single light mode** (no theme switching exists in the app today).

---

## 1. Screen inventory

35 route files under `apps/mobile/src/app`, grouped by flow. UI state key: **complete** (real data + loading + empty), **partial** (works but missing states or rough layout), **placeholder** (static/dummy content), **broken** (visual/interaction defects).

### Auth & onboarding
| Route | State | Notes |
|---|---|---|
| `(auth)/_layout.tsx` | complete | Stack config for 5 screens, no UI |
| `(auth)/login.tsx` | complete | Has loading, KAV, Alert errors. Raw `TouchableOpacity` submit (shared `Button` unused); 2-field form has **no ScrollView** → overflow risk at large text |
| `(auth)/register.tsx` | complete | ScrollView + loading + KAV. Uses shared `Input` but raw TO submit |
| `(auth)/verify-otp.tsx` | partial | "Resend" is a stub `Alert`; `purpose` never set from params → forgot-password can't reach reset-password (**behavior bug, flagged not fixed here**) |
| `(auth)/forgot-password.tsx` | complete | Loading + KAV. Raw TO submit |
| `(auth)/reset-password.tsx` | complete | Loading + KAV. Currently unreachable due to verify-otp bug |

### Home / dashboard
| Route | State | Notes |
|---|---|---|
| `(app)/_layout.tsx` | **broken** | Declares 7 tabs per role (`notifications`, `profile`, `opportunities`, `orders`, `messages`, `bookings`, `shop`) with **no matching route files in the `(app)` group**; `(app)/activity.tsx` exists but is never declared (orphan) |
| `(app)/index.tsx` | placeholder | 9 lines, static "Home / Dashboard" text. No data, scroll, or states |

### Request creation & photo capture
| Route | State | Notes |
|---|---|---|
| `requests/create.tsx` | complete | KAV+ScrollView, loading, category chips incl. **TOWING**. `mediaUrls`/`damagePhotos` always `[]` — **no photo-capture UI exists yet** (feature gap, not to be invented) |
| `requests/my.tsx` | **broken** | 5 status filter chips are dead — `statusFilter` never passed to `useMyRequests()`. FlatList + loading + empty-with-CTA |
| `requests/[id].tsx` | **broken** | Body in a plain `View` styled `scrollContent` with a nested FlatList inside a non-scrolling parent → overflow. Raw TO Accept/Cancel. Highest hex count (16) |
| `broadcast-feed.tsx` | partial | Provider side. "Quote" POSTs a hardcoded `0`-cost quotation instead of a form. Button imported, 0 uses |

### Quotes & comparison
| Route | State | Notes |
|---|---|---|
| `my-quotes.tsx` | partial | FlatList + loading + empty. Card title hardcoded "Quotation"; cards not pressable → no detail view. Raw TO withdraw |

### Chat / messages
| Route | State | Notes |
|---|---|---|
| `messages.tsx` | placeholder | 2 hardcoded threads, no fetch |
| `messages/[threadId].tsx` | **broken** | No `KeyboardAvoidingView`; Send button is `onPress={() => {}}` (dead); hardcoded messages; raw `TextInput` (shared Input unused) |

### Bookings
| Route | State | Notes |
|---|---|---|
| `bookings.tsx` | **broken** | `BookingCard` tap is a no-op `onPress={(id) => {}}` — cards look tappable but do nothing. Has loading, empty, pull-refresh |
| `booking/[id].tsx` | **broken** | Body in plain `View` (no ScrollView) over 4 cards + map + buttons. "Refresh Provider Location" is a stub Alert. `TrackingMap` is placeholder text |

### Payments & escrow
| Route | State | Notes |
|---|---|---|
| `bookings/pay/[id].tsx` | **broken** | Razorpay checkout is a dev stub Alert; "Copy Order ID" is dead; manual "Verify Payment (Dev Mode)" fields; no KAV for 2 inputs |
| `bookings/pay/[id]/verify.tsx` | placeholder | 9-line static "Payment Verification" |
| `(app)/escrow.tsx` | placeholder | 9-line static "Escrow Ledger" (admin) |

### Profile, vehicles, addresses, providers
| Route | State | Notes |
|---|---|---|
| `profile.tsx` | partial | `useState` seeds from async profile before load → fields render blank. KAV+ScrollView |
| `provider-profile.tsx` | partial | Same init-before-load bug → header businessName/avatar initial render empty. 15 hex |
| `vehicles.tsx` | **broken** | Add-vehicle modal (7 inputs) is a non-scrollable plain View, no KAV → keyboard overflow. Button imported, 0 uses |
| `addresses.tsx` | partial | FlatList + loading + empty. Invalid `color` prop in a `View` style. No KAV for 4 inputs |
| `provider/[id].tsx` | partial | ScrollView + loading + reviews-empty + not-found states. "Start Chat" is a stub Alert. Rating drawn as repeated `>` chars. Only screen with an `accessibilityLabel` on a button |

### Shop, orders, listings, activity, providers (admin), notifications, settings
| Route | State | Notes |
|---|---|---|
| `shop.tsx` | partial | FlatList + loading + empty. 🔧 emoji used as product image. No error state |
| `shop/[id].tsx` | partial | ScrollView + loading + not-found. 🔧 emoji image. Order success → Alert only, never navigates to payment |
| `my-orders.tsx` | partial | `useCancelSparePartOrder` declared but unused → no cancel action. Cards not pressable |
| `my-listings.tsx` | complete | FlatList + loading + empty-with-CTA, edit/delete wired. Button imported, 0 uses |
| `listings/create.tsx` | complete | KAV+ScrollView, loading. Label typo "Price Price (₹)" |
| `listings/[id].tsx` | complete | KAV+ScrollView, loading, not-found. Label typo "Price Price (₹)"; `value={form.price \|\| part.price}` snaps field back when cleared |
| `notifications.tsx` | complete | FlatList+RefreshControl, loading, empty. Refresh bound to `isLoading` → full-screen loader hides list during refresh |
| `notifications/push-token.tsx` | partial | No current enabled/disabled state shown; `styles.button` defined but unused; raw TO stacked with no spacing |
| `(app)/providers.tsx` | placeholder | Hardcoded 2 providers despite "fetches from /admin/providers" comment |
| `(app)/activity.tsx` | placeholder | Hardcoded 3 audit rows |

### Shared components
| Component | State | Notes |
|---|---|---|
| `ui/Button.tsx` | complete | Used on 9 screens, imported-unused on 5. Loading renders "…" not a spinner |
| `ui/Input.tsx` | partial | Accepts `label`/`error` props but **never renders them** (labels are manual `<Text>` everywhere). Deprecated `autoCompleteType` passthrough |
| `booking/BookingCard.tsx` | partial | 16 hex status palette; no a11y; parents wire dead onPress |
| `booking/CostBreakdown.tsx` | complete | Pure presentational, clean |
| `booking/TrackingMap.tsx` | placeholder | Text "Map placeholder" — no map (despite `react-native-maps` installed) |

---

## 2. Current styling approach

- **Mechanism:** plain `StyleSheet.create` per screen. No UI library (no NativeWind/Tailwind, no paper). ~790 hardcoded hex color literals across `src/app` + `src/components`.
- **Top offenders (hex counts):** `provider-profile.tsx` (35), `requests/[id].tsx` (33), `vehicles.tsx` (32), `requests/create.tsx` (26), `listings/[id].tsx` (23), `BookingCard.tsx` (22), `provider/[id].tsx` (22).
- **Most-used colors today:** `#111827` (89×), `#208AEF` (83×, a default Material-ish blue), `#6B7280` (73×), `#FFFFFF` (68×), `#E5E7EB` (64×), `#F9FAFB` (41×), plus stray `#8B5CF6` purple and `#10B981` green.
- **Theme/tokens:** only `src/constants/spacing.ts` exists (`spacing` scale 4–32 + `spacingStyles`) — and it is **imported by zero screens**. No color, radius, typography, or elevation tokens exist anywhere.
- **Radius inconsistency:** 9 distinct values — `12` (60×), `6`, `10`, `20`, `8`, `40`, `28`, `4`, `16`.
- **Typography:** system font only (one `monospace` for IDs). 13 different `fontSize` values (10–40); no scale. Weight used ad hoc.
- **Elevation:** **none** — zero `shadowColor`/`elevation` anywhere. Cards read flat with 1px borders only.
- **Icons:** **no icon library in use.** 🔧 emoji doubles as product imagery in `shop.tsx`/`shop/[id].tsx`; `>` chars drawn as a rating in `provider/[id].tsx`. `expo-symbols` is installed but unused.
- **Pressables:** 31 files use raw `TouchableOpacity`/`Pressable`; shared `Button` bypassed on auth screens and 5 screens that import-but-don't-use it.
- **Accessibility:** only 4 files contain any `accessibilityLabel`; zero `SafeAreaView` in `src/app`.
- **Specific inconsistencies:** blank-form-after-load bug (`profile.tsx`, `provider-profile.tsx`); dead no-op `onPress` (`bookings.tsx` card, chat Send, "Copy Order ID"); dead filter chips (`requests/my.tsx`); missing scroll containers causing overflow (`booking/[id].tsx`, `requests/[id].tsx`, `vehicles.tsx` modal, auth forms at large text).

---

## 3. Reusable component audit

**Existing (5):** `Button`, `Input`, `BookingCard`, `CostBreakdown`, `TrackingMap`.

**Problems:** `Input` ignores its own `label`/`error` props; `Button` shows "…" for loading; no shared Card, Header, ListItem, empty/error/skeleton, pill, or sheet — so every screen reinvents them with hardcoded styles (hence 31 raw pressables and ~790 hex literals).

**New shared components to create (Phase 2), all consuming theme tokens only:**
- `AppHeader` — consistent screen header (title, back, optional action)
- `Card` — the one surface container (radius + border + optional press)
- `Button` — extend existing (keep signature; add `loading` spinner, keep variants)
- `Input` — fix to actually render `label`/`error`; keep `TextInputProps` compatible
- `Chip` / `FilterChips` — category & status selectors
- `StatusPill` — booking/request status (text + icon + color, never color-only)
- `Badge` — small counts / labels
- `ListItem` — rows for settings, addresses, orders
- `EmptyState` — illustration/icon + message + optional CTA
- `ErrorState` — retry affordance
- `Skeleton` — shimmer placeholders (via installed `react-native-reanimated`)
- `Toast` — lightweight transient feedback (replaces scattered `Alert` for non-destructive confirms)
- `Avatar` — initials/photo
- `BottomSheet` — via installed `react-native-gesture-handler` (for filters, add-vehicle, quote form)
- `ButtonRow` / `ScreenContainer` — layout helpers enforcing the spacing scale

**Dev-only component gallery** (Phase 2): a route rendered only when `__DEV__`, showing every component in every state. Excluded from production navigation.

---

## 4. Design system proposal — TWO palettes

Both are a **single light mode** (the app has no theme switching; light is best for outdoor/roadside readability). Both avoid neon, gradients, default blues, saturated blocks, and heavy shadows. One accent, used sparingly. Muted semantics. All essential pairs pass **WCAG AA (≥4.5:1)**; measured ratios below.

### Shared tokens (both palettes)

**Spacing scale (locked):** `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32`
**Radius (reduced from 9 values to 3):** `sm 8 · md 12 · lg 20 · pill 999`
**Type scale (2 families max — system only):** `display 32/38 · title 24/30 · heading 20/26 · body 16/24 · caption 14/20 · label 12/16` (weights: regular/medium/semibold only)
**Elevation (replaces borders-only flatness — soft, never heavy):** `none · card (hairline border + 0.5pt shadow) · sheet (raised)`

### Palette A — "Warm Graphite" (heritage amber)
*Soft off-white canvas, warm graphite text, a muted burnt-amber accent that descends from the app's existing orange without the brightness. Mood: crafted, warm, quietly premium — like a well-appointed car interior.*

| Token | Hex |
|---|---|
| background (canvas) | `#F4F2EF` |
| surface (card) | `#FBFAF8` |
| surface-alt (sunken) | `#EDEAE5` |
| border | `#E0DCD6` |
| border-strong | `#CFC9C1` |
| text-primary | `#1C1B19` |
| text-secondary | `#55524D` |
| text-muted | `#8A857D` |
| accent | `#A8571E` |
| accent-pressed | `#8A4617` |
| accent-soft-bg | `#F6EDE6` |
| success | `#3F7A52` |
| warning | `#9A6B10` |
| danger | `#A32C24` |

Rationale: keeps the brand's warm/amber DNA, deepens it to feel adult and premium rather than "safety-vest" bright.

Contrast (WCAG):
- text-primary on canvas **15.40:1** AA · on surface **16.50:1** AA
- text-secondary on canvas **6.96:1** AA · on surface **7.46:1** AA
- text-muted on canvas **3.28:1** — large/UI only (never body copy)
- white on accent **5.19:1** AA · white on success **5.10:1** · white on warning **4.68:1** · white on danger **7.14:1**
- accent on canvas (accent as text) **4.64:1** AA

### Palette B — "Slate Teal" (recommended)
*Cool slate-neutral canvas, cool graphite text, one deep desaturated teal accent. Mood: precise, engineered, calm-confident — the trust of a diagnostic tool, not a marketing site. Steers well clear of default Material blue by going deep and desaturated.*

| Token | Hex |
|---|---|
| background (canvas) | `#F5F6F7` |
| surface (card) | `#FCFDFD` |
| surface-alt (sunken) | `#ECEEF0` |
| border | `#E1E4E8` |
| border-strong | `#C9CFD6` |
| text-primary | `#171A1D` |
| text-secondary | `#4B5560` |
| text-muted | `#808A96` |
| accent | `#1F6F6B` |
| accent-pressed | `#175551` |
| accent-soft-bg | `#E6F0EF` |
| success | `#2E7D5B` |
| warning | `#8A6410` |
| danger | `#A32C24` |

Rationale: neutral-forward and clinical, maximizing legibility and trust for urgent, high-stakes moments; the teal is the only chromatic note and stays rare.

Contrast (WCAG):
- text-primary on canvas **16.15:1** AA · on surface **17.15:1** AA
- text-secondary on canvas **7.01:1** AA · on surface **7.45:1** AA
- text-muted on canvas **3.24:1** — large/UI only
- white on accent **5.92:1** AA · white on success **5.00:1** · white on warning **5.37:1** · white on danger **7.14:1**
- accent on canvas (accent as text) **5.48:1** AA · accent on accent-soft-bg **5.10:1** AA

**Recommendation:** Palette B — highest contrast margins and the calm, trustworthy tone the brief calls for. Choose A if you'd rather preserve the existing orange lineage.

---

## 5. Screen-by-screen redesign notes

*(Layout/hierarchy changes only — no logic, navigation, or data changes. "States" = loading/empty/error/offline to add.)*

- **Auth (login/register/verify-otp/forgot/reset):** unify on shared `Input` (now rendering labels+errors) and shared `Button`; wrap all in `ScreenContainer`; add ScrollView where missing so large-text doesn't overflow; header with brand mark + calm typography. States: inline field errors (already Alert — keep for submission, add inline). `verify-otp`: style Resend as a proper link-button (stub logic untouched).
- **`(app)/index` (home):** restyle the existing placeholder text within the new system; add skeleton loading and an empty state that match current content (no invented data). *Note: tab-route mismatch is a nav issue — reported, not fixed here.*
- **requests/create:** adopt `Chip` for the category row (incl. TOWING), `Input`+`Button`, consistent spacing. Add a photo-capture **slot** styled to match — but since no upload logic exists, leave the existing `[]` behavior; only present the section as "add photos" affordance if a picker already exists (it does not — skip).
- **requests/my:** restyle filter chips with `FilterChips` + `StatusPill` on cards; skeletons for FlatList; keep existing empty-with-CTA. *(Dead filter logic flagged separately.)*
- **requests/[id]:** move body into a proper `ScrollView`; `Card` for quote rows; `ButtonRow` for Accept/Cancel; `StatusPill` for status; skeletons + error state.
- **broadcast-feed:** `Card` + `Chip` filters + `Button` for Quote; skeletons + empty + error.
- **my-quotes:** `Card` list with `StatusPill`; skeletons + existing empty; consistent withdraw action styling.
- **messages (list + thread):** `ListItem` for threads; thread gets `KeyboardAvoidingView`, message bubbles themed, `Input`+`Button` composer (Send logic untouched); skeletons + empty ("no messages yet").
- **bookings + booking/[id]:** themed `BookingCard`; wrap detail in `ScrollView`; `Card` sections; skeletons + empty + error.
- **payments (pay/[id], verify, escrow):** `Card` summary + `CostBreakdown`; styled `Button`s for the existing (stubbed) checkout; skeletons + error. Preserve all dev-mode affordances.
- **profile / provider-profile:** themed form (`Input` renders labels), `Avatar`; skeletons + error. *(Blank-after-load bug flagged, not fixed.)*
- **vehicles / addresses:** themed lists + forms; convert add-vehicle into a proper themed sheet with ScrollView/KAV; skeletons + empty.
- **provider/[id]:** `Card` sections, `Avatar`, rating via text+icon (not `>` chars); reviews empty state; skeletons.
- **shop / shop/[id] / my-orders / my-listings / listings/*:** replace 🔧 emoji with a neutral themed image placeholder; `Card` grids/lists; `Chip` filters; skeletons + empty + error; fix "Price Price" labels.
- **notifications / push-token:** themed rows, `ListItem`, `Button`; fix refresh-loader; show enabled state.
- **(app)/providers, (app)/activity, escrow, pay/verify (placeholders):** restyle existing placeholder content to the new system with skeletons/empty/error — no invented data.

Offline: add a lightweight offline banner component reused app-wide (visual only) since connectivity handling is out of scope to change.

---

## 6. Phase breakdown

**Phase 1 — Design system (theme module + tokens)**
- Create `src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/radii.ts`, `src/theme/spacing.ts` (supersede existing `constants/spacing.ts` — do not delete it, keep re-export for compat), `src/theme/elevation.ts`, `src/theme/index.ts` (barrel). Optional `ThemeProvider` only if needed; a plain token object suffices for single-mode.
- Deliverable: file list, tsc/lint vs baseline, one commit.

**Phase 2 — Shared components + dev gallery**
- Build `AppHeader`, `Card`, extend `Button`, fix `Input`, `Chip`/`FilterChips`, `StatusPill`, `Badge`, `ListItem`, `EmptyState`, `ErrorState`, `Skeleton`, `Toast`, `Avatar`, `BottomSheet`, `ScreenContainer`, `ButtonRow`, offline banner. All tokens-only.
- Add `src/app/_dev/gallery.tsx` (dev-flagged, not in prod nav).
- Deliverable: file list, tsc/lint, one commit.

**Phase 3 — Auth & onboarding** → migrate 5 auth screens.
**Phase 4 — Home** → `(app)/index` + `(app)/_layout` styling.
**Phase 5 — Request creation & photo capture** → `requests/create`, `requests/my`, `requests/[id]`, `broadcast-feed`.
**Phase 6 — Quotes & comparison** → `my-quotes`.
**Phase 7 — Chat** → `messages.tsx`, `messages/[threadId].tsx`.
**Phase 8 — Bookings & payments** → `bookings.tsx`, `booking/[id].tsx`, `bookings/pay/[id].tsx`, `pay/[id]/verify`, `(app)/escrow`.
**Phase 9 — Profile & settings** → `profile`, `provider-profile`, `vehicles`, `addresses`, `provider/[id]`, `notifications`, `notifications/push-token`.
**Phase 10 — Shop/orders/listings + leftovers** → `shop`, `shop/[id]`, `my-orders`, `my-listings`, `listings/create`, `listings/[id]`, `(app)/providers`, `(app)/activity`.

Each flow phase: apply tokens + shared components, fix hierarchy/spacing, add skeletons/empty/error, verify small & large phones, run tsc+lint vs baseline, commit once.

**Final phase — Consistency sweep:** grep for leftover hex/radius/spacing magic numbers, remove unused old styles, add missing `accessibilityLabel`s, verify single light mode. Baseline-vs-final comparison + device checklist.

---

## 7. Risks

- **Screens that could not be safely re-parented without touching layout logic:** `requests/[id].tsx`, `booking/[id].tsx`, `vehicles.tsx` modal currently overflow because content sits in a non-scrolling `View`. Wrapping in `ScrollView` is a *visual* fix but changes measured layout — do it conservatively, keep `flex` behavior, and test on small+large phones.
- **Animated/measured layout:** none found (zero reanimated usage today). Skeletons will *introduce* reanimated — keep animations to opacity/transform only, no layout-measurement coupling to logic.
- **Dead `onPress={() => {}}` handlers** (`bookings` card, chat Send, "Copy Order ID"): these are stubs. Restyle but **do not** wire new behavior (that'd be a logic change). Leave as visually-disabled or clearly-styled stubs.
- **Behavior bugs found but out of scope** (do NOT fix in a visual pass, report instead): verify-otp `purpose` never set (forgot→reset unreachable); `requests/my` dead status filter; blank-form-after-load in `profile`/`provider-profile`; `(app)/_layout` declares 7 nonexistent tab routes + one orphan; chat/`messages` hardcoded; Razorpay checkout dev-stub.
- **Feature flags / One-Tap Towing:** TOWING is a request category (`requests/create`, `broadcast-feed`) plus provider towing-fee fields in `useProfile`. Style the category chip like others; do not alter flag/env handling (`EXPO_PUBLIC_*` untouched).
- **Props/signature compatibility:** extend `Button`/`Input` with optional props only; `Input` will start honoring `label`/`error` (it already accepts them) — additive, not breaking.
- **`react-native-maps` + `expo-location` installed but `TrackingMap` is a text placeholder:** implementing a real map is a *feature*, not a redesign. Keep placeholder, style it to match. Flag as suggestion.

---

## 8. Baseline results (recorded, not fixed)

- **Typecheck** — `npm run typecheck -w @weyro/mobile`: **0 errors** (exit 0).
  - Root `npx tsc --noEmit` reports `TS18003: No inputs found` because root `tsconfig.json` excludes `apps/`/`packages/` — run per-workspace instead.
- **Lint** — `npm run lint -w @weyro/mobile`: **0 errors, 80 warnings** (all pre-existing: `no-unused-vars` for unused imports/vars, `import/no-duplicates`, `exhaustive-deps`).

These are the numbers every later phase must match or beat.

---

### Suggested (missing) screens — NOT to be built, listed for the backlog
Onboarding/welcome, Help/Support/FAQ, Terms & Privacy, dedicated Reviews screen + write-review, Settings (change password, delete account, language, theme), Wallet/transaction history, Provider KYC/verification upload, Booking cancel/reschedule, booking detail reachable from list, full-screen image viewer, map-based address picker.
