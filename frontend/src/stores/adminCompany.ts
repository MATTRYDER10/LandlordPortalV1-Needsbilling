import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAuthStore } from './auth'
import { useRouter } from 'vue-router'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const SESSION_STORAGE_KEY = 'adminCompanyOverride'
const MAX_VIEW_AS_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export interface Company {
  id: string
  name: string
  email: string
}

// Read from sessionStorage immediately (before store is created)
function getInitialState(): { id: string | null; name: string | null; expiresAt: number | null } {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        return { id: null, name: null, expiresAt: null }
      }
      return { id: data.id || null, name: data.name || null, expiresAt: data.expiresAt || null }
    }
  } catch (e) {
    console.error('Failed to read admin company override from sessionStorage:', e)
  }
  return { id: null, name: null, expiresAt: null }
}

const initialState = getInitialState()

export const useAdminCompanyStore = defineStore('adminCompany', () => {
  const authStore = useAuthStore()

  // Initialize with values from sessionStorage
  const selectedCompanyId = ref<string | null>(initialState.id)
  const selectedCompanyName = ref<string | null>(initialState.name)
  const expiresAt = ref<number | null>(initialState.expiresAt)
  const companies = ref<Company[]>([])
  const loading = ref(false)
  const searchQuery = ref('')
  const remainingSeconds = ref(0)

  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  // Is an override currently active?
  const isOverrideActive = computed(() => !!selectedCompanyId.value)

  // The display name for the current view
  const displayCompanyName = computed(() => {
    if (isOverrideActive.value) {
      return selectedCompanyName.value
    }
    return authStore.company?.name || null
  })

  // Initialize from sessionStorage
  const initialize = () => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        // Check if expired
        if (data.expiresAt && Date.now() > data.expiresAt) {
          clearOverride()
          return
        }
        selectedCompanyId.value = data.id || null
        selectedCompanyName.value = data.name || null
        expiresAt.value = data.expiresAt || null
        if (isOverrideActive.value) {
          startTimers()
        }
      }
    } catch (e) {
      console.error('Failed to restore admin company override:', e)
    }
  }

  // Watch for changes and persist to sessionStorage
  watch([selectedCompanyId, selectedCompanyName, expiresAt], () => {
    if (selectedCompanyId.value && selectedCompanyName.value) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        id: selectedCompanyId.value,
        name: selectedCompanyName.value,
        expiresAt: expiresAt.value
      }))
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  })

  // Start auto-timeout and countdown
  function startTimers() {
    stopTimers()

    if (!expiresAt.value) return

    const msRemaining = expiresAt.value - Date.now()
    if (msRemaining <= 0) {
      clearOverride()
      return
    }

    // Update countdown every second
    remainingSeconds.value = Math.ceil(msRemaining / 1000)
    countdownTimer = setInterval(() => {
      if (!expiresAt.value) return
      const left = Math.max(0, Math.ceil((expiresAt.value - Date.now()) / 1000))
      remainingSeconds.value = left
      if (left <= 0) {
        clearOverride()
      }
    }, 1000)

    // Auto-expire
    timeoutTimer = setTimeout(() => {
      clearOverride()
    }, msRemaining)
  }

  function stopTimers() {
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
    remainingSeconds.value = 0
  }

  // Fetch list of companies from admin API
  const fetchCompanies = async (search?: string) => {
    if (!authStore.isAdmin) return

    loading.value = true
    try {
      const token = authStore.session?.access_token
      if (!token) return

      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', '50')

      const response = await fetch(`${API_URL}/api/admin/companies/list?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        companies.value = data.companies || []
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    } finally {
      loading.value = false
    }
  }

  // Set the selected company override with 5-minute timeout
  const setSelectedCompany = (company: Company | null) => {
    if (company) {
      selectedCompanyId.value = company.id
      selectedCompanyName.value = company.name
      expiresAt.value = Date.now() + MAX_VIEW_AS_DURATION_MS
      startTimers()
    } else {
      clearOverride()
    }
  }

  // Clear the override and return to admin
  const clearOverride = () => {
    selectedCompanyId.value = null
    selectedCompanyName.value = null
    expiresAt.value = null
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    stopTimers()
  }

  // Format remaining time as MM:SS
  const formattedTimeRemaining = computed(() => {
    const mins = Math.floor(remainingSeconds.value / 60)
    const secs = remainingSeconds.value % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  })

  // Start timers if already active on store creation
  if (isOverrideActive.value && expiresAt.value) {
    startTimers()
  }

  return {
    selectedCompanyId,
    selectedCompanyName,
    companies,
    loading,
    searchQuery,
    isOverrideActive,
    displayCompanyName,
    remainingSeconds,
    formattedTimeRemaining,
    initialize,
    fetchCompanies,
    setSelectedCompany,
    clearOverride
  }
})
