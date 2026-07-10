import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/mockBackend.js'
import { useQuery } from '../services/useStore.js'
import { money, DELIVERY_LABELS, formatWindow } from '../services/format.js'
import { StatusBadge, Modal, Spinner, useToast } from '../components/ui.jsx'

function Confirm({ text }) {
  return (
    <div className="confirm-box">
      <div className="check">✓</div>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Sent — you'll hear back shortly</p>
      <p className="muted" style={{ fontSize: 14 }}>{text}</p>
    </div>
  )
}

function OfferModal({ item, onClose }) {
  const [form, setForm] = useState({ offer_price: '', buyer_name: '', buyer_contact: '', message: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    await api.createOffer({ item_id: item.id, ...form })
    setBusy(false)
    setSent(true)
  }

  return (
    <Modal title={sent ? 'Offer sent' : `Make an offer — ${item.title}`} onClose={onClose}>
      {sent ? (
        <Confirm text="The seller has been notified and will accept or decline." />
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>Your offer (USD)</label>
            <input type="number" min="1" required placeholder={`Asking ${money(item.price)}`} value={form.offer_price} onChange={set('offer_price')} />
          </div>
          <div className="field">
            <label>Name</label>
            <input required value={form.buyer_name} onChange={set('buyer_name')} />
          </div>
          <div className="field">
            <label>Contact (email or phone)</label>
            <input required value={form.buyer_contact} onChange={set('buyer_contact')} />
          </div>
          <div className="field">
            <label>Message (optional)</label>
            <textarea value={form.message} onChange={set('message')} placeholder="Anything the seller should know?" />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending…' : 'Send offer'}
          </button>
        </form>
      )}
    </Modal>
  )
}

function BookingModal({ item, onClose }) {
  const { data: windows, loading } = useQuery(() => api.listWindows())
  const [form, setForm] = useState({ window_id: '', buyer_name: '', buyer_contact: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    await api.createBooking({ item_id: item.id, ...form })
    setBusy(false)
    setSent(true)
  }

  const open = (windows || []).filter((w) => w.status === 'open')

  return (
    <Modal title={sent ? 'Pickup requested' : `Request pickup — ${item.title}`} onClose={onClose}>
      {sent ? (
        <Confirm text="Your window is held pending the seller's confirmation." />
      ) : loading ? (
        <Spinner />
      ) : open.length === 0 ? (
        <p className="muted">No open pickup windows right now — check back soon.</p>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>Choose an open window</label>
            <select required value={form.window_id} onChange={set('window_id')}>
              <option value="">Select a time…</option>
              {open.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatWindow(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Name</label>
            <input required value={form.buyer_name} onChange={set('buyer_name')} />
          </div>
          <div className="field">
            <label>Contact (email or phone)</label>
            <input required value={form.buyer_contact} onChange={set('buyer_contact')} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Requesting…' : 'Request this window'}
          </button>
        </form>
      )}
    </Modal>
  )
}

export default function ItemPage() {
  const { slug } = useParams()
  const { data: item, loading } = useQuery(() => api.getItemBySlug(slug), [slug])
  const [activePhoto, setActivePhoto] = useState(0)
  const [modal, setModal] = useState(null) // 'offer' | 'booking'
  const [toast, setToast] = useToast()

  if (loading) return <Spinner />
  if (!item)
    return (
      <div className="wrap">
        <div className="empty">
          Item not found. <Link to="/" style={{ color: 'var(--rust)' }}>Back to catalog</Link>
        </div>
      </div>
    )

  const actionable = item.status === 'available'

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href)
    setToast('Link copied to clipboard')
  }

  const specs = [
    ['Price', money(item.price)],
    ['Dimensions', item.dimensions || '—'],
    ['Condition', item.condition],
    ['Category', item.category],
    ['Delivery', DELIVERY_LABELS[item.delivery_option] + (item.delivery_fee ? ` · ${money(item.delivery_fee)}` : '')],
  ]

  return (
    <div className="wrap">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
        ← All items
      </Link>

      <div className="detail">
        <div>
          <div className="gallery-main">
            <img src={item.photos[activePhoto]} alt={item.title} />
          </div>
          {item.photos.length > 1 && (
            <div className="thumbs">
              {item.photos.map((p, i) => (
                <div key={i} className={`thumb ${i === activePhoto ? 'active' : ''}`} onClick={() => setActivePhoto(i)}>
                  <img src={p} alt={`${item.title} ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <StatusBadge status={item.status} />
          </div>
          <h1>{item.title}</h1>
          <div className="price-lg">{money(item.price)}</div>

          <div>
            {specs.map(([k, v]) => (
              <div className="spec-row" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>

          <p className="desc">{item.description}</p>

          <div className="action-row">
            {actionable ? (
              <>
                <button className="btn btn-primary" onClick={() => setModal('offer')}>
                  Make an offer
                </button>
                <button className="btn btn-ghost" onClick={() => setModal('booking')}>
                  Request pickup
                </button>
              </>
            ) : (
              <div className="pill">
                {item.status === 'sold' ? 'This item has sold' : 'Reserved — pending pickup'}
              </div>
            )}
            <button className="btn btn-ghost" onClick={copyLink}>
              🔗 Copy link
            </button>
          </div>
          {!actionable && (
            <p className="hint">Sold and pending items stay listed for reference but can't be reserved.</p>
          )}
        </div>
      </div>

      {modal === 'offer' && <OfferModal item={item} onClose={() => setModal(null)} />}
      {modal === 'booking' && <BookingModal item={item} onClose={() => setModal(null)} />}
      {toast}
    </div>
  )
}
