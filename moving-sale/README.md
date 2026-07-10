# Moving Sale Storefront — Phase 1 Prototype

A front-end prototype (Vite + React) of a single-seller **moving-sale storefront**,
built from `MOVING_SALE_BRIEF.md`. One public page lists everything for sale;
buyers browse, make an offer, and book a pickup window — no account needed. A
single admin manages listings and approves offers/bookings.

> **Prototype scope:** this is the Phase 1 UI running entirely in the browser
> against a **mock backend** (`src/services/mockBackend.js`). It stands in for the
> production stack (Supabase Postgres/Storage/Auth, a Telegram Edge Function, and
> the Anthropic vision intake) so every flow is clickable without any keys or
> servers. Data persists to `localStorage`. See “Swapping in the real backend”.

## Run it

```bash
cd moving-sale
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produces a static bundle in `dist/`; `npm run preview` serves it.

## Admin login

Open **Seller login** (top right) → password **`moveout2026`** (prototype only).

## What's implemented (Phase 1)

**Public buyer (no login)**
- Item grid with photo, title, price, dimensions, condition, and prominent
  **Available / Pending / Sold** badges; sold/pending items stay visible but
  non-actionable.
- Persistent **move-out urgency banner** ("Everything must go by {date}").
- Per-item pages at `#/item/{slug}` with a photo gallery, full info, and **Copy link**.
- **Make an offer** (price + name + contact + message) and **Request pickup**
  (choose an open window) → confirmation screen.

**Admin (single seller, phone-friendly)**
- **Inbox** — mock Telegram approval feed: each new offer/booking has inline
  **Accept / Reject**. Accept offer → item goes *pending*; accept booking →
  *confirmed*; reject booking → window reopens.
- **Quick Add (AI intake)** — drop 1+ photos → each gets an AI-drafted title,
  category, condition, description, and a **suggested price range**; sweep the
  review queue approving/editing. Dimensions + final price stay manual.
- **Items** — full CRUD, simulated photo upload, delivery option/fee, and
  mark available/pending/sold.
- **Pickup Windows** — create open slots; booked windows shown.
- **Share & Export** — downloadable **master catalog QR**, per-item share links,
  and **paste-ready exports** (per-item Marketplace text + one consolidated
  Craigslist block, each with the moving-sale tag).
- **Settings** — site name, move-out date, and a reset-demo control.

Phase 2 items from the brief (negotiation threads, buyer auto-notify, bundle
discounts, analytics, category filters, custom domain) are intentionally **not** built.

## Project layout

```
src/
  App.jsx                 routing (HashRouter) + top nav + urgency banner
  services/
    mockBackend.js        the swappable mock API (Supabase/Telegram/Anthropic stand-in)
    seed.js               demo catalog, windows, offers, bookings, settings
    useStore.js           useQuery/useSession hooks (re-run on backend mutations)
    format.js, placeholder.js
  components/             Banner, ItemForm, QRCode, shared UI (Modal/Spinner/Toast)
  pages/
    Storefront.jsx, ItemPage.jsx
    Admin.jsx + admin/{Inbox,QuickAdd,Items,Windows,Share,Settings}.jsx
```

## Swapping in the real backend

`mockBackend.js` exposes an async, service-shaped API (`listItems`, `createOffer`,
`resolveBooking`, `draftListing`, …). To go live, reimplement those methods against:

- **Supabase** — Postgres tables mirror the brief's data model; Storage for photos;
  Auth for the single admin (replace the hard-coded password).
- **Telegram Edge Function** — replace the in-app inbox: notify on new
  offers/bookings with inline Accept/Reject callbacks.
- **Anthropic vision** — replace `draftListing()` with a real vision call that
  drafts title/category/condition/description + a suggested price range.

The React components consume only that API surface, so the UI should need little
change once the methods are backed by real services.
