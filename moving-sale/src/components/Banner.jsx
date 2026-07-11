import { useQuery } from '../services/useStore.js'
import { api } from '../services/backend.js'
import { formatDate, daysUntil } from '../services/format.js'

// Persistent move-out urgency banner (per brief: "Everything must go by {date}").
export default function Banner() {
  const { data: settings } = useQuery(() => api.getSettings())
  if (!settings?.move_out_date) return null
  const days = daysUntil(settings.move_out_date)
  const when = formatDate(settings.move_out_date, { month: 'long', day: 'numeric' })
  return (
    <div className="urgency">
      Everything must go by {when}
      {days != null && days >= 0 && <span className="days">{days} days left</span>}
    </div>
  )
}
