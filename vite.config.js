import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/n8n': {
        target: 'https://n8n.srv922383.hstgr.cloud',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/n8n/, '')
      },
      '/d-id': {
        target: 'https://api.d-id.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/d-id/, '')
      },
    }
  }
})
