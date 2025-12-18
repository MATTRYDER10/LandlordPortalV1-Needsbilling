<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex items-center space-x-4">
            <button
              @click="$router.push('/staff/dashboard')"
              class="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <h1 class="text-2xl font-bold text-gray-900">Reference Details</h1>
          </div>
          <button
            @click="handleSignOut"
            class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <LogOut class="w-5 h-5 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading reference data...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="reference" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Verification Status Badge -->
      <div class="mb-6">
        <span
          class="px-4 py-2 inline-flex text-sm font-semibold rounded-full"
          :class="{
            'bg-green-100 text-green-800': verificationCheck?.overall_status === 'passed',
            'bg-red-100 text-red-800': verificationCheck?.overall_status === 'failed',
            'bg-yellow-100 text-yellow-800': !verificationCheck?.overall_status
          }"
        >
          {{ verificationCheck?.overall_status === 'passed' ? '✓ Verification Passed' : verificationCheck?.overall_status === 'failed' ? '✗ Verification Failed' : 'Not Verified' }}
        </span>
      </div>

      <!-- Tenant Information -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h2>
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-gray-500">Full Name</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ fullName }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Date of Birth</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatDate(reference.date_of_birth, 'Not provided') }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Email</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ reference.tenant_email }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Phone</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ reference.tenant_phone || 'Not provided' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Verification Summary -->
      <div v-if="verificationCheck" class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h2>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.id_step_completed ? 'bg-green-50' : 'bg-red-50'">
            <span class="text-sm font-medium">ID Verification</span>
            <span v-if="verificationCheck.id_step_completed" class="text-green-600">✓ Completed</span>
            <span v-else class="text-red-600">✗ Incomplete</span>
          </div>

          <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.selfie_step_completed ? 'bg-green-50' : 'bg-red-50'">
            <span class="text-sm font-medium">Selfie Match</span>
            <span v-if="verificationCheck.selfie_step_completed" class="text-green-600">✓ Completed</span>
            <span v-else class="text-red-600">✗ Incomplete</span>
          </div>

          <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.employment_step_completed ? 'bg-green-50' : 'bg-red-50'">
            <span class="text-sm font-medium">Employment</span>
            <span v-if="verificationCheck.employment_step_completed" class="text-green-600">✓ Completed</span>
            <span v-else class="text-red-600">✗ Incomplete</span>
          </div>

          <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.tenancy_step_completed ? 'bg-green-50' : 'bg-red-50'">
            <span class="text-sm font-medium">Previous Tenancy</span>
            <span v-if="verificationCheck.tenancy_step_completed" class="text-green-600">✓ Completed</span>
            <span v-else class="text-red-600">✗ Incomplete</span>
          </div>

          <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.address_history_step_completed ? 'bg-green-50' : 'bg-red-50'">
            <span class="text-sm font-medium">Address History</span>
            <span v-if="verificationCheck.address_history_step_completed" class="text-green-600">✓ Completed</span>
            <span v-else class="text-red-600">✗ Incomplete</span>
          </div>
        </div>

        <div v-if="verificationCheck.final_notes" class="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Final Notes</h3>
          <p class="text-sm text-gray-600">{{ verificationCheck.final_notes }}</p>
        </div>
      </div>

      <!-- Property Information -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Property Information</h2>
        <dl class="grid grid-cols-1 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500">Address</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ reference.property_address }}<br>
              {{ reference.property_city }}, {{ reference.property_postcode }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Current Address -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Current Address</h2>
        <dl class="grid grid-cols-1 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500">Address</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ reference.current_address_line1 }}<br>
              {{ reference.current_city }}, {{ reference.current_postcode }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Time at Address</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ reference.time_at_address_years || 0 }} year(s), {{ reference.time_at_address_months || 0 }} month(s)
            </dd>
          </div>
        </dl>
      </div>

      <!-- Employment Information -->
      <div v-if="reference.income_regular_employment" class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Employment Information</h2>
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-gray-500">Company Name</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ reference.employment_company_name || 'Not provided' }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Position</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ reference.employment_job_title || 'Not provided' }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Annual Salary</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ reference.employment_salary_amount ? `£${reference.employment_salary_amount}` : 'Not provided' }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { LogOut } from 'lucide-vue-next'
import { formatDate as formatUkDate } from '../utils/date'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL
const referenceId = route.params.id as string

const loading = ref(true)
const reference = ref<any>(null)
const verificationCheck = ref<any>(null)

// Helper function to capitalize first letter of each word
const capitalizeWords = (str: string | null | undefined): string => {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const fullName = computed(() => {
  const parts = [
    reference.value?.tenant_first_name,
    reference.value?.middle_name,
    reference.value?.tenant_last_name
  ].filter(Boolean)

  return parts.map(part => capitalizeWords(part)).join(' ')
})

const fetchReference = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      router.push('/staff/login')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch reference')

    const data = await response.json()
    reference.value = data.reference
  } catch (error: any) {
    toast.error(error.message || 'Failed to load reference')
  } finally {
    loading.value = false
  }
}

const fetchVerificationCheck = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/verification/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch verification check')

    const data = await response.json()
    if (data.verificationCheck) {
      verificationCheck.value = data.verificationCheck
    }
  } catch (error: any) {
    console.error('Error fetching verification check:', error)
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}

const formatDate = (value?: string | null, fallback = 'Not provided') =>
  formatUkDate(
    value,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

onMounted(async () => {
  await fetchReference()
  await fetchVerificationCheck()
})
</script>
