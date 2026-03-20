<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create Tenancy</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <X class="w-5 h-5" />
            </button>
          </div>
          <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Create a new tenancy record manually
          </p>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Reference Selection (First - drives property matching) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Link to Reference
              </label>
              <div class="relative">
                <div class="relative">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    v-model="referenceSearch"
                    type="text"
                    placeholder="Search by tenant name or address..."
                    class="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    @focus="showReferenceDropdown = true"
                    @blur="delayedCloseReferenceDropdown"
                  />
                </div>
                <!-- Reference Dropdown -->
                <div
                  v-if="showReferenceDropdown && filteredReferences.length > 0"
                  class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-200 dark:border-slate-700"
                    @click="clearReference"
                  >
                    No linked reference
                  </button>
                  <button
                    v-for="ref in filteredReferences"
                    :key="ref.id"
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                    @click="selectReference(ref)"
                  >
                    <span class="font-medium">{{ ref.tenantName }}</span>
                    <span class="text-gray-500 dark:text-slate-400 ml-2">{{ ref.propertyAddress }}</span>
                  </button>
                </div>
              </div>
              <p v-if="selectedReference" class="mt-1 text-xs text-green-600">
                Selected: {{ selectedReference.tenantName }} - {{ selectedReference.propertyAddress }}
              </p>
              <!-- Show tenants that will be created from reference -->
              <div v-if="selectedReference?.people?.length > 0" class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <p class="font-medium text-green-800 mb-1">Tenants from reference ({{ selectedReference.people.length }}):</p>
                <ul class="space-y-0.5 text-green-700">
                  <li v-for="(person, idx) in selectedReference.people" :key="idx" class="flex items-center gap-2">
                    <span>{{ person.name }}</span>
                    <span v-if="person.email" class="text-green-600">· {{ person.email }}</span>
                    <span v-if="person.isLeadTenant" class="px-1.5 py-0.5 bg-green-200 text-green-800 rounded text-[10px]">Lead</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Property Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Property *
              </label>
              <div class="relative">
                <div class="relative">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    v-model="propertySearch"
                    type="text"
                    placeholder="Search properties..."
                    class="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    :class="{ 'border-green-500': form.propertyId && !showPropertyDropdown }"
                    @focus="showPropertyDropdown = true"
                    @blur="delayedClosePropertyDropdown"
                  />
                </div>
                <!-- Property Dropdown -->
                <div
                  v-if="showPropertyDropdown && (filteredProperties.length > 0 || propertySearch)"
                  class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  <button
                    v-for="prop in filteredProperties"
                    :key="prop.id"
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                    @click="selectProperty(prop)"
                  >
                    <span class="font-medium">{{ prop.address_line1 }}</span>
                    <span class="text-gray-500 dark:text-slate-400 ml-2">{{ prop.city }} {{ prop.postcode }}</span>
                  </button>
                  <div v-if="filteredProperties.length === 0 && propertySearch" class="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                    No properties found
                    <button
                      type="button"
                      class="ml-2 text-primary hover:text-primary/80 font-medium"
                      @click="createPropertyFromSearch"
                    >
                      Create new property
                    </button>
                  </div>
                </div>
              </div>
              <p v-if="selectedProperty" class="mt-1 text-xs text-green-600">
                Selected: {{ selectedProperty.address_line1 }}, {{ selectedProperty.city }} {{ selectedProperty.postcode }}
                <span v-if="selectedProperty.landlord" class="text-gray-500 dark:text-slate-400">
                  (Landlord: {{ selectedProperty.landlord.name }})
                </span>
              </p>
              <p v-if="propertyMatchedFromReference" class="mt-1 text-xs text-blue-600">
                Auto-matched from reference address
              </p>
              <p v-if="propertyCreatedFromReference" class="mt-1 text-xs text-amber-600">
                New property will be created from reference address
              </p>
            </div>

            <!-- Tenancy Details -->
            <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">Tenancy Details</h4>

              <div class="grid grid-cols-2 gap-4">
                <!-- Start Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    v-model="form.startDate"
                    type="date"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    @change="calculateEndDate"
                  />
                </div>

                <!-- Payment Terms -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <select
                    v-model="form.paymentTerms"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    @change="calculateEndDate"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="periodic">Periodic (No fixed term)</option>
                  </select>
                </div>

                <!-- Term Length -->
                <div v-if="form.paymentTerms !== 'periodic'">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Term Length ({{ termLengthUnit }})
                  </label>
                  <input
                    v-model.number="form.termLength"
                    type="number"
                    min="1"
                    :max="form.paymentTerms === 'weekly' ? 520 : 120"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    @input="calculateEndDate"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {{ termLengthHint }}
                  </p>
                </div>

                <!-- End Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    End Date
                    <span v-if="form.paymentTerms !== 'periodic'" class="text-xs text-gray-400 dark:text-slate-500 ml-1">(calculated)</span>
                  </label>
                  <input
                    v-model="form.endDate"
                    type="date"
                    :disabled="form.paymentTerms === 'periodic'"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-700"
                    @change="endDateManuallyEdited = true"
                  />
                  <p v-if="form.paymentTerms === 'periodic'" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Periodic tenancy - no fixed end date
                  </p>
                  <p v-else-if="endDateManuallyEdited" class="mt-1 text-xs text-amber-600">
                    End date manually edited -
                    <button
                      type="button"
                      @click="resetEndDate"
                      class="underline hover:text-amber-700"
                    >
                      recalculate
                    </button>
                  </p>
                </div>

                <!-- Term Summary Badge -->
                <div class="col-span-2">
                  <div
                    class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
                    :class="paymentTermsBadgeClass"
                  >
                    <Calendar class="w-4 h-4 mr-1.5" />
                    <span v-if="form.paymentTerms === 'periodic'">Periodic Tenancy (Rolling)</span>
                    <span v-else>
                      {{ form.termLength }} {{ termLengthUnitSingular }}{{ form.termLength !== 1 ? 's' : '' }} Fixed Term
                    </span>
                  </div>
                  <p v-if="form.paymentTerms !== 'periodic'" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Rent payments: {{ paymentTermsLabel }}
                  </p>
                </div>

                <!-- Monthly Rent -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Monthly Rent *
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="form.monthlyRent"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      @input="calculateDeposit"
                    />
                  </div>
                </div>

                <!-- Deposit Amount -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Deposit Amount
                    <span class="text-xs text-gray-400 dark:text-slate-500 ml-1">(5 weeks pro-rata)</span>
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input
                      v-model.number="form.depositAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <p v-if="form.monthlyRent > 0" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Auto-calculated: &pound;{{ ((form.monthlyRent * 12 / 52) * 5).toFixed(2) }}
                  </p>
                </div>

                <!-- Rent Due Day -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Rent Due Day
                  </label>
                  <select
                    v-model.number="form.rentDueDay"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option v-for="day in 31" :key="day" :value="day">{{ ordinal(day) }} of month</option>
                  </select>
                </div>

                <!-- Tenancy Type -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Tenancy Type
                  </label>
                  <select
                    v-model="form.tenancyType"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="ast">Assured Shorthold Tenancy</option>
                    <option value="periodic">Periodic Tenancy</option>
                    <option value="company_let">Company Let</option>
                    <option value="lodger">Lodger Agreement</option>
                    <option value="license">License to Occupy</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Tenant Details (only when no reference linked) -->
            <div v-if="!form.referenceId" class="border-t border-gray-200 dark:border-slate-700 pt-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-4">Lead Tenant Details</h4>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    v-model="form.tenantFirstName"
                    type="text"
                    :required="!form.referenceId"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    v-model="form.tenantLastName"
                    type="text"
                    :required="!form.referenceId"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    v-model="form.tenantEmail"
                    type="email"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    v-model="form.tenantPhone"
                    type="tel"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                v-model="form.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                placeholder="Any additional notes..."
              ></textarea>
            </div>

            <!-- Error -->
            <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
              <p class="text-sm text-red-700">{{ error }}</p>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            @click="handleSubmit"
            :disabled="submitting || !isValid"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Creating...' : 'Create Tenancy' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'
