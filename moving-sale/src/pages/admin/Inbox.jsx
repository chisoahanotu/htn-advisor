import { api } from '../../services/mockBackend.js'
import { useQuery } from '../../services/useStore.js'
import { money, formatWindow, formatDate } from '../../services/format.js'
import { Spinner } from '../../components/ui.jsx'

// Mirrors the Telegram approval flow: each new offer/booking shows up with
// inline Accept / Reject. Accept offer -> item pending. Accept booking ->
// confirmed. Reject booking -> window reopens.
export default function Inbox() {
  const { data: notifs, loading } = useQuery(() => api.listNotifications())
  const { data: offers } = useQuery(() => api.listOffers())
  const { data: bookings } = useQuery(() => api.listBookings())
  const { data: items } = useQuery(() => api.listItems())
  const { data: windows } = useQuery(() => api.listWindows())

  if (loading) return <Spinner />

  const itemById = Object.fromEntries((items || []).map((i) => [i.id, i]))
  const offerById = Object.fromEntries((offers || []).map((o) => [o.id, o]))
  const bookingById = Object.fromEntries((bookings || []).map((b) => [b.id, b]))
  const windowById = Object.fromEntries((windows || []).map((w) => [w.id, w]))

  const pending = notifs.filter((n) => !n.resolved)
  const resolved = notifs.filter((n) => n.resolved)

  function renderCard(n) {
    const isOffer = n.kind === 'offer'
    const rec = isOffer ? offerById[n.ref_id] : bookingById[n.ref_id]
    const item = rec?.item_id ? itemById[rec.item_id] : null
    return (
      <div className={`notif ${n.resolved ? 'resolved' : ''}`} key={n.id}>
        <div className="notif-icon">{isOffer ? '💵' : '📅'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{n.text}</div>
          {rec && (
            <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
              {isOffer ? (
                <>
                  Offer {money(rec.offer_price)} · {item ? item.title : 'item'} · contact: {rec.buyer_contact}
                  {rec.message ? ` · “${rec.message}”` : ''}
                </>
              ) : (
                <>
                  {windowById[rec.window_id] ? formatWindow(windowById[rec.window_id]) : 'window'} · contact: {rec.buyer_contact}
                </>
              )}
            </div>
          )}
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            {formatDate(n.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>

          {!n.resolved && (
            <div className="row-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => (isOffer ? api.resolveOffer(n.ref_id, true) : api.resolveBooking(n.ref_id, true))}
              >
                ✓ Accept
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => (isOffer ? api.resolveOffer(n.ref_id, false) : api.resolveBooking(n.ref_id, false))}
              >
                ✕ Reject
              </button>
            </div>
          )}
          {n.resolved && rec && (
            <div className="pill" style={{ marginTop: 8 }}>
              {rec.status === 'accepted' || rec.status === 'confirmed' ? 'Accepted' : 'Declined'}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        In production these arrive as Telegram DMs with the same Accept / Reject buttons.
        Buyer follow-up is manual in v1.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 14px 4px' }} className="section-title">
          Needs a decision ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div className="empty" style={{ padding: 28 }}>All caught up 🎉</div>
        ) : (
          pending.map(renderCard)
        )}
      </div>

      {resolved.length > 0 && (
        <div className="card">
          <div style={{ padding: '14px 14px 4px' }} className="section-title">
            Resolved
          </div>
          {resolved.map(renderCard)}
        </div>
      )}
    </div>
  )
}
