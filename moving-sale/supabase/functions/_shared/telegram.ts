// Minimal Telegram Bot API helper used by the Edge Functions.
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''

const API = `https://api.telegram.org/bot${BOT_TOKEN}`

async function tg(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!json.ok) console.error(`telegram ${method} failed:`, JSON.stringify(json))
  return json
}

export function telegramConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID)
}

// DM the seller with inline Accept / Reject buttons.
// callback_data format: "<kind>:<id>:<accept|reject>"
export async function notifySeller(text: string, kind: 'offer' | 'booking', refId: string) {
  if (!telegramConfigured()) {
    console.warn('telegram not configured; skipping notification')
    return null
  }
  const json = await tg('sendMessage', {
    chat_id: CHAT_ID,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Accept', callback_data: `${kind}:${refId}:accept` },
        { text: '❌ Reject', callback_data: `${kind}:${refId}:reject` },
      ]],
    },
  })
  return json.ok ? json.result.message_id as number : null
}

export async function answerCallback(callbackQueryId: string, text: string) {
  await tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

// Replace the buttons with a resolution note after a decision.
export async function markResolved(messageId: number, originalText: string, resolution: string) {
  if (!telegramConfigured() || !messageId) return
  await tg('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text: `${originalText}\n\n${resolution}`,
  })
}

export async function sendPlain(chatId: string | number, text: string) {
  await tg('sendMessage', { chat_id: chatId, text })
}
