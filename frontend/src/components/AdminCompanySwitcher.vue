<template>
  <div class="relative">
    <!-- Current Company Display / Dropdown Trigger -->
    <button
      @click="toggleDropdown"
      class="w-full flex items-center justify-between px-2 py-1.5 text-left rounded-md transition-colors"
      :class="isOverrideActive
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        : 'hover:bg-gray-100 text-gray-600'"
    >
      <div class="flex items-center min-w-0 flex-1">
        <Eye v-if="isOverrideActive" class="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
        <span class="text-xs truncate">
          {{ displayName }}
        </span>
      </div>
      <ChevronDown
        class="w-3.5 h-3.5 ml-1 flex-shrink-0 transition-transform"
        :class="dropdownOpen ? 'rotate-180' : ''"
      />
    </button>

    <!-- Dropdown Panel -->
    <div
      v-if="dropdownOpen"
      class="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-hidden flex flex-col"
    >
      <!-- Search Input -->
      <div class="p-2 border-b border-gray-100">
        <input
          ref="searchInput"
          v-model="searchQuery"
          @input="debouncedSearch"
          type="text"
          placeholder="Search companies..."
          class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
      </div>

      <!-- Own Account Option -->
      <button
        v-if="isOverrideActive"
        @click="clearOverride"
        class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center border-b border-gray-100 text-primary font-medium"
      >
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back to my account
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="p-4 text-center text-sm text-gray-500">
        Loading companies...
      </div>

      <!-- Company List -->
      <div v-else class="overflow-y-auto max-h-48">
        <button
          v-for="company in filteredCompanies"
          :key="company.id"
          @click="selectCompany(company)"
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
          :class="company.id === selectedCompanyId ? 'bg-primary/5 text-primary' : 'text-gray-700'"
        >
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate">{{ company.name }}</div>
            <div class="text-xs text-gray-400 truncate">{{ company.email }}</div>
          </div>
          <Check v-if="company.id === selectedCompanyId" class="w-4 h-4 ml-2 flex-shrink-0 text-primary" />
        </button>

        <div v-if="filteredCompanies.length === 0 && !loading" class="p-4 text-center text-sm text-gray-500">
          No companies found
        </div>
      </div>
    </div>

    <!-- Backdrop to close dropdown -->
    <div
      v-if="dropdownOpen"
      @click="dropdownOpen = false"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useAdminCompanyStore, type Company } from '@/stores/adminCompany'
import { useAuthStore } from '@/stores/auth'
import { Eye, ChevronDown, Check, ArrowLeft } from 'lucide-vue-next'

const adminCompanyStore = useAdminCompanyStore()
const authStore = useAuthStore()

const dropdownOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

// Computed
const isOverrideActive = computed(() => adminCompanyStore.isOverrideActive)
const selectedCompanyId = computed(() => adminCompanyStore.selectedCompanyId)
const loading = computed(() => adminCompanyStore.loading)
const companies = computed(() => adminCompanyStore.companies)

const displayName = computed(() => {
  if (isOverrideActive.value) {
    return adminCompanyStore.selectedCompanyName
  }
  return authStore.company?.name || 'Select Company'
})

const filteredCompanies = computed(() => {
  // Already filtered by API, just return the list
  return companies.value
})

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    adminCompanyStore.fetchCompanies(searchQuery.value)
  }, 300)
}

// Actions
const toggleDropdown = async () => {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) {
    // Load companies when opening
    await adminCompanyStore.fetchCompanies()
    // Focus search input
    await nextTick()
    searchInput.value?.focus()
  }
}

const selectCompany = (company: Company) => {
  adminCompanyStore.setSelectedCompany(company)
  dropdownOpen.value = false
  searchQuery.value = ''
  // Trigger a page reload to refresh data with new company context
  window.location.reload()
}

const clearOverride = () => {
  adminCompanyStore.clearOverride()
  dropdownOpen.value = false
  searchQuery.value = ''
  // Trigger a page reload to refresh data with own company
  window.location.reload()
}

// Initialize store from sessionStorage on mount
onMounted(() => {
  adminCompanyStore.initialize()
})

// Close dropdown on escape key
watch(dropdownOpen, (isOpen) => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dropdownOpen.value = false
    }
  }

  if (isOpen) {
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('keydown', handleEscape)
  }
})
</script>
