import { useState } from 'react'
import { api } from '../../services/backend.js'
import { useQuery } from '../../services/useStore.js'
import { money, formatDate } from '../../services/format.js'
import { Spinner } from '../../components/ui.jsx'

const STATUS_META = {
  new: { label: 'New', badge: 'badge-pending' },
  accepted: { label: 'Accepted', badge: 'badge-available' },
  declined: { label: 'Declined', badge: 'badge-sold' },
}

// Expandable negotiation thread for a single offer — mirrors the buyer-facing
// OfferThread page but with an admin reply box (adminGetThread/adminPostMessage).
function ThreadPanel({ offerId }) {
  const { data: thread, loading } = useQuery(() => api.adminGetThread(offerId), [offerId])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (!thread) return <p className="muted" style={{ padding: '0 14px 14px' }}>No thread found.</p>

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    await api.adminPostMessage(offerId, body.trim())
    setBody('')
    setBusy(false)
  }

  return (
    <div style={{ padding: '0 14px 14px' }}>
      {thread.messages.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No messages yet.</p>
      ) : (
        <div className="thread-list">
          {thread.messages.map((m, i) => (
            <div key={m.id || i} className={`thread-msg thread-msg-${m.sender}`}>
              <div className="thread-msg-body">{m.body}</div>
              <div className="thread-msg-meta">
                {m.sender === 'buyer' ? 'Buyer' : 'You'} ·{' '}
                {formatDate(m.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to buyer…"
          style={{ flex: 1, fontSize: 14, padding: '9px 12px', border: '1px solid var(--line2)', borderRadius: 9, fontFamily: 'inherit' }}
        />
        <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
          {busy ? 'Sending…' : 'Reply'}
        </button>
      </form>
    </div>
  )
}

export default function Offers() {
  const { data: offers, loading } = useQuery(() => api.listOffers())
  const { data: items } = useQuery(() => api.listItems())
  const [open, setOpen] = useState(null)

  if (loading) return <Spinner />

  const itemById = Object.fromEntries((items || []).map((i) => [i.id, i]))

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{offers.length} offers</p>

      <div className="card">
        {offers.length === 0 ? (
          <div className="empty">No offers yet.</div>
        ) : (
          offers.map((o) => {
            const item = itemById[o.item_id]
            const isOpen = open === o.id
            const meta = STATUS_META[o.status] || STATUS_META.new
            return (
              <div key={o.id}>
                <div className="list-row">
                  <div className="list-main">
                    <div className="t">
                      {o.buyer_name} · {money(o.offer_price)} on {item ? item.title : 'item'}
                      {o.is_bundle && (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          Bundle
                        </span>
                      )}
                    </div>
                    <div className="s">
                      contact: {o.buyer_contact}
                      {o.message ? ` · “${o.message}”` : ''}
                    </div>
                  </div>
                  <div className="row-actions">
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                    {o.status === 'new' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => api.resolveOffer(o.id, true)}>
                          Accept
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => api.resolveOffer(o.id, false)}>
                          Decline
                        </button>
                      </>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(isOpen ? null : o.id)}>
                      {isOpen ? 'Hide thread' : 'View thread'}
                    </button>
                  </div>
                </div>
                {isOpen && <ThreadPanel offerId={o.id} />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
