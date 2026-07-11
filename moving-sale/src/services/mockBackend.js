// ---------------------------------------------------------------------------
// Mock backend for the Phase 1 prototype.
//
// This stands in for the real stack described in BRIEF.md:
//   - Supabase Postgres  -> in-memory tables persisted to localStorage
//   - Supabase Storage    -> photos are inline data-URIs (see placeholder.js)
//   - Supabase Auth       -> a single hard-coded admin password
//   - Telegram Edge Fn    -> notifications land in an in-app "Telegram" inbox
//   - Anthropic vision     -> draftListing() returns a canned AI draft
//
// The public API is intentionally async and shaped like a service layer so it
// can later be swapped for real Supabase calls with minimal churn in the UI.
// ---------------------------------------------------------------------------
import {
  SEED_ITEMS,
  SEED_WINDOWS,
  SEED_OFFERS,
  SEED_BOOKINGS,
  SEED_SETTINGS,
  SEED_MESSAGES,
} from './seed.js'
import { placeholderPhoto } from './placeholder.js'

const STORAGE_KEY = 'moving_sale_db_v2'
const SESSION_KEY = 'moving_sale_admin_session'
const ADMIN_PASSWORD = 'moveout2026' // prototype only — real app uses Supabase Auth

// ---- persistence ----------------------------------------------------------
function freshDb() {
  return {
    items: structuredClone(SEED_ITEMS),
    pickup_windows: structuredClone(SEED_WINDOWS),
    offers: structuredClone(SEED_OFFERS),
    bookings: structuredClone(SEED_BOOKINGS),
    settings: structuredClone(SEED_SETTINGS),
    messages: structuredClone(SEED_MESSAGES),
    // Simulated Telegram DMs to the seller, each with inline accept/reject.
    notifications: [
      {
        id: 'ntf_1',
        kind: 'offer',
        ref_id: 'off_1',
        text: 'New offer: $170 on “Oak Dining Table + 4 Chairs” from Priya.',
        created_at: new Date('2026-07-09T15:30:05').toISOString(),
        resolved: false,
      },
      {
        id: 'ntf_2',
        kind: 'booking',
        ref_id: 'bk_1',
        text: 'Pickup request from Marcus for “Trek FX2 Hybrid Bike”.',
        created_at: new Date('2026-07-09T18:05:03').toISOString(),
        resolved: false,
      },
    ],
  }
}

let db
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  db = raw ? JSON.parse(raw) : freshDb()
} catch {
  db = freshDb()
}

const subscribers = new Set()
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* ignore quota / private mode */
  }
  subscribers.forEach((fn) => fn())
}

