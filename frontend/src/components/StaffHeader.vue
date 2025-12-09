<template>
  <div class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <div class="flex items-center">
          <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-10 h-10 mr-3" />
          <h1 class="text-3xl font-bold">
            <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
            <span class="ml-3 text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Staff Portal</span>
          </h1>
        </div>
        <button
          @click="handleSignOut"
          class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}
</script>
