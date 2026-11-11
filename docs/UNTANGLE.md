# Untangle pass — 2026-11-11

First pass against `feat/premium-ui`, baseline `fbed50c`.
Skill: `~/.agents/skills/untangle/SKILL.md`.

## Result

```
Untangled:   removed dead surfaces, merged duplicated formatters, dropped an
             unused native dependency, deleted an unreachable placeholder route
Deleted:     8 files, 745 net lines, 1 dependency (expo-blur)
Merged:      vehicles/[id] local labelize + formatDate -> utils/format
Moved:       none (no relocation earned its risk this pass)
Gates:       tsc 0 -> 0, eslint 0 -> 0, jest 23/23 -> 23/23
```

Commits:

- `9fee0b9` delete dead components and unused payment hook
- `aef36e8` use shared formatters in vehicle detail
- `a6b7087` drop unused expo-blur
- `6d3bbf3` remove unreachable dealer-discovery placeholder

## What was proven dead

| Removed | Why |
| --- | --- |
| `ui/icon.tsx`, `ui/GlassPanel.tsx` | no imports; blur module never shipped |
| `booking/CostBreakdown.tsx`, `booking/BookingCard.tsx` | no imports; emptied the folder |
| `art/BlueprintSpec.tsx`, `art/BrandMark.tsx` | no imports; `PorscheSketch911` stays |
| `hooks/usePayments.ts` | no imports; payments deferred |
| `(app)/provider-search.tsx` | no link, tab entry or navigation; stale "coming soon" |

`PorscheSketch911` was kept — it is used by login.

## Deliberately left alone

| Item | Why |
| --- | --- |
| `(app)/index.tsx` — 1099 lines, 59 commits | highest churn, but no tests; splitting needs a render harness first |
| `maps/LocationPicker.tsx` 826, `requests/create.tsx` 718 | new, cohesive, actively changing; splitting now would slow the map work |
| `components/ui` legacy (`AppHeader`, `Card`) | still used by 13 screens; migration is a UI pass, not an untangle |
| API `RequestIdMiddleware` | duplicates request-id logic in `main.ts`; needs an ops decision |
| API `IdempotencyMiddleware`, `SentryHook` | written but unwired; deleting could remove planned hardening |
| API `quotations.service.ts` 947, `spare-parts.service.ts` 833 | behaviour-heavy with tests; split only along a real seam |

## Next three moves (ranked)

1. **Home split** — extract the hero, service index, status, parts and footer
   sections from `(app)/index.tsx` into `components/home/*`, moving JSX with
   explicit props. Add one render check before and after. Net lines will not
   drop; the win is reviewability. Do this before the next Home feature.
2. **Decide the API middleware** — either wire `IdempotencyMiddleware` +
   `SentryHook` and delete `RequestIdMiddleware`, or delete all three. Do not
   leave three unwired cross-cutting files.
3. **Service split** — `quotations.service.ts` along booking lifecycle vs
   tracking vs reviews; only after the current e2e suite is green and the
   customer flows stop changing.

## Rule for the next pass

One move per commit, gates after each. If a move needs a product decision or
has no test seam, write it here instead of guessing.
