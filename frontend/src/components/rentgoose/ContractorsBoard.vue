<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-[15px] font-semibold text-primary">Contractors</h2>
      <div class="flex items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search contractors..."
          class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white w-56 focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="showArchived" @change="reloadContractors" class="rounded text-primary" />
          <span class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Show archived</span>
        </label>
        <button @click="showContractorModal = true" class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors">
          Add Contractor
        </button>
      </div>
    </div>

    <!-- Contractor list -->
    <div v-if="filteredContractors.length === 0 && !store.loading" class="flex flex-col items-center justify-center py-16">
      <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No contractors added yet</p>
      <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Add your first contractor to start uploading invoices and managing payouts.</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="contractor in filteredContractors"
        :key="contractor.id"
        :class="['rounded-[10px] border overflow-hidden transition-colors', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 hover:border-gray-300']"
      >
        <!-- Card header -->
        <div class="px-5 py-4 flex items-center justify-between min-h-[52px]">
          <!-- LEFT: name + company/email -->
          <div class="cursor-pointer flex-1" @click="toggleExpand(contractor)">
            <p class="font-semibold text-sm text-gray-900 dark:text-white">{{ contractor.name }}</p>
            <p :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">
              {{ contractor.company_name || '' }}
              <span v-if="contractor.email"> &middot; {{ contractor.email }}</span>
            </p>
          </div>

          <!-- CENTRE: commission pill + PI warning -->
          <div class="flex items-center gap-3 mx-4">
            <span class="bg-[#eff6ff] text-[#1d4ed8] rounded-full text-xs font-medium px-2.5 py-0.5">
              {{ contractor.commission_percent }}%{{ contractor.commission_vat ? ' + VAT' : '' }}
            </span>
            <span v-if="!contractor.pi_policy_number" class="bg-[#fef3c7] text-[#b45309] rounded-full text-xs font-medium px-2.5 py-0.5">
              ⚠ No PI on file
            </span>
            <template v-else>
              <span v-if="isPIExpired(contractor.pi_expiry_date)" class="bg-[#fee2e2] text-[#b91c1c] rounded-full text-xs font-medium px-2.5 py-0.5">
                PI Expired
              </span>
              <span v-else class="text-xs text-gray-400 dark:text-slate-500">
                PI Exp: {{ formatDate(contractor.pi_expiry_date) }}
              </span>
            </template>
            <span v-if="contractor.archived_at" class="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full text-xs font-medium px-2.5 py-0.5">Archived</span>
          </div>

          <!-- RIGHT: buttons -->
          <div class="flex items-center gap-2">
            <template v-if="!contractor.archived_at">
              <button
                @click="openInvoiceUpload(contractor)"
                class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2 text-xs transition-colors"
              >
                Upload Invoice
              </button>
              <button
                @click="editContractor(contractor)"
                class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Edit
              </button>
              <button
                @click="deleteContractor(contractor)"
                class="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </template>
            <button
              v-else
              @click="restoreContractor(contractor)"
              class="px-3 py-1.5 text-xs font-medium text-primary hover:underline"
            >
              Restore
            </button>
          </div>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedId === contractor.id" :class="['border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <!-- Contractor details -->
          <div :class="['px-5 py-4 grid grid-cols-3 gap-4 text-sm', isDark ? 'bg-slate-800/50' : 'bg-[#f9fafb]']">
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Phone</p>
              <p>{{ contractor.phone || '---' }}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Bank Details</p>
              <p>{{ contractor.bank_details?.account_name || '---' }}</p>
              <p v-if="contractor.bank_details?.sort_code">{{ contractor.bank_details.sort_code }} / ****{{ (contractor.bank_details.account_number || '').slice(-4) }}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Notes</p>
              <p>{{ contractor.notes || '---' }}</p>
            </div>
          </div>

          <!-- Transaction history -->
          <div class="px-5 py-4">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold mb-3">Invoice History</p>

            <div v-if="loadingInvoices" class="text-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
            </div>

            <div v-else-if="contractorInvoices.length === 0" class="text-[13px] text-gray-500 dark:text-slate-400 py-3 text-center">
              No invoices yet.
            </div>

            <div v-else :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
              <table class="w-full text-sm">
                <thead>
                  <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                    <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Date</th>
                    <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Invoice #</th>
                    <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Property</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Gross</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Commission</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Payout</th>
                    <th class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Status</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Invoice</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Remittance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(inv, idx) in contractorInvoices"
                    :key="inv.id"
                    :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? 'bg-[#f9fafb] dark:bg-slate-800/50' : '']"
                  >
                    <td class="px-4 py-3">{{ formatDate(inv.invoice_date) }}</td>
                    <td class="px-4 py-3">{{ inv.invoice_number }}</td>
                    <td class="px-4 py-3">{{ inv.property_address || '---' }}</td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums">&pound;{{ formatMoney(inv.gross_amount) }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">&pound;{{ formatMoney(inv.commission_net) }}</td>
                    <td class="px-4 py-3 text-right font-medium tabular-nums">&pound;{{ formatMoney(inv.payout_amount) }}</td>
                    <td class="px-4 py-3 text-center">
                      <span
                        :class="[
                          'px-2.5 py-0.5 text-xs font-medium rounded-full',
                          inv.status === 'paid' ? 'bg-[#dcfce7] text-[#15803d]' :
                          inv.status === 'charged' ? 'bg-[#eff6ff] text-[#1d4ed8]' :
                          'bg-[#fef3c7] text-[#b45309]'
                        ]"
                      >{{ inv.status }}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <a v-if="inv.pdf_path" :href="inv.pdf_path" target="_blank" class="text-primary hover:underline text-xs">Download</a>
                      <span v-else class="text-gray-400 dark:text-slate-500">---</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button v-if="inv.remittance_pdf_path" @click="downloadRemittance(inv.id)" class="text-primary hover:underline text-xs">Download</button>
                      <span v-else-if="inv.status === 'paid'" class="text-gray-400 dark:text-slate-500 text-xs">Pending</span>
                      <span v-else class="text-gray-400 dark:text-slate-500">---</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Contractor Modal -->
    <ContractorModal
      v-if="showContractorModal"
      :contractor="selectedContractor"
      @close="showContractorModal = false"
      @saved="onContractorSaved"
    />

    <!-- Invoice Upload Modal -->
    <InvoiceUploadModal
      v-if="showInvoiceModal && selectedContractor"
      :contractor="selectedContractor"
      @close="showInvoiceModal = false"
      @uploaded="onInvoiceUploaded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type Contractor } from '../../stores/rentgoose'
