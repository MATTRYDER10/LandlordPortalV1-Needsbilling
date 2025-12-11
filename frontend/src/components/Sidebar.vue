<template>
  <div class="flex flex-col md:flex-row h-screen bg-background">
    <!-- Mobile top header bar -->
    <div class="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white shadow-sm flex items-center px-4">
      <button
        @click="isMobileMenuOpen = true"
        class="p-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div class="flex items-center ml-3">
        <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-7 h-7 mr-2" />
        <h1 class="text-xl font-bold">
          <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
        </h1>
      </div>
    </div>

    <!-- Mobile overlay backdrop -->
    <div
      v-if="isMobileMenuOpen"
      @click="isMobileMenuOpen = false"
      class="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
    ></div>

    <!-- Sidebar -->
    <aside
      :class="[
        'w-64 bg-white shadow-lg flex-shrink-0',
        'md:relative md:translate-x-0',
        'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
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
          <!-- Create Button -->
          <div class="relative">
            <button
              @click="showCreateMenu = !showCreateMenu"
              class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors bg-primary text-white hover:bg-primary/90 shadow-sm"
            >
              <div class="flex items-center">
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Create...
              </div>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-if="showCreateMenu" class="absolute left-0 right-0 mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
              <div class="py-1">
                <button
                  @click="handleCreateReference"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Reference
                </button>
                <button
                  @click="handleCreateAgreement"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Tenancy Agreement
                </button>
                <button
                  @click="handleAddLandlord"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Landlord
                </button>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 my-2"></div>

          <template v-for="item in navigation" :key="item.name">
            <!-- Menu item without children -->
            <router-link
              v-if="!item.children"
              :to="item.path"
              @click="closeMobileMenu"
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

            <!-- Menu item with children (expandable) -->
            <div v-else>
              <button
                @click="toggleSubmenu(item.name)"
                class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors"
                :class="isParentActive(item)
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 hover:bg-gray-100'"
              >
                <div class="flex items-center">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
                  </svg>
                  {{ item.name }}
                </div>
                <svg
                  class="w-4 h-4 transition-transform"
                  :class="openMenus[item.name] ? 'rotate-180' : ''"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Submenu items -->
              <div v-if="openMenus[item.name]" class="ml-4 mt-1 space-y-1">
                <router-link
                  v-for="child in item.children"
                  :key="child.name"
                  :to="child.path"
                  @click="closeMobileMenu"
                  class="flex items-center px-4 py-2 text-sm rounded-lg transition-colors"
                  :class="isActive(child.path)
                    ? 'bg-primary text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-100'"
                >
                  <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="child.icon" />
                  </svg>
                  {{ child.name }}
                </router-link>
              </div>
            </div>
          </template>
        </nav>

        <!-- Credits Display -->
        <CreditsDisplay />

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
    <main class="flex-1 overflow-auto pt-14 md:pt-0">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import CreditsDisplay from './CreditsDisplay.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showCreateMenu = ref(false)
const isMobileMenuOpen = ref(false)
const openMenus = ref<Record<string, boolean>>({
  Agreements: true // Open by default
})

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

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
    name: 'Tenant Offers',
    path: '/tenant-offers',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  },
  {
    name: 'Landlords',
    path: '/landlords',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
  },
  {
    name: 'Agreements',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    children: [
      {
        name: 'Generate Agreement',
        path: '/agreements/generate',
        icon: 'M12 4v16m8-8H4'
      },
      {
        name: 'Agreement History',
        path: '/agreements/history',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
      }
    ]
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

const isParentActive = (item: any) => {
  if (!item.children) return false
  return item.children.some((child: any) => route.path === child.path)
}

const toggleSubmenu = (menuName: string) => {
  openMenus.value[menuName] = !openMenus.value[menuName]
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/login')
}

const handleCreateReference = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  // If already on references page, emit event to open modal directly
  if (route.path === '/references') {
    // Use a custom event to trigger the modal
    window.dispatchEvent(new CustomEvent('open-create-reference-modal'))
  } else {
    // Navigate to references page with create query param
    router.push('/references?create=true')
  }
}

const handleCreateAgreement = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  router.push('/agreements/generate')
}

const handleAddLandlord = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  router.push('/landlords?add=true')
}
</script>
