import { useEffect, useState, type FormEvent } from 'react'

type User = { id: number; email: string; created_at?: string }

const TOKEN_KEY = 'forge-login-demo:token'

async function api(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY)
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export default function App() {
  const [email, setEmail] = useState('mayank@addwebsolution.in')
  const [password, setPassword] = useState('123456')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Re-check existing token on mount so a refresh keeps you signed in.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) { setCheckingSession(false); return }
      try {
        const r = await api('/api/auth/me')
        if (r.ok) {
          const d = await r.json()
          if (!cancelled) setUser(d.user)
        } else {
          localStorage.removeItem(TOKEN_KEY)
        }
      } catch { /* ignore */ }
      if (!cancelled) setCheckingSession(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error || 'Login failed')
        return
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading…</div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">You're signed in</h1>
            <p className="text-slate-500 mt-1">Welcome back</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm">
            <Row label="Email" value={user.email} />
            <Row label="User ID" value={String(user.id)} />
            {user.created_at && <Row label="Created" value={new Date(user.created_at).toLocaleString()} />}
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition"
          >
            Sign out
          </button>
          <p className="text-xs text-slate-400">
            This page was served from the same droplet as the backend.
            The fetch to <code className="bg-slate-100 px-1 rounded">/api/auth/me</code> hit
            Caddy's reverse_proxy, which forwarded to the Express container on port 3001.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition shadow-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
          <strong>Test credentials</strong> (seeded into PostgreSQL by the backend on first
          start):<br />
          email: <code>mayank@addwebsolution.in</code><br />
          password: <code>123456</code>
        </div>

        <p className="text-center text-xs text-slate-400">
          Forge fullstack droplet · FE built by Vite + Tailwind, BE by Express + pg
        </p>
      </div>
    </div>
  )
}

function Field({
  label, type, value, onChange, placeholder, autoComplete,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
      />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-500">{label}</span>
      <code className="text-slate-900 text-xs bg-white px-2 py-1 rounded">{value}</code>
    </div>
  )
}
