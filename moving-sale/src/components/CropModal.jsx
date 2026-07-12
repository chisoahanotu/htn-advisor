import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Modal } from './ui.jsx'

const ASPECTS = [
  ['4:3', 4 / 3],
  ['Square', 1],
  ['3:4', 3 / 4],
  ['16:9', 16 / 9],
]

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Renders the rotated image to a canvas, then cuts the crop region out of it.
async function cropToFile(src, cropPixels, rotation, fileName) {
  const img = await loadImage(src)
  const rad = (rotation * Math.PI) / 180
  // Bounding box of the rotated image
  const bw = Math.abs(Math.cos(rad) * img.width) + Math.abs(Math.sin(rad) * img.height)
  const bh = Math.abs(Math.sin(rad) * img.width) + Math.abs(Math.cos(rad) * img.height)

  const canvas = document.createElement('canvas')
  canvas.width = bw
  canvas.height = bh
  const ctx = canvas.getContext('2d')
  ctx.translate(bw / 2, bh / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  const out = document.createElement('canvas')
  out.width = cropPixels.width
  out.height = cropPixels.height
  out.getContext('2d').drawImage(
    canvas,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, cropPixels.width, cropPixels.height,
  )

  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9))
  const base = (fileName || 'photo').replace(/\.[a-z0-9]+$/i, '')
  return new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg' })
}

// Pan / zoom / rotate photo editor. onApply receives a new JPEG File.
export default function CropModal({ src, fileName, onClose, onApply }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState(4 / 3)
  const [areaPixels, setAreaPixels] = useState(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area, pixels) => setAreaPixels(pixels), [])

  async function apply() {
    if (!areaPixels) return
    setBusy(true)
    try {
      const file = await cropToFile(src, areaPixels, rotation, fileName)
      onApply(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit photo" onClose={onClose}>
      <div className="crop-stage">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="crop-controls">
        <div className="filter-bar" style={{ margin: 0 }}>
          {ASPECTS.map(([label, value]) => (
            <button
              key={label}
              className={`chip ${aspect === value ? 'active' : ''}`}
              onClick={() => setAspect(value)}
            >
              {label}
            </button>
          ))}
          <button className="chip" onClick={() => setRotation((r) => (r + 90) % 360)}>
            ⟳ Rotate 90°
          </button>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Zoom</label>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
      </div>

      <p className="hint" style={{ margin: '4px 0 12px' }}>
        Drag to reposition, pinch or use the slider to zoom. Applying re-runs the AI analysis on the
        cropped photo, so unpublished draft edits for this photo are replaced.
      </p>

      <div className="row-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !areaPixels} onClick={apply}>
          {busy ? 'Cropping…' : 'Apply crop'}
        </button>
      </div>
    </Modal>
  )
}
