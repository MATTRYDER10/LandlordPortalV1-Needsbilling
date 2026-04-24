<template>
  <div class="flex flex-col md:flex-row h-screen bg-background dark:bg-slate-950 transition-colors duration-300">
    <!-- Mobile top header bar -->
    <div :class="[
      'md:hidden fixed top-0 left-0 right-0 z-30 shadow-sm flex items-center justify-between px-4 h-14 transition-colors duration-300',
      isDark ? 'bg-[#1a2e44]' : 'bg-white border-b border-gray-200'
    ]">
      <div class="flex items-center">
        <button
          @click="isMobileMenuOpen = true"
          :class="['p-2 -ml-2 rounded-md', isDark ? 'text-white/80 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100']"
        >
          <Menu class="w-6 h-6" />
        </button>
        <div class="flex items-center ml-3 gap-2">
          <img :src="isDark ? '/PropertyGooseLogoDark.png' : '/PropertyGooseLogo.png'" alt="PropertyGoose" class="h-8 w-8" />
          <span :class="['text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900']">Landlord Portal</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NotificationBell />
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
        'w-64 flex-shrink-0 transition-all duration-300',
        'md:relative md:translate-x-0',
        'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out',
        isDark ? 'bg-[#1a2e44]' : 'bg-gray-50',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Gradient background -->
      <div :class="[
        'absolute inset-0 transition-colors duration-300',
        isDark
          ? 'bg-gradient-to-b from-[#1a2e44] via-[#1e3550] to-[#162536]'
          : 'bg-gradient-to-b from-gray-50 via-gray-100 to-gray-150 border-r border-gray-200'
      ]"></div>

      <!-- Subtle feather pattern overlay -->
      <div
        class="absolute inset-0 opacity-[0.02]"
        :style="`background-image: url('data:image/svg+xml,%3Csvg width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 40 40\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M20 20c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10c0 5.5-4.5 10-10 10S0 25.5 0 20s4.5-10 10-10c0-5.5 4.5-10 10-10z\\' fill=\\'%23${isDark ? 'ffffff' : '1a2e44'}\\' fill-opacity=\\'1\\' fill-rule=\\'evenodd\\'/%3E%3C/svg%3E');`"
      ></div>

      <div class="relative flex flex-col h-full">
        <!-- Logo Row -->
        <div :class="[
          'flex items-center justify-between h-16 px-4 border-b transition-colors duration-300',
          isDark ? 'border-white/10' : 'border-gray-200'
        ]">
          <div class="flex items-center gap-2.5">
            <img
              :src="isDark ? '/PropertyGooseLogoDark.png' : '/PropertyGooseLogo.png'"
              alt="PropertyGoose"
              class="h-10 w-auto object-contain"
            />
            <div class="flex flex-col">
              <span :class="['text-xs font-bold tracking-wide', isDark ? 'text-white/90' : 'text-gray-800']">Landlord Portal</span>
              <span :class="['text-[9px] font-mono', isDark ? 'text-white/40' : 'text-gray-400']">v{{ appVersion }}</span>
            </div>
          </div>

          <!-- Create Button -->
          <div class="relative" data-create-menu>
            <button
              @click="showCreateMenu = !showCreateMenu"
              class="group flex items-center gap-1 px-2.5 py-2 text-sm font-semibold rounded-xl transition-all bg-gradient-to-r from-primary to-orange-500 text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 hover:scale-105"
            >
              <Plus class="w-4 h-4 transition-transform group-hover:rotate-90" />
              <ChevronDown class="w-3 h-3 transition-transform" :class="showCreateMenu ? 'rotate-180' : ''" />
            </button>

            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <div v-if="showCreateMenu" class="absolute right-0 mt-2 w-52 rounded-xl shadow-2xl bg-white dark:bg-slate-800 ring-1 ring-black/5 z-50 overflow-hidden">
                <div class="py-1">
                  <button
                    @click="handleCreateReference"
                    class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  >
                    <GooseClipboard class="w-5 h-5 text-primary" />
                    Reference
                  </button>
                  <button
                    @click="handleAddProperty"
                    class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  >
                    <GooseProperty class="w-5 h-5 text-primary" />
                    Property
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <router-link
            v-for="item in navigation"
            :key="item.name"
            :to="item.path"
            @click="closeMobileMenu"
            class="nav-item group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300"
            :class="isActive(item.path)
              ? 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-lg shadow-primary/30'
              : isDark
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-primary/10 hover:border-primary/20'"
          >
            <component
              :is="item.icon"
              class="w-5 h-5 mr-3 transition-all duration-300"
              :class="isActive(item.path)
                ? 'text-white'
                : isDark
                  ? 'text-white/60 group-hover:text-primary group-hover:scale-110'
                  : 'text-gray-400 group-hover:text-primary group-hover:scale-110'"
            />
            <span class="flex-1 group-hover:translate-x-0.5 transition-transform duration-200">{{ item.name }}</span>
            <!-- Badge: pending offers -->
            <span
              v-if="item.name === 'Offers' && badgeStore.pendingOffers > 0"
              class="ml-1 min-w-[18px] h-[18px] rounded-full bg-yellow-400 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
            >{{ badgeStore.pendingOffers }}</span>
            <!-- Lock icon for tenancies if no subscription -->
            <svg
              v-if="item.name === 'Tenancies' && !authStore.hasSubscription"
              class="w-3.5 h-3.5 ml-1"
              :class="isDark ? 'text-white/40' : 'text-gray-400'"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <!-- Active indicator -->
            <div
              v-if="isActive(item.path)"
              class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
            ></div>
          </router-link>
        </nav>

        <!-- Bottom Section -->
        <div :class="['border-t transition-colors duration-300', isDark ? 'border-white/10' : 'border-gray-200']">
          <!-- Dark Mode toggle -->
          <div class="px-4 py-2 flex items-center justify-between gap-2">
            <button
              @click="toggleDarkMode"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all"
              :class="isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'"
            >
              <div class="relative w-4 h-4">
                <svg
                  class="absolute inset-0 transition-all duration-300"
                  :class="isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                >
                  <circle cx="12" cy="12" r="4" class="text-amber-500" fill="currentColor" />
                  <path class="text-amber-500" stroke-linecap="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M8.34 15.66l-1.41 1.41m0-12.02l1.41 1.41m7.32 7.32l1.41 1.41" />
                </svg>
                <svg
                  class="absolute inset-0 transition-all duration-300"
                  :class="isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'"
                  fill="currentColor" viewBox="0 0 24 24"
                >
                  <path class="text-blue-300" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              </div>
              <span :class="['text-[11px] font-medium', isDark ? 'text-white/60' : 'text-gray-500']">
                {{ isDark ? 'Dark' : 'Light' }}
              </span>
            </button>
          </div>

          <!-- User Menu -->
          <div :class="['border-t transition-colors duration-300', isDark ? 'border-white/10' : 'border-gray-200']">
            <div class="px-4 py-4">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/30">
                    {{ userInitials }}
                  </div>
                </div>
                <div class="ml-3 flex-1 min-w-0">
                  <p :class="['text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-900']">{{ authStore.userName }}</p>
                  <p :class="['text-xs truncate', isDark ? 'text-white/60' : 'text-gray-500']">{{ userEmail }}</p>
                </div>
                <div class="hidden md:block ml-2">
                  <NotificationBell />
                </div>
              </div>
              <!-- Sign Out Button -->
              <button
                @click="handleSignOut"
                :class="[
                  'mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 border',
                  isDark
                    ? 'text-white/70 hover:text-white bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 border-white/10'
                    : 'text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-red-50 hover:border-red-200 border-gray-200'
                ]"
              >
                <LogOut class="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto md:pt-0 dark:bg-slate-950 transition-colors duration-300 pt-14">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, h, Transition, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBadgeCountsStore } from '../stores/badgeCounts'
