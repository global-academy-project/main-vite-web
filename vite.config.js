import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // port: 50001,
    port: 50001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://spring-server-backend:60001',
        changeOrigin: true,
      },
      '/test/api': {
        target: 'http://localhost:60002',
        changeOrigin: true,
      }
    },
  },
  preview: {
    host: '0.0.0.0',
    // port: 50001,
    port: 50001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://spring-server-backend:60001',
        changeOrigin: true,
      },
      '/test/api': {
        target: 'http://localhost:60002',
        changeOrigin: true,
      }
    },
  }
})
