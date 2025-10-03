<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-gray-700">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    <div :class="label ? 'mt-1 flex gap-2' : 'flex gap-2'">
      <select
        v-model="countryCode"
        :class="selectClass"
        class="flex-shrink-0"
        @change="updateCombinedValue"
      >
        <option v-for="code in countryCodes" :key="code.code" :value="code.code">
          {{ code.flag }} {{ code.code }}
        </option>
      </select>
      <input
        :id="id"
        v-model="number"
        type="text"
        :required="required"
        :placeholder="phonePlaceholder"
        :class="inputClass"
        class="flex-1 min-w-0"
        @input="handleNumberInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue?: string
  label?: string
  id?: string
  required?: boolean
  selectClass?: string
  inputClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  id: 'phone-input',
  required: false,
  selectClass: 'px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary',
  inputClass: 'px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Separate independent fields
const countryCode = ref('+44')
const number = ref('')

// Initialize from modelValue only once
if (props.modelValue) {
  const match = props.modelValue.match(/^(\+\d+)(.*)$/)
  if (match) {
    countryCode.value = match[1]
    number.value = match[2]
  }
}

// Comprehensive country codes list
const countryCodes = [
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', country: 'United States/Canada', flag: '🇺🇸' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
]

// Phone number placeholder based on country
const phonePlaceholder = computed(() => {
  const placeholders: { [key: string]: string } = {
    '+44': '7123456789',
    '+1': '2025551234',
    '+353': '851234567',
    '+61': '412345678',
    '+64': '211234567',
  }
  return placeholders[countryCode.value] || 'Phone number'
})

// Handle number input - filter to numbers only and update combined value
const handleNumberInput = () => {
  number.value = number.value.replace(/\D/g, '')
  updateCombinedValue()
}

// Emit combined value when either field changes
const updateCombinedValue = () => {
  const combined = number.value ? `${countryCode.value}${number.value}` : ''
  emit('update:modelValue', combined)
}
</script>
