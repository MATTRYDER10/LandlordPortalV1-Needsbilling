import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Types matching backend
export type PersonStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'VERIFIED_PASS'
  | 'VERIFIED_CONDITIONAL'
  | 'VERIFIED_FAIL'
  | 'ARCHIVED'

export type TenancyStatus =
  | 'SENT'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'

export type SectionType = 'IDENTITY_SELFIE' | 'RTR' | 'INCOME' | 'RESIDENTIAL' | 'CREDIT' | 'AML'
export type SectionDecision = 'NOT_REVIEWED' | 'PASS' | 'PASS_WITH_CONDITION' | 'ACTION_REQUIRED' | 'FAIL'

export interface SectionStatus {
  type: SectionType
  decision: SectionDecision
  hasActionRequired: boolean
  actionReasonCode?: string
  actionAgentNote?: string
}

export interface ActionRequiredTask {
  sectionType: string
  reasonCode: string
  reasonLabel: string
  staffNote: string
  requiredActionType: string
}

export interface TenancyPerson {
  id: string
  role: 'TENANT' | 'GUARANTOR'
  name: string
  email: string
  phone: string
  rentShare: number
  status: PersonStatus
  guarantorForTenantId?: string
  sectionStatuses: SectionStatus[]
  actionRequiredTasks: ActionRequiredTask[]
}

export interface ProgressSummary {
  tenantsVerified: number
  tenantsTotal: number
  guarantorsVerified: number
  guarantorsTotal: number
  checkFailures: Record<string, number>
}

export interface EmailDeliveryIssue {
  type: 'bounced' | 'complained'
  personName: string
  errorMessage?: string
}

export interface Tenancy {
  id: string
  propertyAddress: string
  propertyCity: string
  propertyPostcode: string
  moveInDate: string
  monthlyRent: number
  tenancyStatus: TenancyStatus
  urgentReverify: boolean
  emailDeliveryIssue?: EmailDeliveryIssue
  blockingSentence: string
  progressSummary: ProgressSummary
  people: TenancyPerson[]
  createdAt: string
}

export interface StatusCounts {
  all: number
  inProgress: number
  awaitingVerification: number
  actionRequired: number
  completed: number
  rejected: number
}

export interface TenanciesResponse {
  tenancies: Tenancy[]
  statusCounts: StatusCounts
}

// Re-referencing types
export interface ActionRequiredDetails {
  referenceId: string
  hasActionRequired: boolean
  sections: {
    sectionType: string
    reasonCode: string | null
    reasonLabel: string | null
    agentMessage: string | null
    correctionCycle: number
    decisionAt: string
  }[]
}

export interface UploadDocumentResult {
  message: string
  uploadedFiles: string[]
}

export interface RefereeUpdateResult {
  message: string
  type: string
  oldEmail: string
  newEmail: string
  emailSent: boolean
}

export interface ReReferencingResult {
  message: string
  newStatus: string
  urgentReverify: boolean
}

