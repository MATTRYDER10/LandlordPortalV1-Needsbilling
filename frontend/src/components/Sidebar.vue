<template>
  <div class="flex flex-col md:flex-row h-screen bg-background dark:bg-slate-950 transition-colors duration-300">
    <!-- Mobile Viewing As Banner -->
    <div
      v-if="adminCompanyStore.isOverrideActive"
      class="md:hidden fixed top-0 left-0 right-0 z-40 bg-red-600 text-white px-4 py-2 flex items-center justify-between"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-bold">VIEWING AS:</span>
        <span class="text-xs font-medium truncate">{{ adminCompanyStore.selectedCompanyName }}</span>
        <span class="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">{{ adminCompanyStore.formattedTimeRemaining }}</span>
      </div>
      <button
        @click="exitViewAs"
        class="flex-shrink-0 flex items-center gap-1 px-3 py-1 text-xs font-bold bg-white text-red-600 hover:bg-red-50 rounded transition-colors"
      >
        Return to Admin
      </button>
    </div>

    <!-- Mobile top header bar -->
    <div :class="[
      'md:hidden fixed top-0 left-0 right-0 z-30 shadow-sm flex items-center justify-between px-4 transition-colors duration-300',
      adminCompanyStore.isOverrideActive ? 'h-14 mt-7' : 'h-14',
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
          <img v-if="companyLogoUrl" :src="companyLogoUrl" alt="Agency" :class="['h-7 w-7 rounded-md object-contain p-0.5', isDark ? 'bg-white/10' : 'bg-gray-100']" />
          <img :src="isDark ? '/PropertyGooseLogoDark.png' : '/PropertyGooseLogo.png'" alt="PropertyGoose" class="h-8 w-8" />
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
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Gradient background - Light mode: light gray/white, Dark mode: dark blue -->
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
        <!-- Viewing As Banner -->
        <div
          v-if="adminCompanyStore.isOverrideActive"
          class="bg-red-600 text-white px-3 py-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider opacity-80">Viewing as</div>
              <div class="text-xs font-semibold truncate">{{ adminCompanyStore.selectedCompanyName }}</div>
            </div>
            <span class="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded shrink-0">{{ adminCompanyStore.formattedTimeRemaining }}</span>
          </div>
          <button
            @click="exitViewAs"
            class="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold bg-white text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            Return to Admin
          </button>
        </div>

        <!-- Logo Row -->
        <div :class="[
          'flex items-center justify-between h-16 px-4 border-b transition-colors duration-300',
          isDark ? 'border-white/10' : 'border-gray-200'
        ]">
          <!-- Logos -->
          <div class="flex items-center gap-2.5">
            <!-- Agent Logo (if available) -->
            <div v-if="companyLogoUrl" class="relative">
              <img
                :src="companyLogoUrl"
                alt="Agency"
                :class="[
                  'h-9 w-9 rounded-lg object-contain p-1 shadow-lg',
                  isDark ? 'bg-white' : 'bg-white border border-gray-200'
                ]"
              />
            </div>
            <!-- Divider -->
            <div v-if="companyLogoUrl" :class="['h-6 w-px', isDark ? 'bg-white/20' : 'bg-gray-300']"></div>
            <!-- PropertyGoose Logo - switches based on dark/light mode -->
            <img
              :src="isDark ? '/PropertyGooseLogoDark.png' : '/PropertyGooseLogo.png'"
              alt="PropertyGoose"
              class="h-10 w-auto object-contain"
            />
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

            <!-- Create Dropdown Menu -->
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
                    @click="handleCreateAgreement"
                    class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  >
                    <GooseDocument class="w-5 h-5 text-primary" />
                    Agreement
                  </button>
                  <button
                    @click="handleAddProperty"
                    class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  >
                    <GooseProperty class="w-5 h-5 text-primary" />
                    Property
                  </button>
                  <button
                    @click="handleAddLandlord"
                    class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  >
                    <GooseLandlord class="w-5 h-5 text-primary" />
                    Landlord
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
                  ? 'text-white/50 group-hover:text-primary group-hover:scale-110'
                  : 'text-gray-400 group-hover:text-primary group-hover:scale-110'"
            />
            <span class="flex-1 group-hover:translate-x-0.5 transition-transform duration-200">{{ item.name }}</span>
            <!-- Active indicator feather -->
            <div
              v-if="isActive(item.path)"
              class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
            ></div>
          </router-link>
        </nav>

        <!-- Beta Section -->
        <div :class="['border-t px-3 py-2 space-y-0.5 transition-colors duration-300', isDark ? 'border-white/10' : 'border-gray-200']">
          <template v-for="item in betaNavigation" :key="item.name">
            <!-- External link (InventoryGoose) -->
            <a
              v-if="item.isExternal"
              :href="item.path"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-300"
              :class="isDark
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-primary/10'"
            >
              <img
                v-if="item.isInventoryGoose"
                src="/inventorygoose-logo.png"
                alt="InventoryGoose"
                class="w-5 h-5 mr-3 rounded-full"
              />
              <span class="flex-1 text-xs">{{ item.name }}</span>
              <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-primary/10 text-primary">Beta</span>
            </a>
            <!-- Internal router link (V2 items) -->
            <router-link
              v-else
              :to="item.path"
              @click="closeMobileMenu"
              class="nav-item group flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-300"
              :class="isActive(item.path)
                ? 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-lg shadow-primary/30'
                : isDark
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-primary/10'"
            >
              <component
                :is="item.icon"
                class="w-5 h-5 mr-3 transition-all duration-300"
                :class="isActive(item.path)
                  ? 'text-white'
                  : isDark
                    ? 'text-white/50 group-hover:text-primary'
                    : 'text-gray-400 group-hover:text-primary'"
              />
              <span class="flex-1 text-xs">{{ item.name }}</span>
              <span
                class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full"
                :class="isActive(item.path)
                  ? 'bg-white/20 text-white'
                  : 'bg-primary/10 text-primary'"
              >Beta</span>
              <div
                v-if="isActive(item.path)"
                class="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-1.5"
              ></div>
            </router-link>
          </template>
        </div>

        <!-- Bottom Section -->
        <div :class="['border-t transition-colors duration-300', isDark ? 'border-white/10' : 'border-gray-200']">
          <!-- Dark Mode + Credits row -->
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
            <CreditsDisplay compact />
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
                  <AdminCompanySwitcher v-if="authStore.isAdmin" class="mb-0.5" />
                  <p v-else-if="companyName" :class="['text-[10px] truncate mb-0.5 uppercase tracking-wider', isDark ? 'text-white/40' : 'text-gray-400']">{{ companyName }}</p>
                  <p :class="['text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-900']">{{ userEmail }}</p>
                  <p class="text-[10px] text-primary truncate">{{ userRole }}</p>
                </div>
                <div class="hidden md:block ml-2">
                  <NotificationBell />
                </div>
              </div>
              <!-- Back/Sign Out Button -->
              <button
                @click="handleBack"
                :class="[
                  'mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 border',
                  isDark
                    ? 'text-white/70 hover:text-white bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 border-white/10'
                    : 'text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-red-50 hover:border-red-200 border-gray-200'
                ]"
              >
                <LogOut class="w-4 h-4" />
                {{ authStore.hasMultipleBranches ? 'Switch Branch' : 'Sign Out' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto pt-14 md:pt-0 dark:bg-slate-950 transition-colors duration-300">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, h, Transition, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminCompanyStore } from '../stores/adminCompany'
import { useDarkMode } from '@/composables/useDarkMode'
import CreditsDisplay from './CreditsDisplay.vue'
import NotificationBell from './NotificationBell.vue'
import AdminCompanySwitcher from './AdminCompanySwitcher.vue'
import { Plus, ChevronDown, Menu, LogOut, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminCompanyStore = useAdminCompanyStore()
const { isDark, toggleDarkMode } = useDarkMode()

const exitViewAs = () => {
  adminCompanyStore.clearOverride()
  router.push('/admin/customers')
}

// Watch for auto-timeout expiry and redirect back to admin
watch(() => adminCompanyStore.isOverrideActive, (active, wasActive) => {
  if (!active && wasActive) {
    router.push('/admin/customers')
  }
})

// ============================================================================
// CUSTOM GOOSE-THEMED ICONS
// ============================================================================

// Dashboard - Goose with dashboard grid
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

// Offers - Banknotes/Money
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

// References - Clipboard with goose checkmark
const GooseClipboard = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '5', y: '4', width: '14', height: '17', rx: '2', fill: 'currentColor', opacity: '0.1' }),
      h('rect', { x: '5', y: '4', width: '14', height: '17', rx: '2' }),
      h('path', { d: 'M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z', fill: 'currentColor', opacity: '0.3' }),
      h('path', { d: 'M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z' }),
      h('path', { d: 'M9 12l2 2 4-4', 'stroke-width': '2' }),
      h('path', { d: 'M16 17c1 0 1.5-.5 1.5-1s-.3-.8-.8-.8c-.3 0-.5.2-.7.4', fill: 'currentColor', opacity: '0.4' }),
      h('circle', { cx: '16.3', cy: '15.8', r: '0.2', fill: 'currentColor' })
    ])
  }
}

