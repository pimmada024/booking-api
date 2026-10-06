#!/bin/bash
# Runs the instructor's cURL Quick Test Guide (plus extra error cases)
# against the deployed API and saves the output as evidence.
#
# Usage:  bash run_tests.sh
#         bash run_tests.sh http://localhost:8787/api   (to test locally)

BASE_URL="${1:-https://booking-api.task-6731503024.workers.dev/api}"
OUT="evidence/cloud-test-results.txt"
mkdir -p evidence

PASS=0
FAIL=0
LAST_BODY=""

# t "title" expected_status METHOD path [json_body]
t() {
  local title="$1" expected="$2" method="$3" path="$4" body="$5"
  local out status resp

  if [ -n "$body" ]; then
    out=$(curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" -d "$body" -w $'\n%{http_code}')
  else
    out=$(curl -s -X "$method" "$BASE_URL$path" -w $'\n%{http_code}')
  fi

  status=$(printf '%s' "$out" | tail -n 1)
  resp=$(printf '%s' "$out" | sed '$d')
  LAST_BODY="$resp"

  echo "--------------------------------------------------------------"
  echo "$title"
  echo "Request : $method $BASE_URL$path"
  [ -n "$body" ] && echo "Body    : $body"
  echo "Expected: $expected"
  echo "Actual  : $status"
  echo "Response: ${resp:-(empty)}"
  if [ "$status" = "$expected" ]; then
    echo "Result  : PASS"
    PASS=$((PASS + 1))
  else
    echo "Result  : FAIL"
    FAIL=$((FAIL + 1))
  fi
}

{
  echo "Campus Equipment Booking API - test run"
  echo "Base URL: $BASE_URL"
  echo "Date    : $(date)"

  t "1. List equipment" 200 GET "/equipment"

  t "2. List bookings" 200 GET "/bookings"

  t "3. Create a booking" 201 POST "/bookings" \
    '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
  BOOKING_ID=$(printf '%s' "$LAST_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n 1)
  echo "Booking id used for the next steps: $BOOKING_ID"

  t "4. Get one booking" 200 GET "/bookings/$BOOKING_ID"

  t "5. Update a booking (move to 12:00-14:00)" 200 PATCH "/bookings/$BOOKING_ID" \
    '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T12:00:00.000Z","endAt":"2026-10-20T14:00:00.000Z","purpose":"Updated class presentation"}'

  t "6. Invalid time range (start after end)" 400 POST "/bookings" \
    '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-21T11:00:00.000Z","endAt":"2026-10-21T09:00:00.000Z","purpose":"Invalid time range test"}'

  t "7. Overlapping booking, same equipment" 409 POST "/bookings" \
    '{"equipmentId":"eq-1","borrowerName":"Suda Dee","startAt":"2026-10-20T12:30:00.000Z","endAt":"2026-10-20T13:30:00.000Z","purpose":"Conflict test"}'

  t "8. Missing booking" 404 GET "/bookings/not-found"

  t "9. Missing required field (no borrowerName)" 400 POST "/bookings" \
    '{"equipmentId":"eq-1","startAt":"2026-10-22T09:00:00.000Z","endAt":"2026-10-22T11:00:00.000Z","purpose":"Missing field test"}'

  t "10. Malformed JSON body" 400 POST "/bookings" '{ "equipmentId": '

  t "11. Equipment does not exist" 404 POST "/bookings" \
    '{"equipmentId":"eq-999","borrowerName":"Somchai Jaidee","startAt":"2026-10-22T09:00:00.000Z","endAt":"2026-10-22T11:00:00.000Z","purpose":"Unknown equipment test"}'

  t "12. Partial update does not conflict with itself" 200 PATCH "/bookings/$BOOKING_ID" \
    '{"purpose":"Purpose only update"}'

  t "13. Delete a booking" 204 DELETE "/bookings/$BOOKING_ID"

  t "14. Deleted booking is gone" 404 GET "/bookings/$BOOKING_ID"

  echo "=============================================================="
  echo "Summary: $PASS passed, $FAIL failed"
} 2>&1 | tee "$OUT"

echo
echo "Saved to $OUT"
