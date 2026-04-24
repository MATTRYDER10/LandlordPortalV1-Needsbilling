<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Send Move-In Pack</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ propertyAddress }}</p>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          <!-- Documents Section -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Documents to Include
            </h4>
            <div class="space-y-2">
              <!-- Signed Agreement -->
              <label
                v-if="signedAgreementUrl"
                class="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="includeAgreement"
                  class="w-4 h-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <FileCheck class="w-5 h-5 text-green-600" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Signed Tenancy Agreement</span>
                  <span class="text-xs text-green-600 ml-2">Fully Executed</span>
                </div>
              </label>

              <!-- Compliance Documents -->
              <label
                v-for="doc in complianceDocuments"
                :key="doc.id"
                class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="selectedDocuments"
                  :value="doc.id"
                  class="w-4 h-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <component :is="getDocIcon(doc.type)" class="w-5 h-5 text-gray-500 dark:text-slate-400" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDocType(doc.type) }}</span>
                  <span v-if="doc.expiry_date" class="text-xs text-gray-500 dark:text-slate-400 ml-2">
                    Expires {{ formatDate(doc.expiry_date) }}
                  </span>
                </div>
              </label>

              <!-- How to Rent Guide (always included) -->
              <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <CheckCircle class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <Book class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">How to Rent Guide</span>
                  <span class="text-xs text-blue-600 dark:text-blue-400 ml-2">Always included (Gov.uk)</span>
                </div>
              </div>

              <!-- Renters' Rights Act 2026 (auto-attached until May 31 2026) -->
              <div v-if="showRentersRightsAct" class="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <CheckCircle class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <FileText class="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Renters' Rights Act 2026</span>
                  <span class="text-xs text-amber-600 dark:text-amber-400 ml-2">Auto-attached until 31 May 2026</span>
                </div>
              </div>

              <p v-if="complianceDocuments.length === 0 && !signedAgreementUrl" class="text-sm text-gray-500 dark:text-slate-400 italic py-2">
                No compliance documents available for this property.
              </p>
            </div>
          </div>

          <!-- Management Information Section -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Management Information
            </h4>

            <div class="p-4 rounded-lg" :class="isManaged ? 'bg-primary/5 border border-primary/20' : 'bg-amber-50 border border-amber-200'">
              <div class="flex items-start gap-3">
                <component
                  :is="isManaged ? Building2 : User"
                  class="w-5 h-5 mt-0.5"
                  :class="isManaged ? 'text-primary' : 'text-amber-600'"
                />
                <div class="flex-1">
                  <p class="text-sm font-medium" :class="isManaged ? 'text-primary' : 'text-amber-700'">
                    {{ isManaged ? 'Managed by Agent' : 'Let Only - Landlord Managed' }}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    <template v-if="isManaged">
                      {{ managementInfo || 'No management information set. Please add this in Settings.' }}
                    </template>
                    <template v-else>
                      This tenancy is managed by the landlord directly. For any issues please contact them:
                      <br />
                      <strong>{{ landlordName }}</strong>
                      <span v-if="landlordPhone"> - {{ landlordPhone }}</span>
                      <span v-if="landlordEmail"> - {{ landlordEmail }}</span>
                    </template>
                  </p>
                </div>
              </div>
            </div>

            <p v-if="isManaged && !managementInfo" class="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle class="w-3 h-3" />
              Add management information in Settings to tell tenants how to report maintenance.
            </p>
          </div>

          <!-- Rent Payment Section -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Rent Payment Details
            </h4>

            <div class="space-y-4">
              <!-- Bank Details (Editable) -->
              <div class="p-4 bg-gray-50 dark:bg-slate-800 border rounded-lg" :class="bankDetailsComplete ? 'border-gray-200 dark:border-slate-700' : 'border-red-300 dark:border-red-700'">
                <div class="flex items-start gap-3">
                  <Landmark class="w-5 h-5 text-gray-500 dark:text-slate-400 mt-0.5" />
                  <div class="flex-1 space-y-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-medium text-gray-700 dark:text-slate-300">
                        {{ isManaged ? 'Agent Bank Details' : 'Landlord Bank Details' }}
                      </p>
                      <span class="text-xs text-red-500" v-if="!bankDetailsComplete">* Required</span>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                      <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Account Name *</label>
                        <input
                          v-model="editableBankAccountName"
                          type="text"
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                          placeholder="Account holder name"
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sort Code *</label>
                          <input
                            v-model="editableBankSortCode"
                            type="text"
                            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            placeholder="00-00-00"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Account Number *</label>
                          <input
                            v-model="editableBankAccountNumber"
                            type="text"
                            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            placeholder="00000000"
                          />
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Payment Reference</label>
                        <input
                          v-model="paymentReference"
                          type="text"
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                          placeholder="e.g. 32ricesmews"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="!bankDetailsComplete" class="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle class="w-3 h-3" />
                Bank details are required. Missing: {{ bankDetailsMissing.join(', ') }}
              </p>
            </div>
          </div>

          <!-- Additional Information Section -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Additional Information
            </h4>
            <textarea
              v-model="additionalInfo"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              placeholder="Add any additional information to include in the move-in pack email..."
            ></textarea>
          </div>

          <!-- Recipients Preview -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Recipients
            </h4>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="tenant in tenantsWithEmail"
                :key="tenant.id"
                class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-full text-sm"
              >
                <Mail class="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span class="font-medium text-gray-900 dark:text-white">{{ tenant.first_name }} {{ tenant.last_name }}</span>
                <span class="text-gray-500 dark:text-slate-400">{{ tenant.email }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex-shrink-0 rounded-b-xl">
          <p class="text-sm text-gray-500 dark:text-slate-400">
            {{ selectedDocuments.length + (includeAgreement ? 1 : 0) }} documents selected
          </p>
          <div class="flex items-center gap-3">
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleSend"
              :disabled="sending || tenantsWithEmail.length === 0 || !bankDetailsComplete"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Send v-if="!sending" class="w-4 h-4" />
              <Loader2 v-else class="w-4 h-4 animate-spin" />
              {{ sending ? 'Sending...' : 'Send Move-In Pack' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X, FileCheck, Book, CheckCircle, Building2, User, AlertCircle,
  Landmark, Mail, Send, Loader2, FileText, Flame, Zap, ShieldCheck,
  Droplets, BellRing, PlugZap
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'
const authStore = useAuthStore()
const toast = useToast()

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

interface ComplianceDoc {
  id: string
  type: string
  file_url: string
  expiry_date: string | null
}

interface BankDetails {
  accountName: string
  sortCode: string
  accountNumber: string
}

const props = defineProps<{
  open: boolean
  tenancyId: string
  propertyAddress: string
  managementType: 'managed' | 'let_only' | null
  tenants: Tenant[]
  complianceDocuments: ComplianceDoc[]
  signedAgreementUrl: string | null
  landlordName: string
  landlordPhone: string | null
  landlordEmail: string | null
  landlordBankDetails: BankDetails
  agentBankDetails: BankDetails
  managementInfo: string | null
}>()

const emit = defineEmits<{
  close: []
  sent: []
}>()

// State
const sending = ref(false)
const includeAgreement = ref(true)
const selectedDocuments = ref<string[]>([])
const additionalInfo = ref('')
const paymentReference = ref('')

// Editable bank details (pre-filled from landlord/agent but can be edited)
const editableBankAccountName = ref('')
const editableBankSortCode = ref('')
const editableBankAccountNumber = ref('')

// Computed
const isManaged = computed(() => props.managementType === 'managed')

// Show Renters' Rights Act checkbox until May 31 2026
const showRentersRightsAct = computed(() => new Date() < new Date('2026-06-01T00:00:00Z'))

const tenantsWithEmail = computed(() =>
  props.tenants.filter(t => t.email && t.email.trim())
)

const sourceBankDetails = computed(() =>
  isManaged.value ? props.agentBankDetails : props.landlordBankDetails
)

// Computed to check if bank details are complete
const bankDetailsComplete = computed(() =>
  editableBankAccountName.value.trim() &&
  editableBankSortCode.value.trim() &&
  editableBankAccountNumber.value.trim()
)

// Computed for validation message
const bankDetailsMissing = computed(() => {
  const missing: string[] = []
  if (!editableBankAccountName.value.trim()) missing.push('Account Name')
  if (!editableBankSortCode.value.trim()) missing.push('Sort Code')
  if (!editableBankAccountNumber.value.trim()) missing.push('Account Number')
  return missing
})

// Generate payment reference from address
const generatePaymentReference = (address: string): string => {
  if (!address) return ''
  // Take first line, remove special chars, lowercase, no spaces
  const firstLine = address.split(',')[0] || address
  return firstLine
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) // Limit length
}

// Watch for address changes to update payment reference
watch(() => props.propertyAddress, (newAddress) => {
  if (newAddress && !paymentReference.value) {
    paymentReference.value = generatePaymentReference(newAddress)
  }
}, { immediate: true })

// Pre-select all documents and initialize bank details when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedDocuments.value = props.complianceDocuments.map(d => d.id)
    includeAgreement.value = !!props.signedAgreementUrl
    additionalInfo.value = ''
    if (props.propertyAddress) {
      paymentReference.value = generatePaymentReference(props.propertyAddress)
    }
    // Pre-fill bank details from landlord or agent
    editableBankAccountName.value = sourceBankDetails.value.accountName || ''
    editableBankSortCode.value = sourceBankDetails.value.sortCode || ''
    editableBankAccountNumber.value = sourceBankDetails.value.accountNumber || ''
  }
})

