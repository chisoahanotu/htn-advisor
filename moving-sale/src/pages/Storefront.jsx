import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/mockBackend.js'
import { useQuery } from '../services/useStore.js'
import { money } from '../services/format.js'
import { StatusBadge, Spinner } from '../components/ui.jsx'

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'available', label: 'Available' },
  { key: 'pending', label: 'Pending' },
  { key: 'sold', label: 'Sold' },
]

function Tile({ item }) {
  const isSold = item.status === 'sold'
  return (
    <Link to={`/item/${item.slug}`} className={`tile is-${item.status}`}>
      <div className="tile-photo">
        <img src={item.photos[0]} alt={item.title} loading="lazy" />
        {item.status !== 'available' && <StatusBadge status={item.status} corner />}
        {isSold && (
          <div className="sold-overlay">
            <span>SOLD</span>
          </div>
        )}
      </div>
      <div className="tile-body">
        <div className="tile-title">{item.title}</div>
        <div className="tile-dims">{item.dimensions}</div>
        <div className="tile-foot">
          <span className="price">{money(item.price)}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {item.condition}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Storefront() {
  const { data: items, loading } = useQuery(() => api.listItems())
  const [filter, setFilter] = useState('all')

  if (loading) return <Spinner />

  const shown = items.filter((i) => filter === 'all' || i.status === filter)
  const availableCount = items.filter((i) => i.status === 'available').length

  return (
    <div className="wrap">
      <div style={{ margin: '16px 0 4px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Everything Must Go</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>
          {availableCount} items still available · Make an offer or book a pickup — no account needed.
        </p>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">No items in this view.</div>
      ) : (
        <div className="grid">
          {shown.map((item) => (
            <Tile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
