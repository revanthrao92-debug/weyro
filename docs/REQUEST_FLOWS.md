# Service-specific request flows

One route, six flows. `/requests/create` now renders a single config-driven
wizard instead of the old generic form.

## Architecture

```
src/app/requests/create.tsx            thin route wrapper
src/components/requests/
  RequestWizard.tsx                    state, steps, navigation, submission
  serviceRequestConfig.ts              field configs, validation, mapping
  RequestReview.tsx                    review screen
  VehicleSelector.tsx                  saved vehicle switch + manual fallback
  PhotoPicker.tsx                      existing uploader (+ helper prop)
```

Adding a service means adding one object to `SERVICE_LIST`: fields, copy,
photos, location mode, urgency mode, title/description composition, prefill and
validation. There is no second form to maintain.

### Steps

1. **Details** — only that service's fields; photos where relevant.
2. **Vehicle & location** — saved vehicle switch, location handling, urgency,
   broadcast.
3. **Review** — every value, photos, route, contact; edit links and submit.

State lives in the wizard, so Back preserves every answer. Progress is shown
with a three-segment bar and mono step label.

## Field matrix

| Service | Fields | Photos | Location |
| --- | --- | --- | --- |
| Repair | Damage type, affected area, issue description, drivable | Up to 4 | Saved address, changeable |
| Maintenance | Service type, odometer, last service (optional), preferred date, notes | — | Saved address, changeable |
| Spare parts | Part name, part/OEM number, quantity, new/used, fitment notes | Up to 4 | Pickup: saved address, no map. Delivery: delivery address |
| Towing | Vehicle condition, equipment, preferred pickup, emergency | — | Required pickup + destination, route on review |
| Roadside | Assistance type (battery/tyre/fuel/lockout/other), problem | — | Required assistance point, GPS available |
| Inspection | Inspection type, preferred date, preferred time, notes | — | Required inspection location |

Irrelevant fields are not rendered at all: the config is the only source of
fields.

## Shared information

- **Vehicles** — `useVehicles()` lists saved vehicles, defaults to the first and
  allows switching. “Use a different vehicle” exposes make/model/year; the API
  creates and reuses the vehicle exactly as before.
- **Addresses** — `useAddresses()` supplies the primary saved address. Repair,
  maintenance and spare pickup reuse it silently. Towing, roadside and
  inspection require an explicit confirmation, but the picker pre-fills the
  saved address so it is one tap.
- **Profile** — review shows the customer name and phone/email from the auth
  profile; there is no contact form.
- **Location component** — `LocationPicker` (Mapbox) handles search, saved
  places, GPS, draggable pin, reverse geocoding and confirmation. No latitude or
  longitude field exists anywhere in the flow.

## API mapping (no contract change)

The existing `POST /damage-requests` contract is unchanged. Every service maps
to the same allowed fields:

| UI | API |
| --- | --- |
| Service fields | Composed into `title` and `description` as readable `Label: value` lines |
| Vehicle | `vehicleId`, or `vehicleMake/Model/Year` for a new vehicle |
| Location | `address`, `latitude`, `longitude` |
| Photos | `mediaUrls` + `damagePhotos` |
| Towing | `fulfillmentType: TOW_TO_GARAGE`, `dropoffAddress/Latitude/Longitude`, `towingVehicleType` |
| Spare parts | `fulfillmentType: PARTS_SHIPPING` (delivery) or `WORKSHOP_VISIT` (pickup) |
| Roadside | `roadsideKind` for BATTERY / TYRE / FUEL; lockout and other stay in the description |
| Urgency | Roadside selection; towing emergency maps to `EMERGENCY`; others `NORMAL` |
| Broadcast | `isBroadcast` |

The backend does not store the new service-specific fields as columns. They are
provider-readable in the description. No schema, DTO or endpoint was changed.

## Backend gaps (future, not required now)

These would become structured fields only if the product needs filtering or
reporting on them:

| Field | Current home |
| --- | --- |
| Damage type, affected area, drivable | Description |
| Odometer, last service date, preferred date | Description |
| Part/OEM number, condition, fitment | Description |
| Vehicle condition, preferred pickup | Description |
| Inspection type, preferred slot | Description |
| Lockout / other roadside | Description; no `roadsideKind` enum value or tariff |

`create` with `vehicleId` still trusts the id without an ownership check — an
existing backend concern, not changed here. The app only offers the customer’s
own vehicles.

## Validation

- Every required field, chips, numbers (odometer, quantity) and dates are
  validated per service; dates use `YYYY-MM-DD` with future/past rules.
- Towing requires a destination at least 50 m from pickup.
- Explicit-location services reject a saved address unless it is confirmed.
- Manual vehicles require make, model and a year between 1980 and next year.
- Description length is checked against the API’s 2000-character limit.
- Errors are inline and step-aware; submission jumps to the first invalid step.

## Entry points

| Source | Params | Result |
| --- | --- | --- |
| Home service rows | `category` | Opens that flow directly |
| Home “Post a request” / footer | none | Service picker, then the flow |
| Home packages | `category`, `title` | Prefills service type/part/notes |
| SOS | `category`, `title`, `urgency` | Roadside/towing prefill + emergency |

## Tests

- `__tests__/service-request-config.spec.ts` — 29 tests: exact field sets,
  photo presence, location modes, validation for all six, payload mapping,
  towing dropoff/equipment, spare pickup/delivery, roadside kind mapping,
  manual vehicle fallback, description composition, prefill.
- Web runs at 390×844: all six flows rendered and submitted; API verified the
  persisted category, title, description, address, vehicle, fulfilment,
  dropoff/distance, roadside kind and urgency.
- `tsc`, `eslint --max-warnings 0`, Jest 52/52.

## Known limits

- Date fields are typed `YYYY-MM-DD` with quick chips (today/tomorrow/+3 days),
  not a native calendar (no native date-picker dependency added).
- Spare parts pickup intentionally shows no map; it uses the saved address. If
  no saved address exists, it asks for one because the API requires coordinates.
- Lockout/other roadside kinds carry no fare estimate server-side.
