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
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-visible shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
        <form @submit.prevent="handleLinkProperty">
          <div class="bg-white px-6 pt-6 pb-4 overflow-visible">
            <!-- Header -->
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-900">Link Property to {{ landlordName }}</h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <!-- Search Section -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Search for Existing Property
              </label>
              <div class="relative">
                <Search class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search by address, city, or postcode..."
                  class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  @input="handleSearch"
                  @focus="showDropdown = searchResults.length > 0"
                />

                <!-- Search Results Dropdown -->
                <div
                  v-if="searchResults.length > 0 && showDropdown"
                  class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto"
                  @mouseenter="isMouseOverDropdown = true"
                  @mouseleave="handleMouseLeaveDropdown"
                >
                  <button
                    v-for="property in searchResults.slice(0, 10)"
                    :key="property.id"
                    type="button"
                    @click="togglePropertySelection(property)"
                    class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-start gap-3"
                    :class="{ 'bg-primary/5': selectedProperties.has(property.id) }"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedProperties.has(property.id)"
                      class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      @click.stop
                    />
                    <div class="flex justify-between items-start">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-gray-900">
                          {{ getPropertyDisplayAddress(property) }}
                        </p>
                        <p class="text-xs text-gray-500 mt-0.5">
                          {{ property.postcode }}
                        </p>
                        <div class="flex items-center gap-2 mt-1">
                          <span v-if="property.property_type" class="text-xs text-gray-600">
                            {{ formatPropertyType(property.property_type) }}
                          </span>
                          <span v-if="property.number_of_bedrooms" class="text-xs text-gray-600">
                            {{ property.number_of_bedrooms }} bed
                          </span>
                          <span
                            class="text-xs px-1.5 py-0.5 rounded"
                            :class="property.status === 'vacant' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
                          >
                            {{ property.status === 'vacant' ? 'Vacant' : 'In Tenancy' }}
                          </span>
                          <span v-if="property.landlords && property.landlords.length > 0" class="text-xs text-gray-500">
                            {{ property.landlords.length }} landlord(s)
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <!-- No Results Message -->
                <div
                  v-else-if="searchQuery && searchResults.length === 0 && !searching && selectedProperties.size === 0"
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4"
                >
                  <p class="text-sm text-gray-500 text-center mb-3">
                    No properties found matching "{{ searchQuery }}"
                  </p>
                  <router-link
                    :to="`/properties?add=true&landlord_id=${landlordId}`"
                    class="block w-full px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md text-center"
                  >
                    <Plus class="h-4 w-4 inline mr-1" />
                    Create New Property
                  </router-link>
                </div>
              </div>
            </div>

            <!-- Selected Properties List -->
            <div v-if="selectedProperties.size > 0" class="mb-6">
              <div class="space-y-3">
                <div class="flex justify-between items-center mb-2">
                  <p class="text-sm font-medium text-gray-900">Selected Properties ({{ selectedProperties.size }})</p>
                  <button
                    type="button"
                    @click="clearAllSelections"
                    class="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear All
                  </button>
                </div>

                <div
                  v-for="[propertyId, data] in Array.from(selectedProperties.entries())"
                  :key="propertyId"
                  class="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900">
                        {{ getPropertyDisplayAddress(data.property) }}
                      </p>
                      <p class="text-xs text-gray-500">{{ data.property.postcode }}</p>

                      <!-- Existing Landlords Warning -->
                      <div
                        v-if="data.property.landlords && data.property.landlords.length > 0"
                        class="mt-2 text-xs text-amber-700"
                      >
                        <AlertTriangle class="h-3 w-3 inline mr-1" />
                        {{ data.property.landlords.length }} existing landlord(s)
                      </div>
                    </div>
                    <button
                      type="button"
                      @click="removePropertySelection(propertyId)"
                      class="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>

                  <!-- Ownership Configuration -->
                  <div class="space-y-2">
                    <div class="flex items-center gap-3">
                      <label class="text-xs text-gray-600 w-20">Ownership:</label>
                      <input
                        v-model.number="data.ownershipPercentage"
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        class="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      />
                      <span class="text-xs text-gray-500">%</span>
                    </div>

                    <div class="flex items-center gap-3">
                      <label class="flex items-center cursor-pointer">
                        <input
                          v-model="data.isPrimaryContact"
                          @change="handlePrimaryContactChange(propertyId)"
                          type="checkbox"
                          class="h-3 w-3 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <span class="ml-2 text-xs text-gray-700">Primary contact</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Create New Property Option (when no property selected) -->
            <div v-if="selectedProperties.size === 0 && !searchQuery" class="text-center py-4">
              <p class="text-sm text-gray-500 mb-3">
                Search for an existing property above or create a new one
              </p>
              <router-link
                :to="`/properties?add=true&landlord_id=${landlordId}`"
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-primary bg-primary/10 border border-primary/20 rounded-md hover:bg-primary/20"
              >
                <Plus class="h-4 w-4 mr-1" />
                Create New Property
              </router-link>
            </div>

            <!-- Validation Messages -->
            <div v-if="validationMessage" class="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800">
              <p class="text-sm">{{ validationMessage }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-between items-center">
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
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Linking...' : `Link ${selectedProperties.size} ${selectedProperties.size === 1 ? 'Property' : 'Properties'}` }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/auth'
import { X, Search, Plus, AlertTriangle } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface PropertyLandlord {
  landlord_id: string
  name: string
  ownership_percentage: number
  is_primary_contact: boolean
}

interface PropertySearchResult {
  id: string
  address: string  // Formatted address string from API
  address_line1?: string
  address_line2?: string
  city?: string
  county?: string
  postcode: string
  property_type?: string
  number_of_bedrooms?: number
  status: 'vacant' | 'in_tenancy'
  landlords?: PropertyLandlord[]
}

const props = defineProps<{
  show: boolean
  landlordId: string
  landlordName: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const saving = ref(false)
const searching = ref(false)
const searchQuery = ref('')
const searchResults = ref<PropertySearchResult[]>([])
const selectedProperties = ref<Map<string, { property: PropertySearchResult, ownershipPercentage: number, isPrimaryContact: boolean }>>(new Map())
const showDropdown = ref(false)
const isMouseOverDropdown = ref(false)

const isValid = computed(() => {
  if (selectedProperties.value.size === 0) return false

  // Check each selected property for valid ownership
  for (const [_, data] of selectedProperties.value) {
    if (data.ownershipPercentage <= 0 || data.ownershipPercentage > 100) return false

    const existingTotal = (data.property.landlords || [])
      .reduce((sum, l) => sum + l.ownership_percentage, 0)
    const totalOwnership = existingTotal + data.ownershipPercentage

    if (totalOwnership > 100.01) return false
  }

  return true
})

const validationMessage = computed(() => {
  if (selectedProperties.value.size === 0) return 'Select at least one property'

  for (const [_, data] of selectedProperties.value) {
    if (data.ownershipPercentage <= 0) {
      return 'All ownership percentages must be greater than 0%'
    }

    const existingTotal = (data.property.landlords || [])
      .reduce((sum, l) => sum + l.ownership_percentage, 0)
    const totalOwnership = existingTotal + data.ownershipPercentage

    if (totalOwnership > 100.01) {
      const addr = getPropertyDisplayAddress(data.property)
      return `${addr}: Total ownership would exceed 100%`
    }
  }

  return ''
})

const formatPropertyType = (type: string) => {
  const types: Record<string, string> = {
    'flat': 'Flat',
    'house': 'House',
    'bungalow': 'Bungalow',
    'studio': 'Studio',
    'hmo': 'HMO',
    'commercial': 'Commercial',
    'other': 'Other'
  }
  return types[type] || type
}

const getPropertyDisplayAddress = (property: PropertySearchResult) => {
  if (!property) return 'Unknown address'

  // Use the formatted address from API if available
  if (property.address && property.address.trim() && property.address !== '.') {
    return property.address
  }

  // Build from parts as fallback
  const parts = []
  if (property.address_line1 && property.address_line1.trim() && property.address_line1 !== '.') {
    parts.push(property.address_line1)
  }
  if (property.address_line2 && property.address_line2.trim() && property.address_line2 !== '.') {
    parts.push(property.address_line2)
  }
  if (property.city && property.city.trim() && property.city !== '.') {
    parts.push(property.city)
  }

  if (parts.length > 0) {
    return parts.join(', ')
  }

  // Fallback to postcode
  return property.postcode || 'Unknown address'
}

const handleSearch = async () => {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  searching.value = true

  try {
    // Fetch ALL matching properties by paginating through all pages
    let allProperties: any[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const response = await fetch(
        `${API_URL}/api/properties?search=${encodeURIComponent(searchQuery.value)}&page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to search properties')
      }

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
    }

    // Filter out properties that already have this landlord linked
    searchResults.value = allProperties.filter((p: PropertySearchResult) =>
      !p.landlords?.some(l => l.landlord_id === props.landlordId)
    )

    showDropdown.value = searchResults.value.length > 0
  } catch (err) {
    console.error('Failed to search properties:', err)
    toast.error('Failed to search properties')
    searchResults.value = []
    showDropdown.value = false
  } finally {
    searching.value = false
  }
}

const handleMouseLeaveDropdown = () => {
  isMouseOverDropdown.value = false
  // Close dropdown when mouse leaves
  showDropdown.value = false
}

const togglePropertySelection = (property: PropertySearchResult) => {
  if (selectedProperties.value.has(property.id)) {
    // Deselect
    selectedProperties.value.delete(property.id)
  } else {
    // Select - calculate default ownership percentage
    const existingTotal = (property.landlords || [])
      .reduce((sum, l) => sum + l.ownership_percentage, 0)

    const defaultOwnership = existingTotal > 0 ? Math.max(0, 100 - existingTotal) : 100
    const isPrimary = existingTotal === 0

    selectedProperties.value.set(property.id, {
      property,
      ownershipPercentage: defaultOwnership,
      isPrimaryContact: isPrimary
    })
  }
}

const removePropertySelection = (propertyId: string) => {
  selectedProperties.value.delete(propertyId)
}

const clearAllSelections = () => {
  selectedProperties.value.clear()
}

const handlePrimaryContactChange = (_propertyId: string) => {
  // Only one property can be primary contact per landlord
  // So we don't need to enforce anything here - they can mark multiple as primary
  // The backend will handle it per-property
}

const handleLinkProperty = async () => {
  if (selectedProperties.value.size === 0 || !isValid.value) return

  saving.value = true

  try {
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Link each selected property
    for (const [propertyId, data] of selectedProperties.value.entries()) {
      try {
        // Build new landlords array: existing + new landlord
        const existingLandlords = data.property.landlords || []
        const newLandlordEntry = {
          landlord_id: props.landlordId,
          ownership_percentage: data.ownershipPercentage,
          is_primary_contact: data.isPrimaryContact
        }

        // If setting as primary, unset others
        const updatedLandlords = existingLandlords.map(l => ({
          landlord_id: l.landlord_id,
          ownership_percentage: l.ownership_percentage,
          is_primary_contact: data.isPrimaryContact ? false : l.is_primary_contact
        }))

        updatedLandlords.push(newLandlordEntry)

        // Update property landlords
        const response = await fetch(
          `${API_URL}/api/properties/${propertyId}/landlords`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authStore.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ landlords: updatedLandlords })
          }
        )

        if (!response.ok) {
          const responseData = await response.json()
          throw new Error(responseData.error || 'Failed to link property')
        }

        successCount++
      } catch (err: any) {
        errorCount++
        const addr = getPropertyDisplayAddress(data.property)
        errors.push(`${addr}: ${err.message}`)
      }
    }

    // Show results
    if (successCount > 0) {
      toast.success(`${successCount} ${successCount === 1 ? 'property' : 'properties'} linked to ${props.landlordName} successfully`)
      emit('saved')
      handleClose()
    }

    if (errorCount > 0) {
      toast.error(`Failed to link ${errorCount} ${errorCount === 1 ? 'property' : 'properties'}`)
      console.error('Link errors:', errors)
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to link properties')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  if (!saving.value) {
    clearAllSelections()
    searchQuery.value = ''
    searchResults.value = []
    showDropdown.value = false
    emit('close')
  }
}

// Reset form when modal is opened
watch(() => props.show, (newVal) => {
  if (newVal) {
    clearAllSelections()
    searchQuery.value = ''
    searchResults.value = []
    showDropdown.value = false
  }
})
</script>
