<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">References</h2>
          <p class="mt-2 text-gray-600">Manage all tenant references</p>
        </div>
        <button
          @click="showCreateModal = true"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
        >
          Create New Reference
        </button>
      </div>

      <!-- References List -->
      <div v-if="loading || references.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody v-if="loading" class="bg-white">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap" style="width: 250px;">
                <div class="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <div class="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  <div class="h-4 bg-gray-100 rounded w-48 animate-pulse"></div>
                </div>
              </td>
              <td class="px-6 py-4" style="width: 300px;">
                <div class="text-sm text-gray-900">
                  <div class="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  <div class="h-4 bg-gray-100 rounded w-40 animate-pulse"></div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap" style="width: 120px;">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" style="width: 150px;">
                <div class="h-4 bg-gray-100 rounded w-28 animate-pulse"></div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style="width: 180px;">
                <div class="h-4 bg-gray-100 rounded w-36 animate-pulse ml-auto"></div>
              </td>
            </tr>
          </tbody>
          <tbody v-else class="bg-white divide-y divide-gray-200">
            <tr v-for="reference in references" :key="reference.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                </div>
                <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
                <div class="text-sm text-gray-500">
                  {{ reference.property_city }}{{ reference.property_postcode ? ', ' + reference.property_postcode : '' }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="{
                    'bg-yellow-100 text-yellow-800': reference.status === 'pending',
                    'bg-blue-100 text-blue-800': reference.status === 'in_progress',
                    'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
                    'bg-green-100 text-green-800': reference.status === 'completed',
                    'bg-gray-100 text-gray-800': reference.status === 'cancelled'
                  }"
                >
                  {{ formatStatus(reference.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(reference.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  @click="viewReference(reference)"
                  class="text-primary hover:text-primary/80 mr-4"
                >
                  View
                </button>
                <button
                  @click="copyTenantLink(reference)"
                  class="text-gray-600 hover:text-gray-900"
                >
                  Copy Link
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-white rounded-lg shadow p-6">
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No references yet</h3>
          <p class="mt-1 text-sm text-gray-500">Get started by creating a new tenant reference.</p>
          <div class="mt-6">
            <button
              @click="showCreateModal = true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
            >
              Create New Reference
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Reference Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Create New Reference</h3>
        <form @submit.prevent="handleCreate" class="space-y-6">
          <!-- Tenant Information -->
          <div>
            <h4 class="text-md font-semibold text-gray-700 mb-3">Tenant Information</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="first-name" class="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  id="first-name"
                  v-model="formData.tenant_first_name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label for="last-name" class="block text-sm font-medium text-gray-700">Last Name *</label>
                <input
                  id="last-name"
                  v-model="formData.tenant_last_name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  id="email"
                  v-model="formData.tenant_email"
                  type="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label for="phone" class="block text-sm font-medium text-gray-700">Phone *</label>
                <input
                  id="phone"
                  v-model="formData.tenant_phone"
                  type="tel"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          <!-- Property Information -->
          <div>
            <h4 class="text-md font-semibold text-gray-700 mb-3">Property Information</h4>
            <div>
              <label for="address" class="block text-sm font-medium text-gray-700">Property Address *</label>
              <input
                id="address"
                v-model="formData.property_address"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label for="city" class="block text-sm font-medium text-gray-700">City *</label>
                <input
                  id="city"
                  v-model="formData.property_city"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label for="postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                <input
                  id="postcode"
                  v-model="formData.property_postcode"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label for="rent" class="block text-sm font-medium text-gray-700">Monthly Rent (£) *</label>
                <input
                  id="rent"
                  v-model="formData.monthly_rent"
                  type="number"
                  step="0.01"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label for="move-in-date" class="block text-sm font-medium text-gray-700">Move-in Date</label>
                <input
                  id="move-in-date"
                  v-model="formData.move_in_date"
                  type="date"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="notes"
              v-model="formData.notes"
              rows="3"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              placeholder="Optional notes about this reference..."
            ></textarea>
          </div>

          <div v-if="createError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {{ createError }}
          </div>

          <div v-if="createSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
            {{ createSuccess }}
          </div>

          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeCreateModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="createLoading"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ createLoading ? 'Creating...' : 'Create Reference' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const showCreateModal = ref(false)
const references = ref<any[]>([])
const loading = ref(true)
const createLoading = ref(false)
const createError = ref('')
const createSuccess = ref('')

const formData = ref({
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  tenant_phone: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  monthly_rent: null,
  move_in_date: '',
  notes: ''
})

onMounted(() => {
  fetchReferences()
})

const fetchReferences = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) {
      console.error('No auth token available')
      return
    }

    const response = await fetch(`${API_URL}/api/references`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch references')
    }

    const data = await response.json()
    references.value = data.references
  } catch (error) {
    console.error('Failed to fetch references:', error)
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  createLoading.value = true
  createError.value = ''
  createSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      createError.value = 'No auth token available'
      return
    }

    const response = await fetch(`${API_URL}/api/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData.value)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reference')
    }

    await response.json()
    createSuccess.value = 'Reference created successfully! Share the link with the tenant.'

    setTimeout(() => {
      closeCreateModal()
      fetchReferences()
    }, 2000)
  } catch (error: any) {
    createError.value = error.message || 'Failed to create reference'
  } finally {
    createLoading.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  formData.value = {
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    tenant_phone: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    monthly_rent: null,
    move_in_date: '',
    notes: ''
  }
  createError.value = ''
  createSuccess.value = ''
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const viewReference = (reference: any) => {
  router.push(`/references/${reference.id}`)
}

const copyTenantLink = (reference: any) => {
  const link = `${window.location.origin}/submit-reference/${reference.reference_token}`
  navigator.clipboard.writeText(link)
  useToast().success('Tenant link copied to clipboard!')
}
</script>
