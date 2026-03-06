<template>
  <div class="relative">
    <label v-if="label" :for="id" class="block text-sm font-medium text-gray-700">
      {{ label }} {{ required ? '*' : '' }}
    </label>
    <input :id="id" ref="inputRef" v-model="query" type="text" :required="required"
      :placeholder="apiError ? 'Address lookup unavailable - please type manually' : placeholder" autocomplete="off"
      :class="[
        'mt-1 block w-full px-3 py-2 bg-white text-gray-900 border rounded-md focus:ring-primary focus:border-primary',
        apiError ? 'border-red-300' : 'border-gray-300'
      ]" @input="handleInput" @focus="showDropdown = true" @blur="handleBlur" @keydown.down.prevent="navigateDown"
      @keydown.up.prevent="navigateUp" @keydown.enter.prevent="selectHighlighted" @keydown.escape="hideDropdown" />
    <p v-if="apiError" class="mt-1 text-xs text-red-600">
      {{ apiError }}. Please type the address manually.
    </p>
    <div v-if="showDropdown && suggestions.length > 0"
      class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
      <div v-for="(suggestion, index) in suggestions" :key="index" :class="[
        'px-3 py-2 cursor-pointer text-sm text-gray-900',
        highlightedIndex === index ? 'bg-primary/10' : 'hover:bg-gray-100'
      ]" @mousedown.prevent="selectSuggestion(suggestion)" @mouseenter="highlightedIndex = index">
        {{ suggestion.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios, { type AxiosResponse } from 'axios'
import { ref, watch } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
  allowManualEntry?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'addressSelected', address: AddressComponents): void
}

interface DetailsResult {
  address_components: { long_name: string, short_name: string, types: string[] }[];
  formatted_address: string;
  name: string;
}

interface Predictions {
  description: string;
  place_id: string;
  reference: string;
};

const props = withDefaults(defineProps<Props>(), {
  label: '',
  required: false,
  placeholder: 'Start typing address...',
  id: 'address-autocomplete',
  allowManualEntry: true
})

const emit = defineEmits<Emits>()

const query = ref(props.modelValue)
const inputRef = ref<HTMLInputElement | null>(null)
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const justSelected = ref(false)
// const apiLoaded = ref(false)
const apiError = ref('')
const suggestions = ref<any[]>([])
let fetchTimeout: number | null = null
// Initialize Google Maps API
//const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Load Google Maps API script
// const loadGoogleMapsAPI = async () => {
//   if ((window as any).google?.maps?.places) {
//     return true
//   }

//   return new Promise((resolve, reject) => {
//     const script = document.createElement('script')
//     script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&region=GB&loading=async`
//     script.async = true
//     script.defer = true
//     script.onload = () => resolve(true)
//     script.onerror = () => reject(new Error('Failed to load Google Maps API'))
//     document.head.appendChild(script)
//   })
// }

// Initialize on mount
// onMounted(async () => {
//   try {
//     await loadGoogleMapsAPI()

//     // Wait for Places API to be ready
//     let attempts = 0
//     while (attempts < 50 && !(window as any).google?.maps?.places?.AutocompleteSuggestion) {
//       await new Promise(resolve => setTimeout(resolve, 100))
//       attempts++
//     }

//     if (!(window as any).google?.maps?.places?.AutocompleteSuggestion) {
//       throw new Error('Google Maps Places API failed to load')
//     }

//     sessionToken.value = new google.maps.places.AutocompleteSessionToken()
//     apiLoaded.value = true
//   } catch (error) {
//     console.error('Failed to initialize Google Maps:', error)
//     apiError.value = 'Failed to initialize Google Maps'
//   }
// })

// Fetch autocomplete suggestions
const fetchSuggestions = async (input: string) => {
  if (input.length < 3) {
    suggestions.value = []
    return
  }

  try {
    // const request = {
    //   input,
    //   sessionToken: sessionToken.value!,
    // }

    // const { suggestions: fetchedSuggestions } =
    //   await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
    const response = await axios.get(`${API_URL}/api/google-places/autocomplete?input=${input}`)
    const fetchedSuggestions = response.data as Predictions[]
    const manualSuggestion = {
      description: `✏️ Manually enter: "${input}"`,
      place_id: 'manual-entry',
      reference: 'manual'
    }

    // Add manual entry option if enabled (always available)
    suggestions.value = props.allowManualEntry
      ? [...fetchedSuggestions, manualSuggestion]
      : fetchedSuggestions;
    showDropdown.value = suggestions.value.length > 0
  } catch (error) {
    console.error('Failed to fetch suggestions:', error)
    const manualSuggestion = {
      description: `✏️ Manually enter: "${input}"`,
      place_id: 'manual-entry',
      reference: 'manual'
    }

    suggestions.value = props.allowManualEntry ? [manualSuggestion] : []

    // If manual entry is allowed and API fails, still allow the user to proceed
    if (props.allowManualEntry) {
      apiError.value = 'Address lookup unavailable'
    } else {
      apiError.value = 'Failed to fetch suggestions'
    }
    showDropdown.value = suggestions.value.length > 0
  }
}

