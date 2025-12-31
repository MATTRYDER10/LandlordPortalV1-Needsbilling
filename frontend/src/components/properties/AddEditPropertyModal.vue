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
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
        <form @submit.prevent="handleSubmit">
          <div class="bg-white px-6 pt-6 pb-4">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-900">
                {{ isEdit ? 'Edit Property' : 'Add Property' }}
              </h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <!-- Address Section -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 mb-3">Address</h4>

              <!-- Address Mode Toggle -->
              <div class="flex gap-4 mb-4">
                <label class="flex items-center">
                  <input
                    type="radio"
                    v-model="addressMode"
                    value="split"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Split fields</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="radio"
                    v-model="addressMode"
                    value="full"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Full address</span>
                </label>
              </div>

              <!-- Full Address -->
              <div v-if="addressMode === 'full'" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                  <textarea
                    v-model="form.full_address"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="Enter complete address..."
                  ></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode <span class="text-red-500">*</span></label>
                  <input
                    v-model="form.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    v-model="form.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      v-model="form.city"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">County</label>
                    <input
                      v-model="form.county"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode <span class="text-red-500">*</span></label>
                  <input
                    v-model="form.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>
              </div>
            </div>

            <!-- Property Details Section (Optional) -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 mb-3">Property Details (Optional)</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    v-model="form.property_type"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">Furnished Status</label>
                  <select
                    v-model="form.furnishing_status"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select...</option>
                    <option value="furnished">Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="part_furnished">Part Furnished</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input
                    v-model.number="form.number_of_bedrooms"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                  <input
                    v-model.number="form.number_of_bathrooms"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <!-- Landlords Section -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 mb-3">Landlords</h4>

              <!-- Existing landlords list -->
              <div v-if="form.landlords.length > 0" class="space-y-3 mb-4">
                <div
                  v-for="(landlord, index) in form.landlords"
                  :key="index"
                  class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex-1">
                    <template v-if="landlord.create_new">
                      <span class="text-sm font-medium text-gray-900">
                        {{ landlord.first_name }} {{ landlord.last_name }} (New)
                      </span>
                      <span class="text-sm text-gray-500 block">{{ landlord.email }}</span>
                    </template>
                    <template v-else>
                      <span class="text-sm font-medium text-gray-900">
                        {{ getLandlordName(landlord.landlord_id) }}
                      </span>
                    </template>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="landlord.ownership_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      class="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                    <span class="text-sm text-gray-500">%</span>
                    <button
                      type="button"
                      @click="removeLandlord(index)"
                      class="text-red-500 hover:text-red-700 p-1"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Total ownership indicator -->
              <div v-if="form.landlords.length > 0" class="mb-4">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-600">Total ownership:</span>
                  <span
                    :class="totalOwnership === 100 ? 'text-green-600' : 'text-amber-600'"
                    class="text-sm font-medium"
                  >
                    {{ totalOwnership.toFixed(2) }}%
                  </span>
                  <span v-if="totalOwnership !== 100" class="text-sm text-amber-600">
                    (must equal 100%)
                  </span>
                  <CheckCircle v-else class="h-4 w-4 text-green-600" />
                </div>
              </div>

              <!-- Add landlord buttons -->
              <div class="flex gap-3">
                <button
                  type="button"
                  @click="showLandlordSearch = !showLandlordSearch; showNewLandlordForm = false"
                  class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                  :class="showLandlordSearch
                    ? 'text-white bg-primary border border-primary'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'"
                >
                  Link Existing Landlord
                </button>
                <button
                  type="button"
                  @click="showNewLandlordForm = !showNewLandlordForm; showLandlordSearch = false"
                  class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                  :class="showNewLandlordForm
                    ? 'text-white bg-primary border border-primary'
                    : 'text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20'"
                >
                  Create New Landlord
                </button>
              </div>

              <!-- Landlord search dropdown -->
              <div v-if="showLandlordSearch" class="mt-3">
                <div class="relative">
                  <input
                    v-model="landlordSearchQuery"
                    type="text"
                    placeholder="Search landlords..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    @input="searchLandlords"
                  />
                  <div
                    v-if="landlordSearchResults.length > 0"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="landlord in landlordSearchResults"
                      :key="landlord.id"
                      type="button"
                      @click="addExistingLandlord(landlord)"
                      class="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      {{ landlord.first_name }} {{ landlord.last_name }} ({{ landlord.email }})
                    </button>
                  </div>
                </div>
              </div>

              <!-- New landlord form -->
              <div v-if="showNewLandlordForm" class="mt-3 p-4 bg-gray-50 rounded-lg">
                <h5 class="text-sm font-medium text-gray-900 mb-3">New Landlord Details</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      v-model="newLandlord.first_name"
                      type="text"
                      placeholder="First name *"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <input
                      v-model="newLandlord.last_name"
                      type="text"
                      placeholder="Last name *"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div class="col-span-2">
                    <input
                      v-model="newLandlord.email"
                      type="email"
                      placeholder="Email *"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div class="col-span-2">
                    <input
                      v-model="newLandlord.phone"
                      type="tel"
                      placeholder="Phone (optional)"
                      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div class="col-span-2">
                    <button
                      type="button"
                      @click="addNewLandlord"
                      :disabled="!newLandlord.first_name || !newLandlord.last_name || !newLandlord.email"
                      class="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
                    >
                      Add Landlord
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes Section -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                v-model="form.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Any additional notes..."
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving || (form.landlords.length > 0 && totalOwnership !== 100)"
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
import { X, CheckCircle } from 'lucide-vue-next'
import AddressAutocomplete from '../AddressAutocomplete.vue'

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
  furnishing_status: string
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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const isEdit = computed(() => !!props.propertyId)
const saving = ref(false)
const loading = ref(false)
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
  furnishing_status: '',
  notes: '',
  landlords: []
})

