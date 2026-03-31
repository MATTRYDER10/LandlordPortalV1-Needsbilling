<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Contractors</h2>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="showArchived" @change="reloadContractors" class="rounded text-primary" />
          <span class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Show archived</span>
        </label>
        <button @click="showContractorModal = true" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg transition-colors">
          Add Contractor
        </button>
      </div>
    </div>

    <!-- Contractor list -->
    <div v-if="store.contractors.length === 0 && !store.loading" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No contractors added yet. Add your first contractor to start uploading invoices.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="contractor in store.contractors"
        :key="contractor.id"
        :class="['rounded-xl border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']"
      >
        <!-- Card header -->
        <div class="px-5 py-4 flex items-center justify-between">
          <div class="cursor-pointer" @click="toggleExpand(contractor)">
            <p class="font-medium text-primary hover:underline">{{ contractor.name }}</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              {{ contractor.company_name || '' }}
              <span v-if="contractor.email"> &middot; {{ contractor.email }}</span>
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div v-if="contractor.pi_policy_number" class="text-right">
              <p :class="['text-xs uppercase', isDark ? 'text-slate-400' : 'text-gray-500']">PI Policy</p>
              <p class="text-xs">{{ contractor.pi_policy_number }}</p>
              <p v-if="contractor.pi_expiry_date" :class="['text-xs', isPIExpired(contractor.pi_expiry_date) ? 'text-red-500 font-medium' : 'text-gray-400']">
                {{ isPIExpired(contractor.pi_expiry_date) ? 'EXPIRED' : 'Exp: ' + formatDate(contractor.pi_expiry_date) }}
              </p>
            </div>
            <div v-else class="text-right">
              <p :class="['text-xs text-amber-500']">No PI on file</p>
            </div>
            <div class="text-right">
              <p :class="['text-xs uppercase', isDark ? 'text-slate-400' : 'text-gray-500']">Commission</p>
              <p class="font-medium">{{ contractor.commission_percent }}%{{ contractor.commission_vat ? ' + VAT' : '' }}</p>
            </div>
            <span v-if="contractor.archived_at" class="px-2 py-0.5 text-xs bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full">Archived</span>
            <template v-if="!contractor.archived_at">
              <button
                @click="openInvoiceUpload(contractor)"
                class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-orange-600 rounded-lg"
              >
                Upload Invoice
              </button>
              <button
                @click="editContractor(contractor)"
                :class="['px-3 py-1.5 text-xs font-medium rounded-lg', isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200']"
              >
                Edit
              </button>
              <button
                @click="deleteContractor(contractor)"
                class="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 rounded-lg"
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
        <div v-if="expandedId === contractor.id" :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']">
          <!-- Contractor details -->
          <div :class="['px-5 py-4 grid grid-cols-3 gap-4 text-sm', isDark ? 'bg-slate-800/50' : 'bg-gray-50']">
            <div>
              <p :class="['text-xs uppercase', isDark ? 'text-slate-400' : 'text-gray-500']">Phone</p>
              <p>{{ contractor.phone || '—' }}</p>
            </div>
            <div>
              <p :class="['text-xs uppercase', isDark ? 'text-slate-400' : 'text-gray-500']">Bank Details</p>
              <p>{{ contractor.bank_details?.account_name || '—' }}</p>
              <p v-if="contractor.bank_details?.sort_code">{{ contractor.bank_details.sort_code }} / ****{{ (contractor.bank_details.account_number || '').slice(-4) }}</p>
            </div>
            <div>
              <p :class="['text-xs uppercase', isDark ? 'text-slate-400' : 'text-gray-500']">Notes</p>
              <p>{{ contractor.notes || '—' }}</p>
            </div>
          </div>

          <!-- Transaction history -->
          <div class="px-5 py-4">
            <p :class="['text-xs uppercase font-medium mb-3', isDark ? 'text-slate-400' : 'text-gray-500']">Invoice History</p>

            <div v-if="loadingInvoices" class="text-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
            </div>

            <div v-else-if="contractorInvoices.length === 0" :class="['text-sm py-3', isDark ? 'text-slate-500' : 'text-gray-400']">
              No invoices yet.
            </div>

            <table v-else class="w-full text-sm">
              <thead>
                <tr :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                  <th class="text-left py-2 text-xs uppercase">Date</th>
                  <th class="text-left py-2 text-xs uppercase">Invoice #</th>
                  <th class="text-left py-2 text-xs uppercase">Property</th>
                  <th class="text-right py-2 text-xs uppercase">Gross</th>
                  <th class="text-right py-2 text-xs uppercase">Commission</th>
                  <th class="text-right py-2 text-xs uppercase">Payout</th>
                  <th class="text-center py-2 text-xs uppercase">Status</th>
                  <th class="text-right py-2 text-xs uppercase">Invoice</th>
                  <th class="text-right py-2 text-xs uppercase">Remittance</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="inv in contractorInvoices"
                  :key="inv.id"
                  :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']"
                >
                  <td class="py-2">{{ formatDate(inv.invoice_date) }}</td>
                  <td class="py-2">{{ inv.invoice_number }}</td>
                  <td class="py-2">{{ inv.property_address || '—' }}</td>
                  <td class="py-2 text-right">&pound;{{ formatMoney(inv.gross_amount) }}</td>
                  <td class="py-2 text-right">&pound;{{ formatMoney(inv.commission_net) }}</td>
                  <td class="py-2 text-right font-medium">&pound;{{ formatMoney(inv.payout_amount) }}</td>
                  <td class="py-2 text-center">
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs rounded-full',
                        inv.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        inv.status === 'charged' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      ]"
                    >{{ inv.status }}</span>
                  </td>
                  <td class="py-2 text-right">
                    <a v-if="inv.pdf_path" :href="inv.pdf_path" target="_blank" class="text-primary hover:underline text-xs">Download</a>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                  <td class="py-2 text-right">
                    <button v-if="inv.remittance_pdf_path" @click="downloadRemittance(inv.id)" class="text-primary hover:underline text-xs">Download</button>
                    <span v-else-if="inv.status === 'paid'" class="text-gray-400 text-xs">Pending</span>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Expand toggle -->
        <div :class="['px-5 py-2 border-t', isDark ? 'border-slate-700' : 'border-gray-100']">
          <button @click="toggleExpand(contractor)" class="text-sm text-primary hover:underline">
            {{ expandedId === contractor.id ? 'Hide details' : 'View details' }}
          </button>
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
import { ref, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type Contractor } from '../../stores/rentgoose'
import { useApi } from '../../composables/useApi'
import ContractorModal from './ContractorModal.vue'
import InvoiceUploadModal from './InvoiceUploadModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const { get, post, del } = useApi()
const showArchived = ref(false)

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
  if (!dateStr) return '—'
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
