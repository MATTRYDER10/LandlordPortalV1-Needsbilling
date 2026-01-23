<template>
  <div class="p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900">Agreement History</h2>
      <p class="mt-2 text-gray-600">View, sign, and manage previously generated agreements</p>
    </div>

    <!-- Search Box -->
    <div class="mb-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="h-5 w-5 text-gray-400" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
          placeholder="Search by property address or tenant name..."
        />
      </div>
    </div>

    <!-- Agreements Table -->
    <div class="bg-white rounded-lg shadow">
      <div v-if="loadingAgreements" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading agreements...</p>
      </div>

      <div v-else-if="filteredAgreements.length === 0" class="text-center py-12">
        <FileText class="mx-auto h-12 w-12 text-gray-400" />
        <p class="mt-2 text-gray-600">{{ searchQuery ? 'No agreements match your search' : 'No agreements created yet' }}</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property Address
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant(s)
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Template
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="agreement in filteredAgreements" :key="agreement.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ formatPropertyAddress(agreement.property_address) }}
                </div>
                <div v-if="agreement.language === 'welsh'" class="text-xs text-gray-500">Welsh Occupation Contract</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ getTenantNames(agreement.tenants) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {{ formatTemplateType(agreement.template_type) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getSigningStatusClass(agreement.signing_status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ getSigningStatusLabel(agreement.signing_status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(agreement.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="relative actions-menu-container inline-block">
                  <button
                    @click.stop="toggleActionsMenu(agreement.id)"
                    class="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                    title="Actions"
                  >
                    <MoreVertical class="w-5 h-5" />
                  </button>
                  <div
                    v-if="actionsMenuOpen === agreement.id"
                    class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
                  >
                    <div class="py-1">
                      <!-- Download -->
                      <button
                        v-if="canDownload(agreement)"
                        @click.stop="downloadAgreement(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Download class="w-4 h-4 mr-2" />
                        {{ agreement.signed_pdf_url ? 'Download Signed PDF' : 'Download PDF' }}
                      </button>

                      <!-- Generate PDF (draft without PDF) -->
                      <button
                        v-if="canGeneratePdf(agreement)"
                        @click.stop="generatePdf(agreement); actionsMenuOpen = null"
                        :disabled="generatingPdf === agreement.id"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <FileText class="w-4 h-4 mr-2" />
                        {{ generatingPdf === agreement.id ? 'Generating...' : 'Generate PDF' }}
                      </button>

                      <!-- Preview & Send (draft with PDF) -->
                      <button
                        v-if="canPreview(agreement)"
                        @click.stop="goToPreview(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Eye class="w-4 h-4 mr-2" />
                        Preview & Send
                      </button>

                      <!-- View Signing Status -->
                      <button
                        v-if="canViewSigningStatus(agreement)"
                        @click.stop="openStatusModal(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <ClipboardCheck class="w-4 h-4 mr-2" />
                        View Signing Status
                      </button>

                      <!-- Send for Signing (draft only) -->
                      <button
                        v-if="canSendForSigning(agreement)"
                        @click.stop="openSigningModal(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Send class="w-4 h-4 mr-2" />
                        Send for Signing
                      </button>

                      <!-- Edit -->
                      <button
                        v-if="canEdit(agreement)"
                        @click.stop="openEditModal(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil class="w-4 h-4 mr-2" />
                        Edit Agreement
                      </button>

                      <!-- Divider before destructive action -->
                      <div v-if="canDelete(agreement)" class="border-t border-gray-100 my-1"></div>

                      <!-- Delete -->
                      <button
                        v-if="canDelete(agreement)"
                        @click.stop="confirmDelete(agreement); actionsMenuOpen = null"
                        class="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        <Trash2 class="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Send for Signing Modal -->
    <div v-if="showSigningModal && selectedAgreement" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl mx-4 p-6 w-full">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Send for Electronic Signing</h3>
          <button @click="showSigningModal = false" class="text-gray-400 hover:text-gray-500">
            <X class="h-6 w-6" />
          </button>
        </div>

        <div class="mb-4 p-4 bg-blue-50 rounded-lg">
          <p class="text-sm text-blue-800">
            <strong>{{ formatPropertyAddress(selectedAgreement.property_address) }}</strong>
          </p>
        </div>

        <p class="text-sm text-gray-600 mb-4">
          The following parties will receive an email with a secure link to sign the agreement:
        </p>

        <div class="space-y-3 mb-6">
          <!-- Landlords -->
          <div v-for="(landlord, index) in selectedAgreement.landlords" :key="`landlord-${index}`"
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span class="text-sm font-medium text-gray-900">{{ landlord.name }}</span>
              <span class="text-xs text-gray-500 ml-2">(Landlord)</span>
            </div>
            <span class="text-sm text-gray-500">{{ selectedAgreement.landlord_email || 'No email' }}</span>
          </div>

          <!-- Tenants -->
          <div v-for="(tenant, index) in selectedAgreement.tenants" :key="`tenant-${index}`"
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span class="text-sm font-medium text-gray-900">{{ tenant.name }}</span>
              <span class="text-xs text-gray-500 ml-2">(Tenant)</span>
            </div>
            <span class="text-sm text-gray-500">{{ selectedAgreement.tenant_email || 'No email' }}</span>
          </div>

          <!-- Guarantors -->
          <div v-for="(guarantor, index) in selectedAgreement.guarantors" :key="`guarantor-${index}`"
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span class="text-sm font-medium text-gray-900">{{ guarantor.name }}</span>
              <span class="text-xs text-gray-500 ml-2">(Guarantor)</span>
            </div>
            <span class="text-sm text-gray-500">Email required</span>
          </div>
        </div>

        <div class="p-3 bg-yellow-50 rounded-lg mb-6">
          <p class="text-sm text-yellow-800">
            <strong>Note:</strong> All parties will receive their signing emails simultaneously.
            Reminders will be sent automatically every 24 hours until signed.
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="showSigningModal = false"
            class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="initiateSigning"
            :disabled="initiatingSign"
            class="px-4 py-2 text-white font-medium bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {{ initiatingSign ? 'Sending...' : 'Send Signing Emails' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Signing Status Modal -->
    <div v-if="showStatusModal && selectedAgreement" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl mx-4 p-6 w-full">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Signing Status</h3>
          <button @click="showStatusModal = false" class="text-gray-400 hover:text-gray-500">
            <X class="h-6 w-6" />
          </button>
        </div>

        <div class="mb-4 p-4 bg-blue-50 rounded-lg">
          <p class="text-sm text-blue-800">
            <strong>{{ formatPropertyAddress(selectedAgreement.property_address) }}</strong>
          </p>
          <p class="text-xs text-blue-600 mt-1">
            Status: <span class="font-medium">{{ getSigningStatusLabel(selectedAgreement.signing_status) }}</span>
          </p>
        </div>

        <div v-if="loadingSigningStatus" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="mt-2 text-gray-600">Loading signing status...</p>
        </div>

        <div v-else-if="signingStatus" class="space-y-3 mb-6">
          <div v-for="signer in signingStatus.signers" :key="signer.id"
               class="p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center mr-3',
                  signer.status === 'signed' ? 'bg-green-100' : 'bg-gray-200'
                ]">
                  <Check v-if="signer.status === 'signed'" class="w-4 h-4 text-green-600" />
                  <Clock v-else class="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <span class="text-sm font-medium text-gray-900">{{ signer.signer_name }}</span>
                  <span class="text-xs text-gray-500 ml-2 capitalize">({{ signer.signer_type }})</span>
                </div>
              </div>
              <span :class="getSignerStatusClass(signer.status)" class="text-xs font-medium px-2 py-1 rounded-full">
                {{ getSignerStatusLabel(signer.status) }}
              </span>
            </div>
            <!-- Email and Remind section for unsigned signers -->
            <div v-if="signer.status !== 'signed' && signer.status !== 'declined'" class="mt-2 flex items-center gap-2">
              <input
                v-model="signerEmails[signer.id]"
                type="email"
                :placeholder="signer.signer_email || 'Enter email address'"
                class="flex-1 text-sm px-2 py-1 border border-gray-300 rounded focus:ring-primary focus:border-primary"
              />
              <button
                @click="sendReminder(signer.id, signerEmails[signer.id])"
                :disabled="sendingReminder === signer.id || !signerEmails[signer.id]"
                class="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Send Reminder"
              >
                {{ sendingReminder === signer.id ? 'Sending...' : 'Send Reminder' }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center">
          <button
            v-if="selectedAgreement.pdf_url || selectedAgreement.signed_pdf_url"
            @click="viewAgreementPdf(selectedAgreement)"
            class="flex items-center gap-2 px-4 py-2 text-primary font-medium border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
          >
            <Eye class="w-4 h-4" />
            View Agreement PDF
          </button>
          <div v-else></div>
          <button
            @click="showStatusModal = false"
            class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal && selectedAgreement" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div class="relative bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Delete Agreement</h3>

        <!-- Warning banner for pending or signed agreements -->
        <div v-if="selectedAgreement.signing_status === 'pending_signatures' || selectedAgreement.signing_status === 'fully_signed'" class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-yellow-800">
            <template v-if="selectedAgreement.signing_status === 'fully_signed'">
              This agreement has been fully signed and is a legal record.
            </template>
            <template v-else>
              This will cancel all pending signature requests and invalidate signing links.
            </template>
          </p>
        </div>

        <p class="text-sm text-gray-600 mb-4">
          {{ getDeleteConfirmationMessage(selectedAgreement) }}
        </p>
        <div class="p-3 bg-gray-50 rounded-lg mb-6">
          <p class="text-sm font-medium text-gray-900">{{ formatPropertyAddress(selectedAgreement.property_address) }}</p>
        </div>
        <div class="flex justify-end gap-3">
          <button
            @click="showDeleteModal = false"
            class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="deleteAgreement"
            :disabled="deleting"
            class="px-4 py-2 text-white font-medium bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Recall Confirmation Modal -->
    <RecallConfirmationModal
      :is-open="showRecallModal"
      :property-address="selectedAgreement ? formatPropertyAddress(selectedAgreement.property_address) : ''"
      :signer-progress="signerProgress"
      :loading="recalling"
      @close="closeRecallModal"
      @confirm="handleRecallConfirm"
    />

    <!-- Edit Agreement Modal -->
    <AgreementEditModal
      :is-open="showEditModal"
      :agreement="selectedAgreement"
      @close="closeEditModal"
      @save="handleEditSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { Search, FileText, Download, Pencil, ClipboardCheck, Trash2, X, Check, Clock, MoreVertical, Send, AlertTriangle, Eye } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AgreementEditModal from '../components/AgreementEditModal.vue'
import RecallConfirmationModal from '../components/RecallConfirmationModal.vue'

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

const agreements = ref<any[]>([])
const loadingAgreements = ref(false)
const searchQuery = ref('')

// Actions dropdown state
const actionsMenuOpen = ref<string | null>(null)

// Modal states
const showSigningModal = ref(false)
const showStatusModal = ref(false)
const showEditModal = ref(false)
const showRecallModal = ref(false)
const showDeleteModal = ref(false)
const selectedAgreement = ref<any>(null)

// Action states
const initiatingSign = ref(false)
const loadingSigningStatus = ref(false)
const signerEmails = ref<Record<string, string>>({})
const signingStatus = ref<any>(null)
const sendingReminder = ref<string | null>(null)
const deleting = ref(false)
const savingEdit = ref(false)
const recalling = ref(false)
const signerProgress = ref<{ signed: number; total: number } | null>(null)
const generatingPdf = ref<string | null>(null)

const filteredAgreements = computed(() => {
  if (!searchQuery.value) return agreements.value

  const query = searchQuery.value.toLowerCase()
  return agreements.value.filter((agreement) => {
    const address = formatPropertyAddress(agreement.property_address).toLowerCase()
    const tenants = getTenantNames(agreement.tenants).toLowerCase()
    return address.includes(query) || tenants.includes(query)
  })
})

const fetchAgreements = async () => {
  loadingAgreements.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch agreements')
    }

    const data = await response.json()
    agreements.value = data.agreements || []
  } catch (err: any) {
    console.error('Error fetching agreements:', err)
    toast.error('Failed to load agreement history')
  } finally {
    loadingAgreements.value = false
  }
}

const formatPropertyAddress = (address: any): string => {
  if (!address) return 'N/A'
  if (typeof address === 'string') return address

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postcode
  ].filter(Boolean)

  return parts.join(', ')
}

const getTenantNames = (tenants: any[]): string => {
  if (!tenants || tenants.length === 0) return 'N/A'
  return tenants.map(t => t.name).join(', ')
}

const formatTemplateType = (type: string): string => {
  const labels: Record<string, string> = {
    'dps': 'DPS',
    'mydeposits': 'Mydeposits',
    'tds': 'TDS',
    'reposit': 'Reposit',
    'no_deposit': 'No Deposit'
  }
  return labels[type] || type
}

const getSigningStatusClass = (status: string | null): string => {
  switch (status) {
    case 'fully_signed':
      return 'bg-green-100 text-green-800'
    case 'partially_signed':
    case 'pending_signatures':
      return 'bg-yellow-100 text-yellow-800'
    case 'cancelled':
    case 'expired':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getSigningStatusLabel = (status: string | null): string => {
  switch (status) {
    case 'fully_signed':
      return 'Signed'
    case 'partially_signed':
      return 'Partially Signed'
    case 'pending_signatures':
      return 'Pending Signatures'
    case 'cancelled':
      return 'Cancelled'
    case 'expired':
      return 'Expired'
    case 'draft':
    default:
      return 'Draft'
  }
}

const getSignerStatusClass = (status: string): string => {
  switch (status) {
    case 'signed':
      return 'bg-green-100 text-green-800'
    case 'viewed':
      return 'bg-blue-100 text-blue-800'
    case 'pending':
    case 'sent':
      return 'bg-yellow-100 text-yellow-800'
    case 'declined':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getSignerStatusLabel = (status: string): string => {
  switch (status) {
    case 'signed':
      return 'Signed'
    case 'viewed':
      return 'Viewed'
    case 'pending':
      return 'Pending'
    case 'sent':
      return 'Sent'
    case 'declined':
      return 'Declined'
    default:
      return status
  }
}

const downloadAgreement = async (agreement: any) => {
  const pdfUrl = agreement.signed_pdf_url || agreement.pdf_url
  if (!pdfUrl) {
    toast.error('PDF not available')
    return
  }

  try {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = pdfUrl.split('/').pop() || 'agreement.pdf'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Error downloading agreement:', err)
    toast.error('Failed to download agreement')
  }
}

const viewAgreementPdf = (agreement: any) => {
  const pdfUrl = agreement.signed_pdf_url || agreement.pdf_url
  if (!pdfUrl) {
    toast.error('PDF not available')
    return
  }

  // Open PDF in new window
  window.open(pdfUrl, '_blank')
}

const generatePdf = async (agreement: any) => {
  generatingPdf.value = agreement.id

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreement.id}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to generate PDF')
    }

    toast.success('PDF generated successfully')
    await fetchAgreements()

    // Navigate to preview page
    router.push(`/agreements/${agreement.id}/preview`)
  } catch (err: any) {
    console.error('Error generating PDF:', err)
    toast.error(err.message || 'Failed to generate PDF')
  } finally {
    generatingPdf.value = null
  }
}

const openSigningModal = (agreement: any) => {
  selectedAgreement.value = agreement
  showSigningModal.value = true
}

const openStatusModal = async (agreement: any) => {
  selectedAgreement.value = agreement
  showStatusModal.value = true
  await fetchSigningStatus(agreement.id)
}

const fetchSigningStatus = async (agreementId: string) => {
  loadingSigningStatus.value = true
  signingStatus.value = null
  signerEmails.value = {}

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/signing/agreements/${agreementId}/signing-status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) throw new Error('Failed to fetch signing status')

    const data = await response.json()
    signingStatus.value = data

    // Initialize signerEmails with existing emails
    if (data.signers) {
      data.signers.forEach((signer: any) => {
        signerEmails.value[signer.id] = signer.signer_email || ''
      })
    }
  } catch (err) {
    console.error('Error fetching signing status:', err)
    toast.error('Failed to load signing status')
  } finally {
    loadingSigningStatus.value = false
  }
}

const initiateSigning = async () => {
  if (!selectedAgreement.value) return

  initiatingSign.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/signing/agreements/${selectedAgreement.value.id}/initiate-signing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to initiate signing')
    }

    toast.success('Signing emails sent successfully!')
    showSigningModal.value = false
    await fetchAgreements()
  } catch (err: any) {
    console.error('Error initiating signing:', err)
    toast.error(err.message || 'Failed to send signing emails')
  } finally {
    initiatingSign.value = false
  }
}