// Tenancies - Document/Contract with checkmark
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

// Properties - House with goose roof
const GooseProperty = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M3 12l9-9 9 9', fill: 'currentColor', opacity: '0.15' }),
      h('path', { d: 'M3 12l9-9 9 9' }),
      h('path', { d: 'M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' }),
      h('rect', { x: '9', y: '14', width: '6', height: '7', rx: '0.5' }),
      h('path', { d: 'M12 3c1.5-.5 2.5 0 2.5 1s-.5 1.2-1 1.5', fill: 'currentColor', opacity: '0.3' }),
      h('circle', { cx: '13.5', cy: '3.5', r: '0.3', fill: 'currentColor' })
    ])
  }
}

// Landlords - People/Users icon
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

// Agreements - Pen signing document
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

// Settings - Wrench/Spanner
const GooseSettings = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z', fill: 'currentColor', opacity: '0.15' }),
      h('path', { d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' })
    ])
  }
}

// Help Centre - Question mark circle
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

// RentGoose - Pound/money icon
const GooseRentGoose = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2', fill: 'currentColor', opacity: '0.15' }),
      h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }),
      h('path', { d: 'M14.5 9.5c-.4-1-1.4-1.5-2.5-1.5-1.7 0-3 1.1-3 2.5s1.3 2.5 3 2.5c1.7 0 3 1.1 3 2.5s-1.3 2.5-3 2.5c-1.1 0-2.1-.5-2.5-1.5' }),
      h('line', { x1: '12', y1: '6', x2: '12', y2: '8' }),
      h('line', { x1: '12', y1: '18', x2: '12', y2: '20' })
    ])
  }
}