import { X, Calendar, Search } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  preselectedPropertyId?: string
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Data
const properties = ref<any[]>([])
const completedReferences = ref<any[]>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

// Search state
const referenceSearch = ref('')
const propertySearch = ref('')
const showReferenceDropdown = ref(false)
const showPropertyDropdown = ref(false)
const selectedReference = ref<any>(null)
const propertyMatchedFromReference = ref(false)
const propertyCreatedFromReference = ref(false)
const pendingPropertyData = ref<any>(null)

// Form
const form = ref({
  propertyId: '',
  referenceId: '',
  startDate: '',
  endDate: '',
  paymentTerms: 'monthly' as 'monthly' | 'weekly' | 'quarterly' | 'periodic',
  termLength: 6,
  monthlyRent: 0,
  depositAmount: 0,
  rentDueDay: 1,
  tenancyType: 'ast',
  tenantFirstName: '',
  tenantLastName: '',
  tenantEmail: '',
  tenantPhone: '',
  notes: ''
})

const endDateManuallyEdited = ref(false)

// Computed helpers for payment terms
const termLengthUnit = computed(() => {
  switch (form.value.paymentTerms) {
    case 'weekly': return 'Weeks'
    case 'quarterly': return 'Quarters'
    default: return 'Months'
  }
})

