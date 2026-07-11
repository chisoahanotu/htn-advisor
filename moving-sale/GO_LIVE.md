# Go Live — deployment checklist

This app ships with two backends: an in-browser mock demo (zero config) and
the production Supabase backend. Going live = create the four external
resources below, set ~8 secrets, deploy. Roughly 30–45 minutes end to end.

**What you need accounts for:** Supabase (free tier is fine), Vercel (free),
Telegram (you already have it), Anthropic API (console.anthropic.com).
Optional: Resend (buyer email auto-notify), PostHog (analytics).

---

## 1. Supabase project

1. Create a project at https://supabase.com/dashboard → note:
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` public key (Settings → API)
2. Apply the schema — either:
   - **CLI:** `supabase link --project-ref xxxx && supabase db push` (from `moving-sale/`), or
   - **Dashboard:** SQL Editor → paste `supabase/migrations/0001_init.sql` → run.
   This creates all tables, RLS policies, thread RPCs, the daily price-drop
   cron job, and the public `photos` storage bucket.
3. Create the admin user: Authentication → Users → "Add user" → your email +
   a strong password. (Also disable public signups: Authentication →
   Providers → Email → turn off "Allow new users to sign up".)

## 2. Telegram bot

1. DM **@BotFather** on Telegram → `/newbot` → pick a name → copy the **bot token**.
2. Generate a webhook secret: any long random string (e.g. `openssl rand -hex 24`).
3. After the functions are deployed (step 3), register the webhook:

   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -d "url=https://xxxx.supabase.co/functions/v1/telegram-webhook" \
     -d "secret_token=<WEBHOOK_SECRET>"
   ```

4. DM your bot any message — it replies with your **chat ID**. Set it as the
   `TELEGRAM_CHAT_ID` secret (step 3), then redeploy or just wait — secrets
   apply on next invocation.

## 3. Edge Functions + secrets

From `moving-sale/` with the Supabase CLI logged in and linked:

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN=... \
  TELEGRAM_CHAT_ID=... \
  TELEGRAM_WEBHOOK_SECRET=... \
  ANTHROPIC_API_KEY=sk-ant-... \
  SITE_URL=https://your-sale.vercel.app

# Optional extras:
#   ANTHROPIC_MODEL=claude-opus-4-8     (intake defaults to claude-haiku-4-5)
#   RESEND_API_KEY=re_...  RESEND_FROM="Moving Sale <sale@yourdomain.com>"

supabase functions deploy submit
supabase functions deploy ai-intake
supabase functions deploy telegram-webhook --no-verify-jwt
```

(`telegram-webhook` must be deployed with `--no-verify-jwt`; it authenticates
via Telegram's `secret_token` header instead.)

## 4. Vercel (frontend)

1. Import the GitHub repo in Vercel → **set Root Directory to `moving-sale`**
   (the repo root contains an unrelated app). Framework preset: Vite.
2. Environment variables:
   - `VITE_SUPABASE_URL` = project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `VITE_SITE_URL` = the deployed URL (add after first deploy; used by the
     master QR + exports)
   - optional `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST`)
3. Deploy. `vercel.json` already handles SPA rewrites.
4. Custom domain (optional): add in Vercel → update `VITE_SITE_URL` and the
   `SITE_URL` function secret.

## 5. Smoke test

1. Open the site → catalog should be empty (no mock data = you're on Supabase).
2. Log in at `/admin` with the admin email/password → Quick Add a photo → AI
   draft appears → set price/dimensions → save → item shows in catalog.
3. Open an item in a private window → make an offer → you get a Telegram DM →
   tap **Accept** → item flips to Pending on the site; if the buyer contact
   was an email and Resend is configured, the buyer got an email.
4. Admin → Pickup Windows → add a window → book it as a buyer → confirm via
   Telegram.
5. Admin → Settings → set the real move-out date (drives the banner and the
   automatic price drops), site name, bundle discount.
6. Admin → Share & Export → download the master QR, print flyers 🎉

## Notes

- **Price drops** run daily at 06:00 UTC via pg_cron using the schedule in
  Settings (e.g. 10% off 14 days out, 20% off 7 days out, computed from
  `original_price` so drops never compound).
- **Buyer threads** are capability-URL based: each offer confirmation gives the
  buyer a private `/offer/<id>?t=<token>` link (also stored in their browser).
  No buyer accounts.
- **Demo mode** still works anywhere the env vars are absent (e.g. local
  `npm run dev` without `.env.local`).
