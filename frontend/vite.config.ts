import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
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