const termLengthUnitSingular = computed(() => {
  switch (form.value.paymentTerms) {
    case 'weekly': return 'Week'
    case 'quarterly': return 'Quarter'
    default: return 'Month'
  }
})

const termLengthHint = computed(() => {
  switch (form.value.paymentTerms) {
    case 'weekly': return 'Common: 26, 52 weeks'
    case 'quarterly': return 'Common: 4, 8 quarters (1-2 years)'
    default: return 'Common: 6, 12, 24 months'
  }
})

const paymentTermsLabel = computed(() => {
  switch (form.value.paymentTerms) {
    case 'weekly': return 'Weekly'
    case 'quarterly': return 'Quarterly'
    default: return 'Monthly'
  }
})

const paymentTermsBadgeClass = computed(() => {
  switch (form.value.paymentTerms) {
    case 'weekly': return 'bg-purple-100 text-purple-800'
    case 'quarterly': return 'bg-green-100 text-green-800'
    case 'periodic': return 'bg-gray-100 text-gray-800'
    default: return 'bg-blue-100 text-blue-800'
  }
})

// Computed
const selectedProperty = computed(() =>
  properties.value.find(p => p.id === form.value.propertyId)
)

// Filtered references based on search - no limit, show all matching
const filteredReferences = computed(() => {
  if (!referenceSearch.value.trim()) {
    return completedReferences.value
  }
  const search = referenceSearch.value.toLowerCase().trim()
  return completedReferences.value.filter(ref => {
    const name = (ref.tenantName || '').toLowerCase()
    const address = (ref.propertyAddress || '').toLowerCase()
    return name.includes(search) || address.includes(search)
  })
})

// Filtered properties based on search - no limit, show all matching
const filteredProperties = computed(() => {
  if (!propertySearch.value.trim()) {
    return properties.value
  }
  const search = propertySearch.value.toLowerCase().trim()
  return properties.value.filter(prop => {
    const address = (prop.address_line1 || '').toLowerCase()
    const city = (prop.city || '').toLowerCase()
    const postcode = (prop.postcode || '').toLowerCase()
    return address.includes(search) || city.includes(search) || postcode.includes(search)
  })
})

const isValid = computed(() => {
  // Allow pending property creation or existing property
  const hasProperty = form.value.propertyId || pendingPropertyData.value
  if (!hasProperty || !form.value.startDate || !form.value.monthlyRent) {
    return false
  }
  // Need either: reference with tenants, OR manual tenant entry
  const hasReferenceWithTenants = selectedReference.value?.people?.length > 0
  const hasManualTenant = form.value.tenantFirstName && form.value.tenantLastName
  if (!hasReferenceWithTenants && !hasManualTenant) {
    return false
  }
  return true
})

