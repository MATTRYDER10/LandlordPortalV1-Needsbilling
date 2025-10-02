<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading reference...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="reference" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button
              @click="$router.push('/references')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to References
            </button>
            <h2 class="text-3xl font-bold text-gray-900">
              {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
            </h2>
            <p class="mt-2 text-gray-600">Reference Details</p>
          </div>
          <span
            class="px-3 py-1 text-sm font-semibold rounded-full"
            :class="{
              'bg-yellow-100 text-yellow-800': reference.status === 'pending',
              'bg-blue-100 text-blue-800': reference.status === 'in_progress',
              'bg-green-100 text-green-800': reference.status === 'completed',
              'bg-gray-100 text-gray-800': reference.status === 'cancelled'
            }"
          >
            {{ formatStatus(reference.status) }}
          </span>
        </div>

        <!-- Tenant Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Email</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_email }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_phone || 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Property Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Address</label>
              <p class="mt-1 text-gray-900">{{ reference.property_address }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">City</label>
              <p class="mt-1 text-gray-900">{{ reference.property_city || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.property_postcode || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Monthly Rent</label>
              <p class="mt-1 text-gray-900">{{ reference.monthly_rent ? `£${reference.monthly_rent}` : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Move-in Date</label>
              <p class="mt-1 text-gray-900">{{ reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Employment Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Employment Information</h3>
          <div v-if="reference.employment_status" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Employment Status</label>
              <p class="mt-1 text-gray-900">{{ reference.employment_status }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Name</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_name || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Job Title</label>
              <p class="mt-1 text-gray-900">{{ reference.job_title || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Annual Income</label>
              <p class="mt-1 text-gray-900">{{ reference.annual_income ? `£${reference.annual_income}` : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Email</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_email || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_phone || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employment Start Date</label>
              <p class="mt-1 text-gray-900">{{ reference.employment_start_date ? formatDate(reference.employment_start_date) : 'Not provided' }}</p>
            </div>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            Tenant has not submitted employment information yet
          </div>
        </div>

        <!-- Previous Landlord Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Previous Landlord Information</h3>
          <div v-if="reference.previous_landlord_name" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Name</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_name }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Email</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_email || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_phone || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Street</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_street || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous City</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_city || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_postcode || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Tenancy Duration</label>
              <p class="mt-1 text-gray-900">{{ formatTenancyDuration(reference.tenancy_years, reference.tenancy_months) }}</p>
            </div>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            Tenant has not submitted previous landlord information yet
          </div>
        </div>

        <!-- Supporting Documents -->
        <div v-if="reference.bank_statement_files?.length || reference.payslip_files?.length" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Supporting Documents</h3>

          <div v-if="reference.bank_statement_files?.length" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">Bank Statements</label>
            <div class="space-y-2">
              <div v-for="(file, index) in reference.bank_statement_files" :key="index"
                   class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-900">Bank Statement {{ index + 1 }}</span>
                </div>
                <button
                  @click="downloadFile(file)"
                  class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md"
                >
                  Download
                </button>
              </div>
            </div>
          </div>

          <div v-if="reference.payslip_files?.length">
            <label class="block text-sm font-medium text-gray-700 mb-3">Payslips</label>
            <div class="space-y-2">
              <div v-for="(file, index) in reference.payslip_files" :key="index"
                   class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-900">Payslip {{ index + 1 }}</span>
                </div>
                <button
                  @click="downloadFile(file)"
                  class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="reference.notes || reference.internal_notes" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <div v-if="reference.notes" class="mb-4">
            <label class="block text-sm font-medium text-gray-500">Reference Notes</label>
            <p class="mt-1 text-gray-900">{{ reference.notes }}</p>
          </div>
          <div v-if="reference.internal_notes">
            <label class="block text-sm font-medium text-gray-500">Internal Notes</label>
            <p class="mt-1 text-gray-900">{{ reference.internal_notes }}</p>
          </div>
        </div>

        <!-- Timestamps -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
          <div class="space-y-2">
            <div>
              <label class="block text-sm font-medium text-gray-500">Created</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.created_at) }}</p>
            </div>
            <div v-if="reference.submitted_at">
              <label class="block text-sm font-medium text-gray-500">Submitted by Tenant</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.submitted_at) }}</p>
            </div>
            <div v-if="reference.completed_at">
              <label class="block text-sm font-medium text-gray-500">Completed</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.completed_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
          <div class="flex space-x-4">
            <button
              @click="copyTenantLink"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
            >
              Copy Tenant Link
            </button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const loading = ref(true)
const error = ref('')

onMounted(() => {
  fetchReference()
})

const fetchReference = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      error.value = 'No auth token available'
      loading.value = false
      return
    }

    const response = await fetch(`${API_URL}/api/references/${route.params.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch reference')
    }

    const data = await response.json()
    reference.value = data.reference
  } catch (err: any) {
    error.value = err.message || 'Failed to load reference'
  } finally {
    loading.value = false
  }
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatTenancyDuration = (years: number | null, months: number | null) => {
  if (!years && !months) return 'Not provided'
  const parts = []
  if (years && years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  }
  if (months && months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const copyTenantLink = () => {
  if (reference.value) {
    const link = `${window.location.origin}/submit-reference/${reference.value.reference_token}`
    navigator.clipboard.writeText(link)
    useToast().success('Tenant link copied to clipboard!')
  }
}

const downloadFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      useToast().error('Authentication required')
      return
    }

    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    const downloadUrl = `${API_URL}/api/references/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2])}`

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to download file')
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filePath.split('/').pop() || 'document'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(a)
  } catch (error) {
    useToast().error('Failed to download file')
  }
}
</script>
