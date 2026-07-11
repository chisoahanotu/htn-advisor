import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front-end prototype — no backend. See src/services/mockBackend.js for the
// in-browser mock that stands in for Supabase + Telegram + Anthropic.
export default defineConfig({
  // '/' for custom domains / Vercel; '/htn-advisor/' when served as a GitHub
  // Pages project site. Set via VITE_BASE at build time.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, host: true },
})