// Methods
const ordinal = (n: number): string => {
  // Handle 11th, 12th, 13th specially
  if (n >= 11 && n <= 13) return n + 'th'
  // For other numbers, check last digit
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

const calculateEndDate = () => {
  // Don't override if manually edited
  if (endDateManuallyEdited.value) return

  // Clear end date for periodic
  if (form.value.paymentTerms === 'periodic') {
    form.value.endDate = ''
    return
  }

  // Need start date and term length
  if (!form.value.startDate || !form.value.termLength) {
    form.value.endDate = ''
    return
  }

  const startDate = new Date(form.value.startDate)

  if (form.value.paymentTerms === 'monthly') {
    // Add months, then subtract 1 day
    // e.g., 10th Feb + 6 months = 10th Aug, minus 1 day = 9th Aug
    startDate.setMonth(startDate.getMonth() + form.value.termLength)
    startDate.setDate(startDate.getDate() - 1)
  } else if (form.value.paymentTerms === 'weekly') {
    // Add weeks (7 days each), then subtract 1 day
    startDate.setDate(startDate.getDate() + (form.value.termLength * 7) - 1)
  } else if (form.value.paymentTerms === 'quarterly') {
    // Add quarters (3 months each), then subtract 1 day
    startDate.setMonth(startDate.getMonth() + (form.value.termLength * 3))
    startDate.setDate(startDate.getDate() - 1)
  }

  form.value.endDate = startDate.toISOString().split('T')[0] || ''
}

const calculateDeposit = () => {
  // 5 weeks pro-rata: (monthly rent * 12 / 52) * 5
  if (form.value.monthlyRent > 0) {
    const weeklyRent = (form.value.monthlyRent * 12) / 52
    form.value.depositAmount = Math.round(weeklyRent * 5 * 100) / 100
  }
}

const resetEndDate = () => {
  endDateManuallyEdited.value = false
  calculateEndDate()
}

const loadProperties = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Fetch ALL properties by paginating through all pages
    let allProperties: any[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const response = await authFetch(`${API_URL}/api/properties?page=${page}&limit=${limit}`, { token })

      if (response.ok) {
        const data = await response.json()
        const pageProperties = data.properties || []
        allProperties = [...allProperties, ...pageProperties]

        // Check if there are more pages
        const pagination = data.pagination
        if (pagination && pagination.page < pagination.totalPages) {
          page++
        } else {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    properties.value = allProperties
    console.log(`[CreateTenancy] Loaded ${allProperties.length} properties`)
  } catch (err) {
    console.error('Error loading properties:', err)
  }
}

const loadCompletedReferences = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenancies?status=completed`, { token })

    if (response.ok) {
      const data = await response.json()
      completedReferences.value = (data.tenancies || []).map((t: any) => {
        // Get all tenants (non-guarantors) from the people array
        const tenants = (t.people || []).filter((p: any) => !p.isGuarantor)
        const leadPerson = tenants[0]
        return {
          id: t.id,
          tenantName: leadPerson?.name || 'Unknown',
          propertyAddress: t.propertyAddress,
          monthlyRent: t.monthlyRent || 0,
          moveInDate: t.moveInDate || '',
          depositAmount: t.depositAmount || 0,
          // Store ALL tenants for use when creating tenancy
          people: tenants.map((p: any, idx: number) => ({
            name: p.name || '',
            email: p.email || '',
            phone: p.phone || '',
            isLeadTenant: idx === 0 // First tenant is lead
          }))
        }
      })
    }
  } catch (err) {
    console.error('Error loading references:', err)
  }
}

// Fuzzy match address to find best property match
const fuzzyMatchProperty = (referenceAddress: string): any | null => {
  if (!referenceAddress) return null

  const normalizeAddress = (addr: string) =>
    addr.toLowerCase().replace(/[^a-z0-9]/g, '')

  const refNormalized = normalizeAddress(referenceAddress)

  // Try exact-ish match first
  for (const prop of properties.value) {
    const propAddr = `${prop.address_line1} ${prop.city} ${prop.postcode}`
    const propNormalized = normalizeAddress(propAddr)
    if (propNormalized === refNormalized || propNormalized.includes(refNormalized) || refNormalized.includes(propNormalized)) {
      return prop
    }
  }

  // Try matching just the first line and postcode
  const refParts = referenceAddress.toLowerCase().split(',').map(s => s.trim())
  for (const prop of properties.value) {
    const propFirstLine = (prop.address_line1 || '').toLowerCase().trim()
    const propPostcode = (prop.postcode || '').toLowerCase().trim()

    for (const part of refParts) {
      if (part === propFirstLine || part === propPostcode) {
        return prop
      }
      // Check if postcode is in the reference address
      if (propPostcode && referenceAddress.toLowerCase().includes(propPostcode)) {
        return prop
      }
    }
  }

  return null
}

// Select a reference from dropdown
const selectReference = (ref: any) => {
  selectedReference.value = ref
  form.value.referenceId = ref.id
  referenceSearch.value = `${ref.tenantName} - ${ref.propertyAddress}`
  showReferenceDropdown.value = false

  // Auto-populate form fields from reference
  if (ref.monthlyRent > 0) {
    form.value.monthlyRent = ref.monthlyRent
    calculateDeposit()
  }
  if (ref.moveInDate) {
    form.value.startDate = ref.moveInDate
    endDateManuallyEdited.value = false
    calculateEndDate()
  }
  if (ref.depositAmount > 0) {
    form.value.depositAmount = ref.depositAmount
  }

  // Clear manual tenant fields - they're not needed when reference is linked
  // Tenants will come from the reference's people array
  form.value.tenantFirstName = ''
  form.value.tenantLastName = ''
  form.value.tenantEmail = ''
  form.value.tenantPhone = ''

  // Try to fuzzy match property
  propertyMatchedFromReference.value = false
  propertyCreatedFromReference.value = false
  pendingPropertyData.value = null

  if (ref.propertyAddress) {
    const matchedProperty = fuzzyMatchProperty(ref.propertyAddress)
    if (matchedProperty) {
      form.value.propertyId = matchedProperty.id
      propertySearch.value = `${matchedProperty.address_line1}, ${matchedProperty.city} ${matchedProperty.postcode}`
      propertyMatchedFromReference.value = true
    } else {
      // No match - set up pending property creation
      propertyCreatedFromReference.value = true
      pendingPropertyData.value = {
        address: ref.propertyAddress
      }
      propertySearch.value = ref.propertyAddress
      form.value.propertyId = ''
    }
  }
}

// Clear reference selection
const clearReference = () => {
  selectedReference.value = null
  form.value.referenceId = ''
  referenceSearch.value = ''
  showReferenceDropdown.value = false
}

// Select a property from dropdown
const selectProperty = (prop: any) => {
  form.value.propertyId = prop.id
  propertySearch.value = `${prop.address_line1}, ${prop.city} ${prop.postcode}`
  showPropertyDropdown.value = false
  propertyMatchedFromReference.value = false
  propertyCreatedFromReference.value = false
  pendingPropertyData.value = null
}

// Create property from search text (for legacy references)
const createPropertyFromSearch = () => {
  propertyCreatedFromReference.value = true
  pendingPropertyData.value = {
    address: propertySearch.value
  }
  showPropertyDropdown.value = false
}

// Create a new property record
const createProperty = async (addressData: any): Promise<string | null> => {
  try {
    const token = authStore.session?.access_token
    if (!token) return null

    // Parse address - simple split for now
    const parts = addressData.address.split(',').map((s: string) => s.trim())
    const addressLine1 = parts[0] || addressData.address
    const city = parts[1] || ''
    const postcode = parts[parts.length - 1] || ''

    const response = await authFetch(`${API_URL}/api/properties`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address_line1: addressLine1,
        city: city,
        postcode: postcode,
        property_type: 'residential',
        status: 'let'
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data.property?.id || data.id
    }
    return null
  } catch (err) {
    console.error('Error creating property:', err)
    return null
  }
}

// Delayed close to allow click events to fire first
const delayedCloseReferenceDropdown = () => {
  setTimeout(() => {
    showReferenceDropdown.value = false
  }, 200)
}

const delayedClosePropertyDropdown = () => {
  setTimeout(() => {
    showPropertyDropdown.value = false
  }, 200)
}

const handleSubmit = async () => {
  if (!isValid.value) return

  submitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // If we need to create a property first
    let propertyId = form.value.propertyId
    if (!propertyId && pendingPropertyData.value) {
      const newPropertyId = await createProperty(pendingPropertyData.value)
      if (!newPropertyId) {
        throw new Error('Failed to create property')
      }
      propertyId = newPropertyId
    }

    if (!propertyId) {
      throw new Error('No property selected')
    }

    const payload: any = {
      propertyId: propertyId,
      tenancyType: form.value.tenancyType,
      startDate: form.value.startDate,
      // Only send endDate if it has a value (periodic tenancies have no end date)
      endDate: form.value.endDate && form.value.endDate.trim() ? form.value.endDate : null,
      monthlyRent: form.value.monthlyRent,
      depositAmount: form.value.depositAmount || undefined,
      rentDueDay: form.value.rentDueDay,
      notes: form.value.notes || undefined
    }

    // If reference linked, include it and use its tenants
    if (form.value.referenceId && selectedReference.value) {
      payload.primaryReferenceId = form.value.referenceId

      // Extract tenants from reference's people array
      const refPeople = selectedReference.value.people || []
      if (refPeople.length > 0) {
        payload.tenants = refPeople.map((person: any) => {
          // Split name into first/last
          const nameParts = (person.name || '').trim().split(' ')
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || ''
          return {
            firstName,
            lastName,
            email: person.email || undefined,
            phone: person.phone || undefined,
            isLeadTenant: person.isLeadTenant || false
          }
        })
      }
    } else if (form.value.tenantFirstName && form.value.tenantLastName) {
      // Manual entry - no reference linked
      payload.tenants = [{
        firstName: form.value.tenantFirstName,
        lastName: form.value.tenantLastName,
        email: form.value.tenantEmail || undefined,
        phone: form.value.tenantPhone || undefined,
        isLeadTenant: true
      }]
    }

    const response = await authFetch(`${API_URL}/api/tenancies/create`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create tenancy')
    }

    toast.success('Tenancy created successfully')
    emit('created')
  } catch (err: any) {
    console.error('Error creating tenancy:', err)
    error.value = err.message || 'Failed to create tenancy'
  } finally {
    submitting.value = false
  }
}

// Reset form when modal opens
watch(() => props.show, async (isShow) => {
  if (isShow) {
    form.value = {
      propertyId: '',
      referenceId: '',
      startDate: new Date().toISOString().split('T')[0] || '',
      endDate: '',
      paymentTerms: 'monthly',
      termLength: 6,
      monthlyRent: 0,
      depositAmount: 0,
      rentDueDay: 1,
      tenancyType: 'ast',
      tenantFirstName: '',
      tenantLastName: '',
      tenantEmail: '',
      tenantPhone: '',
      notes: ''
    }
    error.value = ''
    endDateManuallyEdited.value = false

    // Reset search state
    referenceSearch.value = ''
    propertySearch.value = ''
    showReferenceDropdown.value = false
    showPropertyDropdown.value = false
    selectedReference.value = null
    propertyMatchedFromReference.value = false
    propertyCreatedFromReference.value = false
    pendingPropertyData.value = null

    loading.value = true
    await Promise.all([loadProperties(), loadCompletedReferences()])
    loading.value = false

    // Pre-select property if provided
    if (props.preselectedPropertyId) {
      const matchedProp = properties.value.find(p => p.id === props.preselectedPropertyId)
      if (matchedProp) {
        selectProperty(matchedProp)
      }
    }

    // Calculate initial end date
    calculateEndDate()
  }
})
</script>
