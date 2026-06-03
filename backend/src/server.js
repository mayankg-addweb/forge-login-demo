import express from 'express'
import pg from 'pg'
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'

const { Pool } = pg
const PORT = Number(process.env.PORT || 3001)
const SECRET = process.env.SESSION_SECRET || 'dev-secret'

// ── DB ───────────────────────────────────────────────────────────────────
// DO Managed PostgreSQL uses a self-signed cert chain; relax verification.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=')
    ? { rejectUnauthorized: false }
    : false,
})

// ── Password hashing (scrypt, built into Node, no native deps) ───────────
function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${derived}`
}
function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const candidate = scryptSync(plain, salt, 64).toString('hex')
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── Token signing (HMAC, no extra deps) ──────────────────────────────────
function signToken(userId) {
  const payload = Buffer
    .from(JSON.stringify({ uid: userId, iat: Date.now() }))
    .toString('base64url')
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url')
  if (sig !== expected) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch { return null }
}

// ── Schema + seed (runs on every container start, idempotent) ────────────
async function initDb() {
  console.log('[init] ensuring users table...')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const seedEmail = 'mayank@addwebsolution.in'
  const seedPassword = '123456'
  const stored = hashPassword(seedPassword)
  await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [seedEmail, stored]
  )
  console.log(`[init] seeded ${seedEmail}`)
}

// ── App ──────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok')
    res.json({ ok: true, db: r.rows[0]?.ok === 1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }
  const r = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [String(email).toLowerCase().trim()]
  )
  const user = r.rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid email or password' })
  }
  const token = signToken(user.id)
  res.json({
    token,
    user: { id: user.id, email: user.email },
  })
})

app.get('/api/auth/me', async (req, res) => {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const payload = verifyToken(token)
  if (!payload?.uid) return res.status(401).json({ error: 'not authenticated' })
  const r = await pool.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [payload.uid]
  )
  const user = r.rows[0]
  if (!user) return res.status(401).json({ error: 'user gone' })
  res.json({ user })
})

// ── Start ────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`[backend] listening on :${PORT}`)
    )
  })
  .catch((err) => {
    console.error('[backend] init failed:', err)
    process.exit(1)
  })
