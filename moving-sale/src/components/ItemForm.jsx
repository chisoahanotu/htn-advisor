import { useState } from 'react'
import { api } from '../services/backend.js'
import { money } from '../services/format.js'
import { Modal } from './ui.jsx'
import CropModal from './CropModal.jsx'

const DELIVERY_OPTS = [
  ['none', 'Pickup only'],
  ['can_help_load', 'Pickup — I can help load'],
  ['local_delivery', 'Drop-off available'],
]
const STATUS_OPTS = ['available', 'pending', 'sold']
const CONDITIONS = ['Like New', 'Good', 'Fair', 'For Parts']

// Create or edit an item. `initial` may be a full item (edit) or an AI draft
// (create). Photo upload goes through api.uploadPhotos — mock returns
// placeholder images; supabase uploads to Storage and returns public URLs.
export default function ItemForm({ initial = {}, onClose, onSaved }) {
  const editing = !!initial.id
  const [form, setForm] = useState({
    title: initial.title || '',
    price: initial.price ?? '',
    dimensions: initial.dimensions || '',
    category: initial.category || 'Other',
    condition: initial.condition || 'Good',
    description: initial.description || '',
    delivery_option: initial.delivery_option || 'none',
    delivery_fee: initial.delivery_fee ?? '',
    status: initial.status || 'available',
    photos: initial.photos?.length ? initial.photos : [],
    photo_pos: initial.photo_pos ?? null,
  })
  const [busy, setBusy] = useState(false)
  const [cropIdx, setCropIdx] = useState(null) // photo index being edited
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onFiles(e) {
    const files = [...e.target.files]
    if (!files.length) return
    const urls = await api.uploadPhotos(files)
    setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      ...form,
      price: Number(form.price) || 0,
      delivery_fee: form.delivery_option === 'local_delivery' && form.delivery_fee !== '' ? Number(form.delivery_fee) : null,
      photo_pos: form.photo_pos ?? null,
      ...(initial.photo_group_id ? { photo_group_id: initial.photo_group_id } : {}),
    }
    if (editing) await api.updateItem(initial.id, payload)
    else await api.createItem(payload)
    setBusy(false)
    onSaved?.()
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit item' : 'New item'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Photos {form.photos.length > 0 && `(${form.photos.length})`}</label>
          {form.photos.length > 0 && (
            <div className="thumbs" style={{ marginBottom: 8 }}>
              {form.photos.map((p, i) => (
                <div key={i} className="thumb" style={{ cursor: 'default', position: 'relative' }}>
                  <img src={p} alt={`photo ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                    style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', width: 18, height: 18, borderRadius: '0 0 0 6px', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    title="Crop / edit photo"
                    onClick={() => setCropIdx(i)}
                    style={{ position: 'absolute', top: 0, left: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', width: 20, height: 18, borderRadius: '0 0 6px 0', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}
                  >
                    ✂️
                  </button>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" multiple onChange={onFiles} />
          <p className="hint">Mobile-friendly upload. Photos upload automatically as you add them.</p>
        </div>

        {form.photos.length > 0 && (
          <div className="field">
            <label>Price tag position</label>
            <div
              className="stamp-editor"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width))
                const y = Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height))
                setForm((f) => ({ ...f, photo_pos: { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) } }))
              }}
            >
              <img src={form.photos[0]} alt="price tag position" />
              <span
                className="price-stamp"
                style={
                  form.photo_pos
                    ? {
                        left: `${form.photo_pos.x * 100}%`,
                        top: `${form.photo_pos.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }
                    : { left: 10, bottom: 10 }
                }
              >
                {money(Number(form.price) || 0)}
              </span>
            </div>
            <p className="hint">
              Tap the photo where the price tag should sit in the gallery.
              {form.photo_pos ? ' ' : ' Currently pinned bottom-left. '}
              {form.photo_pos && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => setForm((f) => ({ ...f, photo_pos: null }))}
                >
                  Reset to corner
                </button>
              )}
            </p>
          </div>
        )}

        <div className="field">
          <label>Title</label>
          <input required value={form.title} onChange={set('title')} />
        </div>

        <div className="two-col">
          <div className="field">
            <label>Price (USD)</label>
            <input type="number" min="0" required value={form.price} onChange={set('price')} />
          </div>
          <div className="field">
            <label>Dimensions</label>
            <input value={form.dimensions} onChange={set('dimensions')} placeholder="84W x 38D x 34H in" />
          </div>
        </div>

        <div className="two-col">
          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={set('category')} />
          </div>
          <div className="field">
            <label>Condition</label>
            <select value={form.condition} onChange={set('condition')}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} />
        </div>

        <div className="two-col">
          <div className="field">
            <label>Delivery</label>
            <select value={form.delivery_option} onChange={set('delivery_option')}>
              {DELIVERY_OPTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {form.delivery_option === 'local_delivery' && (
            <div className="field">
              <label>Delivery fee (USD)</label>
              <input type="number" min="0" value={form.delivery_fee} onChange={set('delivery_fee')} />
            </div>
          )}
        </div>

        <div className="field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
        </button>
      </form>

      {cropIdx !== null && (
        <CropModal
          src={form.photos[cropIdx]}
          fileName={`photo-${cropIdx + 1}.jpg`}
          hint="The edited photo replaces this one on the listing when you apply."
          onClose={() => setCropIdx(null)}
          onApply={async (file) => {
            const i = cropIdx
            setCropIdx(null)
            const [url] = await api.uploadPhotos([file])
            setForm((f) => ({ ...f, photos: f.photos.map((p, j) => (j === i ? url : p)) }))
          }}
        />
      )}
    </Modal>
  )
}
