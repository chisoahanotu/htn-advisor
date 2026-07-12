import { useState } from 'react'
import { api } from '../../services/backend.js'
import { useQuery } from '../../services/useStore.js'
import { money, STATUS_LABELS } from '../../services/format.js'
import { Spinner } from '../../components/ui.jsx'
import ItemForm from '../../components/ItemForm.jsx'

export default function Items() {
  const { data: items, loading } = useQuery(() => api.listItems())
  const { data: offers } = useQuery(() => api.listOffers())
  const [editing, setEditing] = useState(null) // item or {} for new
  const [confirmDel, setConfirmDel] = useState(null)

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="muted" style={{ fontSize: 13 }}>{items.length} listings</p>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
          + New item
        </button>
      </div>

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
