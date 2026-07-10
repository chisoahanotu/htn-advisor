import { useEffect, useState } from 'react'
import { STATUS_LABELS } from '../services/format.js'

export function StatusBadge({ status, corner }) {
  return (
    <span className={`badge badge-${status} ${corner ? 'badge-corner' : ''}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />
}

// Lightweight toast controlled via the useToast hook.
export function useToast() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast">{msg}</div> : null
  return [node, setMsg]
}
