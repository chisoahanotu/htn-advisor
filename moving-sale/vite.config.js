import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front-end prototype — no backend. See src/services/mockBackend.js for the
// in-browser mock that stands in for Supabase + Telegram + Anthropic.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
})
