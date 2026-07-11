// Selects the backend implementation. See docs/BACKEND_API.md for the contract.
// With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set (e.g. on Vercel), the app
// runs against Supabase; otherwise it falls back to the in-browser mock demo.
import { api as mockApi } from './mockBackend.js'
import { api as supabaseApi } from './supabaseBackend.js'

const useSupabase = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const api = useSupabase ? supabaseApi : mockApi
