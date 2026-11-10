# Home, ads and skills — working plan

Last updated: 2026-11-11

## 1. Home structure (multi-scroll)

Home is one vertical `ScrollView` with two nested horizontal rails. It currently
runs 1.5–2.5 screens depending on data:

```
chrome (wordmark · search · alerts · avatar)
hero (owned photo, title, one primary + one secondary action)
location row + SOS
01  Services          vertical job-sheet index (6 rows)
02  Your vehicle      vehicle row or add-vehicle row
03  Status            active requests + next booking
    AD SPACE          labelled, 100pt reserved slot (one per screen)
04  Spare parts       horizontal rail: real parts, else 6 categories
05  Packages          vertical P1–P3 rows
06  History           horizontal rail: completed/cancelled bookings
07  Assurance         three factual lines
footer
```

Rules: no infinite scroll, no hidden sections, and section indices never skip —
empty rails render a real navigation card instead of disappearing.

## 2. Ad space contract

Component: `src/components/ui/AdSlot.tsx`

- Exactly **one** slot per screen, placed at a natural break (Home: after
  Status, before Spare parts) — never in the hero, never beside the primary CTA.
- Always labelled **“Ad space”** with the reserved size, until a network fills it.
- Fixed height so the layout never jumps when the ad loads or fails.
- `placement` prop is the stable id (`home-sponsored`) and the `testID`
  (`ad-slot-home-sponsored`) for analytics and tests.

### Real ads — phases

| Phase | Work | Blocker |
|---|---|---|
| A (now) | Labelled reserved slot; house placements only if needed | none |
| B | Install `react-native-google-mobile-ads`, app IDs, test unit IDs, UMP consent + ATT, render banner/native inside `AdSlot` | **requires a new native build** |
| C | Play “contains ads” + data safety, ASC privacy + ATT string, `app-ads.txt`, AdMob policy audit | store accounts |

One banner per screen, ≥50pt from tappable content, no launch interstitials.

## 3. Skills installed (instructions only — no runtime impact)

| Skill | Use when |
|---|---|
| `unslop` | auditing/redesigning a screen that looks AI-generated |
| `ponytail` | keeping the smallest complete change |
| `graphify` | codebase graph questions (needs `graphify-out/`) |
| `react-native-reusables` | adding/altering RN primitives |
| `monetize-admob` | wiring AdMob + privacy re-declaration checklist (not field-tested) |
| `admob-policy` | before shipping ad code / after a Policy Center warning |
| `eas-build-doctor` | EAS or native build failures |
| `eas-ota-discipline` | publishing/verifying OTA updates |
| `better-interface` | ranked review of a screen/flow |
| `better-ui` | surfaces, icons, motion values |
| `better-typography` | type scale, wrapping, figures |
| `better-colors` | palette/contrast checks |
| `better-layout` | grouping, reading order, responsiveness |
| `better-accessibility` | WCAG 2.2, focus, labels, motion |

All are MIT/CC-BY as noted in their own SKILL.md. Skills never execute code on
their own; they are only loaded on demand.

## 4. Screen rollout (next)

Apply the Home system — hero, hairline index, mono figures, one accent — in this
order, one screen per checkpoint:

1. `requests/create` (post requirement)
2. `requests/[id]` (dealer responses)
3. `booking/[id]` (track order)
4. `shop` + `shop/[id]`
5. `bookings`, `my-quotes`
6. `vehicles` + detail
7. `profile` + account menu
8. `sos`, `help` (already built; align to the new system)
9. provider dashboard / opportunities / orders
10. admin screens

## 5. Verification per screen

- `npx tsc --noEmit`, `npx eslint src --ext .ts,.tsx --max-warnings 0`
- Render the screen at 390×844 and compare with the reference/previous shot
- Check: one accent, 4pt rhythm, no stock-photo filler, labelled ad slot if the
  screen is monetised, real empty states.

## 6. Imagery rule and needed photos

Only owned or clearly relevant photography is used. Random luxury-car stock was
removed after it showed a Ferrari for "Spare parts" and a Bugatti for "Towing".

Currently used: `hero-primary.jpg` (hero), `hero-secondary.jpg` (editorial
band), `carPhotoFor()` for the user's vehicle, and real `part.imageUrl` only.

To add more real pictures, drop these into `apps/mobile/assets/images/`:

| File | Size | Use |
|---|---|---|
| `workshop-1.jpg` | 1200×800, ≤300 KB | service band / roadside |
| `tow-1.jpg` | 1200×800 | towing service |
| `parts-1.jpg` | 1000×700 | parts rail header |
| `inspection-1.jpg` | 1000×700 | inspection service |

No text baked into images; dark edges where type may sit.

## 7. Known constraints

- `react-native-google-mobile-ads` needs a native rebuild (no AdMob until then).
- `expo-blur` is not in the installed binary — no native blur.
- Category photography is limited to owned assets; do not reintroduce random
  stock car tiles.
