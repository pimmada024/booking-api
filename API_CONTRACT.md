# API Contract

**Base URL (deployed):** `https://booking-api.task-6731503024.workers.dev/api`
**Base URL (local development):** `http://localhost:8787/api`

All request and response bodies are JSON. Every error response has this shape:

```json
{ "error": "A message understandable to a user or developer" }
```

## Endpoints

| Method | Path | Success | Errors | Purpose |
|---|---|---:|---|---|
| `GET` | `/equipment` | 200 | | List equipment |
| `GET` | `/bookings` | 200 | | List bookings (ordered by start time) |
| `GET` | `/bookings/:id` | 200 | 404 | Get one booking |
| `POST` | `/bookings` | 201 | 400, 404, 409 | Create a booking |
| `PATCH` | `/bookings/:id` | 200 | 400, 404, 409 | Update a booking (partial) |
| `DELETE` | `/bookings/:id` | 204 | 404 | Delete a booking |

## Status codes and why

| Code | When it is used | Reason |
|---:|---|---|
| 200 | Successful read or update | The request worked and data is returned |
| 201 | Booking created | A new resource now exists |
| 204 | Booking deleted | The request worked and there is nothing to return |
| 400 | Missing field, empty field, wrong type, invalid date format, `startAt` not before `endAt`, malformed JSON, `PATCH` with no known fields | The client sent data that is wrong; resending the same request will never work |
| 404 | Booking id not found, `equipmentId` not found, unknown route | The thing being referred to does not exist |
| 409 | Time overlaps an existing booking of the same equipment | The data is valid on its own, but it conflicts with the current state of the system |
| 500 | Unexpected server error | The fault is on the server, not the client |

## Equipment

### `GET /equipment` returns 200

```json
[
  { "id": "eq-1", "name": "Projector A", "location": "Building 1" },
  { "id": "eq-2", "name": "Camera B", "location": "Building 2" },
  { "id": "eq-3", "name": "Meeting Room C", "location": "Building 3" }
]
```

## Bookings

### Request payload (`POST`, and any subset for `PATCH`)

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

| Field | Type | Rule |
|---|---|---|
| `equipmentId` | string | Required; must exist in equipment |
| `borrowerName` | string | Required; not empty |
| `startAt` | string | Required; ISO 8601 with time zone; before `endAt` |
| `endAt` | string | Required; ISO 8601 with time zone |
| `purpose` | string | Required; not empty |

### Booking response

```json
{
  "id": "214af3aa-beeb-4f68-a03d-6a3bfad6e523",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation",
  "createdAt": "2026-10-06 06:46:14"
}
```

`createdAt` is an additional field (UTC).

### `GET /bookings` returns 200

An array of booking objects. Empty array if there are none.

### `GET /bookings/:id`

- 200 with the booking
- 404 `{ "error": "Booking not found" }`

### `POST /bookings`

- 201 with the created booking
- 400 e.g. `{ "error": "borrowerName is required and must be a non-empty string" }`
- 400 `{ "error": "startAt must be before endAt" }`
- 404 `{ "error": "Equipment 'eq-999' not found" }`
- 409 `{ "error": "Equipment 'eq-1' is already booked during this time (booking <id>)" }`

### `PATCH /bookings/:id`

Send one or more of the five fields. Fields not sent keep their current value. The combined result is checked with the same rules as `POST`.

- 200 with the updated booking
- 400 invalid data, or no known field sent
- 404 booking not found, or new `equipmentId` not found
- 409 the new time or equipment conflicts with another booking

### `DELETE /bookings/:id`

- 204 with no body
- 404 `{ "error": "Booking not found" }`

## Overlap rule

Two bookings of the same equipment overlap when:

```
existing.start_at < new.endAt  AND  existing.end_at > new.startAt
```

Back-to-back bookings (one ends at 11:00, the next starts at 11:00) are allowed.
