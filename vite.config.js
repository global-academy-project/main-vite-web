import { env } from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  const apiTarget = env.VITE_API_PROXY_TARGET
    ?? (command === 'serve' ? 'http://localhost:8080' : 'http://spring-boot-application:60001')
  const proxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
    },
  }

  // Default vite web react runtime configuration
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 50001,
      strictPort: true,
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      port: 50001,
      strictPort: true,
      proxy,
    },
  }
})