import { useState } from 'react'
import { api } from '../../services/mockBackend.js'
import { placeholderPhoto } from '../../services/placeholder.js'
import { money } from '../../services/format.js'
import ItemForm from '../../components/ItemForm.jsx'

// AI-assisted intake. Drop 1+ photos -> each gets an AI-drafted title,
// category, condition, description, and a suggested price RANGE. The seller
// sweeps the review queue, confirming/tweaking. Dimensions + final price stay
// manual (per brief — AI can't measure or price your stuff).
export default function QuickAdd() {
  const [queue, setQueue] = useState([]) // {id, photo, name, draft, analyzing}
  const [reviewing, setReviewing] = useState(null)

  async function onFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    const entries = files.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      photo: placeholderPhoto(f.name + Math.random(), f.name.replace(/\.[^.]+$/, '')),
      draft: null,
      analyzing: true,
    }))
    setQueue((q) => [...entries, ...q])
    // Kick off a mock Anthropic vision call per photo.
    entries.forEach(async (entry) => {
      const draft = await api.draftListing(entry.name)
      setQueue((q) => q.map((x) => (x.id === entry.id ? { ...x, draft, analyzing: false } : x)))
    })
  }

  function toInitial(entry) {
    const d = entry.draft
    return {
      title: d.title,
      category: d.category,
      condition: d.condition,
      description: d.description,
      photos: [entry.photo],
      price: '', // manual
      dimensions: '', // manual
      status: 'available',
    }
  }

  function removeFromQueue(id) {
    setQueue((q) => q.filter((x) => x.id !== id))
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="ai-badge" style={{ marginBottom: 8 }}>✨ AI intake</div>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Drop photos, get draft listings</p>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>
          Upload one or many item photos. Each gets an AI-drafted title, category, condition,
          description, and a suggested price range. You confirm dimensions and final price.
        </p>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          📷 Upload photos
          <input type="file" accept="image/*" multiple hidden onChange={onFiles} />
        </label>
      </div>

      {queue.length === 0 ? (
        <div className="empty">Your review queue is empty. Upload photos to get started.</div>
      ) : (
        <>
          <div className="section-title">Review queue ({queue.length})</div>
          {queue.map((entry) => (
            <div className="review-card" key={entry.id}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div className="list-thumb" style={{ width: 90, height: 70 }}>
                  <img src={entry.photo} alt={entry.name} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry.analyzing ? (
                    <p className="muted" style={{ fontSize: 14 }}>
                      <span className="ai-badge">✨ Analyzing…</span>
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="ai-badge">✨ AI draft</span>
                        <strong style={{ fontSize: 15 }}>{entry.draft.title}</strong>
                      </div>
                      <p className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
                        {entry.draft.category} · {entry.draft.condition} · suggested{' '}
                        {money(entry.draft.suggested_price_range.low)}–{money(entry.draft.suggested_price_range.high)}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{entry.draft.description}</p>
                    </>
                  )}
                </div>
              </div>
              {!entry.analyzing && (
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFromQueue(entry.id)}>
                    Discard
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setReviewing(entry)}>
                    Review &amp; add →
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {reviewing && (
        <ItemForm
          initial={toInitial(reviewing)}
          onClose={() => setReviewing(null)}
          onSaved={() => removeFromQueue(reviewing.id)}
        />
      )}
    </div>
  )
}
