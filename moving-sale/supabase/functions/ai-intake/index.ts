// AI-assisted listing intake: given an item photo (public Storage URL), draft
// title / category / condition / description and a suggested price range with
// Anthropic vision. Admin-only — verifies the caller's Supabase Auth JWT.
// Dimensions and final price stay manual per the brief.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// Defaults to Haiku to keep per-photo intake cost low (drafting a listing is a
// simple vision task). Set the ANTHROPIC_MODEL secret to 'claude-opus-4-8'
// for maximum draft quality.
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5'

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short marketplace-style listing title, e.g. "Gray Sectional Sofa"' },
    category: { type: 'string', description: 'One or two words, e.g. Furniture, Electronics, Outdoor, Home, Office, Kitchen, Other' },
    condition: { type: 'string', enum: ['Like New', 'Good', 'Fair', 'For Parts'] },
    description: { type: 'string', description: '2-3 sentence honest sales description based only on what is visible' },
    suggested_price_range: {
      type: 'object',
      properties: {
        low: { type: 'integer', description: 'Low end of a fair used-market USD price' },
        high: { type: 'integer', description: 'High end of a fair used-market USD price' },
      },
      required: ['low', 'high'],
      additionalProperties: false,
    },
  },
  required: ['title', 'category', 'condition', 'description', 'suggested_price_range'],
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
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            {
              type: 'text',
              text:
                'This is a photo of a used household item being sold in a personal moving sale. ' +
                'Draft the listing. Be honest about visible wear. Price range should reflect the ' +
                'used local-pickup market (Facebook Marketplace / Craigslist), not retail.',
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
    return json(JSON.parse((text as { text: string }).text))
  } catch (err) {
    console.error('ai-intake error:', err)
    return json({ error: 'draft generation failed' }, 502)
  }
})
