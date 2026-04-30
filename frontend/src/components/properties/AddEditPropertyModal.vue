<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    @click.self="handleClose"
  >
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="handleClose"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white dark:bg-slate-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
        <form @submit.prevent="handleSubmit">
          <div class="bg-white dark:bg-slate-900 px-6 pt-6 pb-4">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ isEdit ? 'Edit Property' : 'Add Property' }}
              </h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <!-- Address Section -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Address</h4>

              <!-- Address Mode Toggle -->
              <div class="flex gap-4 mb-4">
                <label class="flex items-center">
                  <input
                    type="radio"
                    v-model="addressMode"
                    value="split"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600"
                  />
                  <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Split fields</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="radio"
                    v-model="addressMode"
                    value="full"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600"
                  />
                  <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Full address</span>
                </label>
              </div>

              <!-- Full Address -->
              <div v-if="addressMode === 'full'" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Full Address</label>
                  <textarea
                    v-model="form.full_address"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="Enter complete address..."
                  ></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode <span class="text-red-500">*</span></label>
                  <input
                    v-model="form.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>
              </div>

              <!-- Split Address -->
              <div v-else class="space-y-4">
                <div>
                  <AddressAutocomplete
                    v-model="form.line1"
                    label="Address Line 1"
                    :required="addressMode === 'split'"
                    placeholder="Start typing address..."
                    @addressSelected="handleAddressSelected"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 2</label>
                  <input
                    v-model="form.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City</label>
                    <input
                      v-model="form.city"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">County</label>
                    <input
                      v-model="form.county"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode <span class="text-red-500">*</span></label>
                  <input
                    v-model="form.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>
              </div>
            </div>

            <!-- Property Details Section (Optional) -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Property Details (Optional)</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property Type</label>
                  <select
                    v-model="form.property_type"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select type...</option>
                    <option value="flat">Flat</option>
                    <option value="house">House</option>
                    <option value="bungalow">Bungalow</option>
                    <option value="studio">Studio</option>
                    <option value="hmo">HMO</option>
                    <option value="commercial">Commercial</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Furnished Status</label>
                  <select
                    v-model="form.furnishing_status"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="furnished">Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="part_furnished">Part Furnished</option>
                  </select>
                </div>
                <!-- Management type hard-wired to Let Only for landlord portal -->
                <input type="hidden" v-model="form.management_type" />
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Bedrooms</label>
                  <input
                    v-model.number="form.number_of_bedrooms"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Bathrooms</label>
                  <input
                    v-model.number="form.number_of_bathrooms"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Council Tax Band</label>
                  <select
                    v-model="form.council_tax_band"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option v-for="band in ['A','B','C','D','E','F','G','H']" :key="band" :value="band">
                      {{ band }}
                    </option>
                  </select>
                </div>
                <div class="col-span-2 mt-2">
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      v-model="form.bills_included"
                      class="rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
                    />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Bills included in rent</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Landlords Section -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Landlord</h4>

              <!-- Main Landlord (required) -->
              <div class="mb-4">
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Main Landlord <span class="text-red-500">*</span></label>
                <select
                  v-model="selectedLandlordId"
                  @change="setMainLandlord"
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  :class="{ 'border-red-500': !mainLandlord && formSubmitted }"
                >
                  <option value="">Select yourself or a company...</option>
                  <option
                    v-for="l in existingLandlords"
                    :key="l.id"
                    :value="l.id"
                  >{{ l.first_name }}{{ l.last_name === '(Company)' ? ' (Company)' : ' ' + l.last_name }}</option>
                </select>
                <p v-if="!mainLandlord && formSubmitted" class="text-xs text-red-500 mt-1">Main landlord is required</p>
              </div>

              <!-- Main landlord confirmed -->
              <div v-if="mainLandlord" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3">
                <CheckCircle class="h-4 w-4 text-green-600 flex-shrink-0" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getLandlordName(mainLandlord.landlord_id) }}</span>
                  <span class="text-xs text-green-600 ml-2">Main Landlord — 100%</span>
                </div>
              </div>

              <!-- Co-Landlords (only visible after main landlord selected) -->
              <div v-if="mainLandlord">
                <!-- Co-landlord list -->
                <div v-if="coLandlords.length > 0" class="mb-3 space-y-2">
                  <div
                    v-for="(cl, index) in coLandlords"
                    :key="index"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                  >
                    <div class="flex-1">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ cl.first_name }} {{ cl.last_name }}</span>
                      <span v-if="cl.email" class="text-xs text-gray-500 block">{{ cl.email }}</span>
                    </div>
                    <span class="text-xs text-gray-400">Co-Landlord</span>
                    <button type="button" @click="removeCoLandlord(index)" class="text-red-500 hover:text-red-700 p-1">
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Add Co-Landlord button -->
                <button
                  type="button"
                  @click="showNewLandlordForm = !showNewLandlordForm"
                  class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                  :class="showNewLandlordForm
                    ? 'text-white bg-primary border border-primary'
                    : 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-200'"
                >
                  + Add Co-Landlord
                </button>

                <!-- Co-Landlord inline form -->
                <div v-if="showNewLandlordForm" class="mt-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-1">Co-Landlord Details</h5>
                  <p class="text-xs text-gray-400 mb-3">Appears on agreements alongside the main landlord. Bank details use the main landlord's.</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input v-model="newLandlord.first_name" type="text" placeholder="First name *"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <input v-model="newLandlord.last_name" type="text" placeholder="Last name *"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                    </div>
                    <div class="col-span-2">
                      <input v-model="newLandlord.email" type="email" placeholder="Email (optional)"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                    </div>
                    <div class="col-span-2">
                      <button type="button" @click="addCoLandlord"
                        :disabled="!newLandlord.first_name || !newLandlord.last_name"
                        class="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
                        Add Co-Landlord
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes Section -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
              <textarea
                v-model="form.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                placeholder="Any additional notes..."
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 dark:bg-slate-800 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Property') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/auth'
import { authFetch } from '../../lib/authFetch'
import { X, CheckCircle } from 'lucide-vue-next'
import AddressAutocomplete from '../AddressAutocomplete.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface LandlordAssignment {
  landlord_id?: string
  create_new?: boolean
  ownership_percentage: number
  is_primary_contact?: boolean
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

