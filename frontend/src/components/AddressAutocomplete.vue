<template>
  <div class="relative">
    <label v-if="label" :for="id" class="block text-sm font-medium text-gray-700">
      {{ label }} {{ required ? '*' : '' }}
    </label>
    <input
      :id="id"
      ref="inputRef"
      v-model="query"
      type="text"
      :required="required"
      :placeholder="apiError ? 'Address lookup unavailable - please type manually' : placeholder"
      autocomplete="off"
      :class="[
        'mt-1 block w-full px-3 py-2 bg-white border rounded-md focus:ring-primary focus:border-primary',
        apiError ? 'border-red-300' : 'border-gray-300'
      ]"
      @focus="showDropdown = true"
      @blur="handleBlur"
      @keydown.down.prevent="navigateDown"
      @keydown.up.prevent="navigateUp"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="hideDropdown"
    />
    <p v-if="apiError" class="mt-1 text-xs text-red-600">
      {{ apiError }}. Please type the address manually.
    </p>
    <div
      v-if="showDropdown && suggestions.length > 0"
      class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
    >
      <div
        v-for="(suggestion, index) in suggestions"
        :key="suggestion.place_id"
        :class="[
          'px-3 py-2 cursor-pointer text-sm',
          highlightedIndex === index ? 'bg-primary/10' : 'hover:bg-gray-100'
        ]"
        @mousedown.prevent="selectSuggestion(suggestion)"
        @mouseenter="highlightedIndex = index"
      >
        {{ suggestion.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/// <reference types="@types/google.maps" />
import { ref, watch, onMounted } from 'vue'
import { usePlacesAutocomplete } from 'vue-use-places-autocomplete'

interface AddressComponents {
  addressLine1: string
  addressLine2?: string
  city: string
  postcode: string
  country: {
    code: string
    name: string
  }
}

interface Props {
  modelValue: string
  label?: string
  required?: boolean
  placeholder?: string
  id?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'addressSelected', address: AddressComponents): void
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  required: false,
  placeholder: 'Start typing address...',
  id: 'address-autocomplete'
})

const emit = defineEmits<Emits>()

const query = ref(props.modelValue)
const inputRef = ref<HTMLInputElement | null>(null)
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const placesService = ref<google.maps.places.PlacesService | null>(null)
const justSelected = ref(false)
const apiLoaded = ref(false)
const apiError = ref('')

// Initialize Google Maps API
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const { suggestions } = usePlacesAutocomplete(query, {
  apiKey,
  debounce: 500,
  minLengthAutocomplete: 3
})

// Initialize Places Service when component mounts
onMounted(async () => {
  try {
    // Wait for vue-use-places-autocomplete to load the API
    // Poll until google.maps.places is available
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max wait

    while (attempts < maxAttempts) {
      if ((window as any).google?.maps?.places?.PlacesService) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    if (!(window as any).google?.maps?.places?.PlacesService) {
      throw new Error('Google Maps API failed to load after 5 seconds')
    }

    // Initialize Places Service
    const div = document.createElement('div')
    placesService.value = new google.maps.places.PlacesService(div)
    apiLoaded.value = true
  } catch (error) {
    console.error('Failed to initialize Google Maps:', error)
    apiError.value = 'Failed to initialize Google Maps'
  }
})

// Watch query changes and emit to parent
watch(query, (newValue) => {
  emit('update:modelValue', newValue)
  if (newValue.length >= 3 && !justSelected.value) {
    showDropdown.value = true
    highlightedIndex.value = 0
  } else if (justSelected.value) {
    justSelected.value = false
  }
})

// Watch modelValue changes from parent
watch(() => props.modelValue, (newValue) => {
  if (newValue !== query.value) {
    query.value = newValue
  }
})

const handleBlur = () => {
  // Delay to allow click events to fire
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

const hideDropdown = () => {
  showDropdown.value = false
}

const navigateDown = () => {
  if (highlightedIndex.value < suggestions.value.length - 1) {
    highlightedIndex.value++
  }
}

const navigateUp = () => {
  if (highlightedIndex.value > 0) {
    highlightedIndex.value--
  }
}

const selectHighlighted = () => {
  if (suggestions.value[highlightedIndex.value]) {
    selectSuggestion(suggestions.value[highlightedIndex.value])
  }
}

const selectSuggestion = async (suggestion: any) => {
  justSelected.value = true
  showDropdown.value = false

  // Get place details using Places API
  if (!placesService.value) {
    console.error('Places service not initialized')
    return
  }

  placesService.value.getDetails(
    {
      placeId: suggestion.place_id,
      fields: ['address_components', 'formatted_address']
    },
    (place: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const addressComponents = parseAddressComponents(place.address_components || [])

        // Update the input field with just the street address
        query.value = addressComponents.addressLine1

        // Also emit the update:modelValue to ensure parent component is updated
        emit('update:modelValue', addressComponents.addressLine1)

        // Emit the full address details
        emit('addressSelected', addressComponents)
      } else {
        console.error('Places service failed with status:', status)
      }
    }
  )
}

const parseAddressComponents = (components: google.maps.GeocoderAddressComponent[]): AddressComponents => {
  let streetNumber = ''
  let route = ''
  let city = ''
  let postcode = ''
  let postcodePrefix = ''
  let postcodeSuffix = ''
  let countryCode = ''
  let countryName = ''

  components.forEach(component => {
    const types = component.types

    if (types.includes('street_number')) {
      streetNumber = component.long_name
    }
    if (types.includes('route')) {
      route = component.long_name
    }
    if (types.includes('locality')) {
      city = component.long_name
    }
    if (types.includes('postal_town') && !city) {
      city = component.long_name
    }
    // Handle full postcode
    if (types.includes('postal_code')) {
      postcode = component.long_name
    }
    // Handle partial postcodes (UK specific)
    if (types.includes('postal_code_prefix')) {
      postcodePrefix = component.long_name
    }
    if (types.includes('postal_code_suffix')) {
      postcodeSuffix = component.long_name
    }
    if (types.includes('country')) {
      countryCode = component.short_name
      countryName = component.long_name
    }
  })

  // Construct full postcode from parts if needed
  if (!postcode && (postcodePrefix || postcodeSuffix)) {
    postcode = [postcodePrefix, postcodeSuffix].filter(Boolean).join(' ')
  }

  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ')

  return {
    addressLine1,
    city,
    postcode,
    country: {
      code: countryCode,
      name: countryName
    }
  }
}
</script>
