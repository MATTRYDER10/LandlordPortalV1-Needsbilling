import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(Date.now().toString())
  },
  build: {
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: true, // Listen on all network interfaces (0.0.0.0)
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    allowedHosts: [
      'localhost',
      '192.168.1.81',
      '.up.railway.app',
      '.railway.app',
      'app.propertygoose.co.uk',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app'
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
