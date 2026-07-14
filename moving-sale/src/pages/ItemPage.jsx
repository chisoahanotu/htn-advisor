import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/backend.js'
import { useQuery } from '../services/useStore.js'
import { money, DELIVERY_LABELS, formatWindow, formatDate } from '../services/format.js'
import { Modal, Spinner, useToast } from '../components/ui.jsx'
import { track } from '../services/analytics.js'

const MY_OFFERS_KEY = 'moving_sale_my_offers'

// Buyers keep a token to reach their negotiation thread later — no account needed.
function rememberMyOffer(entry) {
  try {
    const raw = localStorage.getItem(MY_OFFERS_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift(entry)
    localStorage.setItem(MY_OFFERS_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota / private mode */
  }
}

// Sorted (desc) by days_before per the settings shape; finds the soonest
// future drop date relative to move_out_date.
function nextPriceDrop(settings) {
  if (!settings?.price_drops?.length || !settings?.move_out_date) return null
  const moveOut = new Date(settings.move_out_date + 'T00:00:00')
  const now = new Date()
  const drops = [...settings.price_drops].sort((a, b) => b.days_before - a.days_before)
  const upcoming = drops
    .map((d) => ({ pct: d.pct, date: new Date(moveOut.getTime() - d.days_before * 86400000) }))
    .filter((d) => d.date > now)
    .sort((a, b) => a.date - b.date)
  return upcoming[0] || null
}

function Confirm({ text }) {
  return (
    <div className="confirm-box">
      <div className="check">✓</div>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Sent — you'll hear back shortly</p>
      <p className="muted" style={{ fontSize: 14 }}>{text}</p>
    </div>
  )
}

export function OfferModal({ item, onClose }) {
  const { data: settings } = useQuery(() => api.getSettings())
  const [form, setForm] = useState({ buyer_name: '', buyer_contact: '', message: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tracked, setTracked] = useState(null) // { id, thread_token }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    // Fixed-price purchase request — negotiation happens over text, off-site.
    const res = await api.createOffer({ item_id: item.id, offer_price: item.price, ...form })
    setBusy(false)
    if (res?.id) {
      rememberMyOffer({
        offer_id: res.id,
        token: res.thread_token,
        item_title: item.title,
        created_at: new Date().toISOString(),
      })
      setTracked(res)
    }
    track('purchase_requested', { item_id: item.id })
    setSent(true)
  }

  return (
    <Modal title={sent ? 'Request sent' : `Buy — ${item.title} (${money(item.price)})`} onClose={onClose}>
      {sent ? (
        <div>
          <Confirm text="The seller has been notified and will confirm your purchase." />
          {tracked && (
            <p style={{ textAlign: 'center', marginTop: 14 }}>
              <Link
                to={`/offer/${tracked.id}?t=${tracked.thread_token}`}
                className="btn btn-ghost btn-sm"
                onClick={onClose}
              >
                Track your request &amp; message the seller
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
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
            <textarea value={form.message} onChange={set('message')} placeholder="Pickup timing, questions, etc." />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending…' : `Request to buy — ${money(item.price)}`}
          </button>
        </form>
      )}
    </Modal>
  )
}

export function BookingModal({ item, onClose }) {
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
    track('booking_submitted', { item_id: item.id })
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
  const { data: settings } = useQuery(() => api.getSettings())
  const [activePhoto, setActivePhoto] = useState(0)
  const [modal, setModal] = useState(null) // 'offer' | 'booking'
  const [toast, setToast] = useToast()

  useEffect(() => {
    track('item_viewed', { slug })
  }, [slug])

  useEffect(() => {
    if (item?.id) api.recordView(item.id)
  }, [item?.id])

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
  const drop = actionable ? nextPriceDrop(settings) : null
  const hasOriginalPrice = item.original_price && item.original_price > item.price

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
          <h1>{item.title}</h1>
          <div className="price-lg">
            {money(item.price)}
            {hasOriginalPrice && <span className="was-price">was {money(item.original_price)}</span>}
          </div>
          {drop && (
            <p className="hint price-drop-hint">
              Price drops {drop.pct}% on {formatDate(drop.date.toISOString(), { month: 'short', day: 'numeric' })}
            </p>
          )}

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
                  🛒 I'll take it — {money(item.price)}
                </button>
                <button className="btn btn-ghost" onClick={() => setModal('booking')}>
                  Request pickup
                </button>
              </>
            ) : (
              <div className="pill">This listing is no longer available</div>
            )}
            <button className="btn btn-ghost" onClick={copyLink}>
              🔗 Copy link
            </button>
          </div>
          {settings?.contact_phone && (
            <p className="hint" style={{ marginTop: 10 }}>
              💬 Questions or want to negotiate? Text me at{' '}
              <a href={`sms:${settings.contact_phone}`} style={{ color: 'var(--rust)', fontWeight: 600 }}>
                {settings.contact_phone}
              </a>
            </p>
          )}
        </div>
      </div>

      {modal === 'offer' && <OfferModal item={item} onClose={() => setModal(null)} />}
      {modal === 'booking' && <BookingModal item={item} onClose={() => setModal(null)} />}
      {toast}
    </div>
  )
}