const sendReminder = async (signatureId: string, email?: string) => {
  if (!selectedAgreement.value) return

  sendingReminder.value = signatureId
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/signing/agreements/${selectedAgreement.value.id}/send-reminder/${signatureId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send reminder')
    }

    toast.success('Reminder sent successfully!')
    await fetchSigningStatus(selectedAgreement.value.id)
  } catch (err: any) {
    console.error('Error sending reminder:', err)
    toast.error(err.message || 'Failed to send reminder')
  } finally {
    sendingReminder.value = null
  }
}

const confirmDelete = (agreement: any) => {
  selectedAgreement.value = agreement
  showDeleteModal.value = true
}

const deleteAgreement = async () => {
  if (!selectedAgreement.value) return

  deleting.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${selectedAgreement.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to delete agreement')
    }

    toast.success('Agreement deleted successfully')
    showDeleteModal.value = false
    await fetchAgreements()
  } catch (err: any) {
    console.error('Error deleting agreement:', err)
    toast.error(err.message || 'Failed to delete agreement')
  } finally {
    deleting.value = false
  }
}

const formatDate = (value?: string | null, fallback = 'N/A') =>
  formatUkDate(
    value,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

// Actions dropdown functions
const toggleActionsMenu = (id: string) => {
  actionsMenuOpen.value = actionsMenuOpen.value === id ? null : id
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.actions-menu-container')) {
    actionsMenuOpen.value = null
  }
}

