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
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <!-- Download Button -->
                <button
                  @click="downloadAgreement(agreement)"
                  :disabled="!agreement.pdf_url && !agreement.signed_pdf_url"
                  class="text-primary hover:text-primary-dark disabled:text-gray-400 disabled:cursor-not-allowed"
                  :title="getDownloadTitle(agreement)"
                >
                  <Download class="h-5 w-5 inline" />
                </button>

                <!-- Send for Signing Button (only if draft and PDF generated) -->
                <button
                  v-if="agreement.signing_status === 'draft' && agreement.pdf_url"
                  @click="openSigningModal(agreement)"
                  class="text-green-600 hover:text-green-700"
                  title="Send for Signing"
                >
                  <Pencil class="h-5 w-5 inline" />
                </button>

                <!-- View Signing Status Button -->
                <button
                  v-if="agreement.signing_status && agreement.signing_status !== 'draft'"
                  @click="openStatusModal(agreement)"
                  class="text-blue-600 hover:text-blue-700"
                  title="View Signing Status"
                >
                  <ClipboardCheck class="h-5 w-5 inline" />
                </button>

                <!-- Delete Button (only if draft) -->
                <button
                  v-if="!agreement.signing_status || agreement.signing_status === 'draft'"
                  @click="confirmDelete(agreement)"
                  class="text-red-600 hover:text-red-700"
                  title="Delete Agreement"
                >
                  <Trash2 class="h-5 w-5 inline" />
                </button>
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
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
            <div class="flex items-center gap-2">
              <span :class="getSignerStatusClass(signer.status)" class="text-xs font-medium px-2 py-1 rounded-full">
                {{ getSignerStatusLabel(signer.status) }}
              </span>
              <button
                v-if="signer.status !== 'signed' && signer.status !== 'declined'"
                @click="sendReminder(signer.id)"
                :disabled="sendingReminder === signer.id"
                class="text-xs text-primary hover:text-primary-dark disabled:text-gray-400"
                title="Send Reminder"
              >
                {{ sendingReminder === signer.id ? 'Sending...' : 'Remind' }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
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
        <p class="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this agreement? This action cannot be undone.
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { Search, FileText, Download, Pencil, ClipboardCheck, Trash2, X, Check, Clock } from 'lucide-vue-next'

const authStore = useAuthStore()
const toast = useToast()

const agreements = ref<any[]>([])
const loadingAgreements = ref(false)
const searchQuery = ref('')

// Modal states
const showSigningModal = ref(false)
const showStatusModal = ref(false)
const showDeleteModal = ref(false)
const selectedAgreement = ref<any>(null)

// Action states
const initiatingSign = ref(false)
const loadingSigningStatus = ref(false)
const signingStatus = ref<any>(null)
const sendingReminder = ref<string | null>(null)
const deleting = ref(false)

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

const getDownloadTitle = (agreement: any): string => {
  if (agreement.signed_pdf_url) return 'Download Signed PDF'
  if (agreement.pdf_url) return 'Download PDF'
  return 'PDF not available'
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

const sendReminder = async (signatureId: string) => {
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
      }
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

onMounted(() => {
  fetchAgreements()
})
</script>
