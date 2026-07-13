import { useState } from 'react'
import { api } from '../../services/backend.js'
import { useQuery } from '../../services/useStore.js'
import { money, STATUS_LABELS } from '../../services/format.js'
import { Spinner } from '../../components/ui.jsx'
import ItemForm from '../../components/ItemForm.jsx'

// ---- duplicate detection --------------------------------------------------
// The AI can list the same physical item twice when it appears in several
// photos (a rug behind a couch, etc). Flag suspiciously similar titles and let
// the seller merge (keep one, absorb the other's photos) or dismiss.
const DISMISS_KEY = 'moving_sale_dupes_dismissed'

function titleTokens(t) {
  return new Set(
    String(t)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/s$/, '')),
  )
}

function similarity(a, b) {
  const A = titleTokens(a)
  const B = titleTokens(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const w of A) if (B.has(w)) shared++
  return shared / Math.min(A.size, B.size)
}

function pairKey(a, b) {
  return [a.id, b.id].sort().join('|')
}

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function findDuplicatePairs(items, dismissed) {
  const live = items.filter((i) => i.status !== 'sold')
  const pairs = []
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]
      const b = live[j]
      if (a.photo_group_id && a.photo_group_id === b.photo_group_id) continue // same photo = different items
      if (dismissed.has(pairKey(a, b))) continue
      if (similarity(a.title, b.title) >= 0.6) pairs.push([a, b])
    }
  }
  return pairs.slice(0, 8)
}

function DuplicateReview({ items }) {
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [busy, setBusy] = useState(false)
  const pairs = findDuplicatePairs(items, dismissed)
  if (pairs.length === 0) return null

  function dismiss(a, b) {
    const next = new Set(dismissed)
    next.add(pairKey(a, b))
    setDismissed(next)
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }

  async function merge(keep, remove) {
    setBusy(true)
    const photos = [...keep.photos, ...remove.photos.filter((p) => !keep.photos.includes(p))]
    await api.updateItem(keep.id, { photos })
    await api.deleteItem(remove.id)
    setBusy(false)
  }

  return (
    <div className="card dupe-card">
      <div className="section-title" style={{ marginTop: 0 }}>⚠️ Possible duplicate listings</div>
      <p className="hint" style={{ marginTop: 0 }}>
        These titles look alike — often the same item photographed twice. Merging keeps one listing
        and moves the other's photos onto it.
      </p>
      {pairs.map(([a, b]) => (
        <div className="dupe-pair" key={pairKey(a, b)}>
          {[[a, b], [b, a]].map(([keep, other]) => (
            <div className="dupe-side" key={keep.id}>
              <div className="list-thumb"><img src={keep.photos[0]} alt={keep.title} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{keep.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>{money(keep.price)}</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} disabled={busy}
                  onClick={() => merge(keep, other)}>
                  Keep this one
                </button>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => dismiss(a, b)}>
            Not duplicates
          </button>
        </div>
      ))}
    </div>
  )
}

export default function Items() {
  const { data: items, loading } = useQuery(() => api.listItems())
  const { data: offers } = useQuery(() => api.listOffers())
  const { data: visits } = useQuery(() => api.getVisitStats())
  const [editing, setEditing] = useState(null) // item or {} for new
  const [confirmDel, setConfirmDel] = useState(null)

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="muted" style={{ fontSize: 13 }}>
          {items.length} listings
          {visits && ` · 👣 ${visits.today} visits today · ${visits.total} total`}
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
          + New item
        </button>
      </div>

      <DuplicateReview items={items} />

      <div className="card">
        {items.map((item) => (
          <div className="list-row" key={item.id}>
            <div className="list-thumb">
              <img src={item.photos[0]} alt={item.title} />
            </div>
            <div className="list-main">
              <div className="t">{item.title}</div>
              <div className="s">
                {money(item.price)} · {item.dimensions || 'no dimensions'}
              </div>
              <div className="s" style={{ marginTop: 2 }}>
                👁 {item.views ?? 0} views · 🛒 {(offers || []).filter((o) => o.item_id === item.id).length} requests
              </div>
            </div>
            <div className="row-actions">
              <select
                value={item.status}
                onChange={(e) => api.updateItem(item.id, { status: e.target.value })}
                style={{ fontSize: 13, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line2)' }}
                title="Change status"
              >
                {Object.keys(STATUS_LABELS).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(item)}>
                Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(item)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && <ItemForm initial={editing} onClose={() => setEditing(null)} />}

      {confirmDel && (
        <div className="overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-body">
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Delete “{confirmDel.title}”?</p>
              <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>This can't be undone.</p>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    api.deleteItem(confirmDel.id)
                    setConfirmDel(null)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