export function useTenancies() {
  const authStore = useAuthStore()

  const tenancies = ref<Tenancy[]>([])
  const statusCounts = ref<StatusCounts>({
    all: 0,
    inProgress: 0,
    awaitingVerification: 0,
    actionRequired: 0,
    completed: 0,
    rejected: 0
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // UI state
  const expandedTenancyId = ref<string | null>(null)
  const selectedPerson = ref<TenancyPerson | null>(null)
  const selectedTenancy = ref<Tenancy | null>(null)
  const drawerOpen = ref(false)

  // Filters
  const searchQuery = ref('')
  const activeTab = ref<TenancyStatus | 'ALL'>('ALL')
  const sortBy = ref<'move_in_date' | 'created_at'>('move_in_date')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // Computed
  const filteredTenancies = computed(() => {
    let result = tenancies.value

    // Filter by tab
    if (activeTab.value !== 'ALL') {
      result = result.filter(t => t.tenancyStatus === activeTab.value)
    }

    // Filter by search
    if (searchQuery.value) {
      const search = searchQuery.value.toLowerCase()
      result = result.filter(t =>
        t.propertyAddress.toLowerCase().includes(search) ||
        t.propertyCity.toLowerCase().includes(search) ||
        t.propertyPostcode.toLowerCase().includes(search) ||
        t.people.some(p =>
          p.name.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search)
        )
      )
    }

    return result
  })

  async function loadTenancies() {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (sortBy.value) params.append('sortBy', sortBy.value)
      if (sortOrder.value) params.append('sortOrder', sortOrder.value)

      const response = await fetch(`${API_BASE}/api/tenancies?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load tenancies')
      }

      const data: TenanciesResponse = await response.json()
      tenancies.value = data.tenancies
      statusCounts.value = data.statusCounts
    } catch (err: any) {
      console.error('Error loading tenancies:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function loadTenancy(id: string): Promise<Tenancy | null> {
    try {
      const response = await fetch(`${API_BASE}/api/tenancies/${id}`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load tenancy')
      }

      const data = await response.json()
      return data.tenancy
    } catch (err: any) {
      console.error('Error loading tenancy:', err)
      error.value = err.message
      return null
    }
  }

  function toggleExpanded(tenancyId: string) {
    if (expandedTenancyId.value === tenancyId) {
      expandedTenancyId.value = null
    } else {
      expandedTenancyId.value = tenancyId
    }
  }

  function openPersonDrawer(person: TenancyPerson, tenancy: Tenancy) {
    selectedPerson.value = person
    selectedTenancy.value = tenancy
    drawerOpen.value = true
  }

  function closePersonDrawer() {
    drawerOpen.value = false
    selectedPerson.value = null
    selectedTenancy.value = null
  }

  function setActiveTab(tab: TenancyStatus | 'ALL') {
    activeTab.value = tab
  }

  function setSearch(query: string) {
    searchQuery.value = query
  }

  function setSort(by: 'move_in_date' | 'created_at', order: 'asc' | 'desc') {
    sortBy.value = by
    sortOrder.value = order
    loadTenancies() // Reload with new sort
  }

  // Status helpers
  function getStatusColor(status: TenancyStatus | PersonStatus): string {
    switch (status) {
      case 'COMPLETED':
      case 'VERIFIED_PASS':
      case 'VERIFIED_CONDITIONAL':
        return 'green'
      case 'AWAITING_VERIFICATION':
      case 'IN_PROGRESS':
        return 'amber'
      case 'ACTION_REQUIRED':
      case 'REJECTED':
      case 'VERIFIED_FAIL':
        return 'red'
      case 'SENT':
      case 'NOT_STARTED':
      case 'ARCHIVED':
      default:
        return 'gray'
    }
  }

  function getStatusLabel(status: TenancyStatus): string {
    switch (status) {
      case 'SENT': return 'Sent'
      case 'IN_PROGRESS': return 'In Progress'
      case 'AWAITING_VERIFICATION': return 'Awaiting Verification'
      case 'ACTION_REQUIRED': return 'Action Required'
      case 'COMPLETED': return 'Completed'
      case 'REJECTED': return 'Rejected'
      default: return status
    }
  }

  function getSectionLabel(type: SectionType): string {
    switch (type) {
      case 'IDENTITY_SELFIE': return 'ID'
      case 'RTR': return 'RTR'
      case 'INCOME': return 'Income'
      case 'RESIDENTIAL': return 'Res'
      case 'CREDIT': return 'Credit'
      case 'AML': return 'AML'
      default: return type
    }
  }

  // Re-referencing API functions
  async function getActionRequiredDetails(referenceId: string): Promise<ActionRequiredDetails | null> {
    try {
      const response = await fetch(`${API_BASE}/api/references/${referenceId}/action-required-details`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to get action required details')
      }

      return await response.json()
    } catch (err: any) {
      console.error('Error getting action required details:', err)
      return null
    }
  }

  async function uploadDocument(referenceId: string, files: Record<string, File | File[]>): Promise<UploadDocumentResult | null> {
    try {
      const formData = new FormData()

      for (const [key, value] of Object.entries(files)) {
        if (Array.isArray(value)) {
          for (const file of value) {
            formData.append(key, file)
          }
        } else {
          formData.append(key, value)
        }
      }

      const response = await fetch(`${API_BASE}/api/references/${referenceId}/upload-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      return await response.json()
    } catch (err: any) {
      console.error('Error uploading document:', err)
      throw err
    }
  }

  async function updateRefereeEmail(
    referenceId: string,
    type: 'employer' | 'landlord' | 'accountant',
    email: string,
    name?: string
  ): Promise<RefereeUpdateResult | null> {
    try {
      const response = await fetch(`${API_BASE}/api/references/${referenceId}/referee`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, email, name })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update referee email')
      }

      return await response.json()
    } catch (err: any) {
      console.error('Error updating referee email:', err)
      throw err
    }
  }

  async function resendForm(referenceId: string): Promise<{ message: string; email: string } | null> {
    try {
      const response = await fetch(`${API_BASE}/api/references/${referenceId}/resend-form`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resend form')
      }

      return await response.json()
    } catch (err: any) {
      console.error('Error resending form:', err)
      throw err
    }
  }

  async function submitForReReferencing(referenceId: string): Promise<ReReferencingResult | null> {
    try {
      const response = await fetch(`${API_BASE}/api/references/${referenceId}/submit-for-re-referencing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for re-referencing')
      }

      return await response.json()
    } catch (err: any) {
      console.error('Error submitting for re-referencing:', err)
      throw err
    }
  }

  return {
    // State
    tenancies,
    statusCounts,
    loading,
    error,
    expandedTenancyId,
    selectedPerson,
    selectedTenancy,
    drawerOpen,
    searchQuery,
    activeTab,
    sortBy,
    sortOrder,

    // Computed
    filteredTenancies,

    // Actions
    loadTenancies,
    loadTenancy,
    toggleExpanded,
    openPersonDrawer,
    closePersonDrawer,
    setActiveTab,
    setSearch,
    setSort,

    // Helpers
    getStatusColor,
    getStatusLabel,
    getSectionLabel,

    // Re-referencing actions
    getActionRequiredDetails,
    uploadDocument,
    updateRefereeEmail,
    resendForm,
    submitForReReferencing
  }
}
