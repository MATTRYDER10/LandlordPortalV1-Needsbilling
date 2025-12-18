<template>
  <div class="flex flex-col md:flex-row h-screen bg-background">
    <!-- Mobile top header bar -->
    <div class="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white shadow-sm flex items-center px-4">
      <button
        @click="isMobileMenuOpen = true"
        class="p-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100"
      >
        <Menu class="w-6 h-6" />
      </button>
      <div class="flex items-center ml-3">
        <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-8" />
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
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-9" />
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
                <Plus class="w-5 h-5 mr-3" />
                Create...
              </div>
              <ChevronDown class="w-4 h-4" />
            </button>

            <div v-if="showCreateMenu" class="absolute left-0 right-0 mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
              <div class="py-1">
                <button
                  @click="handleCreateReference"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <ClipboardList class="w-5 h-5 text-gray-500" />
                  Reference
                </button>
                <button
                  @click="handleCreateAgreement"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <FileSignature class="w-5 h-5 text-gray-500" />
                  Tenancy Agreement
                </button>
                <button
                  @click="handleAddLandlord"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Building2 class="w-5 h-5 text-gray-500" />
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
              <component :is="item.icon" class="w-5 h-5 mr-3" />
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
                  <component :is="item.icon" class="w-5 h-5 mr-3" />
                  {{ item.name }}
                </div>
                <ChevronDown
                  class="w-4 h-4 transition-transform"
                  :class="openMenus[item.name] ? 'rotate-180' : ''"
                />
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
                  <component :is="child.icon" class="w-4 h-4 mr-3" />
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
              <LogOut class="w-5 h-5 mr-3" />
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
import { computed, ref, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import CreditsDisplay from './CreditsDisplay.vue'
import {
  LayoutDashboard,
  ClipboardList,
  HandCoins,
  Building2,
  FileSignature,
  FilePlus,
  History,
  Settings,
  Plus,
  ChevronDown,
  Menu,
  LogOut
} from 'lucide-vue-next'

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
    icon: markRaw(LayoutDashboard)
  },
  {
    name: 'References',
    path: '/references',
    icon: markRaw(ClipboardList)
  },
  {
    name: 'Tenant Offers',
    path: '/tenant-offers',
    icon: markRaw(HandCoins)
  },
  {
    name: 'Landlords',
    path: '/landlords',
    icon: markRaw(Building2)
  },
  {
    name: 'Agreements',
    icon: markRaw(FileSignature),
    children: [
      {
        name: 'Generate Agreement',
        path: '/agreements/generate',
        icon: markRaw(FilePlus)
      },
      {
        name: 'Agreement History',
        path: '/agreements/history',
        icon: markRaw(History)
      }
    ]
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: markRaw(Settings)
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
