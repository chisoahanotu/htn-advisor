import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from './backend.js'

// Runs an async loader and re-runs it whenever the active backend mutates.
// Mirrors how a real app would subscribe to Supabase realtime changes.
export function useQuery(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Keep the latest data across refetches so a background refresh (fired by any
  // mutation via api.subscribe) never blanks the UI or resets open modals.
  const hasData = useRef(false)

  const run = useCallback(() => {
    let alive = true
    if (!hasData.current) setLoading(true)
    Promise.resolve(loader()).then((res) => {
      if (alive) {
        hasData.current = true
        setData(res)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    const cancel = run()
    const unsub = api.subscribe(run)
    return () => {
      cancel && cancel()
      unsub()
    }
  }, [run])

  return { data, loading }
}

// Reactive admin session flag.
export function useSession() {
  const [authed, setAuthed] = useState(api.getSession())
  useEffect(() => api.subscribe(() => setAuthed(api.getSession())), [])
  return authed
}
