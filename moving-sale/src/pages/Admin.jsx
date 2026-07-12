import { useState } from 'react'
import { api } from '../services/backend.js'
import { useSession, useQuery } from '../services/useStore.js'
import Inbox from './admin/Inbox.jsx'
import Offers from './admin/Offers.jsx'
import Items from './admin/Items.jsx'
import QuickAdd from './admin/QuickAdd.jsx'
import Windows from './admin/Windows.jsx'
import Settings from './admin/Settings.jsx'
import Share from './admin/Share.jsx'

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const showEmail = api.authMode === 'email'

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const res = await api.signIn({ email: email.trim(), password: pw.trim() })
    setBusy(false)
    if (!res.ok) setErr(res.error)
  }

  return (
    <div className="center-narrow">
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Seller login</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>
          Single admin. Buyers never see this.
        </p>
        <form onSubmit={submit}>
          {showEmail && (
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
              />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              autoFocus={!showEmail}
            />
          </div>
          {err && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Checking…' : 'Log in'}
          </button>
        </form>
        {api.authMode === 'password' && (
          <p className="hint" style={{ marginTop: 14 }}>
            Prototype login — use <code>{api.demoPasswordHint}</code>. Real app uses Supabase Auth.
          </p>
        )}
        <p className="hint" style={{ marginTop: 10, opacity: 0.6 }}>
          build {__BUILD_ID__} · {api.backendName}
        </p>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'inbox', label: 'Inbox', C: Inbox },
  { key: 'offers', label: 'Requests', C: Offers },
  { key: 'quickadd', label: 'Quick Add', C: QuickAdd },
  { key: 'items', label: 'Items', C: Items },
  { key: 'windows', label: 'Pickup Windows', C: Windows },
  { key: 'share', label: 'Share & Export', C: Share },
  { key: 'settings', label: 'Settings', C: Settings },
]

export default function Admin() {
  const authed = useSession()
  const [tab, setTab] = useState('inbox')
  const { data: notifs } = useQuery(() => api.listNotifications())
  const pending = (notifs || []).filter((n) => !n.resolved).length

  if (!authed) return <Login />

  const Active = TABS.find((t) => t.key === tab).C

  return (
    <div className="admin-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Admin dashboard</h1>
          <p className="muted" style={{ fontSize: 13 }}>Phone-friendly · single seller</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => api.signOut()}>
          Sign out
        </button>
      </div>

      <div className="admin-nav">
        {TABS.map((t) => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'inbox' && pending > 0 && <span className="count">{pending}</span>}
          </button>
        ))}
      </div>

      <Active />
    </div>
  )
}
