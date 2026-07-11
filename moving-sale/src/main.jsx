import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// BrowserRouter gives clean URLs (/item/gray-sofa) for QR codes and share
// links. SPA fallback: vercel.json rewrite on Vercel, 404.html copy on
// GitHub Pages. basename follows Vite's base for project-site subpaths.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
