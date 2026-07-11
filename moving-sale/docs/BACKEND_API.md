# Backend API Contract

Single source of truth for the service layer. Two implementations expose the
exact same surface:

- `src/services/mockBackend.js` — in-browser demo (localStorage). Used when no
  Supabase env vars are set.
- `src/services/supabaseBackend.js` — production (Supabase Postgres/Storage/Auth
  + Edge Functions). Used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  are set.

`src/services/backend.js` selects the implementation and re-exports `api`.
**UI code must import `{ api }` from `./services/backend.js` only.**

All methods are async unless noted. All return plain JSON-serializable data.

## Meta

- `api.backendName` — `'mock' | 'supabase'` (string, not async)
- `api.authMode` — `'password' | 'email'` (string). Mock uses a single demo
  password; Supabase uses email+password via Supabase Auth. The Login form
  renders an email field when `authMode === 'email'`.
- `api.subscribe(fn) -> unsubscribe` — called after any mutation so views can
  refetch. Supabase impl may simply invoke subscribers after its own mutations
  (no realtime required for v1).
- `api.resetDemo()` — mock only; no-op on supabase.

## Auth (single admin)

- `getSession() -> boolean` (sync)
- `signIn({ email, password }) -> { ok: boolean, error?: string }`
- `signOut()`

## Items

Item shape:
```js
{
  id, slug, title, description,
  price: number,
  original_price: number|null,   // set when price drops applied
  dimensions, category, condition,
  photos: string[],              // URLs (mock: data URIs)
  delivery_option: 'none'|'can_help_load'|'local_delivery',
  delivery_fee: number|null,
  status: 'available'|'pending'|'sold',
  created_at, updated_at
}
```

- `listItems() -> Item[]`
- `getItemBySlug(slug) -> Item|null`
- `createItem(data) -> Item` (generates unique slug from title if absent)
- `updateItem(id, patch) -> Item|null`
- `deleteItem(id)`
- `uploadPhotos(files: File[]) -> string[]` — mock returns placeholder data
  URIs; supabase uploads to the `photos` storage bucket and returns public URLs.

## Offers + negotiation thread (Phase 2)

Offer shape: `{ id, item_id, buyer_name, buyer_contact, offer_price, message,
is_bundle: boolean, status: 'new'|'accepted'|'declined', created_at }`

- `listOffers() -> Offer[]` (admin)
- `createOffer({item_id, buyer_name, buyer_contact, offer_price, message, is_bundle})
   -> { id, thread_token }` — buyer keeps `thread_token` (localStorage) to
  access their thread. Supabase impl calls the `submit` Edge Function (which
  also sends the Telegram DM).
- `resolveOffer(offerId, accept: boolean)` — admin. Accept => offer accepted +
  item -> pending (if available). Decline => declined.
- `getThread(offerId, token) -> { offer: {id, status, offer_price, item_title},
   messages: [{sender:'buyer'|'seller', body, created_at}] } | null` — buyer,
  token-authenticated. Supabase impl uses the `thread_get` RPC.
- `postThreadMessage(offerId, token, body)` — buyer. Supabase: `thread_post` RPC.
- `adminGetThread(offerId) -> same shape as getThread` — admin (authenticated).
- `adminPostMessage(offerId, body)` — admin reply (sender 'seller').

## Pickup windows / bookings

- `listWindows() -> [{id, starts_at, ends_at, status:'open'|'booked'}]`
- `createWindow(starts_at, ends_at)`; `deleteWindow(id)`
- `listBookings() -> Booking[]` (admin)
- `createBooking({window_id, item_id, buyer_name, buyer_contact}) -> Booking` —
  window -> booked. Supabase impl calls the `submit` Edge Function.
- `resolveBooking(id, accept)` — accept => confirmed; decline => declined +
  window reopens.

## Settings (single row)

Shape: `{ site_name, move_out_date, bundle_discount_pct: number,
price_drops: [{days_before: number, pct: number}] }`

- `getSettings()`; `updateSettings(patch)`

## Admin inbox

- `listNotifications() -> [{id, kind:'offer'|'booking', ref_id, text,
   created_at, resolved}]` — mock stores these; supabase derives them from
  offers/bookings (pending = status new/requested).

## AI intake

- `draftListing(file: File) -> { photo: string, title, category, condition,
   description, suggested_price_range: {low, high} }` — mock uses filename
  heuristics + placeholder photo; supabase uploads the photo then calls the
  `ai-intake` Edge Function (Anthropic vision) with the public URL.

## Analytics (Phase 2, optional)

`src/services/analytics.js` exports `track(event, props)` — no-ops unless
`VITE_POSTHOG_KEY` is set (uses posthog-js). Not part of `api`.
