import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '../composables/useApi'

export interface ScheduleEntry {
  id: string
  tenancy_id: string
  period_start: string
  period_end: string
  amount_due: number
  amount_received: number
  status: string
  due_date: string
  paid_at?: string
  payout_sent_at?: string
  total_charges?: number
  property_address?: string
  property_postcode?: string
  property_id?: string
  landlord_name?: string
  landlord_id?: string
  tenant_names?: string
  tenancy_ref?: string
  fee_percent?: number
  management_type?: string
}

export interface PayoutItem {
  id: string
  schedule_entry_id: string
  property_address: string
  property_postcode: string
  landlord_name: string
  landlord_id: string
  landlord_email?: string
  landlord_bank_name?: string
  landlord_bank_account_last4?: string
  landlord_bank_sort_code?: string
  tenant_names: string
  tenancy_ref: string
  period_start: string
  period_end: string
  gross_rent: number
  charges: any[]
  total_charges: number
  net_payout: number
  statement_ref: string
}

export interface ArrearsItem {
  id: string
  schedule_entry_id: string
  property_address: string
  property_postcode: string
  tenant_name: string
  has_guarantor: boolean
  due_date: string
  amount_outstanding: number
  partial_paid: number
  days_overdue: number
  day7_sent: boolean
  day14_sent: boolean
  day21_sent: boolean
  day28_sent: boolean
  status: string
}

export interface ClientAccountEntry {
  id: string
  entry_type: string
  amount: number
  description: string
  reference: string | null
  balance_after: number
  created_by: string | null
  is_manual: boolean
  created_at: string
}

export interface Contractor {
  id: string
  name: string
  company_name: string | null
  email: string | null
  phone: string | null
  bank_details: {
    account_name: string | null
    account_number: string | null
    sort_code: string | null
  }
  commission_percent: number
  commission_vat: boolean
  notes: string | null
}

export const useRentGooseStore = defineStore('rentgoose', () => {
  const { get, post } = useApi()

  // State
  const activeTab = ref('collection')
  const loading = ref(false)
  const scheduleEntries = ref<ScheduleEntry[]>([])
  const statusCounts = ref<Record<string, number>>({})
  const summary = ref({ collectedToday: 0, dueToday: 0, overdueTotal: 0, payoutsReady: 0 })
  const statusFilter = ref('all')

  const payouts = ref<PayoutItem[]>([])
  const arrears = ref<ArrearsItem[]>([])
  const clientAccount = ref<{ entries: ClientAccountEntry[]; current_balance: number }>({ entries: [], current_balance: 0 })
  const agentFees = ref<any>(null)
  const contractors = ref<Contractor[]>([])

  // Actions
  async function fetchSchedule(filters?: Record<string, string>) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters?.landlord_id) params.set('landlord_id', filters.landlord_id)
      if (filters?.property_id) params.set('property_id', filters.property_id)

      const data = await get<any>(`/api/rentgoose/schedule?${params.toString()}`)
      scheduleEntries.value = data.entries || []
      statusCounts.value = data.statusCounts || {}
      summary.value = data.summary || { collectedToday: 0, dueToday: 0, overdueTotal: 0, payoutsReady: 0 }
    } catch (err) {
      console.error('Failed to fetch schedule:', err)
    } finally {
      loading.value = false
    }
  }

  async function receiptPayment(payload: any) {
    const result = await post<any>('/api/rentgoose/receipt', payload)
    await fetchSchedule({ status: statusFilter.value })
    return result
  }

  async function fetchPayouts() {
    loading.value = true
    try {
      const data = await get<any>('/api/rentgoose/payouts')
      payouts.value = data.payouts || []
    } catch (err) {
      console.error('Failed to fetch payouts:', err)
    } finally {
      loading.value = false
    }
  }

  async function markPaid(payload: any) {
    const result = await post<any>('/api/rentgoose/payout', payload)
    await fetchPayouts()
    return result
  }

  async function batchPayout(payload: any) {
    const result = await post<any>('/api/rentgoose/payout/batch', payload)
    await fetchPayouts()
    return result
  }

  async function fetchArrears() {
    loading.value = true
    try {
      const data = await get<any>('/api/rentgoose/arrears')
      arrears.value = data.arrears || []
    } catch (err) {
      console.error('Failed to fetch arrears:', err)
    } finally {
      loading.value = false
    }
  }

  async function resolveArrears(id: string) {
    await post('/api/rentgoose/arrears/resolve', { id })
    await fetchArrears()
  }

  async function fetchClientAccount() {
    loading.value = true
    try {
      const data = await get<any>('/api/rentgoose/client-account')
      clientAccount.value = data
    } catch (err) {
      console.error('Failed to fetch client account:', err)
    } finally {
      loading.value = false
    }
  }

  async function addManualEntry(payload: any) {
    await post('/api/rentgoose/client-account/manual', payload)
    await fetchClientAccount()
  }

  async function reconcile(payload: any) {
    return await post<any>('/api/rentgoose/client-account/reconcile', payload)
  }

  async function fetchAgentFees() {
    loading.value = true
    try {
      const data = await get<any>('/api/rentgoose/fees')
      agentFees.value = data
    } catch (err) {
      console.error('Failed to fetch agent fees:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchContractors() {
    try {
      const data = await get<any>('/api/contractors')
      contractors.value = data.contractors || []
    } catch (err) {
      console.error('Failed to fetch contractors:', err)
    }
  }

  async function uploadContractorInvoice(payload: any) {
    return await post<any>('/api/rentgoose/contractor-invoice', payload)
  }

  async function markContractorPaid(invoiceId: string) {
    return await post<any>('/api/rentgoose/contractor-payout', { invoice_id: invoiceId })
  }

  // Computed
  const filteredEntries = computed(() => {
    if (statusFilter.value === 'all') return scheduleEntries.value
    return scheduleEntries.value.filter(e => e.status === statusFilter.value)
  })

  return {
    activeTab,
    loading,
    scheduleEntries,
    statusCounts,
    summary,
    statusFilter,
    filteredEntries,
    payouts,
    arrears,
    clientAccount,
    agentFees,
    contractors,
    fetchSchedule,
    receiptPayment,
    fetchPayouts,
    markPaid,
    batchPayout,
    fetchArrears,
    resolveArrears,
    fetchClientAccount,
    addManualEntry,
    reconcile,
    fetchAgentFees,
    fetchContractors,
    uploadContractorInvoice,
    markContractorPaid,
  }
})
