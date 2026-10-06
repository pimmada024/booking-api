# Quality Gate Review


## Snapshot of the first version

- Version 1 of `src/index.ts`: list equipment, and list/get/create/delete bookings. No `PATCH`, and the only validation was "each field is a non-empty string".
- Evidence: `evidence/00-hello-hono.png` (13:36), `01-get-equipment.png`, `02-post-valid.png`, `03-get-bookings.png` (13:45 to 13:47).

## Review record

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| 2. Reliability | Version 1 did not check for overlapping bookings, and did not check `equipmentId` against existing equipment. The main rule of the scenario (no double booking) was not enforced. | Added one function, `checkBooking()`, that looks up the equipment and runs the overlap query `start_at < newEnd AND end_at > newStart` for the same equipment. | Test 6: unknown equipment returns `404`. Test 7: overlapping time returns `409`. Test 8: same time on different equipment still returns `201`. |
| 2. Reliability | `PATCH /bookings/:id` was missing in version 1. An update also has to follow the overlap rule, and must not conflict with its own existing booking. | Added `PATCH` as a partial update that merges the new fields with the stored booking, runs the same `checkBooking()`, and excludes the booking being updated from the overlap query (`id != ?`). | Test 9: `PATCH` returns `200`, the purpose changed, other fields unchanged, no false `409`. |
| 2. Reliability | Version 1 called `c.req.json()` directly, so a malformed JSON body would throw and the API would answer `500` instead of handling the invalid request. | Added `readJson()` with try/catch that returns `400`, plus `app.notFound` and `app.onError` so every error is JSON in the `{ "error": "..." }` format. | Test 12: broken JSON body returns `400` with "Request body must be a valid JSON object" (`12-post-malformed-json.png`). |
| 6. Accuracy | Version 1 did not validate that `startAt` is before `endAt`, and accepted any text as a date. | `checkBooking()` now accepts only ISO 8601 date-times, converts them to UTC, and rejects `startAt >= endAt` with `400`. | Test 5: start 11:00, end 09:00 returns `400` "startAt must be before endAt". |
| 3. Course Context | Before I shared the real brief, the AI suggested Express with better-sqlite3 on port 3000. This does not follow the permitted stack (TypeScript/Hono with local SQLite/D1). | I gave the AI the full brief and rubric, discarded the Express project, and rebuilt on Hono + Cloudflare Workers + D1. Recorded in `AI_LOG.md`. | `package.json` (hono, wrangler), `wrangler.jsonc` (D1 binding `DB`), API deployed on Cloudflare Workers. |
| 4. Reasoning | For an `equipmentId` that does not exist, both `400` (invalid input) and `404` (resource not found) can be argued. I needed a reason, not just a number. | Chose `404` because the brief says "404 when a resource is not found" and equipment is a resource. Wrote the reason for every status code in `API_CONTRACT.md` and listed my assumptions in `README.md`. | Test 6 returns `404` "Equipment 'eq-999' not found". Status code table in `API_CONTRACT.md`. |
| 7. Delivery Quality | The code enabled CORS, but I test with Postman and have no browser-based client. The Quality Gate says to include CORS only if a browser client is used. | Removed the `cors` import and `app.use('*', cors())` from `src/index.ts`, and removed the CORS line from `README.md`. | Redeployed after removing it and ran `bash run_tests.sh` against the deployed API; results in `evidence/cloud-test-results.txt`. |
| 1. Purpose | My Base API URL was `http://localhost:8787/api`, which only works on my own laptop. The instructor requires the API to be deployed on Cloudflare and the code submitted on GitHub. | Created a remote D1 database, loaded `schema.sql` into it, deployed with `npm run deploy`, and updated the Base URL in `README.md`, `API_CONTRACT.md`, and `TEST_EVIDENCE.md`. | Live URL `https://booking-api.task-6731503024.workers.dev/api`; the full test run against it is in `evidence/cloud-test-results.txt`. |

## Self-check against the Quality Gate

| Area | Status | Note |
|---|---|---|
| 1. Purpose | Met | Routes, bodies, and status codes follow the common API contract. No extra features. |
| 2. Reliability | Met | Overlap and equipment checks run on both create and update. Invalid requests do not crash the API. |
| 3. Course Context | Met | Hono + D1 as required. AI assistance recorded in `AI_LOG.md`. |
| 4. Reasoning | Met | Status code reasons, overlap rule, and assumptions are written down. |
| 5. Execution Value | Met | Runs with the three commands in `README.md`. All endpoints tested. |
| 6. Accuracy | Met | Dates validated, errors are JSON, all SQL uses `?` with `.bind()`. |
| 7. Delivery Quality | Met | README, contract, schema/ERD, evidence for more than five cases. |
| 8. You Own It | Met | I ran every command and test myself and can explain the points listed in `AI_LOG.md`. |

## Remaining limitations

- The overlap check and the insert are two separate steps, so two requests at exactly the same moment could both pass. A production system would need a transaction or a database constraint.
- No authentication and no maximum length on text fields (not required by the brief).

## Submission decision

**READY**
