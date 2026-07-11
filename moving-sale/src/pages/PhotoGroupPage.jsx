import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/backend.js'
import { useQuery } from '../services/useStore.js'
import { money, DELIVERY_LABELS } from '../services/format.js'
import { StatusBadge, Spinner } from '../components/ui.jsx'
import { track } from '../services/analytics.js'
import { OfferModal, BookingModal } from './ItemPage.jsx'
import { PriceStamps } from './Storefront.jsx'

// One photo, several listings. Reached from the gallery when a photo's items
// share a photo_group_id; each item keeps its own /item/:slug page too.
export default function PhotoGroupPage() {
  const { groupId } = useParams()
  const { data: items, loading } = useQuery(() => api.listItems())
  const [modal, setModal] = useState(null) // { kind: 'offer'|'booking', item }

  useEffect(() => {
    track('photo_group_viewed', { group_id: groupId })
  }, [groupId])

  if (loading) return <Spinner />

  const members = (items || []).filter((i) => i.photo_group_id === groupId)
  if (members.length === 0)
    return (
      <div className="wrap">
        <div className="empty">
          Photo not found. <Link to="/" style={{ color: 'var(--rust)' }}>Back to catalog</Link>
        </div>
      </div>
    )

  const photo = members[0].photos[0]

  return (
    <div className="wrap">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
        ← All items
      </Link>

      <div className="group-photo">
        <img src={photo} alt={`${members.length} items`} />
        <PriceStamps items={members} />
      </div>

      <div className="section-title" style={{ marginTop: 18 }}>
        {members.length} items in this photo
      </div>

      {members.map((item) => {
        const actionable = item.status === 'available'
        return (
          <div className="card group-item" key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>{item.title}</h2>
                  <StatusBadge status={item.status} />
                </div>
                <div className="price" style={{ fontSize: 20, marginTop: 4 }}>
                  {money(item.price)}
                  {item.original_price > item.price && (
                    <span className="was-price"> was {money(item.original_price)}</span>
                  )}
                </div>
              </div>
              <div className="row-actions" style={{ alignItems: 'flex-start' }}>
                {actionable ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'offer', item })}>
                      Make an offer
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ kind: 'booking', item })}>
                      Request pickup
                    </button>
                  </>
                ) : (
                  <span className="pill">{item.status === 'sold' ? 'Sold' : 'Reserved'}</span>
                )}
              </div>
            </div>
            <p className="desc" style={{ marginTop: 8 }}>{item.description}</p>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {item.dimensions ? `${item.dimensions} · ` : ''}
              {item.condition} · {item.category} · {DELIVERY_LABELS[item.delivery_option]}
              {item.delivery_fee ? ` (${money(item.delivery_fee)})` : ''}
            </p>
            <Link to={`/item/${item.slug}`} className="hint" style={{ display: 'inline-block', marginTop: 6 }}>
              View full listing →
            </Link>
          </div>
        )
      })}

      {modal?.kind === 'offer' && <OfferModal item={modal.item} onClose={() => setModal(null)} />}
      {modal?.kind === 'booking' && <BookingModal item={modal.item} onClose={() => setModal(null)} />}
    </div>
  )
}