// Permission check functions
const canDownload = (agreement: any): boolean => {
  return !!(agreement.pdf_url || agreement.signed_pdf_url)
}

const canViewSigningStatus = (agreement: any): boolean => {
  return agreement.signing_status && agreement.signing_status !== 'draft'
}

const canSendForSigning = (agreement: any): boolean => {
  return agreement.signing_status === 'draft' && agreement.pdf_url
}

const canPreview = (agreement: any): boolean => {
  return agreement.signing_status === 'draft' && agreement.pdf_url
}

const canEdit = (agreement: any): boolean => {
  // Allow edit for draft and sent agreements (not fully_signed or expired)
  const editableStatuses = ['draft', 'pending_signatures', 'partially_signed', 'cancelled']
  return !agreement.signing_status || editableStatuses.includes(agreement.signing_status)
}

const canDelete = (_agreement: any): boolean => {
  // Allow delete for all agreements
  return true
}

const canGeneratePdf = (agreement: any): boolean => {
  // Show generate PDF for draft agreements without a PDF
  return (!agreement.signing_status || agreement.signing_status === 'draft') && !agreement.pdf_url
}

// Get appropriate delete confirmation message
const getDeleteConfirmationMessage = (agreement: any): string => {
  if (agreement.signing_status === 'fully_signed') {
    return 'This agreement has been fully signed and executed. Are you sure you want to permanently delete it? This action cannot be undone.'
  }
  if (agreement.signing_status === 'pending_signatures') {
    return 'This agreement has been sent for signing. Deleting it will cancel all pending signatures and invalidate signing links. Are you sure you want to continue?'
  }
  if (agreement.signing_status === 'cancelled') {
    return 'Are you sure you want to permanently delete this cancelled agreement? This action cannot be undone.'
  }
  return 'Are you sure you want to delete this agreement? This action cannot be undone.'
}

