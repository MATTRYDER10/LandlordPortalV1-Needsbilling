import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    allowedHosts: [
      'localhost',
      '.up.railway.app',
      '.railway.app',
      'app.propertygoose.co.uk'
    ]
  },
  preview: {
    allowedHosts: [
      'localhost',
      '.up.railway.app', // Allow all Railway domains
      '.railway.app',
      'app.propertygoose.co.uk'
    ]
  }
})
