<template>
  <router-view />
  <ReportIssueButton v-if="authStore.session" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useAdminCompanyStore } from './stores/adminCompany'
import ReportIssueButton from './components/support/ReportIssueButton.vue'

const authStore = useAuthStore()
const adminCompanyStore = useAdminCompanyStore()

// Force hard refresh on new deployments
const APP_VERSION = __APP_VERSION__
const STORED_VERSION_KEY = 'pg_app_version'
const storedVersion = localStorage.getItem(STORED_VERSION_KEY)
if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION)
  window.location.reload()
} else {
  localStorage.setItem(STORED_VERSION_KEY, APP_VERSION)
}

onMounted(async () => {
  // Initialize admin company store first (reads from sessionStorage)
  adminCompanyStore.initialize()
  // Then initialize auth
  await authStore.initialize()
})
</script>
