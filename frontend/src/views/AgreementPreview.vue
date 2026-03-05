<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <router-link to="/agreements/history" class="hover:text-primary">Agreement History</router-link>
        <span>/</span>
        <span>Preview</span>
      </div>
      <h2 class="text-3xl font-bold text-gray-900">Review Agreement</h2>
      <p v-if="agreement" class="mt-2 text-gray-600">
        {{ formatPropertyAddress(agreement.property_address) }}
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p class="mt-2 text-gray-600">Loading agreement...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <AlertTriangle class="w-12 h-12 text-red-500 mx-auto mb-4" />
      <p class="text-red-800">{{ error }}</p>
      <router-link to="/agreements/history" class="mt-4 inline-block text-primary hover:text-primary-dark">
        Return to Agreement History
      </router-link>
    </div>

    <!-- Main content -->
    <div v-else-if="agreement" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- PDF Preview (2/3 width) -->
      <div class="lg:col-span-2 bg-white rounded-lg shadow">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Agreement Document</h3>
          <button
            @click="downloadPdf"
            :disabled="!agreement.pdf_url"
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:text-primary-dark disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Download class="w-4 h-4" />
            Download PDF
          </button>
        </div>
        <div class="relative">
          <iframe
            v-if="agreement.pdf_url"
            :src="agreement.pdf_url"
            class="w-full h-[700px] border-0"
          ></iframe>
          <div v-else class="h-[700px] flex items-center justify-center bg-gray-50">
            <div class="text-center">
              <FileText class="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p class="text-gray-600">No PDF generated yet</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recipients Panel (1/3 width) -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Recipients</h3>
        <p class="text-sm text-gray-600 mb-4">
          These parties will receive an email with a secure link to sign the agreement.
        </p>

        <!-- Recipients List -->
        <div class="space-y-3 mb-6">
          <RecipientCard
            v-for="recipient in recipients"
            :key="`${recipient.type}-${recipient.index}`"
            :recipient="recipient"
            :can-remove="!recipient.isRequired"
            @update="updateRecipient"
            @remove="removeRecipient"
          />
        </div>

        <!-- Missing emails warning -->
        <div v-if="missingEmails.length > 0" class="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm text-yellow-800 font-medium">Missing email addresses</p>
              <p class="text-sm text-yellow-700 mt-1">
                Please add email addresses for all recipients before sending.
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-3 pt-4 border-t">
          <button
            @click="sendForSigning"
            :disabled="sending || missingEmails.length > 0"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Send class="w-4 h-4" />
            {{ sending ? 'Sending...' : 'Send for Signing' }}
          </button>
          <button
            @click="goToEdit"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            <Pencil class="w-4 h-4" />
            Edit Agreement
          </button>
          <router-link
            to="/agreements/history"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft class="w-4 h-4" />
            Back to History
          </router-link>
        </div>
      </div>
    </div>
  </div>

  <AgreementEditModal
    :is-open="showEditModal"
    :agreement="agreement"
    @close="closeEditModal"
    @save="handleEditSave"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { Download, FileText, AlertTriangle, Send, Pencil, ArrowLeft } from 'lucide-vue-next'
import RecipientCard from '../components/RecipientCard.vue'
import AgreementEditModal from '../components/AgreementEditModal.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Recipient {
  type: 'landlord' | 'tenant' | 'guarantor'
  index: number
  name: string
  email: string
  isRequired?: boolean
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const agreement = ref<any>(null)
const recipients = ref<Recipient[]>([])
const loading = ref(true)
const error = ref('')
const sending = ref(false)
const saving = ref(false)
const showEditModal = ref(false)

const agreementId = computed(() => route.params.id as string)

const missingEmails = computed(() => {
  return recipients.value.filter(r => !r.email)
})

const fetchAgreement = async () => {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('No authentication token')
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreementId.value}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Agreement not found')
      }
      throw new Error('Failed to fetch agreement')
    }

    const data = await response.json()
    agreement.value = data.agreement

    // Check if already sent for signing
    if (agreement.value.signing_status && agreement.value.signing_status !== 'draft') {
      router.push('/agreements/history')
      return
    }

    // Build recipients list
    buildRecipients()
  } catch (err: any) {
    console.error('Error fetching agreement:', err)
    error.value = err.message || 'Failed to load agreement'
  } finally {
    loading.value = false
  }
}

