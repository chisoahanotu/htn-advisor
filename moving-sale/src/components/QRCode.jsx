import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

// Renders a QR code to a canvas and offers a PNG download.
// The master catalog QR (per brief) points at the site root URL.
export default function QRCodeBox({ value, label, downloadName = 'catalog-qr.png' }) {
  const canvasRef = useRef(null)
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, { width: 220, margin: 2, color: { dark: '#2a2724', light: '#ffffff' } })
    QRCode.toDataURL(value, { width: 600, margin: 2 }).then(setDataUrl)
  }, [value])

  return (
    <div>
      <div className="qr-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      {label && <p className="hint" style={{ textAlign: 'center' }}>{label}</p>}
      <a
        className="btn btn-ghost btn-block"
        style={{ marginTop: 12 }}
        href={dataUrl || '#'}
        download={downloadName}
      >
        ⬇ Download QR (PNG)
      </a>
    </div>
  )
}
