import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/schema-registry-site/',
  server: {
    proxy: {
      '/schema-registry-site/api': {
        target: 'http://localhost:5173',
        rewrite: (path) => path.replace('/schema-registry-site/api', '/api'),
      },
    },
  },
})
