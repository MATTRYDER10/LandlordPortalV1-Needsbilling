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
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
        <form @submit.prevent="handleSubmit">
          <div class="bg-white px-6 pt-6 pb-4">
            <!-- Header -->
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-900">Edit Property Landlords</h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <!-- Landlords List -->
            <div class="space-y-4">
              <div v-if="form.landlords.length === 0" class="text-sm text-gray-500 text-center py-4">
                No landlords linked. Add at least one landlord below.
              </div>

              <!-- Existing landlords -->
              <div
                v-for="(landlord, index) in form.landlords"
                :key="index"
                class="p-4 border border-gray-200 rounded-lg"
              >
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-900">
                        {{ landlord.name || `${landlord.first_name} ${landlord.last_name}` }}
                      </span>
                      <span v-if="landlord.create_new" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        New
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">{{ landlord.email || landlord.new_email }}</p>
                  </div>
                  <button
                    type="button"
                    @click="removeLandlord(index)"
                    class="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>

                <!-- Ownership percentage input -->
                <div class="flex items-center gap-3 mb-3">
                  <label class="text-sm text-gray-600 w-24">Ownership:</label>
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="landlord.ownership_percentage"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      class="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                    <span class="text-sm text-gray-500">%</span>
                  </div>
                </div>

                <!-- Ownership progress bar -->
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    class="h-full bg-primary rounded-full transition-all duration-300"
                    :style="{ width: `${Math.min(100, landlord.ownership_percentage || 0)}%` }"
                  ></div>
                </div>

                <!-- Primary contact radio -->
                <label class="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    :checked="landlord.is_primary_contact"
                    @change="setPrimaryContact(index)"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Primary contact</span>
                </label>
              </div>

              <!-- Total ownership indicator -->
              <div
                v-if="form.landlords.length > 0"
                class="p-3 rounded-lg"
                :class="totalOwnership === 100 ? 'bg-green-50' : 'bg-amber-50'"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700">Total Ownership</span>
                  <div class="flex items-center gap-2">
                    <span
                      :class="totalOwnership === 100 ? 'text-green-600' : 'text-amber-600'"
                      class="font-semibold"
                    >
                      {{ totalOwnership.toFixed(2) }}%
                    </span>
                    <CheckCircle v-if="totalOwnership === 100" class="h-4 w-4 text-green-600" />
                    <AlertTriangle v-else class="h-4 w-4 text-amber-600" />
                  </div>
                </div>
                <div class="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="totalOwnership === 100 ? 'bg-green-500' : totalOwnership > 100 ? 'bg-red-500' : 'bg-amber-500'"
                    :style="{ width: `${Math.min(100, totalOwnership)}%` }"
                  ></div>
                </div>
              </div>

              <!-- Add landlord buttons -->
              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  @click="showLandlordSearch = !showLandlordSearch; showNewLandlordForm = false"
                  class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                  :class="showLandlordSearch
                    ? 'text-white bg-primary border border-primary'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'"
                >
                  <UserPlus class="h-4 w-4 inline mr-1" />
                  Link Existing
                </button>
                <button
                  type="button"
                  @click="showNewLandlordForm = !showNewLandlordForm; showLandlordSearch = false"
                  class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                  :class="showNewLandlordForm
                    ? 'text-white bg-primary border border-primary'
                    : 'text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20'"
                >
                  <Plus class="h-4 w-4 inline mr-1" />
                  Create New
                </button>
              </div>

              <!-- Landlord search dropdown -->
              <div v-if="showLandlordSearch" class="mt-3">
                <div class="relative">
                  <Search class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    v-model="landlordSearchQuery"
                    type="text"
                    placeholder="Search by name or email..."
                    class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
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
                      class="w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      <span class="text-sm font-medium text-gray-900">{{ landlord.first_name }} {{ landlord.last_name }}</span>
                      <span class="text-xs text-gray-500 block">{{ landlord.email }}</span>
                    </button>
                  </div>
                  <div
                    v-else-if="landlordSearchQuery && landlordSearchResults.length === 0"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500"
                  >
                    No landlords found matching "{{ landlordSearchQuery }}"
                  </div>
                </div>
              </div>

              <!-- New landlord inline form -->
              <div v-if="showNewLandlordForm" class="mt-3 p-4 bg-gray-50 rounded-lg">
                <h5 class="text-sm font-medium text-gray-900 mb-3">New Landlord</h5>
                <div class="grid grid-cols-2 gap-3">
                  <input
                    v-model="newLandlord.first_name"
                    type="text"
                    placeholder="First name *"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                  <input
                    v-model="newLandlord.last_name"
                    type="text"
                    placeholder="Last name *"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                  <input
                    v-model="newLandlord.email"
                    type="email"
                    placeholder="Email *"
                    class="col-span-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    @click="addNewLandlord"
                    :disabled="!newLandlord.first_name || !newLandlord.last_name || !newLandlord.email"
                    class="col-span-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
                  >
                    Add to Property
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-between items-center">
            <div class="text-sm text-gray-500">
              <span v-if="validationMessage" class="text-amber-600">{{ validationMessage }}</span>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving || !isValid"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
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
import { X, Trash2, CheckCircle, AlertTriangle, UserPlus, Plus, Search } from 'lucide-vue-next'

interface LandlordAssignment {
  landlord_id?: string
  create_new?: boolean
  ownership_percentage: number
  is_primary_contact: boolean
  name?: string
  email?: string
  first_name?: string
  last_name?: string
  new_email?: string
}