import { useDarkMode } from '@/composables/useDarkMode'
import NotificationBell from './NotificationBell.vue'
import { Plus, ChevronDown, Menu, LogOut, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const badgeStore = useBadgeCountsStore()
const { isDark, toggleDarkMode } = useDarkMode()

declare const __APP_VERSION__: string
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'

// Goose-themed icons (reused from original)
const GooseDashboard = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '3', y: '3', width: '7', height: '7', rx: '1.5', fill: 'currentColor', opacity: '0.2' }),
      h('rect', { x: '14', y: '3', width: '7', height: '7', rx: '1.5' }),
      h('rect', { x: '3', y: '14', width: '7', height: '7', rx: '1.5' }),
      h('path', { d: 'M17.5 14c1.5 0 2.5 1 2.5 2.5s-1 2.5-2.5 2.5c-1 0-1.8-.5-2.2-1.2', fill: 'currentColor', opacity: '0.3' }),
      h('circle', { cx: '18', cy: '15.5', r: '0.5', fill: 'currentColor' })
    ])
  }
}

const GooseOffers = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '2', y: '6', width: '20', height: '12', rx: '2', fill: 'currentColor', opacity: '0.15' }),
      h('rect', { x: '2', y: '6', width: '20', height: '12', rx: '2' }),
      h('circle', { cx: '12', cy: '12', r: '3' }),
      h('path', { d: 'M6 12h.01M18 12h.01' })
    ])
  }
}

