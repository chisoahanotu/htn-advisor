// Telegram webhook: handles the seller tapping Accept / Reject on offer and
// booking notifications, and replies to any direct message with the chat ID
// (handy for initial setup). Authenticated via Telegram's secret_token header
// — deploy with --no-verify-jwt.
//
// Phase 2: if the buyer left an email address and RESEND_API_KEY is set, the
// buyer is auto-notified of the decision by email.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { answerCallback, markResolved, sendPlain } from '../_shared/telegram.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Moving Sale <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? ''

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function emailBuyer(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY || !EMAIL_RE.test(to)) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text }),
    })
    if (!res.ok) console.error('resend failed:', await res.text())
  } catch (err) {
    console.error('resend error:', err)
  }
}

async function handleOffer(id: string, accept: boolean) {
  const { data: offer } = await supabase
    .from('offers')
    .select('id, item_id, buyer_name, buyer_contact, offer_price, status, thread_token, telegram_message_id')
    .eq('id', id)
    .single()
  if (!offer) return 'Offer not found'
  if (offer.status !== 'new') return 'Already handled'

  await supabase.from('offers')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', id)

  let itemTitle = 'your item'
  if (accept) {
    const { data: item } = await supabase
      .from('items').select('title, status').eq('id', offer.item_id).single()
    if (item) {
      itemTitle = item.title
      if (item.status === 'available') {
        await supabase.from('items').update({ status: 'pending' }).eq('id', offer.item_id)
      }
    }
  } else {
    const { data: item } = await supabase
      .from('items').select('title').eq('id', offer.item_id).single()
    if (item) itemTitle = item.title
  }

  const verdict = accept ? '✅ Accepted — item marked pending' : '❌ Declined'
  await markResolved(
    offer.telegram_message_id,
    `Offer: $${offer.offer_price} from ${offer.buyer_name}`,
    verdict,
  )

  const threadUrl = SITE_URL ? `${SITE_URL.replace(/\/$/, '')}/offer/${offer.id}?t=${offer.thread_token}` : ''
  await emailBuyer(
    offer.buyer_contact,
    accept ? `Your offer on "${itemTitle}" was accepted!` : `Update on your offer for "${itemTitle}"`,
    accept
      ? `Good news, ${offer.buyer_name} — your offer of $${offer.offer_price} on "${itemTitle}" was accepted. The seller will coordinate pickup with you.${threadUrl ? `\n\nMessage the seller here: ${threadUrl}` : ''}`
      : `Hi ${offer.buyer_name} — the seller declined your offer of $${offer.offer_price} on "${itemTitle}".${threadUrl ? ` You can send a new message or revised offer here: ${threadUrl}` : ''}`,
  )
  return verdict
}

async function handleBooking(id: string, accept: boolean) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, window_id, buyer_name, buyer_contact, status, telegram_message_id')
    .eq('id', id)
    .single()
  if (!booking) return 'Booking not found'
  if (booking.status !== 'requested') return 'Already handled'

  await supabase.from('bookings')
    .update({ status: accept ? 'confirmed' : 'declined' })
    .eq('id', id)
  if (!accept) {
    await supabase.from('pickup_windows').update({ status: 'open' }).eq('id', booking.window_id)
  }

  const verdict = accept ? '✅ Confirmed' : '❌ Declined — window reopened'
  await markResolved(
    booking.telegram_message_id,
    `Pickup request from ${booking.buyer_name}`,
    verdict,
  )

  let when = ''
  const { data: win } = await supabase
    .from('pickup_windows').select('starts_at').eq('id', booking.window_id).single()
  if (win) {
    when = new Date(win.starts_at).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }
  await emailBuyer(
    booking.buyer_contact,
    accept ? 'Your pickup is confirmed' : 'Update on your pickup request',
    accept
      ? `Hi ${booking.buyer_name} — your pickup${when ? ` on ${when}` : ''} is confirmed. See you then!`
      : `Hi ${booking.buyer_name} — the seller couldn't make that pickup window work. Please pick another open window on the site.`,
  )
  return verdict
}

Deno.serve(async (req) => {
  // Telegram sends this header when the webhook was registered with secret_token.
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  let update: Record<string, any>
  try {
    update = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  try {
    if (update.callback_query) {
      const cq = update.callback_query
      const [kind, id, action] = String(cq.data ?? '').split(':')
      const accept = action === 'accept'
      let result = 'Unknown action'
      if (kind === 'offer') result = await handleOffer(id, accept)
      else if (kind === 'booking') result = await handleBooking(id, accept)
      await answerCallback(cq.id, result)
    } else if (update.message?.text) {
      // Setup helper: DM the bot anything and it replies with the chat ID to
      // store as the TELEGRAM_CHAT_ID secret.
      await sendPlain(
        update.message.chat.id,
        `Your chat ID is: ${update.message.chat.id}\nSet it as the TELEGRAM_CHAT_ID secret in Supabase.`,
      )
    }
  } catch (err) {
    console.error('webhook error:', err)
  }

  // Always 200 so Telegram doesn't retry forever.
  return new Response('ok')
})
