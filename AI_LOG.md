# AI Log

**AI tool used:** Claude (chat assistant)
**How I used it:** step-by-step guidance for setup, a first version of the code, a second improved version, test cases, and drafts of the documentation. I ran every command and every test myself on my own laptop.


| # | What I asked the AI | What I used from the answer | What I verified myself |
|---:|---|---|---|
| 1 | How to prepare a MacBook for this lab test | Checked Node.js and npm versions in Terminal | Ran `node -v` and `npm -v`; saw v24.15.0 and 11.12.1 |
| 2 | (Before sharing the real brief) what to do next | The AI first suggested Express + better-sqlite3 | After I pasted the real brief, this did not match the required stack (Hono + D1), so I did not use it and switched |
| 3 | Shared the exam brief and rubric; asked for analysis and next steps | Command to create a Hono project for Cloudflare Workers | Ran `npm run dev`; opened `http://localhost:8787` and saw "Hello Hono!" |
| 4 | How to create the database | `schema.sql` (two tables, foreign key, 3 seed rows) and the D1 binding in `wrangler.jsonc` | Ran `SELECT * FROM equipment` with Wrangler and saw 3 rows |
| 5 | How to write the API | Version 1 of `src/index.ts`: list equipment, list/get/create/delete bookings with parameter binding | Tested in Postman: `GET /equipment` 200, `POST /bookings` 201, `GET /bookings` 200 |
| 6 | Why VS Code showed red underlines on `D1Database` and `crypto` | Explanation that it is a missing type definition, not a runtime error | The API still ran and returned correct results |
| 7 | Next step after version 1 worked | Version 2: added `PATCH`, the shared `checkBooking()` rules, safe JSON parsing, JSON 404/500 handlers | Ran 8 more Postman tests (400, 400, 404, 409, 201, 200, 404, 204); all matched the expected status |
| 8 | A 400 result looked strange to me | Explanation: my request body had several mistakes at once and the API reports the first one | Re-ran each error case changing only one thing; each returned the expected error |
| 9 | What is still missing for submission | Drafts of README, API contract, test evidence table, this log, and the Quality Gate review | Read each file and checked it against my code and my own test results |
| 10 | Why a malformed-JSON test returned 404 "Route not found" | Explanation: my URL in Postman had a space at the end | Removed the space and re-sent; got the expected 400 |
| 11 | Shared the instructor's Quality Gate and cURL guide and asked for a check | The AI pointed out that its own code enabled CORS although I have no browser client, and that I had no evidence for "get one booking" | Removed the two CORS lines myself and re-tested |
| 12 | The instructor said localhost is not accepted; asked how to deploy to Cloudflare | Wrangler commands for login, creating the remote D1 database, loading the schema, and deploying. The AI told me to answer "n" when Wrangler offered to edit the config, because its binding name would not match my code (`DB`) | Put the real `database_id` into `wrangler.jsonc` myself; opened the live URL `/api/equipment` and saw the 3 equipment records |
| 13 | How to collect evidence from the deployed API | `run_tests.sh`, a curl script based on the instructor's cURL guide | Ran it myself and read every PASS/FAIL line in `evidence/cloud-test-results.txt` |

## Decisions I can explain

- **Parameter binding:** every query uses `?` and `.bind()`, so user input is treated as data, never as SQL.
- **Overlap rule:** `start_at < newEnd AND end_at > newStart`; back-to-back bookings are allowed.
- **PATCH excludes itself** from the conflict check (`id != ?`), otherwise editing only the purpose would return 409.
- **Unknown equipment returns 404** because the brief says "404 when a resource is not found".
- **Times stored as UTC ISO text** so that comparing text gives the correct time order.

## What I did not take from the AI without checking

- The first stack suggestion (Express), because it did not match the brief.
- Status codes: I confirmed each one in Postman instead of trusting the code.
