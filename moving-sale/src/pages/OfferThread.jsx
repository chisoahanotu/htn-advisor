import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../services/backend.js'
import { useQuery } from '../services/useStore.js'
import { money, formatDate } from '../services/format.js'
import { Spinner } from '../components/ui.jsx'

const STATUS_META = {
  new: { label: 'Awaiting response', badge: 'badge-pending' },
  accepted: { label: 'Accepted', badge: 'badge-available' },
  declined: { label: 'Declined', badge: 'badge-sold' },
}

// Buyer-facing negotiation thread — reached via the token link shown after an
// offer is submitted. Token-authenticated (no buyer account).
export default function OfferThread() {
  const { offerId } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') || ''
  const { data: thread, loading } = useQuery(() => api.getThread(offerId, token), [offerId, token])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />

  if (!thread) {
    return (
      <div className="wrap">
        <div className="empty">
          <p>We couldn't find that request thread. Double-check the link from your confirmation.</p>
          <div style={{ marginTop: 14 }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              ← Back to catalog
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { offer, messages } = thread
  const meta = STATUS_META[offer.status] || STATUS_META.new

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    await api.postThreadMessage(offerId, token, body.trim())
    setBody('')
    setBusy(false)
  }

  return (
    <div className="wrap">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
        ← All items
      </Link>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div className="section-title">Your request</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 17 }}>{offer.item_title}</strong>
          <span className={`badge ${meta.badge}`}>{meta.label}</span>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>Your request: {money(offer.offer_price)}</p>

        {offer.status === 'accepted' && (
          <div className="thread-banner thread-banner-accepted">
            Offer accepted — the seller will coordinate pickup.
          </div>
        )}
        {offer.status === 'declined' && (
          <div className="thread-banner thread-banner-declined">This offer was declined.</div>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div className="section-title">Messages</div>
        {messages.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No messages yet — say hello!</p>
        ) : (
          <div className="thread-list">
            {messages.map((m, i) => (
              <div key={m.id || i} className={`thread-msg thread-msg-${m.sender}`}>
                <div className="thread-msg-body">{m.body}</div>
                <div className="thread-msg-meta">
                  {m.sender === 'buyer' ? 'You' : 'Seller'} ·{' '}
                  {formatDate(m.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <div className="field">
            <label>Send a message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message the seller…" />
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
