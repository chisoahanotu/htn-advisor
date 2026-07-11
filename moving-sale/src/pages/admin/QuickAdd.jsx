import { useState } from 'react'
import { api } from '../../services/backend.js'
import { money } from '../../services/format.js'
import ItemForm from '../../components/ItemForm.jsx'

// Bulk AI intake. Drop many photos at once -> each photo is analyzed by
// Anthropic vision, which may find SEVERAL sellable items in one shot. Every
// detected item gets an editable draft row (title, price, size, dimensions);
// publish rows one at a time, per photo, or everything at once. Items from the
// same photo share a photo_group_id so the storefront gallery can stack their
// price stamps on one picture.
const sizeToDelivery = (size) => (size === 'large' ? 'none' : 'local_delivery')

function draftToItem(row, photo, groupId) {
  return {
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    price: Number(row.price) || 0,
    dimensions: row.dimensions || '',
    photos: [photo],
    delivery_option: row.delivery_option,
    status: 'available',
    photo_group_id: groupId,
    photo_pos: row.position || null,
  }
}

function DraftRow({ row, onChange, onAdd, onDiscard, onEdit, busy }) {
  const set = (k) => (e) => onChange({ ...row, [k]: e.target.value })
  if (row.added) {
    return (
      <div className="draft-row added">
        <span className="check" style={{ fontSize: 14 }}>✓</span>
        <strong style={{ fontSize: 14 }}>{row.title}</strong>
        <span className="muted" style={{ fontSize: 13 }}>{money(Number(row.price) || 0)} · listed</span>
      </div>
    )
  }
  return (
    <div className="draft-row">
      <div className="draft-grid">
        <div className="field" style={{ gridArea: 'title' }}>
          <label>Title</label>
          <input value={row.title} onChange={set('title')} />
        </div>
        <div className="field" style={{ gridArea: 'price' }}>
          <label>Price (USD)</label>
          <input type="number" min="0" value={row.price} onChange={set('price')} />
        </div>
        <div className="field" style={{ gridArea: 'size' }}>
          <label>Fulfillment</label>
          <select value={row.delivery_option} onChange={set('delivery_option')}>
            <option value="none">Pickup only</option>
            <option value="can_help_load">Pickup — I can help load</option>
            <option value="local_delivery">Drop-off available</option>
          </select>
        </div>
        <div className="field" style={{ gridArea: 'dims' }}>
          <label>Dimensions (optional)</label>
          <input value={row.dimensions} onChange={set('dimensions')} placeholder="84W x 38D x 34H in" />
        </div>
        <div className="field" style={{ gridArea: 'desc' }}>
          <label>Description</label>
          <textarea rows={2} value={row.description} onChange={set('description')} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '2px 0 8px' }}>
        {row.category} · {row.condition} · AI suggested {money(row.suggested_price)}
      </p>
      <div className="row-actions">
        <button className="btn btn-ghost btn-sm" onClick={onDiscard}>Discard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Full form…</button>
        <button className="btn btn-primary btn-sm" disabled={busy || !row.title} onClick={onAdd}>
          {busy ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </div>
  )
}