// Handle input with debounce
const handleInput = () => {
  apiError.value = ''
  if (fetchTimeout) {
    clearTimeout(fetchTimeout)
  }

  if (justSelected.value) {
    justSelected.value = false
    return
  }

  fetchTimeout = setTimeout(() => {
    if (query.value.length >= 3) {
      fetchSuggestions(query.value)
    } else {
      suggestions.value = []
      showDropdown.value = false
    }
  }, 500) as unknown as number
}

// Watch query changes and emit to parent
watch(query, (newValue) => {
  emit('update:modelValue', newValue)
})

// Watch modelValue changes from parent
watch(() => props.modelValue, (newValue) => {
  if (newValue !== query.value) {
    query.value = newValue
  }
})

const handleBlur = () => {
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

const selectSuggestion = async (suggestion: Predictions) => {
  justSelected.value = true
  showDropdown.value = false

  // Handle manual entry selection
  if (suggestion.place_id === 'manual-entry') {
    // Keep the current query value (the manually typed address)
    emit('update:modelValue', query.value)

    // Emit addressSelected with minimal data (just what was typed)
    emit('addressSelected', {
      addressLine1: query.value,
      city: '',
      postcode: '',
      country: {
        code: 'GB',
        name: 'United Kingdom'
      }
    })
    return
  }

  try {
    // Convert to Place and fetch details
    // const place = suggestion.placePrediction.toPlace()

    // await place.fetchFields({
    //   fields: ['displayName', 'formattedAddress', 'addressComponents']
    // })

    const response = await axios.get(`${API_URL}/api/google-places/details?place_id=${suggestion.place_id}`) as AxiosResponse<DetailsResult>;
    const place = response.data as DetailsResult;
    const addressComponents = parseAddressComponents(place.address_components, place.formatted_address, suggestion.description)

    // Update the input field with just the street address
    query.value = addressComponents.addressLine1

    // Also emit the update:modelValue to ensure parent component is updated
    emit('update:modelValue', addressComponents.addressLine1)

    // Emit the full address details
    emit('addressSelected', addressComponents)

  } catch (error) {
    console.error('Failed to get place details:', error)
  }
}

const parseAddressComponents = (
  components: DetailsResult['address_components'],
  formattedAddress: string = '',
  suggestionText: string = ''
): AddressComponents => {
  let streetNumber = ''
  let route = ''
  let city = ''
  let postcode = ''
  let postcodePrefix = ''
  let postcodeSuffix = ''
  let countryCode = ''
  let countryName = ''

  components.forEach((component) => {
    const types = component.types

    if (types.includes('street_number')) {
      streetNumber = component.long_name || ''
    }
    if (types.includes('route')) {
      route = component.long_name || ''
    }
    if (types.includes('locality')) {
      city = component.long_name || ''
    }
    if (types.includes('postal_town') && !city) {
      city = component.long_name || ''
    }
    // Handle full postcode
    if (types.includes('postal_code')) {
      postcode = component.long_name || ''
    }
    // Handle partial postcodes (UK specific)
    if (types.includes('postal_code_prefix')) {
      postcodePrefix = component.long_name || ''
    }
    if (types.includes('postal_code_suffix')) {
      postcodeSuffix = component.long_name || ''
    }
    if (types.includes('country')) {
      countryCode = component.short_name || ''
      countryName = component.long_name || ''
    }
  })

  // Construct full postcode from parts if needed
  if (!postcode && (postcodePrefix || postcodeSuffix)) {
    postcode = [postcodePrefix, postcodeSuffix].filter(Boolean).join(' ')
  }

  // Fallback: Try to extract full UK postcode from formatted_address
  // UK postcodes follow pattern: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
  if ((!postcode || !postcode.includes(' ')) && formattedAddress) {
    const ukPostcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i
    const match = formattedAddress.match(ukPostcodeRegex)
    if (match && match[1]) {
      // Normalize the postcode format (ensure space between outward and inward parts)
      const rawPostcode = match[1].replace(/\s+/g, '').toUpperCase()
      // Insert space before the last 3 characters (inward code)
      postcode = rawPostcode.slice(0, -3) + ' ' + rawPostcode.slice(-3)
    }
  }

  let addressLine1 = [streetNumber, route].filter(Boolean).join(' ')

  // Fallback: If no street number from components, try to extract from suggestion text
  if (!streetNumber && suggestionText) {
    // Extract the first part before the first comma
    const firstPart = suggestionText.split(',')[0]?.trim()
    if (firstPart) {
      addressLine1 = firstPart
    }
  }

  // Fallback: If still no address, use formatted address first line
  if (!addressLine1 && formattedAddress) {
    const firstLine = formattedAddress.split(',')[0]?.trim()
    if (firstLine) {
      addressLine1 = firstLine
    }
  }

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
