export function money(n) {
  if (n == null || n === '') return '—'
  return `$${Number(n).toLocaleString('en-US')}`
}

export function formatDate(iso, opts) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric' })
}

export function formatWindow(w) {
  const start = new Date(w.starts_at)
  const end = new Date(w.ends_at)
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const t = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t(start)}–${t(end)}`
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}

export const DELIVERY_LABELS = {
  none: 'Pickup only',
  can_help_load: 'Pickup — I can help load',
  local_delivery: 'Local delivery available',
}

export const STATUS_LABELS = {
  available: 'Available',
  pending: 'Pending / Reserved',
  sold: 'Sold',
}
