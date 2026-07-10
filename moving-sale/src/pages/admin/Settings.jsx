import { useState, useEffect } from 'react'
import { api } from '../../services/mockBackend.js'
import { useQuery } from '../../services/useStore.js'
import { Spinner, useToast } from '../../components/ui.jsx'

export default function Settings() {
  const { data: settings, loading } = useQuery(() => api.getSettings())
  const [form, setForm] = useState({ move_out_date: '', site_name: '' })
  const [toast, setToast] = useToast()

  useEffect(() => {
    if (settings) setForm({ move_out_date: settings.move_out_date || '', site_name: settings.site_name || '' })
  }, [settings])

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
