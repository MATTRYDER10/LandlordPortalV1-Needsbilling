import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = pkg.version

// Plugin to write version.json into the build output
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      mkdirSync(distDir, { recursive: true })
      const versionPath = resolve(distDir, 'version.json')
      writeFileSync(versionPath, JSON.stringify({ version: appVersion }))
      console.log(`[version-file] Wrote version.json: ${appVersion}`)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), versionFilePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
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
      'landlord.propertygoose.co.uk',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app'
    ]
  },
  preview: {
    allowedHosts: [
      'localhost',
      '.up.railway.app',
      '.railway.app',
      'landlord.propertygoose.co.uk'
    ]
  }
})
