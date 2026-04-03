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
  rent_credit_amount?: number
  rent_credit_reason?: string
  original_amount_due?: number
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

export interface UnifiedPaymentItem {
  id: string
  item_type: 'rent' | 'expected_payment'
  payment_type: string
  tenancy_id?: string
  property_id?: string
  property_address?: string
  property_postcode?: string
  tenant_name?: string
  tenant_names?: string
  landlord_name?: string
  landlord_id?: string
  description: string
  amount_due: number
  amount_received: number
  status: string
  due_date?: string
  paid_at?: string
  payout_type?: string
  payout_split?: Array<{ type: string; amount: number; description: string }>
  source_type?: string
  source_id?: string
  period_start?: string
  period_end?: string
  fee_percent?: number
  management_type?: string
  tenancy_ref?: string
  payout_sent_at?: string
  total_charges?: number
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

  // Unified payments state
  const unifiedItems = ref<UnifiedPaymentItem[]>([])
  const categoryCounts = ref<Record<string, number>>({ all: 0, rent: 0, pre_tenancy: 0, invoices: 0, arrears: 0 })
  const categoryFilter = ref<'all' | 'rent' | 'pre_tenancy' | 'invoices' | 'arrears'>('all')
  const unifiedSummary = ref({ collected: 0, due: 0, arrears: 0, payoutsReady: 0, agentFees: 0 })

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

  async function applyRentCredit(payload: { schedule_entry_id: string; credit_amount: number; reason: string }) {
    const result = await post<any>('/api/rentgoose/rent-credit', payload)
    await fetchSchedule({ status: statusFilter.value })
    await fetchUnifiedSchedule({ status: statusFilter.value })
    return result
  }

  async function fetchUnifiedSchedule(filters?: Record<string, string>) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (categoryFilter.value && categoryFilter.value !== 'all') params.set('category', categoryFilter.value)
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters?.payment_type) params.set('payment_type', filters.payment_type)

      const data = await get<any>(`/api/rentgoose/unified-schedule?${params.toString()}`)
      unifiedItems.value = data.items || []
      categoryCounts.value = data.categoryCounts || { all: 0, rent: 0, pre_tenancy: 0, invoices: 0, arrears: 0 }
      unifiedSummary.value = data.summary || { collected: 0, due: 0, arrears: 0, payoutsReady: 0, agentFees: 0 }
    } catch (err) {
      console.error('Failed to fetch unified schedule:', err)
    } finally {
      loading.value = false
    }
  }

  async function receiptExpectedPayment(payload: any) {
    const result = await post<any>('/api/rentgoose/receipt-expected', payload)
    await fetchUnifiedSchedule({ status: statusFilter.value })
    return result
  }

  async function fetchHoldingDepositCredit(tenancyId: string) {
    try {
      return await get<any>(`/api/rentgoose/holding-deposit-credit/${tenancyId}`)
    } catch (err) {
      console.error('Failed to fetch holding deposit credit:', err)
      return { available: false, amount: 0, expected_payment_id: null }
    }
  }

  const filteredUnifiedItems = computed(() => {
    if (statusFilter.value === 'paid') return unifiedItems.value.filter(item => item.status === 'paid')
    if (statusFilter.value === 'all') return unifiedItems.value.filter(item => item.status !== 'paid' && item.status !== 'cancelled')
    return unifiedItems.value.filter(item => item.status === statusFilter.value)
  })

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
    unifiedItems,
    categoryCounts,
    categoryFilter,
    unifiedSummary,
    filteredUnifiedItems,
    fetchUnifiedSchedule,
    receiptExpectedPayment,
    fetchHoldingDepositCredit,
  }
})
