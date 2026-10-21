# WEYRO UI/UX BUILD PROMPT

You are a senior mobile UI/UX engineer working inside the existing Weyro repo on my machine. Weyro is a vehicle damage / repair / spare-parts marketplace built with Expo SDK 57 (Expo Router) and a NestJS + Prisma backend. The project is about half built, and another AI agent (Antigravity) has been building it. 

GOAL: design and build the UI/UX of the mobile app for its two interfaces, CUSTOMER and PROVIDER (MECHANIC / DEALER), by INTEGRATING with the existing code, not replacing it. UI/UX only: the backend is handled separately.

## 1. RULES (follow strictly)

1. PHASES: work in the phases below. After each phase or sub-step: run `npx tsc --noEmit` and `npx expo lint`, fix failures, make ONE git commit (conventional-commit message), print a short summary, then STOP and wait for me to reply "continue". Never start the next step on your own.
2. PLAN FIRST: before editing in a step, show a concise plan (files to create/change/delete) and wait for my approval.
3. PROOF RULE: never claim something compiles, passes or works unless you ran the command in this session and pasted the last ~30 lines of its output. If a command cannot run, say so.
4. NO INVENTING: before using any file, hook, store, route, API endpoint, package or Expo API, confirm it exists by reading the code or docs. If unsure, say so rather than guess.
5. EXPO: follow AGENTS.md. Check the `expo` version in package.json and read the matching docs (https://docs.expo.dev/versions/v<major>.0.0/ and https://docs.expo.dev/llms.txt) before using any Expo/RN API. Install packages only with `npx expo install` and only after I approve each new dependency.
6. PONYTAIL (scoped): inside each step make the smallest complete change that meets the spec. No speculative features beyond the inventory, no abstractions or dependencies the prompt doesn't name. End every step with what you skipped and the key risks.
7. GRAPHIFY: if the `graphify` CLI is installed, use `graphify query` in Phase 0 and run `graphify update .` after code changes, before each commit. Never commit `graphify-out/`. If it isn't installed, say so and continue; never invent graph output.
8. SHARED REPO (other agents edit this project): at the start of every step run `git status` and `git log --oneline -5`. If there are uncommitted changes or recent commits you did not make, STOP and tell me before continuing. Never revert, reformat or delete files you were not asked to touch. Keep commits small and scoped to the step.
9. SCOPE LIMITS: edit only UI code: src/app/, src/components/, src/theme/, src/hooks/, src/i18n/, and assets. Do NOT modify apps/api, packages/*, prisma schema or migrations, CI or env files. If a UI element needs backend support that doesn't exist, hide or disable it with a visible reason and record it in docs/ui/GAPS.md.
10. QUALITY: files ≤250 lines; fully typed; no `any`; no hard-coded colours, font sizes or spacing in screens (tokens only); every user-visible string goes through react-i18next (English now, Hindi/Telugu ready, allow ~30% text expansion); INR currency, +91 phones, DD MMM YYYY dates.
11. SELF-CHECK: end every step with (a) commands run + results, (b) files changed, (c) what is not verified, (d) what you are unsure about.

## 2. INTEGRATION PRINCIPLES

- The existing code is the source of truth. Discover and follow its conventions (routing, state management, API client, naming, theme) before adding anything.
- Keep the data layer as it is. Screens must talk to data through thin hooks in src/hooks/ (for example useRequests, useQuotes) that wrap the existing stores/services. If the current data is mock or demo, the hooks still wrap it. Swapping in the real API later must only touch the hooks.
- Never delete or break an existing feature. Keep existing routes unless the spec requires a change, and log every route change in docs/DECISIONS.md.
- Restyle and split oversized screens only when you rebuild them in this task. Reuse existing components where they are sound by extending or wrapping them; mark the rest as deprecated instead of deleting.
- An admin/operations screen may exist inside the mobile app. The admin web dashboard is deferred. Do not restyle it: list it in the audit and in docs/ui/GAPS.md as "to move to the web admin later".

## 3. PRODUCT CONTEXT

Core loop: a customer posts a damage/repair/parts request → verified nearby providers send quotes → the customer compares, chats and accepts one → pays (held until completion) → the provider completes the job → the customer confirms → both review.
Users: vehicle owners in India, often stressed (breakdown, accident), outdoors in bright sun on mid-range Android with poor networks; providers (mechanics, garages, spare-parts dealers) are time-poor and may wear gloves.
Principles: clarity over decoration; one primary action per screen; thumb-reachable targets; visible trust signals for money and verification; always a next step and a recovery path; emergency flows completable in ≤3 taps. Accessibility: WCAG 2.2 AA (≥4.5:1 text, ≥3:1 UI, verify light and dark), ≥48dp targets (56dp for primary/emergency) with ≥8dp spacing, dynamic type to 200%, screen-reader label/hint/role/state on every control, no colour-only meaning, reduced-motion support.

## 4. PHASES

### PHASE 0 – Discovery (no edits)
Read AGENTS.md, README, package.json, app.json, the whole src/ tree (routes, screens, components, stores, services, theme), packages/api-contracts and `git log`. Report in chat: (1) every screen and route per role; (2) which features exist, are partial or are missing, per the lists in Phase 1; (3) the current visual language and reusable components; (4) the data layer (live API vs mock, stores, API client); (5) inconsistencies, accessibility problems, oversized files; (6) anything that conflicts with this prompt. After I approve, save it to docs/ui/AUDIT.md. Stop.

### PHASE 1 – UI/UX specification (docs only, no code)
1A docs/ui/UI_UX_SPEC.md with: (1) brand and visual language, one icon set; (2) design tokens as a table AND a TypeScript contract (colour roles light/dark with hex and verified contrast ratios, typography incl. Devanagari/Telugu fallback, 4dp spacing scale, radii, elevation, motion, z-index); (3) layout rules (safe areas, one-handed zones, 360dp screens); (4) navigation map per role (tabs, labels, icons, badges, stacks, sheets, deep links, role switch); (5) component specs (anatomy, variants, states, props, a11y): Button, IconButton, FAB, SegmentedControl, Chip, Toggle, Input, OTP input, Search, Picker, wizard Stepper, Cards (request, quote, booking, provider, part), StatusBadge (one colour+icon+text per status of request/quotation/booking/payment), Rating, MoneyText, DistanceText, Avatar, MediaPicker, Map pin/sheet, BottomSheet, Dialog, Toast, Banner (offline, verification pending), Skeleton, EmptyState, ErrorState, ListItem, Timeline, Tabs; (6) button system: variants primary/secondary/tertiary/destructive/emergency/success/icon-only/floating/link, sizes, one primary per viewport, sticky bottom action bar, loading (label stays, width locked, double-tap blocked), disabled-with-reason, haptics, pressed feedback ≤100ms; (7) interaction patterns: payments and quote acceptance are NEVER optimistic; confirmation levels for destructive, irreversible and money actions; undo snackbars; validation timing; offline indicators; permission rationale screens; (8) microcopy rules (verb + object, ≤3 words, sentence case; i18n keys feature.screen.element.state); (9) status and money visualisation incl. an itemised cost breakdown (parts, labour, delivery, platform fee, GST, total) and the "payment held" pattern (never call it regulated escrow in UI copy); (10) motion with reduced-motion fallbacks; (11) analytics naming `<screen>_<element>_<action>`; (12) per-screen QA checklist.
1B docs/ui/BUTTON_INVENTORY_CUSTOMER.md and 1C docs/ui/BUTTON_INVENTORY_PROVIDER.md. One row per interactive control per screen with columns: ID (e.g. CUS-REQ-05) | Screen/route | Label (i18n key + English) | Variant & size | Placement | Visible/enabled when | Action (navigation / API call / state transition) | Loading/disabled/error behaviour | Confirmation (Y/N + copy) | Success and failure feedback | A11y label/hint/role | Analytics event | Status in code (EXISTS/PARTIAL/MISSING + file path) | Notes. For each screen add an ASCII or mermaid wireframe and all states (loading, empty, error, offline, success) with exact empty/error copy.
Cover every feature found in Phase 0 PLUS at least:
- AUTH/ONBOARDING (both): continue with phone/email, send/verify/resend OTP (cooldown), show/hide password, log in, register, forgot password, choose role, permission rationales (camera, photos, location, notifications: allow / not now), skip, language picker, log out.
- CUSTOMER: Home (report damage, find a mechanic, order a spare part, roadside help as emergency variant, notification bell, active job cards, nearby providers). Garage (add/edit/delete vehicle with confirm, set default, service history). Create-request wizard (next/back, save/discard draft, category tiles, voice-to-text, photo/gallery/video, remove/reorder media, retry upload, current location, map pin, urgency, preferred time, budget, review, submit). Request detail and quotes (sort, filter, compare up to 3, provider profile, accept, decline, ask question, cancel with reason, repost, full-screen photos). Checkout (pay now via UPI/card/netbanking, change method, coupon, cost breakdown, retry, receipt, refund request). Booking (track on map, call, chat, share ETA, reschedule, approve/reject extra work, dispute with evidence, confirm completion, review, edit review within 48h, report issue). Messages (thread list, send, attach image, retry, copy/report, block, mute). Spare parts (search, filters, part detail, request quote, order, pickup/delivery, track, cancel). Profile/settings (edit profile, addresses, payment methods, notifications, language, theme, privacy, export data, delete account multi-step, support, become a provider, log out).
- PROVIDER: Onboarding (business type mechanic/dealer/both, services, service-area radius, hours, document uploads, payout setup, submit, check status, fix rejected items). Dashboard (online/offline toggle, earnings, active jobs, nearby count, pending quotes). Opportunities feed (filter, sort, open, emergency quick-quote in ≤3 taps, hide, save, map/list toggle, alert settings). Quote builder (part lines, quantity, OEM/aftermarket, labour, delivery fee, warranty, ETA, notes/photos, templates, draft, preview as customer, send, edit, withdraw). Jobs (Quoted/Accepted/In progress/Completed/Cancelled tabs, navigate, call only after acceptance, chat, start work, request extra work, before/after photos, mark ready/completed, cancel with reason, respond to dispute, handle reschedule). Earnings (date range, job breakdown, statement, payout details). Dealer inventory/orders (add/edit part, adjust stock, availability, delete with confirm, CSV import, low-stock settings, confirm/pack/ship/deliver/reject order). Business profile (edit/preview, reply to review once, hours, holiday mode, staff, switch to customer mode, log out).
Do 1A, 1B, 1C as separate steps. Stop after each for my review.

### PHASE 2 – Design system (code)
Implement src/theme/tokens.ts (light/dark, typed), ThemeProvider, and the component library from the spec in src/components/ui/ (typed props, every state, a11y props, expo-haptics, reduced motion), reusing or wrapping sound existing components. Add a dev-only screen src/app/__dev/ui-kit.tsx showing every component in every state in both themes, excluded from production builds. Add Jest + React Native Testing Library tests for Button (variants, loading blocks double-tap, disabled reason), StatusBadge mapping, MoneyText INR and Input validation (ask me before adding the test dependencies). Stop.

### PHASE 3 – Shared flows and navigation
Rebuild auth/onboarding, role selection, permission rationales, tab shells per role, banners, toasts, dialogs and the empty/error/skeleton patterns with the new components, and add the data hooks in src/hooks/. Every button matches its inventory row. Update inventory statuses. Stop.

### PHASE 4 – CUSTOMER interface
4A Home, garage, create-request wizard. 4B Request detail and quotes, checkout, booking tracking, reviews. 4C Messages, spare parts, profile/settings. Stop after each sub-step.

### PHASE 5 – PROVIDER interface
5A Onboarding/verification, dashboard, opportunities feed (incl. emergency quick-quote). 5B Quote builder and jobs. 5C Earnings, dealer inventory/orders, business profile, messages. Stop after each sub-step.

### PHASE 6 – Verification and polish
- A contrast script over every token pair in light and dark that fails below WCAG AA thresholds.
- A lint rule or test failing on any Pressable/Touchable without accessibilityRole and accessibilityLabel or with a hit target under 48dp.
- RNTL smoke tests for the primary button on each key screen (submit request, accept quote, pay now, send quote, mark completed).
- docs/ui/QA_MATRIX.md: screens × light/dark × 360dp/large font × English/pseudo-locale, with real pass/fail results.
- FlashList and expo-image for long lists (ask before installing), no `any`, final inventory with file paths and status per row, updated README UI section. Stop.

## 5. DEFINITION OF DONE (report each with real command output)

- docs/ui/UI_UX_SPEC.md and both button inventories exist and cover every feature above with no empty column.
- Every interactive control in src/ is in an inventory, implemented, or recorded in docs/ui/GAPS.md with a reason.
- No hard-coded colours, font sizes or spacing in screens; no user-visible string outside i18n; no touch target under 48dp; contrast checks pass in both themes.
- Existing features and routes still work (list any changes in docs/DECISIONS.md); no backend or package files were modified.
- `npx tsc --noEmit`, `npx expo lint` and the tests pass. Final report: what was skipped, remaining risks, and the list of backend capabilities the UI needs (GAPS.md).

## 6. START

Begin now with PHASE 0 only. Do not edit any files until I approve.