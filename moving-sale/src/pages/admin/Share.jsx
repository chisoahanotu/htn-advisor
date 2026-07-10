import { useState } from 'react'
import { api } from '../../services/mockBackend.js'
import { useQuery } from '../../services/useStore.js'
import { money } from '../../services/format.js'
import { Spinner, useToast } from '../../components/ui.jsx'
import QRCodeBox from '../../components/QRCode.jsx'

// Site root for the master catalog QR + share links. With HashRouter the
// catalog lives at <origin><path>#/ and items at #/item/<slug>.
const SITE_ROOT = `${window.location.origin}${window.location.pathname}#/`
const itemUrl = (slug) => `${SITE_ROOT}item/${slug}`

function movingTag(count) {
  const bucket = count >= 30 ? '30+' : count >= 20 ? '20+' : count >= 10 ? '10+' : String(count)
  return `Moving sale — ${bucket} items, see everything + reserve pickup here: ${SITE_ROOT}`
}

function marketplaceText(item, count) {
  return `${item.title} — ${money(item.price)}\n\n${item.description}\n\n${movingTag(count)}`
}

function craigslistBlock(items, siteName, count) {
  const lines = items
    .filter((i) => i.status !== 'sold')
    .map((i) => `• ${i.title} — ${money(i.price)}${i.dimensions ? ` (${i.dimensions})` : ''}`)
    .join('\n')
  return `MOVING SALE — ${siteName || 'Everything Must Go'}\n\nEverything must go! Available items:\n\n${lines}\n\nCash / Venmo / Zelle at pickup. Make an offer or book a pickup window online.\n\n${movingTag(count)}`
}

function CopyButton({ text, label = 'Copy', onCopied }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        navigator.clipboard?.writeText(text)
        onCopied?.()
      }}
    >
      {label}
    </button>
  )
}

export default function Share() {
  const { data: items, loading } = useQuery(() => api.listItems())
  const { data: settings } = useQuery(() => api.getSettings())
  const [toast, setToast] = useToast()
  const [openExport, setOpenExport] = useState(null) // item id

  if (loading) return <Spinner />
  const count = items.length
  const copied = () => setToast('Copied to clipboard')

  return (
    <div>
      <div className="two-col" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Master catalog QR</div>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            One QR for flyers, yard signs, and Facebook — points to the whole catalog.
          </p>
          <QRCodeBox value={SITE_ROOT} label={SITE_ROOT} downloadName="moving-sale-catalog-qr.png" />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Per-item share links</div>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Digital links for posting hero items individually. (No physical per-item tags.)
          </p>
          {items.map((i) => (
            <div className="list-row" key={i.id} style={{ padding: '10px 0' }}>
              <div className="list-main">
                <div className="t" style={{ fontSize: 13 }}>{i.title}</div>
                <div className="s" style={{ wordBreak: 'break-all' }}>{itemUrl(i.slug)}</div>
              </div>
              <div className="row-actions">
                <CopyButton text={itemUrl(i.slug)} label="🔗 Copy" onCopied={copied} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <div className="section-title">Paste-ready listing export</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Consolidated Craigslist block</strong>
            <CopyButton text={craigslistBlock(items, settings?.site_name, count)} label="Copy block" onCopied={copied} />
          </div>
          <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>One paste covering every available item.</p>
          <div className="code-block">{craigslistBlock(items, settings?.site_name, count)}</div>
        </div>

        <div>
          <strong style={{ fontSize: 14 }}>Per-item Marketplace text</strong>
          <p className="hint" style={{ marginTop: 4, marginBottom: 10 }}>
            Title + description + price with the moving-sale tag appended.
          </p>
          {items.map((i) => (
            <div key={i.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{i.title}</span>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpenExport(openExport === i.id ? null : i.id)}>
                    {openExport === i.id ? 'Hide' : 'Preview'}
                  </button>
                  <CopyButton text={marketplaceText(i, count)} label="Copy" onCopied={copied} />
                </div>
              </div>
              {openExport === i.id && <div className="code-block" style={{ marginTop: 8 }}>{marketplaceText(i, count)}</div>}
            </div>
          ))}
        </div>
      </div>
      {toast}
    </div>
  )
}