interface PropertyForm {
  full_address: string
  line1: string
  line2: string
  city: string
  county: string
  postcode: string
  property_type: string
  number_of_bedrooms: number | null
  number_of_bathrooms: number | null
  council_tax_band: string
  furnishing_status: string
  management_type: string
  bills_included: boolean
  notes: string
  landlords: LandlordAssignment[]
}

interface ExistingLandlord {
  id: string
  first_name: string
  last_name: string
  email: string
}

const props = defineProps<{
  show: boolean
  propertyId?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const isEdit = computed(() => !!props.propertyId)
const saving = ref(false)
const loading = ref(false)
const formSubmitted = ref(false)
const addressMode = ref<'split' | 'full'>('split')

const form = ref<PropertyForm>({
  full_address: '',
  line1: '',
  line2: '',
  city: '',
  county: '',
  postcode: '',
  property_type: '',
  number_of_bedrooms: null,
  number_of_bathrooms: null,
  council_tax_band: '',
  furnishing_status: '',
  management_type: 'let_only',
  bills_included: false,
  notes: '',
  landlords: []
})

const showNewLandlordForm = ref(false)
const existingLandlords = ref<ExistingLandlord[]>([])
const selectedLandlordId = ref('')

const newLandlord = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: ''
})

// Main landlord is always the first entry with ownership 100%
const mainLandlord = computed(() => {
  return form.value.landlords.find(l => !l.create_new && l.ownership_percentage === 100) || null
})

// Co-landlords are create_new entries (inline only, not saved to landlords table)
const coLandlords = computed(() => {
  return form.value.landlords.filter(l => l.create_new)
})

const getLandlordName = (id?: string) => {
  if (!id) return 'Unknown'
  const landlord = existingLandlords.value.find(l => l.id === id)
  if (!landlord) return 'Unknown'
  return landlord.last_name === '(Company)' ? landlord.first_name : `${landlord.first_name} ${landlord.last_name}`
}

const setMainLandlord = () => {
  if (!selectedLandlordId.value) return
  // Remove any existing main landlord
  form.value.landlords = form.value.landlords.filter(l => l.create_new)
  // Add the selected one as main with 100%
  form.value.landlords.unshift({
    landlord_id: selectedLandlordId.value,
    ownership_percentage: 100,
    is_primary_contact: true,
  })
}

const addCoLandlord = () => {
  if (!newLandlord.value.first_name || !newLandlord.value.last_name) {
    toast.error('First name and last name are required')
    return
  }
  form.value.landlords.push({
    create_new: true,
    first_name: newLandlord.value.first_name,
    last_name: newLandlord.value.last_name,
    email: newLandlord.value.email || undefined,
    ownership_percentage: 0, // Co-landlords don't affect ownership
  })
  newLandlord.value = { first_name: '', last_name: '', email: '', phone: '' }
  showNewLandlordForm.value = false
}

const removeCoLandlord = (index: number) => {
  // Find the actual index in form.landlords (co-landlords are create_new entries)
  const coLandlordsInForm = form.value.landlords
    .map((l, i) => ({ ...l, _idx: i }))
    .filter(l => l.create_new)
  if (coLandlordsInForm[index]) {
    form.value.landlords.splice(coLandlordsInForm[index]._idx, 1)
  }
}

