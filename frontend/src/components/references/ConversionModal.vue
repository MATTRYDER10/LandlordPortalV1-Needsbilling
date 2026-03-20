<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="p-6 pb-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Convert to Tenancy</h3>
            <button
              @click="$emit('close')"
              class="text-gray-400 hover:text-gray-600"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Convert this completed reference into an active tenancy record.
          </p>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Loading State -->
          <div v-if="loading" class="flex items-center justify-center py-12">
            <Loader2 class="w-8 h-8 animate-spin text-primary" />
            <span class="ml-3 text-gray-600">Validating conversion...</span>
          </div>

          <!-- Error State -->
          <div v-else-if="validationErrors.length > 0" class="space-y-4">
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="text-sm font-medium text-red-800">Cannot Convert</h4>
                  <ul class="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                    <li v-for="error in validationErrors" :key="error">{{ error }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview & Options -->
          <template v-else-if="previewData">
            <!-- Warnings -->
            <div v-if="validationWarnings.length > 0" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="text-sm font-medium text-amber-800">Warnings</h4>
                  <ul class="mt-2 text-sm text-amber-700 list-disc list-inside space-y-1">
                    <li v-for="warning in validationWarnings" :key="warning">{{ warning }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Property Selection (for legacy references) -->
            <div v-if="needsPropertySelection" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <Building2 class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <h4 class="text-sm font-medium text-blue-800">Property Selection Required</h4>
                  <p class="mt-1 text-sm text-blue-700">
                    This reference doesn't have a linked property. Please select or create one:
                  </p>
                  <div class="mt-3 relative">
                    <div class="relative">
                      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        v-model="propertySearch"
                        type="text"
                        placeholder="Search properties by address..."
                        class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white"
                        :class="{ 'border-green-500': selectedProperty, 'border-red-500': needsPropertySelection && !selectedProperty && !pendingPropertyData }"
                        @focus="showPropertyDropdown = true"
                        @blur="delayedClosePropertyDropdown"
                      />
                    </div>
                    <!-- Property Dropdown -->
                    <div
                      v-if="showPropertyDropdown && (filteredProperties.length > 0 || propertySearch)"
                      class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      <button
                        v-for="prop in filteredProperties"
                        :key="prop.id"
                        type="button"
                        class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        @mousedown.prevent="selectProperty(prop)"
                      >
                        <span class="font-medium">{{ prop.address_line1 || prop.address || prop.postcode }}</span>
                        <span v-if="prop.city || prop.postcode" class="text-gray-500 ml-2">{{ [prop.city, prop.postcode].filter(Boolean).join(' ') }}</span>
                      </button>
                      <div v-if="filteredProperties.length === 0 && propertySearch" class="px-3 py-2 text-sm text-gray-500">
                        No properties found
                        <button
                          type="button"
                          class="ml-2 text-primary hover:text-primary/80 font-medium"
                          @mousedown.prevent="createPropertyFromSearch"
                        >
                          Create new property
                        </button>
                      </div>
                    </div>
                  </div>
                  <p v-if="selectedProperty" class="mt-2 text-xs text-green-600">
                    Selected: {{ editableDetails.address || selectedProperty.address_line1 }}, {{ editableDetails.city || selectedProperty.city }} {{ editableDetails.postcode || selectedProperty.postcode }}
                    <span v-if="propertyMatchedFromReference" class="text-blue-600 ml-1">(auto-matched)</span>
                  </p>
                  <p v-else-if="pendingPropertyData" class="mt-2 text-xs text-amber-600">
                    New property will be created: {{ pendingPropertyData.address }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Property Summary - Editable -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-900 mb-3">Property Details</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="col-span-2">
                  <label class="block text-gray-500 mb-1">Address</label>
                  <input
                    v-model="editableDetails.address"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-gray-500 mb-1">City</label>
                  <input
                    v-model="editableDetails.city"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-gray-500 mb-1">Postcode</label>
                  <input
                    v-model="editableDetails.postcode"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-gray-500 mb-1">Monthly Rent (&pound;)</label>
                  <input
                    v-model.number="editableDetails.monthlyRent"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    @input="onRentChange"
                  />
                </div>
                <div>
                  <label class="block text-gray-500 mb-1">Move-in Date</label>
                  <input
                    v-model="editableDetails.moveInDate"
                    type="date"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-gray-500 mb-1">Term Length (months)</label>
                  <input
                    v-model.number="editableDetails.termMonths"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <!-- Tenants & Guarantors Summary -->
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-gray-900">
                  People ({{ allPeople.length }})
                </h4>
                <button
                  type="button"
                  @click="splitRentEvenly"
                  class="text-xs text-primary hover:text-primary/80"
                >
                  Split evenly
                </button>
              </div>
              <div class="space-y-3">
                <!-- Only show rent for tenants, not guarantors -->
                <div
                  v-for="(person, index) in allPeople"
                  :key="person.id || person.referenceId"
                  class="flex items-center justify-between text-sm"
                >
                  <div class="flex items-center gap-2">
                    <User class="w-4 h-4 text-gray-400" />
                    <span class="font-medium text-gray-900">{{ person.firstName || person.name?.split(' ')[0] }} {{ person.lastName || person.name?.split(' ').slice(1).join(' ') }}</span>
                    <span v-if="person.role === 'TENANT' || person.isLeadTenant" class="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      Tenant
                    </span>
                    <span v-else-if="person.role === 'GUARANTOR'" class="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                      Guarantor
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-gray-500">&pound;</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      :value="getTenantRentShare(index)"
                      @input="updateRentShare(index, ($event.target as HTMLInputElement).value)"
                      class="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-primary focus:border-primary"
                      :class="{
                        'border-red-300': !rentSharesValid && (person.role === 'TENANT' || (!person.role && !person.isGuarantor)),
                        'border-purple-300': person.role === 'GUARANTOR'
                      }"
                    />
                    <span class="text-gray-500">/month</span>
                  </div>
                </div>
              </div>
              <!-- Rent total validation -->
              <div class="mt-3 pt-3 border-t border-gray-200 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Tenant rent total:</span>
                  <span :class="rentSharesValid ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                    &pound;{{ tenantRentTotal.toFixed(2) }} / &pound;{{ (editableDetails.monthlyRent || 0).toFixed(2) }}
                    <span v-if="rentSharesValid" class="text-green-500">✓</span>
                    <span v-else class="text-red-500">✗</span>
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-1">
                  Guarantor liability mirrors tenant - doesn't add to total
                </p>
              </div>
            </div>

            <!-- Conversion Options -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-gray-900">Tenancy Options</h4>

              <!-- Deposit Amount -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Deposit Amount (&pound;)
                </label>
                <input
                  v-model.number="options.depositAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  :placeholder="defaultDeposit.toString()"
                />
                <p class="mt-1 text-xs text-gray-500">
                  Default: 5 weeks rent (&pound;{{ defaultDeposit.toLocaleString() }})
                </p>
              </div>

              <!-- Deposit Scheme -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Deposit Protection Scheme
                </label>
                <select
                  v-model="options.depositScheme"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option value="">Select scheme...</option>
                  <option value="dps_custodial">DPS Custodial</option>
                  <option value="dps_insured">DPS Insured</option>
                  <option value="mydeposits_custodial">MyDeposits Custodial</option>
                  <option value="mydeposits_insured">MyDeposits Insured</option>
                  <option value="tds_custodial">TDS Custodial</option>
                  <option value="tds_insured">TDS Insured</option>
                  <option value="reposit">Reposit (Deposit-free)</option>
                  <option value="no_deposit">No Deposit</option>
                </select>
              </div>

              <!-- Rent Due Day -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Rent Due Day of Month
                </label>
                <select
                  v-model.number="options.rentDueDay"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option v-for="day in 31" :key="day" :value="day">{{ day }}{{ day === defaultRentDueDay ? ' (from move-in date)' : '' }}</option>
                </select>
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  v-model="options.notes"
                  rows="2"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="Any notes about this tenancy..."
                ></textarea>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="p-6 pt-4 border-t border-gray-200">
          <!-- Post-conversion success state -->
          <div v-if="conversionComplete" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center gap-2 text-green-800">
                <ArrowRightCircle class="w-5 h-5" />
                <span class="font-medium">Tenancy created successfully!</span>
              </div>
              <p class="mt-1 text-sm text-green-700">What would you like to do next?</p>
            </div>
            <div class="flex justify-end gap-3">
              <button
                @click="$emit('close')"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Close
              </button>
              <button
                @click="goToAgreement"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md flex items-center gap-2"
              >
                <FileText class="w-4 h-4" />
                Generate Agreement
              </button>
              <button
                @click="goToTenancy"
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center gap-2"
              >
                <Home class="w-4 h-4" />
                View Tenancy
              </button>
            </div>
          </div>

          <!-- Pre-conversion state -->
          <div v-else class="flex justify-end gap-3">
            <!-- Debug: show why we can't convert -->
            <span v-if="!canConvert && previewData" class="text-xs text-red-500 self-center">
              {{ needsPropertySelection && !selectedProperty && !pendingPropertyData ? 'Select a property above' : '' }}
              {{ validationErrors.length > 0 ? validationErrors.join(', ') : '' }}
            </span>
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              v-if="previewData"
              @click="convert"
              :disabled="converting || !canConvert"
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2 v-if="converting" class="w-4 h-4 animate-spin" />
              <ArrowRightCircle v-else class="w-4 h-4" />
              {{ converting ? 'Converting...' : 'Convert to Tenancy' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { X, AlertTriangle, User, Loader2, ArrowRightCircle, Search, Building2, FileText, Home } from 'lucide-vue-next'
import type { Tenancy } from '@/composables/useTenancies'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const props = defineProps<{
  show: boolean
  tenancy: Tenancy | null
}>()

const emit = defineEmits<{
  close: []
  converted: []
}>()

const router = useRouter()
const authStore = useAuthStore()
// State
const loading = ref(false)
const converting = ref(false)
const conversionComplete = ref(false)
const createdTenancyId = ref<string | null>(null)
const validationErrors = ref<string[]>([])
const validationWarnings = ref<string[]>([])
const previewData = ref<{
  referenceId: string
  propertyAddress: string
  propertyCity: string
  propertyPostcode: string
  monthlyRent: number
  moveInDate: string
  termYears: number
  termMonths: number
  agreementSigned: boolean
  tenants: Array<{
    referenceId: string
    firstName: string
    lastName: string
    email: string
    rentShare?: number
    isLeadTenant: boolean
  }>
} | null>(null)

const options = ref({
  depositAmount: null as number | null,
  depositScheme: '',
  rentDueDay: null as number | null, // Will default to move-in date day
  activateImmediately: true,
  notes: ''
})

// Editable rent shares for each person
const rentShares = ref<Record<number, number>>({})

// Editable property/tenancy details
const editableDetails = ref({
  address: '',
  city: '',
  postcode: '',
  monthlyRent: 0,
  moveInDate: '',
  termMonths: 6
})

// Property selection for legacy references without linked_property_id
const needsPropertySelection = ref(false)
const properties = ref<any[]>([])
const propertySearch = ref('')
const showPropertyDropdown = ref(false)
const selectedProperty = ref<any>(null)
const propertyMatchedFromReference = ref(false)
const pendingPropertyData = ref<any>(null)

// Computed
const defaultDeposit = computed(() => {
  if (!previewData.value) return 0
  return Math.round((previewData.value.monthlyRent * 12 / 52) * 5 * 100) / 100 // 5 weeks rent
})

const defaultRentDueDay = computed(() => {
  const moveInDate = editableDetails.value.moveInDate || previewData.value?.moveInDate
  if (!moveInDate) return 1
  const day = new Date(moveInDate).getDate()
  return Math.min(day, 31)
})

// Extract postcode from a string (UK format)
const extractPostcode = (str: string): string => {
  const match = str.match(/([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i)
  return match ? match[1]!.toUpperCase().replace(/\s/g, '') : ''
}

// Extract house number from address
const extractHouseNumber = (str: string): string => {
  const match = str.match(/^(\d+[A-Za-z]?)\s/)
  return match ? match[1]!.toLowerCase() : ''
}

// Filtered properties based on search - prioritize postcode matches
const filteredProperties = computed(() => {
  if (!propertySearch.value.trim()) {
    return properties.value
  }

  const search = propertySearch.value.toLowerCase().trim()
  const searchPostcode = extractPostcode(propertySearch.value)
  const searchHouseNumber = extractHouseNumber(propertySearch.value)

  // Score each property for relevance
  const scored = properties.value.map(prop => {
    const address = (prop.address_line1 || '').toLowerCase()
    const city = (prop.city || '').toLowerCase()
    const postcode = (prop.postcode || '').toUpperCase().replace(/\s/g, '')
    const propHouseNumber = extractHouseNumber(prop.address_line1 || '')

    let score = 0

    // Postcode match is highest priority
    if (searchPostcode && postcode === searchPostcode) {
      score += 100
    } else if (searchPostcode && postcode.startsWith(searchPostcode.slice(0, -3))) {
      // Partial postcode match (same area)
      score += 50
    }

    // House number match
    if (searchHouseNumber && propHouseNumber === searchHouseNumber) {
      score += 30
    }

    // General text matching
    if (address.includes(search) || city.includes(search) || postcode.toLowerCase().includes(search)) {
      score += 10
    }

    // Any word match
    const searchWords = search.split(/[\s,]+/).filter(w => w.length > 2)
    for (const word of searchWords) {
      if (address.includes(word) || city.includes(word)) {
        score += 5
      }
    }

    return { prop, score }
  })

  // Filter to those with any match and sort by score
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.prop)
})

// Check if conversion is ready (has property and valid rent shares)
const canConvert = computed(() => {
  if (validationErrors.value.length > 0) return false
  if (needsPropertySelection.value && !selectedProperty.value && !pendingPropertyData.value) return false
  if (!rentSharesValid.value) return false
  return !!previewData.value
})

// All people (tenants + guarantors) for display
const allPeople = computed((): any[] => {
  // If we have tenancy.people from the prop, use that (includes role info)
  if (props.tenancy?.people) {
    return props.tenancy.people as any[]
  }
  // Otherwise fall back to previewData.tenants
  return (previewData.value?.tenants || []) as any[]
})

// Calculate total tenant rent
const tenantRentTotal = computed(() => {
  let total = 0
  allPeople.value.forEach((person: any, index: number) => {
    if (person.role === 'TENANT' || (!person.role && !person.isGuarantor)) {
      total += getTenantRentShare(index)
    }
  })
  return total
})

// Check if rent shares are valid (equal to monthly rent)
const rentSharesValid = computed(() => {
  const monthlyRent = editableDetails.value.monthlyRent || previewData.value?.monthlyRent || 0
  return Math.abs(tenantRentTotal.value - monthlyRent) < 0.01
})

// Get rent share for a specific person index
const getTenantRentShare = (index: number): number => {
  if (rentShares.value[index] !== undefined) {
    return rentShares.value[index]
  }
  const person = allPeople.value[index]
  return person?.rentShare || 0
}

// Methods
// Load properties for selection - fetch all pages
const loadProperties = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    let allProperties: any[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const response = await authFetch(`${API_URL}/api/properties?limit=${limit}&page=${page}`, {
        token
      })

      if (response.ok) {
        const data = await response.json()
        const props = data.properties || []
        allProperties = [...allProperties, ...props]
        // Check if there are more pages
        hasMore = props.length === limit
        page++
      } else {
        hasMore = false
      }
    }

    properties.value = allProperties
  } catch (err) {
    console.error('Error loading properties:', err)
  }
}

// Fuzzy match address to find best property match
const fuzzyMatchProperty = (referenceAddress: string): any | null => {
  if (!referenceAddress || properties.value.length === 0) return null

  const refPostcode = extractPostcode(referenceAddress)
  const refHouseNumber = extractHouseNumber(referenceAddress)

  // Priority 1: Match by postcode + house number (most reliable)
  if (refPostcode && refHouseNumber) {
    for (const prop of properties.value) {
      const propPostcode = (prop.postcode || '').toUpperCase().replace(/\s/g, '')
      const propHouseNumber = extractHouseNumber(prop.address_line1 || '')
      if (propPostcode === refPostcode && propHouseNumber === refHouseNumber) {
        return prop
      }
    }
  }

  // Priority 2: Match by postcode only (if unique match)
  if (refPostcode) {
    const postcodeMatches = properties.value.filter(prop => {
      const propPostcode = (prop.postcode || '').toUpperCase().replace(/\s/g, '')
      return propPostcode === refPostcode
    })
    if (postcodeMatches.length === 1) {
      return postcodeMatches[0]
    }
    // If multiple matches and we have house number, try to find best match
    if (postcodeMatches.length > 1 && refHouseNumber) {
      const houseMatch = postcodeMatches.find(prop => {
        const propHouseNumber = extractHouseNumber(prop.address_line1 || '')
        return propHouseNumber === refHouseNumber
      })
      if (houseMatch) return houseMatch
    }
  }

  // Priority 3: Normalized address matching (fallback)
  const normalizeAddress = (addr: string) =>
    addr.toLowerCase().replace(/[^a-z0-9]/g, '')

  const refNormalized = normalizeAddress(referenceAddress)

  for (const prop of properties.value) {
    const propAddr = `${prop.address_line1} ${prop.city} ${prop.postcode}`
    const propNormalized = normalizeAddress(propAddr)
    if (propNormalized === refNormalized || propNormalized.includes(refNormalized) || refNormalized.includes(propNormalized)) {
      return prop
    }
  }

  return null
}

// Select a property from dropdown
const selectProperty = (prop: any) => {
  selectedProperty.value = prop
  // Build display string, filtering out null/empty values
  const addressParts = [prop.address_line1, prop.city, prop.postcode].filter(Boolean)
  propertySearch.value = addressParts.join(', ') || prop.postcode || 'Unknown address'
  showPropertyDropdown.value = false
  propertyMatchedFromReference.value = false
  pendingPropertyData.value = null
  // Populate editable details from selected property
  editableDetails.value.address = prop.address_line1 || ''
  editableDetails.value.city = prop.city || ''
  editableDetails.value.postcode = prop.postcode || ''
}

// Create property from search text
const createPropertyFromSearch = () => {
  // Use all available address info from the reference
  pendingPropertyData.value = {
    address: propertySearch.value || previewData.value?.propertyAddress || props.tenancy?.propertyAddress,
    city: previewData.value?.propertyCity || props.tenancy?.propertyCity || '',
    postcode: previewData.value?.propertyPostcode || props.tenancy?.propertyPostcode || ''
  }
  showPropertyDropdown.value = false
}

// Create a new property record
const createProperty = async (addressData: any): Promise<string | null> => {
  try {
    const token = authStore.session?.access_token
    if (!token) return null

    // Use provided city/postcode if available, otherwise parse from address
    let addressLine1 = ''
    let city = addressData.city || ''
    let postcode = addressData.postcode || ''

    const fullAddress = addressData.address || ''

    // If no postcode provided, try to extract from address (UK format)
    if (!postcode) {
      const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i
      const postcodeMatch = fullAddress.match(postcodeRegex)
      postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : ''
    }

    // Remove postcode from address to parse the rest
    let addressWithoutPostcode = fullAddress.replace(/([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i, '').trim()
    addressWithoutPostcode = addressWithoutPostcode.replace(/,\s*$/, '') // Remove trailing comma

    // Split by comma
    const parts = addressWithoutPostcode.split(',').map((s: string) => s.trim()).filter(Boolean)

    // First part is address line 1, last part (if different and no city) is city
    addressLine1 = parts[0] || fullAddress
    if (!city && parts.length > 1) {
      city = parts[parts.length - 1]
    }

    console.log('[CreateProperty] Parsed:', { addressLine1, city, postcode, original: fullAddress })

    const response = await authFetch(`${API_URL}/api/properties`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: {
          line1: addressLine1,
          city: city,
          postcode: postcode
        },
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

// Delayed close for dropdown
const delayedClosePropertyDropdown = () => {
  setTimeout(() => {
    showPropertyDropdown.value = false
  }, 200)
}

// Update rent share for a person
const updateRentShare = (index: number, value: string) => {
  rentShares.value[index] = parseFloat(value) || 0
}

// Initialize rent shares - split evenly among tenants on load
const initializeRentShares = () => {
  const monthlyRent = editableDetails.value.monthlyRent || previewData.value?.monthlyRent || props.tenancy?.monthlyRent || 0
  const people = allPeople.value

  // Find tenant indices
  const tenantIndices: number[] = []
  people.forEach((person: any, index: number) => {
    if (person.role === 'TENANT' || (!person.role && !person.isGuarantor)) {
      tenantIndices.push(index)
    }
  })

  if (tenantIndices.length === 0) return

  const sharePerTenant = Math.floor((monthlyRent / tenantIndices.length) * 100) / 100
  const remainder = Math.round((monthlyRent - (sharePerTenant * tenantIndices.length)) * 100) / 100

  tenantIndices.forEach((idx, i) => {
    rentShares.value[idx] = i === 0 ? sharePerTenant + remainder : sharePerTenant
  })

  // Set guarantor liabilities to match their tenant's liability
  people.forEach((person: any, index: number) => {
    if (person.role === 'GUARANTOR') {
      // Find the tenant this guarantor is for and copy their rent share
      const tenantId = person.guarantorForTenantId || person.guarantor_for_reference_id
      const tenantIndex = people.findIndex((p: any) => p.id === tenantId || p.referenceId === tenantId)
      if (tenantIndex >= 0) {
        rentShares.value[index] = rentShares.value[tenantIndex] || sharePerTenant
      } else {
        // If no specific tenant, use average
        rentShares.value[index] = sharePerTenant
      }
    }
  })
}

// Split rent evenly among tenants (and mirror to guarantors)
const splitRentEvenly = () => {
  initializeRentShares()
}

// When rent changes, recalculate shares
const onRentChange = () => {
  // Update deposit default (5 weeks)
  options.value.depositAmount = Math.round((editableDetails.value.monthlyRent * 12 / 52) * 5 * 100) / 100
  // Recalculate rent shares
  initializeRentShares()
}

// Parse a full address string into editable details (address, city, postcode)
const parseAddressIntoEditableDetails = (fullAddress: string) => {
  if (!fullAddress) return

  // UK postcode regex pattern
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i
  const postcodeMatch = fullAddress.match(postcodeRegex)
  const postcode = postcodeMatch && postcodeMatch[1] ? postcodeMatch[1].toUpperCase() : ''

  // Remove postcode from address
  let addressWithoutPostcode = fullAddress.replace(postcodeRegex, '').trim()
  addressWithoutPostcode = addressWithoutPostcode.replace(/,\s*$/, '') // Remove trailing comma

  // Split by comma
  const parts = addressWithoutPostcode.split(',').map(s => s.trim()).filter(Boolean)

  // First part is address line 1
  const addressLine1 = parts[0] || ''
  // Last part (if different from first) is city
  const city = parts.length > 1 ? (parts[parts.length - 1] || '') : ''

  editableDetails.value.address = addressLine1
  editableDetails.value.city = city
  editableDetails.value.postcode = postcode

  console.log('[ParseAddress]', { fullAddress, addressLine1, city, postcode })
}

const loadPreview = async () => {
  if (!props.tenancy) return

  loading.value = true
  validationErrors.value = []
  validationWarnings.value = []
  previewData.value = null
  needsPropertySelection.value = false
  selectedProperty.value = null
  propertyMatchedFromReference.value = false
  pendingPropertyData.value = null
  propertySearch.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      validationErrors.value = ['Not authenticated']
      return
    }

    // Load properties for fuzzy matching
    await loadProperties()

    const response = await authFetch(
      `${API_URL}/api/tenancies/convert/preview/${props.tenancy.id}`,
      {
        token
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to load preview')
    }

    const data = await response.json()

    // Check if the only error is missing property
    const errors = data.errors || []
    const hasOnlyPropertyError = errors.length === 1 &&
      errors[0].toLowerCase().includes('not linked to a property')

    if (!data.canConvert && hasOnlyPropertyError) {
      // Allow conversion with property selection
      needsPropertySelection.value = true
      validationErrors.value = [] // Clear the property error - we'll handle it

      // Try to fuzzy match from reference address
      if (props.tenancy.propertyAddress) {
        // Build full address for matching
        const fullAddress = [
          props.tenancy.propertyAddress,
          props.tenancy.propertyCity,
          props.tenancy.propertyPostcode
        ].filter(Boolean).join(', ')

        const matchedProperty = fuzzyMatchProperty(fullAddress)
        if (matchedProperty) {
          selectedProperty.value = matchedProperty
          // Use reference address if property has null address fields
          const displayAddress = matchedProperty.address_line1 || props.tenancy.propertyAddress || ''
          const displayCity = matchedProperty.city || props.tenancy.propertyCity || ''
          const displayPostcode = matchedProperty.postcode || props.tenancy.propertyPostcode || ''
          propertySearch.value = `${displayAddress}, ${displayCity} ${displayPostcode}`
          propertyMatchedFromReference.value = true
          // Populate editable details - prefer property data, fallback to reference
          editableDetails.value.address = displayAddress
          editableDetails.value.city = displayCity
          editableDetails.value.postcode = displayPostcode
        } else {
          // Pre-fill search with full reference address
          propertySearch.value = fullAddress
          // Parse the full address into separate fields
          // If we have separate city/postcode from the tenancy, use them
          // Otherwise parse from the full address string
          if (props.tenancy.propertyCity && props.tenancy.propertyPostcode) {
            editableDetails.value.address = props.tenancy.propertyAddress || ''
            editableDetails.value.city = props.tenancy.propertyCity
            editableDetails.value.postcode = props.tenancy.propertyPostcode
          } else {
            // Parse from full address (references often use single-line address)
            parseAddressIntoEditableDetails(fullAddress)
          }
        }
      }
    } else if (!data.canConvert) {
      // Filter out property error if there are other errors
      validationErrors.value = errors.filter((e: string) =>
        !e.toLowerCase().includes('not linked to a property')
      )
      if (errors.some((e: string) => e.toLowerCase().includes('not linked to a property'))) {
        needsPropertySelection.value = true
      }
    }

    validationWarnings.value = data.warnings || []

    if (data.referenceData) {
      previewData.value = data.referenceData
      options.value.depositAmount = data.referenceData.depositAmount || defaultDeposit.value
      // Default rent due day to the day of the move-in date
      if (data.referenceData.moveInDate) {
        const moveInDay = new Date(data.referenceData.moveInDate).getDate()
        options.value.rentDueDay = Math.min(moveInDay, 31) // Cap at 31 for month consistency
      }
    } else if (needsPropertySelection.value && props.tenancy) {
      // Build preview data from tenancy for legacy references
      previewData.value = {
        referenceId: props.tenancy.id,
        propertyAddress: props.tenancy.propertyAddress || '',
        propertyCity: '',
        propertyPostcode: '',
        monthlyRent: props.tenancy.monthlyRent || 0,
        moveInDate: props.tenancy.moveInDate || '',
        termYears: 0,
        termMonths: 6,
        agreementSigned: false,
        tenants: props.tenancy.people?.filter((p: any) => p.role === 'TENANT').map((p: any) => ({
          referenceId: p.id || props.tenancy?.id,
          firstName: p.name?.split(' ')[0] || '',
          lastName: p.name?.split(' ').slice(1).join(' ') || '',
          email: '',
          isLeadTenant: true
        })) || []
      }
      options.value.depositAmount = defaultDeposit.value
      // Default rent due day to the day of the move-in date
      if (props.tenancy?.moveInDate) {
        const moveInDay = new Date(props.tenancy.moveInDate).getDate()
        options.value.rentDueDay = Math.min(moveInDay, 31)
      }
    }

    // Initialize editable details from preview data
    // Only overwrite if we haven't already parsed the address from property selection logic
    const alreadyParsedAddress = editableDetails.value.city || editableDetails.value.postcode
    if (!alreadyParsedAddress) {
      if (previewData.value) {
        // Check if we have separate city/postcode fields
        const hasSeparateFields = previewData.value.propertyCity || previewData.value.propertyPostcode
        if (hasSeparateFields) {
          editableDetails.value.address = previewData.value.propertyAddress || props.tenancy?.propertyAddress || ''
          editableDetails.value.city = previewData.value.propertyCity || ''
          editableDetails.value.postcode = previewData.value.propertyPostcode || ''
        } else {
          // Parse from full address
          const fullAddress = [
            previewData.value.propertyAddress || props.tenancy?.propertyAddress,
            props.tenancy?.propertyCity,
            props.tenancy?.propertyPostcode
          ].filter(Boolean).join(', ')
          parseAddressIntoEditableDetails(fullAddress)
        }
        editableDetails.value.monthlyRent = previewData.value.monthlyRent || 0
        editableDetails.value.moveInDate = previewData.value.moveInDate || ''
        editableDetails.value.termMonths = (previewData.value.termYears || 0) * 12 + (previewData.value.termMonths || 6)
      } else if (props.tenancy) {
        // Check if tenancy has separate city/postcode fields
        const hasSeparateFields = props.tenancy.propertyCity || props.tenancy.propertyPostcode
        if (hasSeparateFields) {
          editableDetails.value.address = props.tenancy.propertyAddress || ''
          editableDetails.value.city = props.tenancy.propertyCity || ''
          editableDetails.value.postcode = props.tenancy.propertyPostcode || ''
        } else {
          // Parse from full address
          parseAddressIntoEditableDetails(props.tenancy.propertyAddress || '')
        }
        editableDetails.value.monthlyRent = props.tenancy.monthlyRent || 0
        editableDetails.value.moveInDate = props.tenancy.moveInDate || ''
        editableDetails.value.termMonths = 6
      }
    } else {
      // Keep already-parsed address fields, just update other fields
      if (previewData.value) {
        editableDetails.value.monthlyRent = previewData.value.monthlyRent || editableDetails.value.monthlyRent
        editableDetails.value.moveInDate = previewData.value.moveInDate || editableDetails.value.moveInDate
        editableDetails.value.termMonths = (previewData.value.termYears || 0) * 12 + (previewData.value.termMonths || 6)
      }
    }

    // Initialize rent shares - split evenly among tenants by default
    if (previewData.value || props.tenancy) {
      initializeRentShares()
    }
  } catch (error: any) {
    console.error('Failed to load conversion preview:', error)
    validationErrors.value = [error.message || 'Failed to load preview']
  } finally {
    loading.value = false
  }
}

const convert = async () => {
  if (!props.tenancy || !previewData.value) return

  converting.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) {
      validationErrors.value = ['Not authenticated']
      return
    }

    // Handle property creation if needed
    let propertyId = selectedProperty.value?.id
    if (!propertyId && (pendingPropertyData.value || needsPropertySelection.value)) {
      // Use editable details for property creation
      const propertyData = {
        address: editableDetails.value.address,
        city: editableDetails.value.city,
        postcode: editableDetails.value.postcode
      }
      const newPropertyId = await createProperty(propertyData)
      if (!newPropertyId) {
        throw new Error('Failed to create property')
      }
      propertyId = newPropertyId
    }

    let tenancyId: string | null = null

    // If no selected property but we need one, use CreateTenancy endpoint instead
    if (needsPropertySelection.value && propertyId) {
      // Build tenants array from allPeople (includes tenants with their rent shares)
      const tenantsToSend = allPeople.value
        .filter((p: any) => p.role === 'TENANT' || (!p.role && !p.isGuarantor))
        .map((person: any, index: number) => ({
          referenceId: person.referenceId || person.id,
          firstName: person.firstName || person.name?.split(' ')[0] || '',
          lastName: person.lastName || person.name?.split(' ').slice(1).join(' ') || '',
          email: person.email || '',
          phone: person.phone || '',
          isLeadTenant: index === 0,
          rentShare: getTenantRentShare(allPeople.value.indexOf(person))
        }))

      console.log('[ConversionModal] Sending tenants:', tenantsToSend)

      // Use the manual create endpoint for legacy references
      const response = await authFetch(`${API_URL}/api/tenancies/create`, {
        method: 'POST',
        token,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyId: propertyId,
          primaryReferenceId: props.tenancy.id,
          tenancyType: 'ast',
          startDate: editableDetails.value.moveInDate || new Date().toISOString().split('T')[0],
          monthlyRent: editableDetails.value.monthlyRent,
          depositAmount: options.value.depositAmount || undefined,
          depositScheme: options.value.depositScheme || undefined,
          rentDueDay: options.value.rentDueDay || defaultRentDueDay.value,
          notes: options.value.notes || undefined,
          tenants: tenantsToSend
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tenancy')
      }

      const data = await response.json()
      tenancyId = data.tenancy?.id
    } else {
      // Use the standard convert endpoint (has linked_property_id)
      const response = await authFetch(`${API_URL}/api/tenancies/convert`, {
        method: 'POST',
        token,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referenceId: props.tenancy.id,
          propertyId: propertyId || undefined, // Pass property if selected
          depositAmount: options.value.depositAmount || undefined,
          depositScheme: options.value.depositScheme || undefined,
          rentDueDay: options.value.rentDueDay || defaultRentDueDay.value,
          activateImmediately: options.value.activateImmediately,
          notes: options.value.notes || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to convert reference')
      }

      const data = await response.json()
      tenancyId = data.tenancy?.id
    }

    // Mark conversion as complete and store tenancy ID
    createdTenancyId.value = tenancyId
    conversionComplete.value = true
    emit('converted')
  } catch (error: any) {
    console.error('Failed to convert:', error)
    validationErrors.value = [error.message || 'Failed to convert reference']
  } finally {
    converting.value = false
  }
}

// Navigation after conversion
const goToAgreement = () => {
  emit('close')
  // Navigate to agreement generation with the reference ID
  router.push(`/agreements/generate?referenceId=${props.tenancy?.id}`)
}

const goToTenancy = () => {
  emit('close')
  if (createdTenancyId.value) {
    router.push(`/tenancies/${createdTenancyId.value}`)
  } else {
    router.push('/tenancies')
  }
}

// Watch move-in date changes to update rent due day
watch(() => editableDetails.value.moveInDate, (newDate) => {
  if (newDate) {
    const day = new Date(newDate).getDate()
    options.value.rentDueDay = Math.min(day, 31)
  }
})

// Watch for show prop to load preview
watch(() => props.show, (isShow) => {
  if (isShow && props.tenancy) {
    // Reset state
    validationErrors.value = []
    validationWarnings.value = []
    previewData.value = null
    options.value = {
      depositAmount: null,
      depositScheme: '',
      rentDueDay: null,
      activateImmediately: true,
      notes: ''
    }
    // Reset property selection state
    conversionComplete.value = false
    createdTenancyId.value = null
    needsPropertySelection.value = false
    properties.value = []
    propertySearch.value = ''
    showPropertyDropdown.value = false
    selectedProperty.value = null
    propertyMatchedFromReference.value = false
    pendingPropertyData.value = null
    rentShares.value = {}
    editableDetails.value = {
      address: '',
      city: '',
      postcode: '',
      monthlyRent: 0,
      moveInDate: '',
      termMonths: 6
    }

    loadPreview()
  }
})
</script>