// Simulate a little network latency so loading states are exercised.
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`
const clone = (x) => structuredClone(x)

function randomToken() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
}

function slugify(text) {
  const base = String(text || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  let slug = base || 'item'
  let n = 2
  while (db.items.some((i) => i.slug === slug)) slug = `${base}-${n++}`
  return slug
}

// Builds the { offer, messages } payload shared by getThread/adminGetThread.
function threadPayload(offer) {
  const item = db.items.find((i) => i.id === offer.item_id)
  const messages = db.messages
    .filter((m) => m.offer_id === offer.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  return clone({
    offer: {
      id: offer.id,
      status: offer.status,
      offer_price: offer.offer_price,
      item_title: item?.title ?? 'item',
    },
    messages,
  })
}

// ---- public API -----------------------------------------------------------
export const api = {
  backendName: 'mock',
  authMode: 'password',

  subscribe(fn) {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  },

  resetDemo() {
    db = freshDb()
    persist()
  },

  // ---- auth (mock Supabase Auth) ----
  getSession() {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  },
  async signIn({ email, password } = {}) {
    await delay()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      subscribers.forEach((fn) => fn())
      return { ok: true }
    }
    return { ok: false, error: 'Incorrect password.' }
  },
  signOut() {
    sessionStorage.removeItem(SESSION_KEY)
    subscribers.forEach((fn) => fn())
  },
  demoPasswordHint: ADMIN_PASSWORD,

  // ---- items ----
  async listItems() {
    await delay()
    return clone(db.items)
  },
  async getItemBySlug(slug) {
    await delay()
    return clone(db.items.find((i) => i.slug === slug) || null)
  },
  async createItem(data) {
    await delay()
    const now = new Date().toISOString()
    const item = {
      id: uid('itm'),
      slug: slugify(data.slug || data.title),
      title: data.title || 'Untitled item',
      description: data.description || '',
      price: data.price ?? 0,
      original_price: data.original_price ?? null,
      dimensions: data.dimensions || '',
      category: data.category || 'Other',
      condition: data.condition || 'Good',
      photos: data.photos?.length ? data.photos : [placeholderPhoto(uid('p'), data.title)],
      delivery_option: data.delivery_option || 'none',
      delivery_fee: data.delivery_fee ?? null,
      status: data.status || 'available',
      created_at: now,
      updated_at: now,
    }
    db.items.unshift(item)
    persist()
    return clone(item)
  },
  async updateItem(id, patch) {
    await delay()
    const item = db.items.find((i) => i.id === id)
    if (!item) return null
    Object.assign(item, patch, { updated_at: new Date().toISOString() })
    persist()
    return clone(item)
  },
  async deleteItem(id) {
    await delay()
    db.items = db.items.filter((i) => i.id !== id)
    persist()
  },
  async uploadPhotos(files) {
    await delay()
    const list = files || []
    return list.map((f) =>
      placeholderPhoto((f?.name || 'photo') + Math.random(), (f?.name || 'Photo').replace(/\.[^.]+$/, '')),
    )
  },

  // ---- offers (buyer action -> Telegram) ----
  async listOffers() {
    await delay()
    return clone(db.offers)
  },
  async createOffer(data) {
    await delay()
    const item = db.items.find((i) => i.id === data.item_id)
    const offer = {
      id: uid('off'),
      item_id: data.item_id,
      buyer_name: data.buyer_name,
      buyer_contact: data.buyer_contact,
      offer_price: Number(data.offer_price) || 0,
      message: data.message || '',
      is_bundle: Boolean(data.is_bundle),
      thread_token: randomToken(),
      status: 'new',
      created_at: new Date().toISOString(),
    }
    db.offers.unshift(offer)
    db.notifications.unshift({
      id: uid('ntf'),
      kind: 'offer',
      ref_id: offer.id,
      text: `New offer: $${offer.offer_price} on “${item?.title ?? 'item'}” from ${offer.buyer_name}.`,
      created_at: offer.created_at,
      resolved: false,
    })
    persist()
    return { id: offer.id, thread_token: offer.thread_token }
  },
  async resolveOffer(offerId, accept) {
    await delay()
    const offer = db.offers.find((o) => o.id === offerId)
    if (!offer) return
    offer.status = accept ? 'accepted' : 'declined'
    if (accept) {
      const item = db.items.find((i) => i.id === offer.item_id)
      if (item && item.status === 'available') item.status = 'pending'
    }
    resolveNotification('offer', offerId)
    persist()
  },

  // ---- offer negotiation thread ----
  async getThread(offerId, token) {
    await delay()
    const offer = db.offers.find((o) => o.id === offerId)
    if (!offer || !token || offer.thread_token !== token) return null
    return threadPayload(offer)
  },
  async postThreadMessage(offerId, token, body) {
    await delay()
    const offer = db.offers.find((o) => o.id === offerId)
    if (!offer || !token || offer.thread_token !== token) return null
    const msg = {
      id: uid('msg'),
      offer_id: offerId,
      sender: 'buyer',
      body,
      created_at: new Date().toISOString(),
    }
    db.messages.push(msg)
    persist()
    return clone(msg)
  },
  async adminGetThread(offerId) {
    await delay()
    const offer = db.offers.find((o) => o.id === offerId)
    if (!offer) return null
    return threadPayload(offer)
  },
  async adminPostMessage(offerId, body) {
    await delay()
    const offer = db.offers.find((o) => o.id === offerId)
    if (!offer) return null
    const msg = {
      id: uid('msg'),
      offer_id: offerId,
      sender: 'seller',
      body,
      created_at: new Date().toISOString(),
    }
    db.messages.push(msg)
    persist()
    return clone(msg)
  },

  // ---- pickup windows ----
  async listWindows() {
    await delay()
    return clone(db.pickup_windows)
  },
  async createWindow(starts_at, ends_at) {
    await delay()
    db.pickup_windows.push({ id: uid('win'), starts_at, ends_at, status: 'open' })
    db.pickup_windows.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    persist()
  },
  async deleteWindow(id) {
    await delay()
    db.pickup_windows = db.pickup_windows.filter((w) => w.id !== id)
    persist()
  },

  // ---- bookings (buyer action -> Telegram) ----
  async listBookings() {
    await delay()
    return clone(db.bookings)
  },
  async createBooking(data) {
    await delay()
    const window = db.pickup_windows.find((w) => w.id === data.window_id)
    const item = data.item_id ? db.items.find((i) => i.id === data.item_id) : null
    if (window) window.status = 'booked'
    const booking = {
      id: uid('bk'),
      window_id: data.window_id,
      item_id: data.item_id || null,
      buyer_name: data.buyer_name,
      buyer_contact: data.buyer_contact,
      status: 'requested',
      created_at: new Date().toISOString(),
    }
    db.bookings.unshift(booking)
    db.notifications.unshift({
      id: uid('ntf'),
      kind: 'booking',
      ref_id: booking.id,
      text: `Pickup request from ${booking.buyer_name}${item ? ` for “${item.title}”` : ''}.`,
      created_at: booking.created_at,
      resolved: false,
    })
    persist()
    return clone(booking)
  },
  async resolveBooking(bookingId, accept) {
    await delay()
    const booking = db.bookings.find((b) => b.id === bookingId)
    if (!booking) return
    booking.status = accept ? 'confirmed' : 'declined'
    const window = db.pickup_windows.find((w) => w.id === booking.window_id)
    if (window && !accept) window.status = 'open' // reopen on reject
    resolveNotification('booking', bookingId)
    persist()
  },

  // ---- settings ----
  async getSettings() {
    await delay()
    return clone(db.settings)
  },
  async updateSettings(patch) {
    await delay()
    Object.assign(db.settings, patch)
    persist()
    return clone(db.settings)
  },

  // ---- notifications (mock Telegram inbox) ----
  async listNotifications() {
    await delay()
    return clone(db.notifications)
  },

  // ---- AI intake (mock Anthropic vision) ----
  // Returns an AI-style draft. Dimensions + final price stay manual per brief.
  async draftListing(file) {
    await delay(700) // vision calls are slower
    const fileName = file?.name || ''
    const name = fileName.toLowerCase()
    const guesses = [
      { m: /(sofa|couch|sectional)/, t: 'Upholstered Sofa', c: 'Furniture', cond: 'Good', lo: 200, hi: 450, d: 'Upholstered sofa in good condition. Comfortable seating with minor signs of use consistent with age.' },
      { m: /(desk|table|dining)/, t: 'Wooden Table', c: 'Furniture', cond: 'Good', lo: 80, hi: 250, d: 'Sturdy wooden table with a warm finish. Surface shows light everyday wear.' },
      { m: /(chair|stool)/, t: 'Accent Chair', c: 'Furniture', cond: 'Good', lo: 40, hi: 120, d: 'Comfortable accent chair, structurally solid with clean upholstery.' },
      { m: /(bike|bicycle)/, t: 'Hybrid Bicycle', c: 'Outdoor', cond: 'Good', lo: 120, hi: 350, d: 'Well-maintained bicycle, ready to ride. Tires and brakes in working order.' },
      { m: /(monitor|tv|screen)/, t: 'Display Monitor', c: 'Electronics', cond: 'Like New', lo: 100, hi: 300, d: 'Crisp display in excellent working condition. Includes stand and cable.' },
      { m: /(lamp|light)/, t: 'Floor Lamp', c: 'Home', cond: 'Good', lo: 15, hi: 60, d: 'Stylish floor lamp that adds warm ambient light to any room.' },
      { m: /(plant|fig|pot)/, t: 'Houseplant', c: 'Home', cond: 'Good', lo: 20, hi: 70, d: 'Healthy, established houseplant in a decorative pot.' },
    ]
    const g =
      guesses.find((x) => x.m.test(name)) || {
        t: 'Household Item',
        c: 'Other',
        cond: 'Good',
        lo: 20,
        hi: 100,
        d: 'Gently used household item in good condition. See photos for detail.',
      }
    const photo = placeholderPhoto(fileName + Math.random(), g.t)
    return {
      photo,
      title: g.t,
      category: g.c,
      condition: g.cond,
      description: g.d,
      suggested_price_range: { low: g.lo, high: g.hi },
    }
  },
}

function resolveNotification(kind, refId) {
  const n = db.notifications.find((x) => x.kind === kind && x.ref_id === refId)
  if (n) n.resolved = true
}
