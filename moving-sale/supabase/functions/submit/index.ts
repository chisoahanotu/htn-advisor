// Buyer-facing writes: create an offer or a pickup booking, then DM the seller
// on Telegram with inline Accept/Reject buttons. Runs with the service role so
// RLS can deny direct anonymous inserts entirely.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { notifySeller } from '../_shared/telegram.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }

  try {
    if (body.type === 'offer') {
      const item_id = str(body.item_id, 64)
      const buyer_name = str(body.buyer_name, 120)
      const buyer_contact = str(body.buyer_contact, 200)
      const offer_price = Number(body.offer_price)
      const message = str(body.message, 1000)
      const is_bundle = Boolean(body.is_bundle)
      if (!item_id || !buyer_name || !buyer_contact || !(offer_price > 0)) {
        return json({ error: 'missing or invalid fields' }, 400)
      }

      const { data: item, error: itemErr } = await supabase
        .from('items').select('id, title, status').eq('id', item_id).single()
      if (itemErr || !item) return json({ error: 'item not found' }, 404)
      if (item.status !== 'available') return json({ error: 'item is no longer available' }, 409)

      const { data: offer, error } = await supabase
        .from('offers')
        .insert({ item_id, buyer_name, buyer_contact, offer_price, message, is_bundle })
        .select('id, thread_token')
        .single()
      if (error) throw error

      const text =
        `🛒 Purchase request: “${item.title}” — $${offer_price} from ${buyer_name}` +
        `${is_bundle ? ' (bundle)' : ''}\nContact: ${buyer_contact}` +
        `${message ? `\n“${message}”` : ''}`
      const messageId = await notifySeller(text, 'offer', offer.id)
      if (messageId) {
        await supabase.from('offers').update({ telegram_message_id: messageId }).eq('id', offer.id)
      }
      return json({ ok: true, id: offer.id, thread_token: offer.thread_token })
    }

    if (body.type === 'booking') {
      const window_id = str(body.window_id, 64)
      const item_id = str(body.item_id, 64) || null
      const buyer_name = str(body.buyer_name, 120)
      const buyer_contact = str(body.buyer_contact, 200)
      if (!window_id || !buyer_name || !buyer_contact) {
        return json({ error: 'missing fields' }, 400)
      }

      // Claim the window atomically: only an open window can be booked.
      const { data: win, error: winErr } = await supabase
        .from('pickup_windows')
        .update({ status: 'booked' })
        .eq('id', window_id)
        .eq('status', 'open')
        .select('id, starts_at, ends_at')
        .single()
      if (winErr || !win) return json({ error: 'window is no longer open' }, 409)

      let itemTitle = ''
      if (item_id) {
        const { data: item } = await supabase.from('items').select('title').eq('id', item_id).single()
        itemTitle = item?.title ?? ''
      }

      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({ window_id, item_id, buyer_name, buyer_contact })
        .select('id')
        .single()
      if (error) throw error

      const when = new Date(win.starts_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
      const text =
        `📅 Pickup request from ${buyer_name}${itemTitle ? ` for “${itemTitle}”` : ''}` +
        `\nWindow: ${when}\nContact: ${buyer_contact}`
      const messageId = await notifySeller(text, 'booking', booking.id)
      if (messageId) {
        await supabase.from('bookings').update({ telegram_message_id: messageId }).eq('id', booking.id)
      }
      return json({ ok: true, id: booking.id })
    }

    return json({ error: 'unknown type' }, 400)
  } catch (err) {
    console.error('submit error:', err)
    return json({ error: 'internal error' }, 500)
  }
})
