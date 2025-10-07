<template>
  <div class="flex h-screen bg-background">
    <!-- Sidebar -->
    <aside class="w-64 bg-white shadow-lg">
      <div class="flex flex-col h-full">
        <!-- Logo -->
        <div class="flex items-center justify-center h-16 px-4 border-b border-gray-200">
          <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-8 h-8 mr-2" />
          <h1 class="text-2xl font-bold">
            <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
          </h1>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <router-link
            v-for="item in navigation"
            :key="item.name"
            :to="item.path"
            class="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors"
            :class="isActive(item.path)
              ? 'bg-primary text-white'
              : 'text-gray-700 hover:bg-gray-100'"
          >
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
            </svg>
            {{ item.name }}
          </router-link>
        </nav>

        <!-- User Menu -->
        <div class="border-t border-gray-200">
          <div class="px-4 py-4">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                  {{ userInitials }}
                </div>
              </div>
              <div class="ml-3 flex-1 min-w-0">
                <p v-if="companyName" class="text-xs text-gray-400 truncate mb-0.5">{{ companyName }}</p>
                <p class="text-sm font-medium text-gray-900 truncate">{{ userEmail }}</p>
                <p class="text-xs text-gray-500 truncate">{{ userRole }}</p>
              </div>
            </div>
            <button
              @click="handleSignOut"
              class="mt-4 w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const navigation = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
  },
  {
    name: 'References',
    path: '/references',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  }
]

const userEmail = computed(() => authStore.user?.email || '')
const userRole = computed(() => {
  const role = authStore.company?.role || ''
  return role.charAt(0).toUpperCase() + role.slice(1)
})
const companyName = computed(() => authStore.company?.name || '')
const userInitials = computed(() => {
  const email = authStore.user?.email || ''
  return email.charAt(0).toUpperCase()
})

const isActive = (path: string) => {
  return route.path === path
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/login')
}
</script>