// Navigate to preview page
const goToPreview = (agreement: any) => {
  router.push(`/agreements/${agreement.id}/preview`)
}

// Edit modal functions
const openEditModal = async (agreement: any) => {
  selectedAgreement.value = agreement

  // For sent agreements, show recall confirmation first
  if (agreement.signing_status && ['pending_signatures', 'partially_signed'].includes(agreement.signing_status)) {
    // Fetch signer progress
    await fetchSignerProgress(agreement.id)
    showRecallModal.value = true
  } else {
    // For draft agreements, open edit modal directly
    showEditModal.value = true
  }
}

const fetchSignerProgress = async (agreementId: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/signing/agreements/${agreementId}/signing-status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      const signers = data.signers || []
      const signed = signers.filter((s: any) => s.status === 'signed').length
      signerProgress.value = { signed, total: signers.length }
    }
  } catch (err) {
    console.error('Error fetching signer progress:', err)
    signerProgress.value = null
  }
}

const handleRecallConfirm = () => {
  showRecallModal.value = false
  showEditModal.value = true
}

const handleEditSave = async ({ formData, isDraft, agreementId }: { formData: any; isDraft: boolean; agreementId: string }) => {
  savingEdit.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    let response

    if (isDraft) {
      // Update draft agreement
      response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreementId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
    } else {
      // Recall and edit - creates new draft
      response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreementId}/recall-and-edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
    }

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save agreement')
    }

    const result = await response.json()

    showEditModal.value = false
    toast.success(isDraft ? 'Agreement updated successfully' : 'Agreement recalled and new draft created')

    // If recall created a new agreement, optionally navigate to it
    if (!isDraft && result.newAgreementId) {
      // Refresh the list to show both cancelled and new draft
      await fetchAgreements()
    } else {
      await fetchAgreements()
    }
  } catch (err: any) {
    console.error('Error saving agreement:', err)
    toast.error(err.message || 'Failed to save agreement')
  } finally {
    savingEdit.value = false
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  selectedAgreement.value = null
}

const closeRecallModal = () => {
  showRecallModal.value = false
  selectedAgreement.value = null
  signerProgress.value = null
}

onMounted(() => {
  fetchAgreements()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
