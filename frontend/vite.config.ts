import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dev only: proxy /api/* to the local backend on port 3001 so localhost
  // dev mirrors the production Caddy layout. Production builds are static
  // and rely on Caddy to do the proxying.
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
