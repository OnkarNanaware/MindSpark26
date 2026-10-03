import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        // Preserve all request headers including Authorization
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Ensure Authorization header is forwarded (critical for multipart/form-data uploads)
            if (req.headers['authorization']) {
              proxyReq.setHeader('authorization', req.headers['authorization'])
            }
          })
        },
      }
    }
  }
})
