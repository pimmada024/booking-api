# Test Evidence

- **Base API URL (deployed on Cloudflare Workers):** `https://booking-api.task-6731503024.workers.dev/api`
- **Date:** 6 October 2026

There are two sets of evidence:

1. **Cloud test run (curl)** against the deployed API. This is the main evidence.
2. **Postman screenshots** taken during local development (`http://localhost:8787/api`) before deployment.

## 1. Cloud test run (curl)

- **How to run:** `bash run_tests.sh`
- **Output file:** `evidence/cloud-test-results.txt`

The script runs the nine steps of the instructor's cURL Quick Test Guide plus five extra error cases. For each case it prints the request, the expected status, the actual status, the response body, and PASS or FAIL.

| # | Case | Request | Expected |
|---:|---|---|---:|
| 1 | List equipment | `GET /equipment` | 200 |
| 2 | List bookings | `GET /bookings` | 200 |
| 3 | Create a booking | `POST /bookings` (eq-1, 09:00 to 11:00) | 201 |
| 4 | Get one booking | `GET /bookings/:id` | 200 |
| 5 | Update a booking | `PATCH /bookings/:id` (move to 12:00 to 14:00) | 200 |
| 6 | Invalid time range | `POST /bookings` (start after end) | 400 |
| 7 | Overlapping booking | `POST /bookings` (eq-1, 12:30 to 13:30) | 409 |
| 8 | Missing booking | `GET /bookings/not-found` | 404 |
| 9 | Missing required field | `POST /bookings` without `borrowerName` | 400 |
| 10 | Malformed JSON | `POST /bookings` with a broken body | 400 |
| 11 | Equipment does not exist | `POST /bookings` with `eq-999` | 404 |
| 12 | Partial update, no self-conflict | `PATCH /bookings/:id` with only `purpose` | 200 |
| 13 | Delete a booking | `DELETE /bookings/:id` | 204 |
| 14 | Deleted booking is gone | `GET /bookings/:id` | 404 |

Cases 1 to 8 and 13 are the instructor's guide steps 1 to 9. Cases 9 to 12 and 14 are my additions.

### Coverage

- **CRUD:** create (3), read (1, 2, 4), update (5, 12), delete (13)
- **Validation errors (400):** 6, 9, 10
- **Not found (404):** 8, 11, 14
- **Conflict (409):** 7

## 2. Postman screenshots (local development)

| # | Case | Request | Expected | Actual | Screenshot |
|---:|---|---|---:|---:|---|
| 0 | Project running (first version) | Browser, `http://localhost:8787` | page loads | "Hello Hono!" | `00-hello-hono.png` |
| 1 | List equipment | `GET /equipment` | 200 | 200, 3 items | `01-get-equipment.png` |
| 2 | Create a valid booking | `POST /bookings` (eq-1, 09:00 to 11:00) | 201 | 201, booking with `id` | `02-post-valid.png` |
| 3 | List bookings | `GET /bookings` | 200 | 200, 1 booking | `03-get-bookings.png` |
| 4 | Missing field | `POST /bookings` without `borrowerName` | 400 | 400, "borrowerName is required and must be a non-empty string" | `04-post-missing-field.png` |
| 5 | Start after end | `POST /bookings` (startAt 11:00, endAt 09:00) | 400 | 400, "startAt must be before endAt" | `05-post-start-after-end.png` |
| 6 | Equipment does not exist | `POST /bookings` with `eq-999` | 404 | 404, "Equipment 'eq-999' not found" | `06-post-unknown-equipment.png` |
| 7 | Overlapping time, same equipment | `POST /bookings` (eq-1, 10:00 to 12:00) | 409 | 409, "Equipment 'eq-1' is already booked during this time" | `07-post-conflict.png` |
| 8 | Same time, different equipment | `POST /bookings` (eq-2, 10:00 to 12:00) | 201 | 201, booking created | `08-post-other-equipment.png` |
| 9 | Update a booking | `PATCH /bookings/214af3aa-...` with `{ "purpose": "Updated purpose" }` | 200 | 200, purpose changed, other fields unchanged | `09-patch.png` |
| 10 | Booking not found | `GET /bookings/not-real` | 404 | 404, "Booking not found" | `10-get-not-found.png` |
| 11 | Delete a booking | `DELETE /bookings/214af3aa-...` | 204 | 204, empty body | `11-delete.png` |
| 12 | Malformed JSON | `POST /bookings` with a broken body | 400 | 400, "Request body must be a valid JSON object" | `12-post-malformed-json.png` |

Screenshots 00 to 03 show the first version (before the Quality Gate review).