const showLandlordSearch = ref(false)
const showNewLandlordForm = ref(false)
const landlordSearchQuery = ref('')
const landlordSearchResults = ref<ExistingLandlord[]>([])
const existingLandlords = ref<ExistingLandlord[]>([])

const newLandlord = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: ''
})

const totalOwnership = computed(() => {
  return form.value.landlords.reduce((sum, l) => sum + (l.ownership_percentage || 0), 0)
})

const getLandlordName = (id?: string) => {
  if (!id) return 'Unknown'
  const landlord = existingLandlords.value.find(l => l.id === id)
  return landlord ? `${landlord.first_name} ${landlord.last_name}` : 'Unknown'
}

const fetchExistingLandlords = async () => {
  try {
    const response = await fetch(`${API_URL}/api/landlords?limit=100`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      const data = await response.json()
      existingLandlords.value = data.landlords || []
    }
  } catch (err) {
    console.error('Failed to fetch landlords:', err)
  }
}

const searchLandlords = () => {
  const query = landlordSearchQuery.value.toLowerCase()
  if (!query) {
    landlordSearchResults.value = []
    return
  }
  landlordSearchResults.value = existingLandlords.value.filter(l =>
    `${l.first_name} ${l.last_name}`.toLowerCase().includes(query) ||
    l.email.toLowerCase().includes(query)
  ).slice(0, 10)
}

const addExistingLandlord = (landlord: ExistingLandlord) => {
  if (form.value.landlords.some(l => l.landlord_id === landlord.id)) {
    toast.warning('This landlord is already added')
    return
  }
  form.value.landlords.push({
    landlord_id: landlord.id,
    ownership_percentage: form.value.landlords.length === 0 ? 100 : 0
  })
  showLandlordSearch.value = false
  landlordSearchQuery.value = ''
  landlordSearchResults.value = []
}

const addNewLandlord = () => {
  if (!newLandlord.value.first_name || !newLandlord.value.last_name || !newLandlord.value.email) {
    toast.error('Please fill in required fields')
    return
  }
  form.value.landlords.push({
    create_new: true,
    first_name: newLandlord.value.first_name,
    last_name: newLandlord.value.last_name,
    email: newLandlord.value.email,
    phone: newLandlord.value.phone,
    ownership_percentage: form.value.landlords.length === 0 ? 100 : 0
  })
  newLandlord.value = { first_name: '', last_name: '', email: '', phone: '' }
  showNewLandlordForm.value = false
}

const removeLandlord = (index: number) => {
  form.value.landlords.splice(index, 1)
}

const fetchProperty = async () => {
  if (!props.propertyId) return

  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/properties/${props.propertyId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

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
    form.value.furnishing_status = property.furnishing_status || ''
    form.value.notes = property.notes || ''
    form.value.landlords = property.landlords.map((l: any) => ({
      landlord_id: l.landlord_id,
      ownership_percentage: l.ownership_percentage
    }))
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
  // Validate ownership
  if (form.value.landlords.length > 0 && totalOwnership.value !== 100) {
    toast.error('Total ownership percentage must equal 100%')
    return
  }

  // Validate postcode
  if (!form.value.postcode) {
    toast.error('Postcode is required')
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
      furnishing_status: form.value.furnishing_status || undefined,
      notes: form.value.notes || undefined,
      landlords: form.value.landlords
    }

    const url = isEdit.value
      ? `${API_URL}/api/properties/${props.propertyId}`
      : `${API_URL}/api/properties`

    const response = await fetch(url, {
      method: isEdit.value ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
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
    furnishing_status: '',
    notes: '',
    landlords: []
  }
  addressMode.value = 'split'
  showLandlordSearch.value = false
  showNewLandlordForm.value = false
  landlordSearchQuery.value = ''
  landlordSearchResults.value = []
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