const showCreateMenu = ref(false)
const isMobileMenuOpen = ref(false)

// Close create menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (showCreateMenu.value && !target.closest('[data-create-menu]')) {
    showCreateMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Main navigation (V1)
const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: GooseDashboard },
  { name: 'Offers', path: '/tenant-offers', icon: GooseOffers },
  { name: 'References', path: '/references', icon: GooseClipboard },
  { name: 'Tenancies', path: '/tenancies', icon: GooseTenancies },
  { name: 'Properties', path: '/properties', icon: GooseProperty },
  { name: 'Landlords', path: '/landlords', icon: GooseLandlord },
  { name: 'RentGoose', path: '/rentgoose', icon: GooseRentGoose },
  { name: 'Standalone Agreements', path: '/agreements/history', icon: GooseDocument },
  { name: 'Settings', path: '/settings', icon: GooseSettings },
  { name: 'Help Centre', path: '/help-centre', icon: GooseHelp }
]

// Beta navigation items (bottom of sidebar)
const betaNavigation = [
  { name: 'Offers V2', path: '/tenant-offers-v2', icon: GooseOffers, isExternal: false, isInventoryGoose: false },
  { name: 'References V2', path: '/references-v2', icon: GooseClipboard, isExternal: false, isInventoryGoose: false },
  { name: 'RentGoose', path: '/rentgoose', icon: GooseSettings, isExternal: false, isInventoryGoose: false },
  { name: 'InventoryGoose', path: 'https://ig.propertygoose.co.uk', icon: null, isExternal: true, isInventoryGoose: true }
]

const userEmail = computed(() => authStore.user?.email || '')
const userRole = computed(() => {
  const role = authStore.company?.role || ''
  return role.charAt(0).toUpperCase() + role.slice(1)
})
const companyName = computed(() => authStore.company?.name || '')
const companyLogoUrl = computed(() => authStore.company?.logoUrl || '')
const userInitials = computed(() => {
  const email = authStore.user?.email || ''
  return email.charAt(0).toUpperCase()
})

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const handleBack = async () => {
  if (authStore.hasMultipleBranches) {
    // Multi-branch user: clear active branch and go to selector
    authStore.clearActiveBranch()
    router.push('/select-branch')
  } else {
    // Single branch user: sign out completely
    await authStore.signOut()
    router.push('/login')
  }
}

const handleCreateReference = () => {
  showCreateMenu.value = false
  closeMobileMenu()
  if (route.path === '/references') {
    window.dispatchEvent(new CustomEvent('open-create-reference-modal'))
  } else {
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
