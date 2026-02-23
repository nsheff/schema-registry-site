import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use VITE_BASE_URL env var to set base path:
//   GitHub Pages: VITE_BASE_URL=/schema-registry-site/
//   Cloudflare Pages: VITE_BASE_URL=/ (default)
const base = process.env.VITE_BASE_URL || '/'

export default defineConfig({
  plugins: [react()],
  base,
})