import { useApi } from '../../composables/useApi'
import ContractorModal from './ContractorModal.vue'
import InvoiceUploadModal from './InvoiceUploadModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const { get, post, del } = useApi()
const showArchived = ref(false)
const searchQuery = ref('')

const filteredContractors = computed(() => {
  if (!searchQuery.value.trim()) return store.contractors
  const q = searchQuery.value.toLowerCase()
  return store.contractors.filter((c: any) =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.company_name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.notes || '').toLowerCase().includes(q)
  )
})

const showContractorModal = ref(false)
const showInvoiceModal = ref(false)
const selectedContractor = ref<Contractor | null>(null)
const expandedId = ref<string | null>(null)
const loadingInvoices = ref(false)
const contractorInvoices = ref<any[]>([])

function editContractor(c: Contractor) {
  selectedContractor.value = c
  showContractorModal.value = true
}

function openInvoiceUpload(c: Contractor) {
  selectedContractor.value = c
  showInvoiceModal.value = true
}

async function toggleExpand(c: Contractor) {
  if (expandedId.value === c.id) {
    expandedId.value = null
    return
  }
  expandedId.value = c.id
  loadingInvoices.value = true
  try {
    const data = await get<any[]>(`/api/contractors/${c.id}/invoices`)
    contractorInvoices.value = data || []
  } catch (err) {
    console.error('Failed to fetch invoices:', err)
    contractorInvoices.value = []
  } finally {
    loadingInvoices.value = false
  }
}

function onContractorSaved() {
  showContractorModal.value = false
  selectedContractor.value = null
  store.fetchContractors()
}

function onInvoiceUploaded() {
  showInvoiceModal.value = false
  if (expandedId.value) {
    const c = store.contractors.find(c => c.id === expandedId.value)
    if (c) toggleExpand(c) // Refresh invoices
  }
}

async function deleteContractor(c: Contractor) {
  if (!confirm(`Delete ${c.name}? If they have invoice history they will be archived instead.`)) return
  try {
    const result = await del<any>(`/api/contractors/${c.id}`)
    if (result.archived) {
      alert(`${c.name} has been archived (invoice history exists)`)
    }
    reloadContractors()
  } catch (err) {
    console.error('Failed to delete contractor:', err)
  }
}

async function restoreContractor(c: Contractor) {
  try {
    await post(`/api/contractors/${c.id}/restore`, {})
    reloadContractors()
  } catch (err) {
    console.error('Failed to restore contractor:', err)
  }
}

async function reloadContractors() {
  // Re-fetch with or without archived
  try {
    const data = await get<any>(`/api/contractors${showArchived.value ? '?include_archived=true' : ''}`)
    store.contractors = data.contractors || []
  } catch (err) {
    console.error('Failed to reload contractors:', err)
  }
}

async function downloadRemittance(invoiceId: string) {
  try {
    const result = await get<any>(`/api/contractors/invoice/${invoiceId}/remittance`)
    if (result.url) window.open(result.url, '_blank')
  } catch (err) {
    console.error('Failed to download remittance:', err)
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  if (!dateStr) return '---'
  return new Date(dateStr).toLocaleDateString('en-GB')
}

function isPIExpired(dateStr: string) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

onMounted(() => {
  store.fetchContractors()
})
</script>
