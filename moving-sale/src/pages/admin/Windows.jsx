import { useState } from 'react'
import { api } from '../../services/backend.js'
import { useQuery } from '../../services/useStore.js'
import { formatWindow } from '../../services/format.js'
import { Spinner } from '../../components/ui.jsx'

export default function Windows() {
  const { data: windows, loading } = useQuery(() => api.listWindows())
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [err, setErr] = useState('')

  if (loading) return <Spinner />

  async function add(e) {
    e.preventDefault()
    setErr('')
    if (!starts || !ends) return
    if (new Date(ends) <= new Date(starts)) {
      setErr('End time must be after start time.')
      return
    }
    await api.createWindow(new Date(starts).toISOString(), new Date(ends).toISOString())
    setStarts('')
    setEnds('')
  }

  const sorted = [...windows].sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <div>
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="section-title">Open a new pickup window</div>
        <form onSubmit={add}>
          <div className="two-col">
            <div className="field">
              <label>Starts</label>
              <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} required />
            </div>
            <div className="field">
              <label>Ends</label>
              <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} required />
            </div>
          </div>
          {err && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{err}</p>}
          <button className="btn btn-primary btn-sm">+ Add window</button>
        </form>
      </div>

      <div className="card">
        <div className="section-title" style={{ padding: '14px 14px 4px' }}>
          Windows ({sorted.length})
        </div>
        {sorted.length === 0 ? (
          <div className="empty">No windows yet.</div>
        ) : (
          sorted.map((w) => (
            <div className="list-row" key={w.id}>
              <div className="list-main">
                <div className="t">{formatWindow(w)}</div>
                <div className="s">
                  <span className={`badge badge-${w.status === 'open' ? 'available' : 'pending'}`}>
                    {w.status === 'open' ? 'Open' : 'Booked'}
                  </span>
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-danger btn-sm" onClick={() => api.deleteWindow(w.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