const fetchExistingLandlords = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Fetch landlords and companies in parallel
    const [landlordsRes, companiesRes] = await Promise.all([
      authFetch(`${API_URL}/api/landlords?page=1&limit=100`, { token }),
      authFetch(`${API_URL}/api/landlord-portal/companies`, { token }).catch(() => null),
    ])

    const allEntries: ExistingLandlord[] = []

    if (landlordsRes.ok) {
      const data = await landlordsRes.json()
      const landlords = data.landlords || []
      allEntries.push(...landlords)
    }

    // Add companies/SPVs as landlord options
    if (companiesRes?.ok) {
      const data = await companiesRes.json()
      const companies = data.companies || []
      for (const co of companies) {
        allEntries.push({
          id: co.id,
          first_name: co.company_name || 'Unnamed Company',
          last_name: '(Company)',
          email: co.email || '',
        })
      }
    }

    existingLandlords.value = allEntries
    console.log(`[AddEditPropertyModal] Loaded ${allEntries.length} landlords/companies`)
  } catch (err) {
    console.error('Failed to fetch landlords:', err)
  }
}

const removeLandlord = (index: number) => {
  form.value.landlords.splice(index, 1)
}

const fetchProperty = async () => {
  if (!props.propertyId) return

  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }
    const response = await authFetch(`${API_URL}/api/properties/${props.propertyId}`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch property')
    }

    const data = await response.json()
    const property = data.property

    // Populate form
    if (property.address.full_address) {
      addressMode.value = 'full'
      form.value.full_address = property.address.full_address
    } else {
      addressMode.value = 'split'
      form.value.line1 = property.address.line1 || ''
      form.value.line2 = property.address.line2 || ''
      form.value.city = property.address.city || ''
      form.value.county = property.address.county || ''
    }
    form.value.postcode = property.address.postcode
    form.value.property_type = property.property_type || ''
    form.value.number_of_bedrooms = property.number_of_bedrooms
    form.value.number_of_bathrooms = property.number_of_bathrooms
    form.value.council_tax_band = property.council_tax_band || ''
    form.value.furnishing_status = property.furnishing_status || ''
    form.value.management_type = property.management_type || ''
    form.value.bills_included = property.bills_included || false
    form.value.notes = property.notes || ''
    form.value.landlords = property.landlords?.map((l: any) => ({
      landlord_id: l.landlord_id,
      ownership_percentage: l.ownership_percentage,
      is_primary_contact: l.is_primary_contact || false
    })) || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load property')
  } finally {
    loading.value = false
  }
}

// Handle address autocomplete selection
const handleAddressSelected = (addr: any) => {
  form.value.line1 = addr.addressLine1 || ''
  form.value.city = addr.city || ''
  form.value.postcode = addr.postcode || ''
}

const handleSubmit = async () => {
  formSubmitted.value = true

  // Validate main landlord selected
  if (!mainLandlord.value) {
    toast.error('Please select a main landlord')
    return
  }

  // Validate postcode
  if (!form.value.postcode) {
    toast.error('Postcode is required')
    return
  }

  // Validate management type
  if (!form.value.management_type) {
    toast.error('Management type is required')
    return
  }

  saving.value = true

  try {
    const payload = {
      address: {
        full_address: addressMode.value === 'full' ? form.value.full_address : undefined,
        line1: addressMode.value === 'split' ? form.value.line1 : undefined,
        line2: addressMode.value === 'split' ? form.value.line2 : undefined,
        city: addressMode.value === 'split' ? form.value.city : undefined,
        county: addressMode.value === 'split' ? form.value.county : undefined,
        postcode: form.value.postcode
      },
      property_type: form.value.property_type || undefined,
      number_of_bedrooms: form.value.number_of_bedrooms || undefined,
      number_of_bathrooms: form.value.number_of_bathrooms || undefined,
      council_tax_band: form.value.council_tax_band || undefined,
      furnishing_status: form.value.furnishing_status || undefined,
      management_type: form.value.management_type || undefined,
      bills_included: form.value.bills_included,
      notes: form.value.notes || undefined,
      landlords: form.value.landlords
    }

    const url = isEdit.value
      ? `${API_URL}/api/properties/${props.propertyId}`
      : `${API_URL}/api/properties`

    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    const response = await authFetch(url, {
      method: isEdit.value ? 'PUT' : 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save property')
    }

    emit('saved')
  } catch (err: any) {
    toast.error(err.message || 'Failed to save property')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  resetForm()
  emit('close')
}

const resetForm = () => {
  form.value = {
    full_address: '',
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: '',
    property_type: '',
    number_of_bedrooms: null,
    number_of_bathrooms: null,
    council_tax_band: '',
    furnishing_status: '',
    management_type: '',
    bills_included: false,
    notes: '',
    landlords: []
  }
  addressMode.value = 'split'
  showNewLandlordForm.value = false
  selectedLandlordId.value = ''
  formSubmitted.value = false
  newLandlord.value = { first_name: '', last_name: '', email: '', phone: '' }
}

watch(() => props.show, (show) => {
  if (show) {
    fetchExistingLandlords()
    if (props.propertyId) {
      fetchProperty()
    }
  } else {
    resetForm()
  }
})

onMounted(() => {
  if (props.show) {
    fetchExistingLandlords()
    if (props.propertyId) {
      fetchProperty()
    }
  }
})
</script>
