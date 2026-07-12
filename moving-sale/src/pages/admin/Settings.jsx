import { useState, useEffect } from 'react'
import { api } from '../../services/backend.js'
import { useQuery } from '../../services/useStore.js'
import { Spinner, useToast } from '../../components/ui.jsx'

export default function Settings() {
  const { data: settings, loading } = useQuery(() => api.getSettings())
  const [form, setForm] = useState({ move_out_date: '', site_name: '', bundle_discount_pct: 0, price_drops: [], contact_phone: '', hold_hours: 48 })
  const [toast, setToast] = useToast()

  useEffect(() => {
    if (settings)
      setForm({
        move_out_date: settings.move_out_date || '',
        site_name: settings.site_name || '',
        bundle_discount_pct: settings.bundle_discount_pct ?? 0,
        price_drops: settings.price_drops || [],
        contact_phone: settings.contact_phone || '',
        hold_hours: settings.hold_hours ?? 48,
      })
  }, [settings])

  function setDrop(i, key, value) {
    setForm((f) => ({
      ...f,
      price_drops: f.price_drops.map((d, j) => (j === i ? { ...d, [key]: Number(value) || 0 } : d)),
    }))
  }

  if (loading) return <Spinner />

  async function save(e) {
    e.preventDefault()
    await api.updateSettings(form)
    setToast('Settings saved')
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 480 }}>
      <div className="section-title">Store settings</div>
      <form onSubmit={save}>
        <div className="field">
          <label>Site name</label>
          <input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Move-out date</label>
          <input
            type="date"
            value={form.move_out_date}
            onChange={(e) => setForm({ ...form, move_out_date: e.target.value })}
          />
          <p className="hint">Drives the urgency banner shown to every buyer.</p>
        </div>

        <div className="field">
          <label>Your phone (for buyer texts)</label>
          <input
            type="tel"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            placeholder="e.g. 401-555-0123"
          />
          <p className="hint">
            Shown on listings as "text me to negotiate". Leave blank to hide it.
          </p>
        </div>
        <div className="field">
          <label>Hold duration (hours)</label>
          <input
            type="number"
            min="1"
            max="720"
            value={form.hold_hours}
            onChange={(e) => setForm({ ...form, hold_hours: Number(e.target.value) || 48 })}
          />
          <p className="hint">
            Accepted purchases reserve an item this long. If it isn't marked sold in time, it
            relists automatically and you get a Telegram heads-up.
          </p>
        </div>
        <div className="field">
          <label>Bundle discount (%)</label>
          <input
            type="number"
            min="0"
            max="90"
            value={form.bundle_discount_pct}
            onChange={(e) => setForm({ ...form, bundle_discount_pct: Number(e.target.value) || 0 })}
          />
          <p className="hint">Shown as a "take it all" banner on the storefront. 0 hides it.</p>
        </div>

        <div className="field">
          <label>Automatic price drops</label>
          {form.price_drops.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                type="number"
                min="1"
                value={d.pct}
                onChange={(e) => setDrop(i, 'pct', e.target.value)}
                style={{ width: 80 }}
                aria-label="percent off"
              />
              <span className="muted" style={{ fontSize: 13 }}>% off when</span>
              <input
                type="number"
                min="0"
                value={d.days_before}
                onChange={(e) => setDrop(i, 'days_before', e.target.value)}
                style={{ width: 80 }}
                aria-label="days before move-out"
              />
              <span className="muted" style={{ fontSize: 13 }}>days left</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setForm((f) => ({ ...f, price_drops: f.price_drops.filter((_, j) => j !== i) }))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setForm((f) => ({ ...f, price_drops: [...f.price_drops, { days_before: 7, pct: 10 }] }))}
          >
            + Add drop
          </button>
          <p className="hint">
            Applied daily off each item's original price as the move-out date nears. Available items only.
          </p>
        </div>

        <button className="btn btn-primary btn-sm">Save settings</button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '22px 0' }} />
      <div className="section-title">Demo controls</div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Reset the prototype's data (items, offers, bookings, inbox) back to the seeded demo.
      </p>
      <button
        className="btn btn-danger btn-sm"
        onClick={() => {
          if (confirm('Reset all prototype data to the seeded demo?')) {
            api.resetDemo()
            setToast('Demo data reset')
          }
        }}
      >
        Reset demo data
      </button>
      {toast}
    </div>
  )
}
