import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/backend.js'
import { useQuery } from '../services/useStore.js'
import { money } from '../services/format.js'
import { StatusBadge, Spinner } from '../components/ui.jsx'
import { track } from '../services/analytics.js'

// Items created from the same photo share a photo_group_id; single-item photos
// fall back to their own id so every item lands in exactly one gallery tile.
export function groupItems(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.photo_group_id || `solo-${item.id}`
    if (!groups.has(key)) groups.set(key, { key, items: [] })
    groups.get(key).items.push(item)
  }
  return [...groups.values()]
}

// Price stamp pinned where the AI saw the item in the photo; items without a
// position stack in the bottom-left corner instead. When the photo is shown
// object-fit:cover in a fixed-ratio box (gallery tiles), positions are stored
// relative to the FULL image, so remap them into the visible cropped region.
function remapForCover(pos, imageAspect, boxAspect) {
  if (!imageAspect || !boxAspect) return pos
  let { x, y } = pos
  if (imageAspect > boxAspect) {
    const visible = boxAspect / imageAspect // horizontal fraction shown
    x = (x - (1 - visible) / 2) / visible
  } else if (imageAspect < boxAspect) {
    const visible = imageAspect / boxAspect // vertical fraction shown
    y = (y - (1 - visible) / 2) / visible
  }
  return { x: Math.min(0.94, Math.max(0.06, x)), y: Math.min(0.92, Math.max(0.08, y)) }
}

export function PriceStamps({ items, imageAspect = null, boxAspect = null }) {
  let stacked = 0
  return items.map((item) => {
    const pos = item.photo_pos ? remapForCover(item.photo_pos, imageAspect, boxAspect) : null
    const style = pos
      ? { left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: 'translate(-50%, -50%)' }
      : { left: 10, bottom: 10 + 30 * stacked++ }
    return (
      <span key={item.id} className={`price-stamp is-${item.status}`} style={style}>
        {item.status === 'sold' ? <s>{money(item.price)}</s> : money(item.price)}
      </span>
    )
  })
}

function GalleryTile({ group }) {
  const items = group.items
  const single = items.length === 1
  const first = items[0]
  const allSold = items.every((i) => i.status === 'sold')
  const to = single ? `/item/${first.slug}` : `/photo/${group.key}`
  const [imageAspect, setImageAspect] = useState(null)

  return (
    <Link to={to} className={`tile ${allSold ? 'is-sold' : ''}`}>
      <div className="tile-photo">
        <img
          src={first.photos[0]}
          alt={single ? first.title : `${items.length} items`}
          loading="lazy"
          onLoad={(e) => setImageAspect(e.target.naturalWidth / e.target.naturalHeight)}
        />
        <PriceStamps items={items} imageAspect={imageAspect} boxAspect={4 / 3} />
        {single && first.status !== 'available' && <StatusBadge status={first.status} corner />}
        {allSold && (
          <div className="sold-overlay">
            <span>SOLD</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export default function Storefront() {
  const { data: items, loading } = useQuery(() => api.listItems())
  const { data: settings } = useQuery(() => api.getSettings())

  useEffect(() => {
    track('catalog_viewed')
  }, [])

  if (loading) return <Spinner />

  const groups = groupItems(items)
  const availableCount = items.filter((i) => i.status === 'available').length

  return (
    <div className="wrap">
      <div className="hero">
        <img className="hero-bg" src={`${import.meta.env.BASE_URL}hero.webp`} alt="" />
        <div className="hero-veil" />
        <div className="hero-text">
          <h1>Everything Must Go</h1>
          <p>
            {availableCount} items still available · Tap any photo to buy or book a pickup — no account
            needed.
          </p>
        </div>
      </div>

      {settings?.bundle_discount_pct > 0 && (
        <div className="pill bundle-banner">
          Take it all: bundle 2+ items and save {settings.bundle_discount_pct}% — text me for a bundle deal.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty">Nothing listed yet — check back soon.</div>
      ) : (
        <div className="grid">
          {groups.map((group) => (
            <GalleryTile key={group.key} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