// Helpers
const getDocIcon = (type: string) => {
  const icons: Record<string, any> = {
    gas_safety: Flame,
    epc: Zap,
    eicr: PlugZap,
    fire_safety: ShieldCheck,
    legionella: Droplets,
    smoke_alarm: BellRing
  }
  return icons[type] || FileText
}

const formatDocType = (type: string): string => {
  const labels: Record<string, string> = {
    gas_safety: 'Gas Safety Certificate',
    epc: 'Energy Performance Certificate (EPC)',
    eicr: 'Electrical Safety Certificate (EICR)',
    fire_safety: 'Fire Safety Certificate',
    legionella: 'Legionella Risk Assessment',
    smoke_alarm: 'Smoke & CO Alarms Certificate',
    pat_testing: 'PAT Testing Certificate'
  }
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Send handler
const handleSend = async () => {
  if (tenantsWithEmail.value.length === 0) {
    toast.error('No tenants with email addresses')
    return
  }

  if (!bankDetailsComplete.value) {
    toast.error('Please fill in all required bank details')
    return
  }

  sending.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/move-in-pack`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          includeAgreement: includeAgreement.value,
          selectedDocumentIds: selectedDocuments.value,
          additionalInfo: additionalInfo.value,
          paymentReference: paymentReference.value,
          // Send bank details to store on tenancy for reliable retrieval
          bankDetails: {
            accountName: editableBankAccountName.value.trim(),
            sortCode: editableBankSortCode.value.trim(),
            accountNumber: editableBankAccountNumber.value.trim()
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send move-in pack')
    }

    toast.success(`Move-in pack sent to ${tenantsWithEmail.value.length} tenant(s)`)
    emit('sent')
    emit('close')
  } catch (error: any) {
    console.error('Error sending move-in pack:', error)
    toast.error(error.message || 'Failed to send move-in pack')
  } finally {
    sending.value = false
  }
}
</script>
