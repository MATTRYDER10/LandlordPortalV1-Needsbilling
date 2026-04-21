<template>
  <router-view />
  <ReportIssueButton v-if="authStore.session" />
  <WhatsNewModal v-if="authStore.session" />
  <GooseBotWidget v-if="authStore.session" user-type="agent" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useAdminCompanyStore } from './stores/adminCompany'
import ReportIssueButton from './components/support/ReportIssueButton.vue'
import WhatsNewModal from './components/WhatsNewModal.vue'
import GooseBotWidget from './components/GooseBotWidget.vue'

const authStore = useAuthStore()
const adminCompanyStore = useAdminCompanyStore()
const router = useRouter()

// Force hard refresh on new deployments (immediate check on page load)
declare const __APP_VERSION__: string
const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1'
const STORED_VERSION_KEY = 'pg_app_version'
const storedVersion = localStorage.getItem(STORED_VERSION_KEY)
if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION)
  window.location.reload()
} else {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION)
}

// Background version polling — detects new deployments while app is open
let versionPollTimer: ReturnType<typeof setInterval> | null = null
let newVersionDetected = false

async function checkForNewVersion() {
  try {
    const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    if (data.version && data.version !== APP_VERSION && !newVersionDetected) {
      newVersionDetected = true
      console.log('[AutoUpdate] New version detected, will reload on next navigation')
      // Reload on next route change so we don't interrupt the user mid-task
      router.beforeEach(() => {
        window.location.reload()
      })
    }
  } catch {
    // Silently fail — network issues, dev mode, etc.
  }
}

onMounted(async () => {
  // Initialize admin company store first (reads from sessionStorage)
  adminCompanyStore.initialize()
  // Then initialize auth
  await authStore.initialize()

  // Poll for new versions every 60 seconds (production only)
  if (import.meta.env.PROD) {
    versionPollTimer = setInterval(checkForNewVersion, 60_000)
  }
})

onUnmounted(() => {
  if (versionPollTimer) clearInterval(versionPollTimer)
})
</script>
