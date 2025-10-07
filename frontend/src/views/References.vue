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
                <div class="flex items-center gap-2">
                  <div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                    </div>
                    <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
                  </div>
                  <span v-if="reference.is_group_parent" class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    {{ reference.tenant_count || 0 }} Tenants
                  </span>
                </div>
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
                    'bg-red-100 text-red-800': reference.status === 'rejected',
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
                  class="text-primary hover:text-primary/80"
                >
                  View
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
      <div class="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="p-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-900">Create New Reference</h3>
        </div>
        <form @submit.prevent="handleCreate" class="flex flex-col flex-1 min-h-0">
          <div class="px-6 overflow-y-auto flex-1 space-y-4">
          <!-- Tenant Count Selector -->
          <div>
            <label for="tenant-count" class="block text-sm font-medium text-gray-700 mb-2">Number of Tenants *</label>
            <select
              id="tenant-count"
              v-model.number="tenantCount"
              @change="updateTenantCount(tenantCount)"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option :value="1">1 Tenant</option>
              <option :value="2">2 Tenants</option>
              <option :value="3">3 Tenants</option>
              <option :value="4">4 Tenants</option>
              <option :value="5">5 Tenants</option>
              <option :value="6">6 Tenants</option>
            </select>
          </div>

          <!-- Property Information (shown once) -->
          <div>
            <h4 class="text-md font-semibold text-gray-700 mb-3">Property Information</h4>
            <div class="grid grid-cols-2 gap-4">
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
              <div>
                <label for="rent" class="block text-sm font-medium text-gray-700">Total Monthly Rent (£) *</label>
                <input
                  id="rent"
                  v-model="formData.monthly_rent"
                  type="number"
                  step="0.01"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          <!-- Single Tenant Information (v-if tenantCount === 1) -->
          <div v-if="tenantCount === 1">
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
                <PhoneInput
                  v-model="formData.tenant_phone"
                  label="Phone"
                  id="phone"
                  :required="true"
                />
              </div>
            </div>
          </div>

          <!-- Multiple Tenants (v-if tenantCount > 1) -->
          <div v-if="tenantCount > 1">
            <h4 class="text-md font-semibold text-gray-700 mb-3">Tenants</h4>
            <div v-for="(tenant, index) in tenants" :key="index" class="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h5 class="text-sm font-semibold text-gray-700 mb-3">Tenant {{ index + 1 }}</h5>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label :for="`tenant-${index}-first-name`" class="block text-sm font-medium text-gray-700">First Name *</label>
                  <input
                    :id="`tenant-${index}-first-name`"
                    v-model="tenant.first_name"
                    type="text"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label :for="`tenant-${index}-last-name`" class="block text-sm font-medium text-gray-700">Last Name *</label>
                  <input
                    :id="`tenant-${index}-last-name`"
                    v-model="tenant.last_name"
                    type="text"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label :for="`tenant-${index}-email`" class="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    :id="`tenant-${index}-email`"
                    v-model="tenant.email"
                    type="email"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <PhoneInput
                    v-model="tenant.phone"
                    :label="`Phone`"
                    :id="`tenant-${index}-phone`"
                    :required="false"
                  />
                </div>
                <div class="col-span-2">
                  <label :for="`tenant-${index}-rent-share`" class="block text-sm font-medium text-gray-700">Rent Share (£) *</label>
                  <input
                    :id="`tenant-${index}-rent-share`"
                    v-model.number="tenant.rent_share"
                    type="number"
                    step="0.01"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <!-- Rent Calculator -->
            <div class="p-4 rounded-lg" :class="rentSharesValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                  Total Rent Shares:
                </span>
                <span class="text-lg font-bold" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                  £{{ totalRentShare.toFixed(2) }} / £{{ Number(formData.monthly_rent || 0).toFixed(2) }}
                </span>
              </div>
              <p v-if="!rentSharesValid" class="text-xs text-red-700 mt-2">
                Rent shares must sum exactly to the total monthly rent
              </p>
              <p v-else class="text-xs text-green-700 mt-2">
                ✓ Rent shares match total rent
              </p>
            </div>
          </div>

          <!-- Move-in Date & Term Length Grid -->
          <div class="grid grid-cols-2 gap-6">
            <div>
              <DatePicker
                v-model="formData.move_in_date"
                label="Move-in Date (Optional)"
                :required="false"
                year-range-type="move-in"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Term Length</label>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex items-center gap-2">
                  <label for="term-years" class="text-sm text-gray-600 whitespace-nowrap">Years</label>
                  <input
                    id="term-years"
                    v-model.number="formData.term_years"
                    type="number"
                    min="0"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <label for="term-months" class="text-sm text-gray-600 whitespace-nowrap">Months</label>
                  <input
                    id="term-months"
                    v-model.number="formData.term_months"
                    type="number"
                    min="0"
                    max="11"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="notes"
              v-model="formData.notes"
              rows="2"
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
          </div>

          <!-- Sticky Footer with Buttons -->
          <div class="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-lg">
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
          </div>
        </form>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const showCreateModal = ref(false)
const references = ref<any[]>([])
const loading = ref(true)
const createLoading = ref(false)
const createError = ref('')
const createSuccess = ref('')

const tenantCount = ref(1)
const tenants = ref<Array<{
  first_name: string
  last_name: string
  email: string
  phone: string
  rent_share: number | null
}>>([{
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  rent_share: null
}])

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
  term_years: 0,
  term_months: 0,
  notes: ''
})

const totalRentShare = computed(() => {
  return tenants.value.reduce((sum, t) => sum + (Number(t.rent_share) || 0), 0)
})

const rentSharesValid = computed(() => {
  if (tenantCount.value === 1) return true
  const total = totalRentShare.value
  const monthlyRent = Number(formData.value.monthly_rent) || 0
  return Math.abs(total - monthlyRent) < 0.01 && monthlyRent > 0
})

const updateTenantCount = (count: number) => {
  tenantCount.value = count
  // Adjust tenants array
  while (tenants.value.length < count) {
    tenants.value.push({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      rent_share: null
    })
  }
  while (tenants.value.length > count) {
    tenants.value.pop()
  }
}

onMounted(() => {
  fetchReferences()

  // Check if we should open the create modal
  if (route.query.create === 'true') {
    showCreateModal.value = true
    // Remove the query parameter from the URL
    router.replace('/references')
  }
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

    let payload: any

    if (tenantCount.value === 1) {
      // Single tenant flow
      payload = {
        ...formData.value,
        move_in_date: formData.value.move_in_date || null
      }
    } else {
      // Multi-tenant flow
      if (!rentSharesValid.value) {
        createError.value = 'Rent shares must sum to the total monthly rent'
        createLoading.value = false
        return
      }

      payload = {
        tenants: tenants.value,
        property_address: formData.value.property_address,
        property_city: formData.value.property_city,
        property_postcode: formData.value.property_postcode,
        monthly_rent: formData.value.monthly_rent,
        move_in_date: formData.value.move_in_date || null,
        term_years: formData.value.term_years,
        term_months: formData.value.term_months,
        notes: formData.value.notes
      }
    }

    const response = await fetch(`${API_URL}/api/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reference')
    }

    await response.json()
    createSuccess.value = tenantCount.value > 1
      ? `Reference created successfully for ${tenantCount.value} tenants!`
      : 'Reference created successfully!'

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
  tenantCount.value = 1
  tenants.value = [{
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rent_share: null
  }]
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
    term_years: 0,
    term_months: 0,
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
</script>
