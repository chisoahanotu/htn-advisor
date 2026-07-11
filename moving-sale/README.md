# Moving Sale Storefront

A single-seller **moving-sale storefront** built from `MOVING_SALE_BRIEF.md`.
One public page lists everything for sale; buyers browse, make offers, message
the seller, and book pickup windows — no accounts. A single admin manages
listings (with AI-assisted intake) and approves offers/bookings from Telegram.

**Stack:** Vite + React frontend (Vercel) · Supabase (Postgres + Storage +
Auth + Edge Functions) · Telegram bot for approvals · Anthropic vision for
listing intake · optional Resend (buyer emails) + PostHog (analytics).

## Two modes, one codebase

The UI talks to a service layer (`src/services/backend.js`) with two
interchangeable implementations:

| Mode | When | Backend |
|---|---|---|
| **Demo** | No env vars (default for `npm run dev`) | `mockBackend.js` — in-browser, localStorage, seeded data, admin password `moveout2026` |
| **Production** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | `supabaseBackend.js` — real Postgres/Storage/Auth + Edge Functions |

The contract both implement: `docs/BACKEND_API.md`.

## Run it

```bash
npm install
npm run dev        # demo mode at http://localhost:5173
```

For production mode locally, copy `.env.example` to `.env.local` and fill in
the Supabase values.

## Deploying for real

Follow **`GO_LIVE.md`** — Supabase project + schema, Telegram bot, Edge
Function secrets, Vercel. ~30–45 minutes.

## Features

**Public buyers (no login)**
- Item grid with status badges (Available / Pending / Sold), category filters,
  move-out urgency banner, bundle-discount banner
- Per-item pages (`/item/{slug}`) with gallery, copy link, price-drop preview
- Make an offer (incl. bundle offers) → seller gets a Telegram DM
- Private negotiation thread per offer (`/offer/{id}?t={token}` — capability
  URL, no account needed)
- Book a pickup window → Telegram DM; declined bookings reopen the window

**Admin (single seller, phone-friendly, `/admin`)**
- Inbox mirroring the Telegram approval feed (accept/reject in either place)
- Offers tab with negotiation threads and replies
- Quick Add: drop photos → Anthropic vision drafts title/category/condition/
  description + suggested price range; dimensions + final price stay manual
- Item CRUD, photo upload (Supabase Storage), delivery options, status
- Pickup windows, move-out date, bundle discount %, auto price-drop schedule
  (applied daily by a Postgres cron job)
- Master catalog QR download, per-item share links, paste-ready Marketplace /
  Craigslist exports

**Notifications**
- New offer/booking → Telegram DM with inline **Accept / Reject** buttons
  (Edge Function webhook handles the callbacks)
- Optional buyer auto-notify by email on accept/decline (Resend)

## Project layout

```
supabase/
  migrations/0001_init.sql   schema, RLS, thread RPCs, price-drop cron, storage bucket
  functions/
    submit/                  buyer offer/booking intake + Telegram DM (service role)
    telegram-webhook/        Accept/Reject callbacks + buyer email notify
    ai-intake/               Anthropic vision listing draft (admin JWT required)
src/
  services/                  backend.js selector · mockBackend.js · supabaseBackend.js
  pages/                     Storefront · ItemPage · OfferThread · Admin + tabs
  components/                Banner · ItemForm · QRCode · shared UI
docs/BACKEND_API.md          the service-layer contract
GO_LIVE.md                   deployment checklist
vercel.json                  SPA rewrites (root directory: moving-sale)
```
