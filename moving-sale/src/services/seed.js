import { placeholderPhoto } from './placeholder.js'

// Initial demo catalog. In production these rows live in Supabase Postgres.
// Dates are stored as ISO strings so the mock persists cleanly to localStorage.

const photo = (seed, label, n = 1) =>
  Array.from({ length: n }, (_, i) => placeholderPhoto(seed + i, label))

export const SEED_ITEMS = [
  {
    id: 'itm_sofa',
    slug: 'gray-sectional-sofa',
    title: 'Gray Sectional Sofa',
    description:
      'Comfortable 5-seat sectional in charcoal gray. Some light wear on the left armrest but structurally solid and very comfy. Pet-free, smoke-free home.',
    price: 425,
    dimensions: '110W x 84D x 34H in',
    category: 'Furniture',
    condition: 'Good',
    photos: photo('sofa', 'Gray Sofa', 3),
    delivery_option: 'local_delivery',
    delivery_fee: 40,
    status: 'available',
  },
  {
    id: 'itm_desk',
    slug: 'standing-desk-jarvis',
    title: 'Jarvis Standing Desk',
    description:
      'Electric sit/stand desk, bamboo top. Programmable height presets. Works perfectly. Great for a home office.',
    price: 260,
    dimensions: '60W x 30D x 25–50H in',
    category: 'Office',
    condition: 'Like New',
    photos: photo('desk', 'Standing Desk', 2),
    delivery_option: 'can_help_load',
    delivery_fee: null,
    status: 'available',
  },
  {
    id: 'itm_bike',
    slug: 'trek-hybrid-bike',
    title: 'Trek FX2 Hybrid Bike',
    description:
      'Medium frame hybrid, recently tuned with new brake pads. Great commuter. Minor scratches on the frame.',
    price: 300,
    dimensions: 'M frame (56cm)',
    category: 'Outdoor',
    condition: 'Good',
    photos: photo('bike', 'Trek Bike', 2),
    delivery_option: 'none',
    delivery_fee: null,
    status: 'pending',
  },
  {
    id: 'itm_dining',
    slug: 'oak-dining-table',
    title: 'Oak Dining Table + 4 Chairs',
    description:
      'Solid oak table, seats 4–6 with the leaf in. Includes 4 matching chairs. A few water rings on top, otherwise great.',
    price: 200,
    dimensions: '60W x 38D x 30H in',
    category: 'Furniture',
    condition: 'Fair',
    photos: photo('dining', 'Dining Table', 2),
    delivery_option: 'can_help_load',
    delivery_fee: null,
    status: 'available',
  },
  {
    id: 'itm_monitor',
    slug: 'lg-ultrawide-monitor',
    title: 'LG 34" UltraWide Monitor',
    description: '34-inch 3440x1440 ultrawide. No dead pixels. Comes with stand and power cable.',
    price: 220,
    dimensions: '34 in diagonal',
    category: 'Electronics',
    condition: 'Like New',
    photos: photo('monitor', 'LG Monitor', 1),
    delivery_option: 'none',
    delivery_fee: null,
    status: 'sold',
  },
  {
    id: 'itm_plants',
    slug: 'fiddle-leaf-fig',
    title: 'Fiddle Leaf Fig (5 ft)',
    description: 'Big, healthy fiddle leaf fig in a ceramic pot. Too tall to move — needs a good home.',
    price: 45,
    dimensions: '~60H in incl. pot',
    category: 'Home',
    condition: 'Good',
    photos: photo('plant', 'Fiddle Fig', 1),
    delivery_option: 'none',
    delivery_fee: null,
    status: 'available',
  },
]

// Pickup windows the seller has opened. starts_at/ends_at are ISO strings.
// Built relative to a fixed base date so the prototype is deterministic.
const base = new Date('2026-07-18T00:00:00')
const at = (dayOffset, hour) => {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const SEED_WINDOWS = [
  { id: 'win_1', starts_at: at(0, 10), ends_at: at(0, 12), status: 'open' },
  { id: 'win_2', starts_at: at(0, 17), ends_at: at(0, 19), status: 'open' },
  { id: 'win_3', starts_at: at(1, 14), ends_at: at(1, 16), status: 'booked' },
  { id: 'win_4', starts_at: at(2, 9), ends_at: at(2, 11), status: 'open' },
  { id: 'win_5', starts_at: at(2, 18), ends_at: at(2, 20), status: 'open' },
]

export const SEED_OFFERS = [
  {
    id: 'off_1',
    item_id: 'itm_dining',
    buyer_name: 'Priya',
    buyer_contact: 'priya@example.com',
    offer_price: 170,
    message: 'Could do pickup this weekend if that works!',
    status: 'new',
    created_at: new Date('2026-07-09T15:30:00').toISOString(),
  },
]

export const SEED_BOOKINGS = [
  {
    id: 'bk_1',
    window_id: 'win_3',
    item_id: 'itm_bike',
    buyer_name: 'Marcus',
    buyer_contact: '555-0142',
    status: 'requested',
    created_at: new Date('2026-07-09T18:05:00').toISOString(),
  },
]

export const SEED_SETTINGS = {
  move_out_date: '2026-07-31',
  site_name: 'Maple St. Moving Sale',
}
