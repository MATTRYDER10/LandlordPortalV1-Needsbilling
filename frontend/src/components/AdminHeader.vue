<template>
  <div class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Top Bar with Logo and Sign Out -->
      <div class="flex justify-between items-center py-6">
        <!-- Logo and Branding -->
        <div class="flex items-center">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-8 mr-3" />
          <span class="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded">
            Admin Portal
          </span>
        </div>

        <!-- User Info and Sign Out - Desktop -->
        <div class="hidden md:flex items-center gap-4">
          <div class="text-right">
            <p class="text-sm font-medium text-gray-900">{{ adminUser?.full_name || 'Admin' }}</p>
            <p class="text-xs text-gray-500">{{ adminUser?.email || '' }}</p>
          </div>
          <button
            @click="handleSignOut"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <!-- Mobile Menu Button -->
        <button
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              v-if="!mobileMenuOpen"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Navigation Tabs - Desktop -->
      <div class="hidden md:block border-t border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Admin Navigation">
          <router-link
            v-for="item in navigationItems"
            :key="item.path"
            :to="item.path"
            :class="[
              isActive(item.path)
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                isActive(item.path) ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500',
                'mr-2 h-5 w-5'
              ]"
            />
            {{ item.name }}
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div
      v-if="mobileMenuOpen"
      class="md:hidden border-t border-gray-200"
    >
      <div class="px-2 pt-2 pb-3 space-y-1">
        <router-link
          v-for="item in navigationItems"
          :key="item.path"
          :to="item.path"
          @click="mobileMenuOpen = false"
          :class="[
            isActive(item.path)
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            'block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors'
          ]"
        >
          <div class="flex items-center">
            <component
              :is="item.icon"
              :class="[
                isActive(item.path) ? 'text-primary' : 'text-gray-400',
                'mr-3 h-5 w-5'
              ]"
            />
            {{ item.name }}
          </div>
        </router-link>
      </div>

      <!-- Mobile User Info and Sign Out -->
      <div class="pt-4 pb-3 border-t border-gray-200">
        <div class="px-4 flex items-center">
          <div class="flex-1">
            <div class="text-base font-medium text-gray-800">{{ adminUser?.full_name || 'Admin' }}</div>
            <div class="text-sm text-gray-500">{{ adminUser?.email || '' }}</div>
          </div>
        </div>
        <div class="mt-3 px-2">
          <button
            @click="handleSignOut"
            class="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const mobileMenuOpen = ref(false)

// Get admin user info from auth store
const adminUser = computed(() => {
  // If we have staff user data, use that
  if (authStore.user?.user_metadata?.full_name) {
    return {
      full_name: authStore.user.user_metadata.full_name,
      email: authStore.user.email
    }
  }
  return {
    full_name: authStore.user?.email?.split('@')[0] || 'Admin',
    email: authStore.user?.email || ''
  }
})

// Navigation items
const navigationItems = [
  {
    name: 'Dashboard',
    path: '/admin/dashboard',
    icon: h('svg', {
      class: 'h-5 w-5',
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
      })
    ])
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    icon: h('svg', {
      class: 'h-5 w-5',
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'
      })
    ])
  },
  {
    name: 'Customers',
    path: '/admin/customers',
    icon: h('svg', {
      class: 'h-5 w-5',
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
      })
    ])
  },
  {
    name: 'References',
    path: '/admin/references',
    icon: h('svg', {
      class: 'h-5 w-5',
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
      })
    ])
  },
  {
    name: 'Staff',
    path: '/admin/staff',
    icon: h('svg', {
      class: 'h-5 w-5',
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor'
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
      })
    ])
  }
]

// Check if route is active
const isActive = (path: string) => {
  return route.path === path
}

// Handle sign out
const handleSignOut = async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await authStore.signOut()
    router.push('/staff/login')
  }
}
</script>
