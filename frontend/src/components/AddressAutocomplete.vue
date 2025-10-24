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
      :placeholder="placeholder"
      autocomplete="off"
      class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
      @focus="showDropdown = true"
      @blur="handleBlur"
      @keydown.down.prevent="navigateDown"
      @keydown.up.prevent="navigateUp"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="hideDropdown"
    />
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

// Initialize Google Maps API
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const { suggestions } = usePlacesAutocomplete(query, {
  apiKey,
  debounce: 500,
  minLengthAutocomplete: 3
})

// Initialize Places Service when component mounts
onMounted(async () => {
  // Load Google Maps API
  if (!(window as any).google) {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    await new Promise((resolve) => {
      script.onload = resolve
    })
  }

  // Initialize Places Service
  const div = document.createElement('div')
  placesService.value = new google.maps.places.PlacesService(div)
})

// Watch query changes and emit to parent
watch(query, (newValue) => {
  emit('update:modelValue', newValue)
  if (newValue.length >= 3) {
    showDropdown.value = true
    highlightedIndex.value = 0
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
        console.log('Parsed address components:', addressComponents)

        // Update the input field with just the street address
        query.value = addressComponents.addressLine1

        emit('addressSelected', addressComponents)
      } else {
        console.error('Places service status:', status)
      }
    }
  )
}

const parseAddressComponents = (components: google.maps.GeocoderAddressComponent[]): AddressComponents => {
  let streetNumber = ''
  let route = ''
  let city = ''
  let postcode = ''
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
    if (types.includes('postal_code')) {
      postcode = component.long_name
    }
    if (types.includes('country')) {
      countryCode = component.short_name
      countryName = component.long_name
    }
  })

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
