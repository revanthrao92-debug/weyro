# Screen refinement backlog

Last updated: 2026-11-11

Home is the approved standard. A screen is **meaningful** when it has real data,
complete states (empty / loading / error), working actions, and no dead rows or
"coming soon" placeholders. This backlog tracks screens that still fail that
bar.

## Rules

- No dead links or rows without an action.
- No "Coming soon" unless it is a real roadmap item with a target.
- Every list screen: empty state with a way forward, loading skeletons, error
  state.
- Reuse Home's system: job-sheet rows, mono figures, one accent, hairlines.
- No stock photography; owned or real listing images only.

## Priority order

| # | Screen | Current state | What "meaningful" means |
|---|---|---|---|
| 1 | `bookings` | Basic list, old header, no grouping | Group **Upcoming / Past**, show provider + vehicle + amount, status timeline hint, empty state → Post request |
| 2 | `vehicles` | Long form/list, no visual hierarchy | Showroom rows with car photo, plate in mono, year/fuel; add/edit/delete; default vehicle badge |
| 3 | `messages` | List with avatar only | Show last message + time + unread count, empty state, thread header with provider + booking context |
| 4 | `profile` | Rows, some "Coming soon" | Wire Help (done), add Requests/Orders shortcuts, honest disabled rows, role + verification state |
| 5 | `shop` | Catalogue with filters | Category chips, stock/condition on cards, part detail gallery + fitment notes |
| 6 | `requests/create` | Restyled, works | Section validation feedback, photo requirements, distance/location helper |
| 7 | `requests/my` | Basic list | Group open vs closed, quote counts, empty CTA |
| 8 | `requests/[id]` | Restyled quotes | Expired quote state, withdraw feedback, provider card detail |
| 9 | `booking/[id]` | Timeline | Live tracking actions, contact provider, invoice/payment state |
| 10 | `help` / `sos` | New, consistent | Minor polish only |
| 11 | provider dashboard / opportunities / orders | Functional, old style | Apply Home system; KPIs, request rows, status |
| 12 | admin (`providers`, `escrow`, `activity`) | Functional, old style | Data tables in the Home language |

## Known dead ends to remove

- `profile` → "Wishlist" alert: wire to a real saved-items screen or remove.
- `profile` → "Payment Methods — Coming soon": no action; keep only if payments
  UI ships.
- `shop` → checkout dead-ends at "Proceed to payment verification" (no mobile
  payment screen yet) — Phase 1 backlog.

## Next action

Start at #1 `bookings`: restyle to the job-sheet system, group upcoming/past,
real empty state. One screen per checkpoint, rendered and compared before moving
on.
