import { Hono } from 'hono'
import type { Context } from 'hono'

type Bindings = { DB: D1Database }

type BookingRow = {
  id: string
  equipment_id: string
  borrower_name: string
  start_at: string
  end_at: string
  purpose: string
  created_at: string
}

type BookingInput = {
  equipmentId: string
  borrowerName: string
  startAt: string
  endAt: string
  purpose: string
}

type CheckResult =
  | { ok: true; value: BookingInput }
  | { ok: false; status: 400 | 404 | 409; error: string }

const FIELDS = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose'] as const

// แปลงชื่อคอลัมน์ในฐานข้อมูล (snake_case) เป็นชื่อตาม API contract (camelCase)
const toBooking = (r: BookingRow) => ({
  id: r.id,
  equipmentId: r.equipment_id,
  borrowerName: r.borrower_name,
  startAt: r.start_at,
  endAt: r.end_at,
  purpose: r.purpose,
  createdAt: r.created_at,
})

// อ่าน JSON อย่างปลอดภัย: ถ้า JSON พังหรือไม่ใช่ object ให้คืน null
async function readJson(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

// รับเฉพาะวันเวลาแบบ ISO 8601 ที่มีเขตเวลา แล้วแปลงเป็น UTC รูปแบบเดียวกันทั้งหมด
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
function parseIso(value: string): string | null {
  if (!ISO_PATTERN.test(value)) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

// ตรวจกฎทั้งหมดของการจอง ใช้ร่วมกันทั้งตอนสร้าง (POST) และแก้ไข (PATCH)
// excludeId = id ของการจองที่กำลังแก้ไข เพื่อไม่ให้ชนกับตัวเอง
async function checkBooking(
  db: D1Database,
  data: Record<string, unknown>,
  excludeId: string | null
): Promise<CheckResult> {
  // 1) ทุกช่องต้องเป็นข้อความที่ไม่ว่าง
  for (const f of FIELDS) {
    const v = data[f]
    if (typeof v !== 'string' || v.trim() === '') {
      return { ok: false, status: 400, error: `${f} is required and must be a non-empty string` }
    }
  }
  const equipmentId = (data.equipmentId as string).trim()
  const borrowerName = (data.borrowerName as string).trim()
  const purpose = (data.purpose as string).trim()

  // 2) รูปแบบวันเวลาต้องถูกต้อง
  const startAt = parseIso(data.startAt as string)
  const endAt = parseIso(data.endAt as string)
  if (!startAt || !endAt) {
    return {
      ok: false,
      status: 400,
      error: 'startAt and endAt must be ISO 8601 date-times, e.g. 2026-10-20T09:00:00.000Z',
    }
  }

  // 3) เวลาเริ่มต้องมาก่อนเวลาจบ
  if (startAt >= endAt) {
    return { ok: false, status: 400, error: 'startAt must be before endAt' }
  }

  // 4) อุปกรณ์ต้องมีอยู่จริง
  const equipment = await db
    .prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(equipmentId)
    .first()
  if (!equipment) {
    return { ok: false, status: 404, error: `Equipment '${equipmentId}' not found` }
  }

  // 5) ห้ามเวลาทับกับการจองอื่นของอุปกรณ์เดียวกัน
  const conflict = await db
    .prepare(
      'SELECT id FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ? AND id != ? LIMIT 1'
    )
    .bind(equipmentId, endAt, startAt, excludeId ?? '')
    .first<{ id: string }>()
  if (conflict) {
    return {
      ok: false,
      status: 409,
      error: `Equipment '${equipmentId}' is already booked during this time (booking ${conflict.id})`,
    }
  }

  return { ok: true, value: { equipmentId, borrowerName, startAt, endAt, purpose } }
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

// ---------- Equipment ----------
app.get('/equipment', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id, name, location FROM equipment ORDER BY id')
    .all()
  return c.json(results, 200)
})

// ---------- Bookings ----------
app.get('/bookings', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM bookings ORDER BY start_at')
    .all<BookingRow>()
  return c.json(results.map(toBooking), 200)
})

app.get('/bookings/:id', async (c) => {
  const row = await c.env.DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(c.req.param('id'))
    .first<BookingRow>()
  if (!row) return c.json({ error: 'Booking not found' }, 404)
  return c.json(toBooking(row), 200)
})

app.post('/bookings', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'Request body must be a valid JSON object' }, 400)

  const check = await checkBooking(c.env.DB, body, null)
  if (!check.ok) return c.json({ error: check.error }, check.status)

  const b = check.value
  const id = crypto.randomUUID()
  await c.env.DB
    .prepare(
      'INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, b.equipmentId, b.borrowerName, b.startAt, b.endAt, b.purpose)
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>()
  return c.json(toBooking(row!), 201)
})

app.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id')

  const existing = await c.env.DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>()
  if (!existing) return c.json({ error: 'Booking not found' }, 404)

  const body = await readJson(c)
  if (!body) return c.json({ error: 'Request body must be a valid JSON object' }, 400)
  if (!FIELDS.some((f) => body[f] !== undefined)) {
    return c.json({ error: `Provide at least one field to update: ${FIELDS.join(', ')}` }, 400)
  }

  // รวมค่าเดิมกับค่าที่ส่งมาใหม่ แล้วตรวจด้วยกฎชุดเดียวกับตอนสร้าง
  const current = toBooking(existing)
  const merged: Record<string, unknown> = {}
  for (const f of FIELDS) {
    merged[f] = body[f] !== undefined ? body[f] : current[f]
  }

  const check = await checkBooking(c.env.DB, merged, id)
  if (!check.ok) return c.json({ error: check.error }, check.status)

  const b = check.value
  await c.env.DB
    .prepare(
      'UPDATE bookings SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ? WHERE id = ?'
    )
    .bind(b.equipmentId, b.borrowerName, b.startAt, b.endAt, b.purpose, id)
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>()
  return c.json(toBooking(row!), 200)
})

app.delete('/bookings/:id', async (c) => {
  const result = await c.env.DB
    .prepare('DELETE FROM bookings WHERE id = ?')
    .bind(c.req.param('id'))
    .run()
  if (result.meta.changes === 0) return c.json({ error: 'Booking not found' }, 404)
  return c.body(null, 204)
})

// ---------- Error ทั่วไป ----------
app.notFound((c) => c.json({ error: 'Route not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