const GooseClipboard = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '5', y: '4', width: '14', height: '17', rx: '2', fill: 'currentColor', opacity: '0.1' }),
      h('rect', { x: '5', y: '4', width: '14', height: '17', rx: '2' }),
      h('path', { d: 'M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z', fill: 'currentColor', opacity: '0.3' }),
      h('path', { d: 'M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z' }),
      h('path', { d: 'M9 12l2 2 4-4', 'stroke-width': '2' })
    ])
  }
}

const GooseTenancies = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z', fill: 'currentColor', opacity: '0.1' }),
      h('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z' }),
      h('path', { d: 'M14 2v6h6' }),
      h('path', { d: 'M9 15l2 2 4-4', 'stroke-width': '2' }),
      h('line', { x1: '8', y1: '18', x2: '12', y2: '18' })
    ])
  }
}

const GooseProperty = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M3 12l9-9 9 9', fill: 'currentColor', opacity: '0.15' }),
      h('path', { d: 'M3 12l9-9 9 9' }),
      h('path', { d: 'M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' }),
      h('rect', { x: '9', y: '14', width: '6', height: '7', rx: '0.5' })
    ])
  }
}

const GooseLandlord = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('circle', { cx: '9', cy: '7', r: '4', fill: 'currentColor', opacity: '0.15' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('path', { d: 'M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2' }),
      h('circle', { cx: '17', cy: '7', r: '3' }),
      h('path', { d: 'M21 21v-2a3 3 0 00-2-2.83' })
    ])
  }
}

const GooseDocument = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M12 20h9' }),
      h('path', { d: 'M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z', fill: 'currentColor', opacity: '0.15' }),
      h('path', { d: 'M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' }),
      h('path', { d: 'M15 5l3 3' })
    ])
  }
}

const GooseSettings = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z', fill: 'currentColor', opacity: '0.15' }),
      h('path', { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' })
    ])
  }
}

const GooseHelp = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('circle', { cx: '12', cy: '12', r: '10', fill: 'currentColor', opacity: '0.15' }),
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('path', { d: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' }),
      h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
    ])
  }
}

const showCreateMenu = ref(false)
const isMobileMenuOpen = ref(false)

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (showCreateMenu.value && !target.closest('[data-create-menu]')) {
    showCreateMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  badgeStore.startPolling()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  badgeStore.stopPolling()
})

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Landlord navigation
const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: GooseDashboard },
  { name: 'Offers', path: '/offers', icon: GooseOffers },
  { name: 'Referencing', path: '/referencing', icon: GooseClipboard },
  { name: 'Tenancies', path: '/tenancies', icon: GooseTenancies },
  { name: 'Properties', path: '/properties', icon: GooseProperty },
  { name: 'Landlords', path: '/landlords', icon: GooseLandlord },
  { name: 'Agreements', path: '/agreements', icon: GooseDocument },
  { name: 'Settings', path: '/settings', icon: GooseSettings },
  { name: 'Help Centre', path: '/help-centre', icon: GooseHelp }
]

const userEmail = computed(() => authStore.user?.email || '')
const userInitials = computed(() => {
  const email = authStore.user?.email || ''
  return email.charAt(0).toUpperCase()
})

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/login')
}

const handleCreateReference = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  router.push('/referencing?create=true')
}

const handleAddProperty = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  router.push('/properties?add=true')
}
</script>

<style scoped>
.nav-item {
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.15), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s;
}

.nav-item:hover::before {
  transform: translateX(100%);
}

.nav-item:hover {
  transform: translateX(4px);
}
</style>