export default function QuickAdd() {
  // batches: {id, name, photo, groupId, rows: [draft rows], analyzing, error}
  const [batches, setBatches] = useState([])
  const [editing, setEditing] = useState(null) // { batch, rowIndex }
  const [busyKey, setBusyKey] = useState(null)

  const patchBatch = (id, patch) =>
    setBatches((bs) => bs.map((b) => (b.id === id ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b)))

  async function onFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    const entries = files.map((f) => ({
      id: crypto.randomUUID(),
      groupId: crypto.randomUUID(),
      name: f.name,
      file: f,
      photo: null,
      rows: [],
      analyzing: true,
      error: null,
    }))
    setBatches((bs) => [...entries, ...bs])
    // Each photo is analyzed independently so a big drop streams in as it finishes.
    entries.forEach(async (entry) => {
      try {
        const { photo, items } = await api.draftListing(entry.file)
        const rows = items.map((it) => ({
          ...it,
          price: it.suggested_price,
          dimensions: '',
          delivery_option: sizeToDelivery(it.size_class),
          added: false,
        }))
        patchBatch(entry.id, { photo, rows, analyzing: false })
      } catch (err) {
        console.error('draft failed:', err)
        patchBatch(entry.id, { analyzing: false, error: 'AI analysis failed — try re-uploading this photo.' })
      }
    })
  }

  async function addRow(batch, i) {
    const row = batch.rows[i]
    setBusyKey(`${batch.id}:${i}`)
    await api.createItem(draftToItem(row, batch.photo, batch.groupId))
    setBusyKey(null)
    patchBatch(batch.id, (b) => ({ rows: b.rows.map((r, j) => (j === i ? { ...r, added: true } : r)) }))
  }

  async function addAll(batch) {
    setBusyKey(batch.id)
    for (let i = 0; i < batch.rows.length; i++) {
      if (!batch.rows[i].added) await api.createItem(draftToItem(batch.rows[i], batch.photo, batch.groupId))
    }
    setBusyKey(null)
    patchBatch(batch.id, (b) => ({ rows: b.rows.map((r) => ({ ...r, added: true })) }))
  }

  const pendingCount = batches.reduce((n, b) => n + b.rows.filter((r) => !r.added).length, 0)

  async function publishEverything() {
    for (const b of batches) {
      if (!b.analyzing && !b.error && b.rows.some((r) => !r.added)) await addAll(b)
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="ai-badge" style={{ marginBottom: 8 }}>✨ AI bulk intake</div>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Drop photos in bulk, get draft listings</p>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>
          Upload many photos at once. The AI finds every sellable item in each photo (several items in one
          shot is fine), drafts the title, description, and price, and marks big items "Pickup only" vs small
          items "Drop-off available". Edit anything, add dimensions if needed, then publish.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            📷 Upload photos
            <input type="file" accept="image/*" multiple hidden onChange={onFiles} />
          </label>
          {pendingCount > 1 && (
            <button className="btn btn-ghost" onClick={publishEverything}>
              🚀 Publish all {pendingCount} drafts
            </button>
          )}
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="empty">Your review queue is empty. Upload photos to get started.</div>
      ) : (
        <>
          <div className="section-title">Review queue ({batches.length} photo{batches.length !== 1 ? 's' : ''})</div>
          {batches.map((batch) => (
            <div className="review-card" key={batch.id}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="list-thumb" style={{ width: 110, height: 84, flexShrink: 0 }}>
                  {batch.photo && <img src={batch.photo} alt={batch.name} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {batch.analyzing ? (
                    <p className="muted" style={{ fontSize: 14 }}>
                      <span className="ai-badge">✨ Analyzing…</span>
                    </p>
                  ) : batch.error ? (
                    <p style={{ color: 'var(--red)', fontSize: 13 }}>{batch.error}</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span className="ai-badge">✨ {batch.rows.length} item{batch.rows.length !== 1 ? 's' : ''} found</span>
                        {batch.rows.filter((r) => !r.added).length > 1 && (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busyKey === batch.id}
                            onClick={() => addAll(batch)}
                          >
                            {busyKey === batch.id ? 'Adding…' : 'Add all from this photo'}
                          </button>
                        )}
                      </div>
                      {batch.rows.map((row, i) => (
                        <DraftRow
                          key={i}
                          row={row}
                          busy={busyKey === `${batch.id}:${i}`}
                          onChange={(next) =>
                            patchBatch(batch.id, (b) => ({ rows: b.rows.map((r, j) => (j === i ? next : r)) }))
                          }
                          onAdd={() => addRow(batch, i)}
                          onDiscard={() =>
                            patchBatch(batch.id, (b) => ({ rows: b.rows.filter((_, j) => j !== i) }))
                          }
                          onEdit={() => setEditing({ batch, rowIndex: i })}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
              {!batch.analyzing && (batch.error || batch.rows.length === 0 || batch.rows.every((r) => r.added)) && (
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setBatches((bs) => bs.filter((b) => b.id !== batch.id))}
                  >
                    {batch.error ? 'Remove' : 'Clear from queue'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {editing && (
        <ItemForm
          initial={{
            ...draftToItem(editing.batch.rows[editing.rowIndex], editing.batch.photo, editing.batch.groupId),
            price: editing.batch.rows[editing.rowIndex].price,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            patchBatch(editing.batch.id, (b) => ({
              rows: b.rows.map((r, j) => (j === editing.rowIndex ? { ...r, added: true } : r)),
            }))
          }}
        />
      )}
    </div>
  )
}
