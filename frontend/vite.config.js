import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: {
          Origin: 'http://localhost:8080',
        },
      },
      '/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: {
          Origin: 'http://localhost:8080',
        },
      },
    },
  },
})
