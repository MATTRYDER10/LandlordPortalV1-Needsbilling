<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useAdminCompanyStore } from './stores/adminCompany'

const authStore = useAuthStore()
const adminCompanyStore = useAdminCompanyStore()

onMounted(async () => {
  // Initialize admin company store first (reads from sessionStorage)
  adminCompanyStore.initialize()
  // Then initialize auth
  await authStore.initialize()
})
</script>