const buildRecipients = () => {
  if (!agreement.value) return

  const recipientsList: Recipient[] = []

  const getPrimaryLandlordEmail = (landlord: any, index: number) => {
    // For managed properties, ALL landlords use agent email
    if (agreement.value.management_type === 'managed') {
      return agreement.value.agent_email || authStore.user?.email || ''
    }

    // For non-managed properties, use individual landlord emails
    return landlord.email || (index === 0 ? agreement.value.landlord_email || '' : '')
  }

  // Add landlords
  agreement.value.landlords?.forEach((landlord: any, index: number) => {
    const landlordEmail = getPrimaryLandlordEmail(landlord, index)

    recipientsList.push({
      type: 'landlord',
      index,
      name: landlord.name,
      email: landlordEmail,
      isRequired: index === 0
    })
  })

  // Add tenants
  agreement.value.tenants?.forEach((tenant: any, index: number) => {
    const tenantEmail = tenant.email
      (index === 0 ? (agreement.value.tenant_email || '') : '')

    recipientsList.push({
      type: 'tenant',
      index,
      name: tenant.name,
      email: tenantEmail,
      isRequired: index === 0
    })
  })

  // Add guarantors
  agreement.value.guarantors?.forEach((guarantor: any, index: number) => {
    recipientsList.push({
      type: 'guarantor',
      index,
      name: guarantor.name,
      email: guarantor.email || '',
      isRequired: false
    })
  })

  recipients.value = recipientsList
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

const updateRecipient = async (updatedRecipient: Recipient) => {
  // Update local state
  const index = recipients.value.findIndex(
    r => r.type === updatedRecipient.type && r.index === updatedRecipient.index
  )
  if (index !== -1) {
    recipients.value[index] = updatedRecipient
  }

  // Save to backend
  await saveRecipients()
}

const removeRecipient = (recipient: Recipient) => {
  // Only allow removing non-required recipients
  if (recipient.isRequired) return

  recipients.value = recipients.value.filter(
    r => !(r.type === recipient.type && r.index === recipient.index)
  )

  // TODO: Update the agreement to remove the party
  toast.info('Recipient removal will be reflected when you regenerate the agreement')
}

const saveRecipients = async () => {
  saving.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreementId.value}/recipients`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: recipients.value.map(r => ({
          type: r.type,
          index: r.index,
          email: r.email
        }))
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save recipients')
    }
  } catch (err: any) {
    console.error('Error saving recipients:', err)
    toast.error(err.message || 'Failed to save recipients')
  } finally {
    saving.value = false
  }
}

const sendForSigning = async () => {
  // Validate all recipients have emails
  if (missingEmails.value.length > 0) {
    toast.error('Please add email addresses for all recipients')
    return
  }

  sending.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    // Save recipients first
    await saveRecipients()

    // Initiate signing
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/signing/agreements/${agreementId.value}/initiate-signing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send for signing')
    }

    toast.success('Signing emails sent successfully!')
    router.push('/agreements/history')
  } catch (err: any) {
    console.error('Error sending for signing:', err)
    toast.error(err.message || 'Failed to send for signing')
  } finally {
    sending.value = false
  }
}

const downloadPdf = () => {
  if (!agreement.value?.pdf_url) return

  const link = document.createElement('a')
  link.href = agreement.value.pdf_url
  link.download = agreement.value.pdf_url.split('/').pop() || 'agreement.pdf'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const goToEdit = () => {
  showEditModal.value = true
}

const handleEditSave = async ({ formData, isDraft, agreementId }: { formData: any; isDraft: boolean; agreementId: string }) => {
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements/${agreementId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save agreement')
    }

    const result = await response.json()
    agreement.value = result.agreement
    buildRecipients()
    showEditModal.value = false
    toast.success(isDraft ? 'Agreement updated successfully' : 'Agreement recalled and new draft created')
  } catch (err: any) {
    console.error('Error saving agreement:', err)
    toast.error(err.message || 'Failed to save agreement')
  }
}

const closeEditModal = () => {
  showEditModal.value = false
}

onMounted(() => {
  fetchAgreement()
})
</script>
