# Mapping system

## Provider: Mapbox

Chosen over Google Maps Platform because the whole feature runs on Mapbox's
REST APIs — Raster Tiles, Geocoding v5 and Directions v5 — so it works in the
existing dev client with **no native map SDK and no rebuild**. Google's mobile
maps require the native SDK (or a WebView), which the current build cannot
accept. Mapbox also gives one public token for tiles + search + routing, a
purpose-built dark automotive style, and usage-based pricing that is easier to
cap than Google's per-SKU mix.

No secret token is ever shipped. Only `EXPO_PUBLIC_MAPBOX_TOKEN` (a `pk.` token)
is read by the client.

## Configuration

Add to `apps/mobile/.env` (and the EAS environment):

```
EXPO_PUBLIC_MAPBOX_TOKEN=pk.xxxxxxxx
# optional
EXPO_PUBLIC_MAPBOX_STYLE=mapbox/dark-v11
```

Restrict the token in the Mapbox dashboard to:

- the iOS bundle id `com.weyro.app` and Android package `com.weyro.app`
- styles **tiles** (raster) and the **geocoding** and **directions** endpoints
- no secret scopes

Restart Metro after adding the token. Without a token the app stays usable:
manual address entry, saved addresses and a one-shot GPS fix. The map surface
shows an honest "map preview unavailable" state; it does not pretend to be a
map.

## Components

| File | Purpose |
| --- | --- |
| `src/maps/config.ts` | Public token, dark style, market bias, debounce/cost constants |
| `src/maps/geo.ts` | Spherical Mercator projection, tile maths, haversine, fit-to-bounds, distance/duration formatting |
| `src/maps/client.ts` | Mapbox autocomplete, reverse geocode, directions; timeouts, abort, LRU cache |
| `src/maps/useDeviceLocation.ts` | One-shot GPS fix; requests permission only on tap; no polling |
| `src/maps/useDirections.ts` | Route + distance + ETA between two committed points |
| `src/maps/MapSurface.tsx` | Raster tiles, UI-thread pan/pinch, centre pin, draggable markers, route polyline, zoom controls, attribution |
| `src/maps/LocationPicker.tsx` | Full-screen search + map + bottom-sheet confirmation; saved places; manual address; GPS |
| `src/maps/LocationField.tsx` | Location as a form field — never latitude/longitude |
| `src/maps/RoutePreview.tsx` | Pickup/destination pins + route line + distance/ETA; draggable pins re-resolve addresses |

Integration points:

- `src/app/requests/create.tsx` — the single request form, now service-aware
- `src/app/(app)/index.tsx` — Home location selector opens the picker and saves
  the primary address (no permanent map)
- `src/app/addresses.tsx` — saved addresses chosen on the map, no coordinate
  fields

## Service matrix

| Service | Map | Behaviour |
| --- | --- | --- |
| Repair | Optional | Vehicle location; falls back to the saved address |
| Maintenance | Optional | Garage/service address; falls back to saved |
| Spare parts | Conditional | No map for dealer pickup; delivery address only when "Deliver to me" |
| Towing | Required | Pickup + destination, equipment, route line, distance, ETA, server-side fare |
| Roadside | Required | Assistance point + battery/tyre/fuel kind; GPS, pin adjustment, confirmation |
| Inspection | Required | Inspection location chosen and confirmed |
| Home | On demand | Modal picker; saved as the primary address |

## Backend

No API contract change was needed. `CreateServiceRequestSchema` already
accepts `address`, `latitude`, `longitude`, `fulfillmentType`,
`dropoffAddress/Latitude/Longitude`, `towingVehicleType`, `roadsideKind`.
The API already persists the dropoff and computes `towingDistanceKm` and the
estimated fare. Verified end-to-end: a towing request stored pickup
`12.9716,77.5946`, dropoff `12.9352,77.6245`, `towingDistanceKm = 5.18`,
`TOW_TO_GARAGE`.

Live provider tracking: the API exposes `GET /bookings/:id/tracking` and
`PATCH /bookings/:id/location`, but provider builds never report a location, so
the customer app would always render "not available". The booking screen states
that honestly instead of simulating a moving marker. Missing backend piece:
a provider-side periodic location update while a booking is en route.

## Cost and performance controls

- Search is debounced 320 ms, abortable, minimum 3 characters.
- Reverse geocoding runs only after a gesture settles, debounced 450 ms, and is
  skipped for pans under 12 m.
- An LRU cache (160 entries) absorbs repeated searches/reverse lookups; routes
  cache for 45 s, geocoding for 5 minutes.
- GPS is a single fix per tap; no watchPosition, no interval.
- Tile grids are rebuilt only when a gesture ends; pan/pinch animate on the UI
  thread, so dragging never re-renders React.
- Attribution and a token-gated surface avoid blank-tile confusion.

## Tests

- `__tests__/maps-geo.spec.ts` — projection round-trip, pixel offsets,
  haversine, formatting, fit-to-bounds, route simplification.
- `__tests__/maps-client.spec.ts` — autocomplete parsing, proximity/country,
  cache hit, route parsing, empty-route error, HTTP error mapping, no-token
  short-circuit.
- Manual web runs at 390×844: login, Home location save, all six category
  variants, pickup/destination pickers, saved-place reuse, denied GPS handling,
  towing submission and persistence.

`tsc`, `eslint --max-warnings 0` and `jest` are green (23 tests).

## Known limits

- A real Mapbox token is required for tiles, autocomplete, reverse geocoding and
  routing; it was not available in this environment. The tile/route render path
  is therefore not visually verified, while the UI, fallback, persistence and
  request flows are.
- Without a token, a typed address keeps the pin at the current map centre /
  saved coordinate. The picker says so; the production path always has a token.
- Device verification (iOS/Android) is still pending; web renders and the API
  were used here.