interface ExistingLandlord {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface PropertyLandlord {
  landlord_id: string
  name: string
  email: string
  ownership_percentage: number
  is_primary_contact: boolean
}

const props = defineProps<{
  show: boolean
  propertyId: string
  currentLandlords: PropertyLandlord[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const saving = ref(false)
const form = ref<{ landlords: LandlordAssignment[] }>({ landlords: [] })
const showLandlordSearch = ref(false)
const showNewLandlordForm = ref(false)
const landlordSearchQuery = ref('')
const landlordSearchResults = ref<ExistingLandlord[]>([])
const existingLandlords = ref<ExistingLandlord[]>([])

const newLandlord = ref({
  first_name: '',
  last_name: '',
  email: ''
})

const totalOwnership = computed(() => {
  return form.value.landlords.reduce((sum, l) => sum + (l.ownership_percentage || 0), 0)
})

const isValid = computed(() => {
  if (form.value.landlords.length === 0) return false
  if (Math.abs(totalOwnership.value - 100) > 0.01) return false
  const primaryCount = form.value.landlords.filter(l => l.is_primary_contact).length
  if (primaryCount !== 1) return false
  for (const l of form.value.landlords) {
    if (l.create_new && (!l.first_name || !l.last_name || !l.new_email)) {
      return false
    }
  }
  return true
})

const validationMessage = computed(() => {
  if (form.value.landlords.length === 0) return 'Add at least one landlord'
  if (Math.abs(totalOwnership.value - 100) > 0.01) return `Total must equal 100% (currently ${totalOwnership.value.toFixed(2)}%)`
  const primaryCount = form.value.landlords.filter(l => l.is_primary_contact).length
  if (primaryCount === 0) return 'Select one primary contact'
  if (primaryCount > 1) return 'Only one primary contact allowed'
  return ''
})

const initializeForm = () => {
  form.value.landlords = props.currentLandlords.map(l => ({
    landlord_id: l.landlord_id,
    name: l.name,
    email: l.email,
    ownership_percentage: l.ownership_percentage,
    is_primary_contact: l.is_primary_contact
  }))
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
  const assignedIds = form.value.landlords
    .filter(l => l.landlord_id)
    .map(l => l.landlord_id)

  landlordSearchResults.value = existingLandlords.value
    .filter(l => !assignedIds.includes(l.id))
    .filter(l =>
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query)
    )
    .slice(0, 10)
}

const addExistingLandlord = (landlord: ExistingLandlord) => {
  const remainingOwnership = Math.max(0, 100 - totalOwnership.value)
  form.value.landlords.push({
    landlord_id: landlord.id,
    name: `${landlord.first_name} ${landlord.last_name}`,
    email: landlord.email,
    ownership_percentage: form.value.landlords.length === 0 ? 100 : remainingOwnership,
    is_primary_contact: form.value.landlords.length === 0
  })
  showLandlordSearch.value = false
  landlordSearchQuery.value = ''
  landlordSearchResults.value = []
}

const addNewLandlord = () => {
  if (!newLandlord.value.first_name || !newLandlord.value.last_name || !newLandlord.value.email) {
    toast.error('Please fill in all required fields')
    return
  }
  const remainingOwnership = Math.max(0, 100 - totalOwnership.value)
  form.value.landlords.push({
    create_new: true,
    first_name: newLandlord.value.first_name,
    last_name: newLandlord.value.last_name,
    new_email: newLandlord.value.email,
    name: `${newLandlord.value.first_name} ${newLandlord.value.last_name}`,
    email: newLandlord.value.email,
    ownership_percentage: form.value.landlords.length === 0 ? 100 : remainingOwnership,
    is_primary_contact: form.value.landlords.length === 0
  })
  newLandlord.value = { first_name: '', last_name: '', email: '' }
  showNewLandlordForm.value = false
}

const removeLandlord = (index: number) => {
  const landlord = form.value.landlords[index]
  if (!landlord) return
  const wasPrimary = landlord.is_primary_contact
  form.value.landlords.splice(index, 1)
  if (wasPrimary && form.value.landlords.length > 0) {
    const firstLandlord = form.value.landlords[0]
    if (firstLandlord) {
      firstLandlord.is_primary_contact = true
    }
  }
}

const setPrimaryContact = (index: number) => {
  form.value.landlords.forEach((l, i) => {
    l.is_primary_contact = i === index
  })
}

const handleClose = () => {
  showLandlordSearch.value = false
  showNewLandlordForm.value = false
  landlordSearchQuery.value = ''
  landlordSearchResults.value = []
  newLandlord.value = { first_name: '', last_name: '', email: '' }
  emit('close')
}

const handleSubmit = async () => {
  if (!isValid.value) return
  saving.value = true

  try {
    const landlords = form.value.landlords.map(l => {
      if (l.create_new) {
        return {
          create_new: true,
          first_name: l.first_name,
          last_name: l.last_name,
          email: l.new_email,
          ownership_percentage: l.ownership_percentage,
          is_primary_contact: l.is_primary_contact
        }
      }
      return {
        landlord_id: l.landlord_id,
        ownership_percentage: l.ownership_percentage,
        is_primary_contact: l.is_primary_contact
      }
    })

    const response = await fetch(`${API_URL}/api/properties/${props.propertyId}/landlords`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ landlords })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update landlords')
    }

    toast.success('Landlords updated successfully')
    emit('saved')
  } catch (err: any) {
    toast.error(err.message || 'Failed to update landlords')
  } finally {
    saving.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    initializeForm()
    fetchExistingLandlords()
  }
})

onMounted(() => {
  if (props.show) {
    initializeForm()
    fetchExistingLandlords()
  }
})
</script>
