// AI-assisted listing intake: given a photo (public Storage URL) that may
// contain SEVERAL sellable items, draft one listing per item with Anthropic
// vision — title, category, condition, description, a suggested price, a
// size call (large -> pickup only, small -> drop-off possible), and the
// item's approximate position in the photo (for the gallery price stamp).
// Admin-only — verifies the caller's Supabase Auth JWT.
// Dimensions stay manual per the brief; prices are editable drafts.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// Opus by default — the seller wants maximum draft quality (multi-item
// detection + pricing). Set the ANTHROPIC_MODEL secret to override.
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-4-8'

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      // NOTE: minItems/maxItems are unsupported in structured-outputs schemas
      // (the request 400s) — the 8-item cap lives in the prompt instead.
      description: 'One entry per distinct sellable item visible in the photo (at most 8)',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short marketplace-style listing title, e.g. "Gray Sectional Sofa"' },
          category: { type: 'string', description: 'One or two words, e.g. Furniture, Electronics, Outdoor, Home, Office, Kitchen, Other' },
          condition: { type: 'string', enum: ['Like New', 'Good', 'Fair', 'For Parts'] },
          description: { type: 'string', description: '2-3 sentence honest sales description based only on what is visible' },
          suggested_price: {
            type: 'integer',
            description: 'Single fair USD price for the used local-pickup market (Facebook Marketplace / Craigslist), not retail',
          },
          size_class: {
            type: 'string',
            enum: ['large', 'small'],
            description:
              'large = bulky/heavy (furniture, appliances) — buyer must pick it up. small = fits easily in a sedan — seller could drop it off',
          },
          position: {
            type: 'object',
            description: 'Approximate center of this item within the photo, as fractions from the top-left corner',
            properties: {
              x: { type: 'number', description: '0 = left edge, 1 = right edge' },
              y: { type: 'number', description: '0 = top edge, 1 = bottom edge' },
            },
            required: ['x', 'y'],
            additionalProperties: false,
          },
        },
        required: ['title', 'category', 'condition', 'description', 'suggested_price', 'size_class', 'position'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // Only the authenticated admin may spend Anthropic tokens.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: userData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !userData?.user) return json({ error: 'unauthorized' }, 401)

  let body: { image_url?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }
  const imageUrl = String(body.image_url ?? '')
  // Only accept images from this project's own storage.
  if (!imageUrl.startsWith(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/photos/`)) {
    return json({ error: 'image_url must be a public photos-bucket URL' }, 400)
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            {
              type: 'text',
              text:
                'This photo is from a personal moving sale and may contain ONE or SEVERAL distinct items ' +
                'being sold. Draft one listing per sellable item (at most 8 — pick the most sellable if there are more). Count furniture, electronics, decor, rugs, ' +
                'lamps, plants, kitchenware, etc. — but ignore fixtures, walls, floors, and anything clearly ' +
                'not for sale (light switches, radiators, built-ins). If several identical items form a set ' +
                '(e.g. 4 dining chairs), list the set as one listing. Be honest about visible wear. ' +
                'Prices should reflect the used local-pickup market (Facebook Marketplace / Craigslist), not retail. ' +
                'For each item, judge size_class: could it fit in a sedan (small) or does it need a truck/muscle (large)? ' +
                'Give each item\'s approximate center position in the photo as x/y fractions from the top-left.',
            },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json({ error: 'the model declined to describe this image' }, 422)
    }
    const text = response.content.find((b: { type: string }) => b.type === 'text')
    if (!text) return json({ error: 'no draft produced' }, 502)
    const parsed = JSON.parse((text as { text: string }).text)
    // Clamp positions defensively so a stray value can't push a stamp off-photo.
    for (const item of parsed.items ?? []) {
      if (item.position) {
        item.position.x = Math.min(0.95, Math.max(0.05, Number(item.position.x) || 0.5))
        item.position.y = Math.min(0.95, Math.max(0.05, Number(item.position.y) || 0.5))
      }
    }
    return json(parsed)
  } catch (err) {
    console.error('ai-intake error:', err)
    return json({ error: 'draft generation failed' }, 502)
  }
})
