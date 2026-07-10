// Generates a self-contained placeholder "photo" as an SVG data URI.
// Keeps the prototype offline — no external image hosts, no Supabase Storage.
const PALETTE = [
  ['#b4532a', '#e8b48f'],
  ['#3f6d55', '#a9cbb4'],
  ['#4b5d8a', '#aebbdc'],
  ['#8a6d3b', '#dcc79a'],
  ['#7a4b6d', '#d6aecb'],
  ['#4a6b6d', '#a9cccd'],
]

export function placeholderPhoto(seedText = '', label = '') {
  let h = 0
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) >>> 0
  const [bg, fg] = PALETTE[h % PALETTE.length]
  const initials = (label || 'Item')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="${bg}"/>
    <circle cx="400" cy="250" r="150" fill="${fg}" opacity="0.5"/>
    <text x="400" y="300" font-family="system-ui, sans-serif" font-size="180" font-weight="700"
      fill="#fff" text-anchor="middle" dominant-baseline="middle" opacity="0.85">${initials}</text>
    <text x="400" y="480" font-family="system-ui, sans-serif" font-size="34"
      fill="#fff" text-anchor="middle" opacity="0.7">${(label || '').slice(0, 28)}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
