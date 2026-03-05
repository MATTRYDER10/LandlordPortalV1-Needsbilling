import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const SESSION_STORAGE_KEY = 'adminCompanyOverride'

export interface Company {
  id: string
  name: string
  email: string
}

// Read from sessionStorage immediately (before store is created)
function getInitialState(): { id: string | null; name: string | null } {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      return { id: data.id || null, name: data.name || null }
    }
  } catch (e) {
    console.error('Failed to read admin company override from sessionStorage:', e)
  }
  return { id: null, name: null }
}

const initialState = getInitialState()

export const useAdminCompanyStore = defineStore('adminCompany', () => {
  const authStore = useAuthStore()

  // Initialize with values from sessionStorage
  const selectedCompanyId = ref<string | null>(initialState.id)
  const selectedCompanyName = ref<string | null>(initialState.name)
  const companies = ref<Company[]>([])
  const loading = ref(false)
  const searchQuery = ref('')

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
        selectedCompanyId.value = data.id || null
        selectedCompanyName.value = data.name || null
      }
    } catch (e) {
      console.error('Failed to restore admin company override:', e)
    }
  }

  // Watch for changes and persist to sessionStorage
  watch([selectedCompanyId, selectedCompanyName], () => {
    if (selectedCompanyId.value && selectedCompanyName.value) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        id: selectedCompanyId.value,
        name: selectedCompanyName.value
      }))
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  })

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

  // Set the selected company override
  const setSelectedCompany = (company: Company | null) => {
    if (company) {
      selectedCompanyId.value = company.id
      selectedCompanyName.value = company.name
    } else {
      clearOverride()
    }
  }

  // Clear the override and return to own account
  const clearOverride = () => {
    selectedCompanyId.value = null
    selectedCompanyName.value = null
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }

  return {
    selectedCompanyId,
    selectedCompanyName,
    companies,
    loading,
    searchQuery,
    isOverrideActive,
    displayCompanyName,
    initialize,
    fetchCompanies,
    setSelectedCompany,
    clearOverride
  }
})
