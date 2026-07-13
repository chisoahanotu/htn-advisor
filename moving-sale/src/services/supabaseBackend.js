// ---------------------------------------------------------------------------
// Production backend against Supabase. Implements docs/BACKEND_API.md.
//
//   - Supabase Postgres  -> items, offers, messages, pickup_windows,
//                            bookings, settings (single row id=1)
//   - Supabase Storage    -> photos bucket, public URLs
//   - Supabase Auth       -> email + password (single admin)
//   - Edge Functions      -> `submit` (offers/bookings + Telegram DM),
//                            `ai-intake` (Anthropic vision draft)
//
// This module is imported even when the app runs in mock mode, so it must
// never throw at import time — the Supabase client is only created when the
// env vars are present.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

function client() {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  return supabase
}

function check(error) {
  if (error) throw error
}

// ---- subscribers ------------------------------------------------------------
const subscribers = new Set()
function notify() {
  subscribers.forEach((fn) => fn())
}

// ---- session (cached, updated async via onAuthStateChange) -----------------
let sessionActive = false
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    sessionActive = Boolean(data?.session)
    notify()
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    sessionActive = Boolean(session)
    notify()
  })
}

function slugify(text) {
  const base = String(text || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return base || 'item'
}

// Camera-roll photos are huge (4000px+, several MB) and iPhones may hand over
// HEIC, which non-Apple browsers and the vision model can't read. Downscale to
// a web-friendly size and re-encode as JPEG on-device before uploading. If the
// browser can't decode the file (e.g. HEIC on Chrome), upload it untouched.
const WEB_SAFE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_EDGE = 2048

async function normalizePhoto(file) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const webSafe = WEB_SAFE_TYPES.includes(file.type)
    if (webSafe && scale === 1 && file.size < 3 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob) return file
    const base = (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// ---- public API -----------------------------------------------------------
export const api = {
  backendName: 'supabase',
  authMode: 'email',

  subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  },

  resetDemo() {
    // no-op on supabase
  },

  // ---- auth (Supabase Auth) ----
  getSession() {
    return sessionActive
  },
  async signIn({ email, password }) {
    const { error } = await client().auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    sessionActive = true
    notify()
    return { ok: true }
  },
  async signOut() {
    await client().auth.signOut()
    sessionActive = false
    notify()
  },

  // ---- items ----
  async listItems() {
    const { data, error } = await client().from('items').select('*').order('created_at', { ascending: false })
    check(error)
    return data
  },
  async getItemBySlug(slug) {
    const { data, error } = await client().from('items').select('*').eq('slug', slug).maybeSingle()
    check(error)
    return data || null
  },
  async createItem(data) {
    const base = slugify(data.slug || data.title)
    let slug = base
    let n = 2
    const payload = {
      title: data.title || 'Untitled item',
      description: data.description || '',
      price: data.price ?? 0,
      original_price: data.original_price ?? null,
      dimensions: data.dimensions || '',
      category: data.category || 'Other',
      condition: data.condition || 'Good',
      photos: data.photos?.length ? data.photos : [],
      delivery_option: data.delivery_option || 'none',
      delivery_fee: data.delivery_fee ?? null,
      status: data.status || 'available',
      photo_group_id: data.photo_group_id ?? null,
      photo_pos: data.photo_pos ?? null,
    }
    for (;;) {
      const { data: row, error } = await client()
        .from('items')
        .insert({ ...payload, slug })
        .select()
        .single()
      if (!error) {
        notify()
        return row
      }
      if (error.code === '23505') {
        slug = `${base}-${n++}`
        continue
      }
      throw error
    }
  },
  async updateItem(id, patch) {
    const { data, error } = await client()
      .from('items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()
    check(error)
    notify()
    return data || null
  },
  async deleteItem(id) {
    const { error } = await client().from('items').delete().eq('id', id)
    check(error)
    notify()
  },
  async uploadPhotos(files) {
    const urls = []
    for (const raw of files) {
      const file = await normalizePhoto(raw)
      const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
      const path = `items/${crypto.randomUUID()}.${ext}`
      const { error } = await client().storage.from('photos').upload(path, file)
      check(error)
      const { data } = client().storage.from('photos').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  },

  // ---- offers (buyer action -> Telegram via Edge Function) ----
  // Homepage visit counter (daily buckets; deduped per browser session upstream).
  async recordVisit() {
    try {
      await client().rpc('record_visit')
    } catch {
      /* analytics must never break the page */
    }
  },
  async getVisitStats() {
    const { data, error } = await client().from('site_visits').select('*')
    check(error)
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: (data || []).reduce((n, r) => n + r.count, 0),
      today: (data || []).find((r) => r.day === today)?.count ?? 0,
    }
  },

  // Fire-and-forget anonymous view counter (SECURITY DEFINER RPC).
  async recordView(itemId) {
    try {
      await client().rpc('record_view', { p_item_id: itemId })
    } catch {
      /* analytics must never break the page */
    }
  },
  async listOffers() {
    const { data, error } = await client().from('offers').select('*').order('created_at', { ascending: false })
    check(error)
    return data
  },
  async createOffer(data) {
    const { data: res, error } = await client().functions.invoke('submit', {
      body: { type: 'offer', ...data },
    })
    if (error) throw error
    if (!res?.ok) throw new Error(res?.error || 'Failed to submit offer')
    notify()
    return { id: res.id, thread_token: res.thread_token }
  },
  async resolveOffer(offerId, accept) {
    const { data: offer, error: offerErr } = await client()
      .from('offers')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', offerId)
      .select()
      .maybeSingle()
    check(offerErr)
    if (accept && offer) {
      const { data: item, error: itemErr } = await client()
        .from('items')
        .select('id, status')
        .eq('id', offer.item_id)
        .maybeSingle()
      check(itemErr)
      if (item && item.status === 'available') {
        const { error } = await client().from('items').update({ status: 'pending' }).eq('id', item.id)
        check(error)
      }
    }
    notify()
  },
  async getThread(offerId, token) {
    const { data, error } = await client().rpc('thread_get', { p_offer_id: offerId, p_token: token })
    check(error)
    return data || null
  },
  async postThreadMessage(offerId, token, body) {
    const { data, error } = await client().rpc('thread_post', {
      p_offer_id: offerId,
      p_token: token,
      p_body: body,
    })
    check(error)
    notify()
    return data
  },
  async adminGetThread(offerId) {
    const { data: offer, error: offerErr } = await client()
      .from('offers')
      .select('id, status, offer_price, item_id, items(title)')
      .eq('id', offerId)
      .maybeSingle()
    check(offerErr)
    if (!offer) return null
    const { data: messages, error: msgErr } = await client()
      .from('messages')
      .select('*')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: true })
    check(msgErr)
    return {
      offer: {
        id: offer.id,
        status: offer.status,
        offer_price: offer.offer_price,
        item_title: offer.items?.title ?? null,
      },
      messages: messages || [],
    }
  },
  async adminPostMessage(offerId, body) {
    const { error } = await client().from('messages').insert({ offer_id: offerId, sender: 'seller', body })
    check(error)
    notify()
  },

  // ---- pickup windows ----
  async listWindows() {
    const { data, error } = await client().from('pickup_windows').select('*').order('starts_at', { ascending: true })
    check(error)
    return data
  },
  async createWindow(starts_at, ends_at) {
    const { error } = await client().from('pickup_windows').insert({ starts_at, ends_at, status: 'open' })
    check(error)
    notify()
  },
  async deleteWindow(id) {
    const { error } = await client().from('pickup_windows').delete().eq('id', id)
    check(error)
    notify()
  },

  // ---- bookings (buyer action -> Telegram via Edge Function) ----
  async listBookings() {
    const { data, error } = await client().from('bookings').select('*').order('created_at', { ascending: false })
    check(error)
    return data
  },
  async createBooking(data) {
    const { data: res, error } = await client().functions.invoke('submit', {
      body: { type: 'booking', ...data },
    })
    if (error) throw error
    if (!res?.ok) throw new Error(res?.error || 'Failed to submit booking')
    // The Edge Function only returns the new id — fetch the full row so
    // createBooking matches the documented Booking return shape.
    const { data: booking, error: fetchErr } = await client()
      .from('bookings')
      .select('*')
      .eq('id', res.id)
      .single()
    check(fetchErr)
    notify()
    return booking
  },
  async resolveBooking(bookingId, accept) {
    const { data: booking, error } = await client()
      .from('bookings')
      .update({ status: accept ? 'confirmed' : 'declined' })
      .eq('id', bookingId)
      .select()
      .maybeSingle()
    check(error)
    if (booking && !accept && booking.window_id) {
      const { error: winErr } = await client()
        .from('pickup_windows')
        .update({ status: 'open' })
        .eq('id', booking.window_id)
      check(winErr)
    }
    notify()
  },

  // ---- settings ----
  async getSettings() {
    const { data, error } = await client().from('settings').select('*').eq('id', 1).maybeSingle()
    check(error)
    return (
      data || {
        site_name: '',
        move_out_date: null,
        bundle_discount_pct: 0,
        price_drops: [],
      }
    )
  },
  async updateSettings(patch) {
    const { data, error } = await client()
      .from('settings')
      .upsert({ id: 1, ...patch })
      .select()
      .single()
    check(error)
    notify()
    return data
  },

  // ---- notifications (derived from offers + bookings) ----
  async listNotifications() {
    const [itemsRes, offersRes, bookingsRes] = await Promise.all([
      client().from('items').select('id, title'),
      client().from('offers').select('*'),
      client().from('bookings').select('*'),
    ])
    check(itemsRes.error)
    check(offersRes.error)
    check(bookingsRes.error)
    const titleById = new Map((itemsRes.data || []).map((i) => [i.id, i.title]))
    const offerNtfs = (offersRes.data || []).map((o) => ({
      id: `ntf_off_${o.id}`,
      kind: 'offer',
      ref_id: o.id,
      text: `Purchase request: "${titleById.get(o.item_id) ?? 'item'}" — $${o.offer_price} from ${o.buyer_name}.`,
      created_at: o.created_at,
      resolved: o.status !== 'new',
    }))
    const bookingNtfs = (bookingsRes.data || []).map((b) => {
      const title = b.item_id ? titleById.get(b.item_id) : null
      return {
        id: `ntf_bk_${b.id}`,
        kind: 'booking',
        ref_id: b.id,
        text: `Pickup request from ${b.buyer_name}${title ? ` for "${title}"` : ''}.`,
        created_at: b.created_at,
        resolved: b.status !== 'requested',
      }
    })
    return [...offerNtfs, ...bookingNtfs].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  // ---- AI intake (Anthropic vision via Edge Function) ----
  // One photo may contain several sellable items — returns one draft per item.
  async draftListing(file) {
    const [photo] = await api.uploadPhotos([file])
    const { data, error } = await client().functions.invoke('ai-intake', { body: { image_url: photo } })
    if (error) throw error
    return { photo, items: data.items || [] }
  },
}
