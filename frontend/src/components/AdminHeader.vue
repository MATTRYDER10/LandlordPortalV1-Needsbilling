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
          <Menu v-if="!mobileMenuOpen" class="h-6 w-6" />
          <X v-else class="h-6 w-6" />
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
import { ref, computed, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import {
  LayoutDashboard,
  LineChart,
  Users,
  ClipboardList,
  UserCog,
  Menu,
  X
} from 'lucide-vue-next'

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
    icon: markRaw(LayoutDashboard)
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    icon: markRaw(LineChart)
  },
  {
    name: 'Customers',
    path: '/admin/customers',
    icon: markRaw(Users)
  },
  {
    name: 'References',
    path: '/admin/references',
    icon: markRaw(ClipboardList)
  },
  {
    name: 'Staff',
    path: '/admin/staff',
    icon: markRaw(UserCog)
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
