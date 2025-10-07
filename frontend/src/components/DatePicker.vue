<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-2">
      {{ label }} <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <select
          v-model="selectedDay"
          :required="required"
          :class="selectClass"
        >
          <option value="">Day</option>
          <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
        </select>
      </div>
      <div>
        <select
          v-model="selectedMonth"
          :required="required"
          :class="selectClass"
        >
          <option value="">Month</option>
          <option value="01">January</option>
          <option value="02">February</option>
          <option value="03">March</option>
          <option value="04">April</option>
          <option value="05">May</option>
          <option value="06">June</option>
          <option value="07">July</option>
          <option value="08">August</option>
          <option value="09">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>
      </div>
      <div>
        <select
          v-model="selectedYear"
          :required="required"
          :class="selectClass"
        >
          <option value="">Year</option>
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue?: string
  label?: string
  required?: boolean
  selectClass?: string
  yearRangeType?: 'past' | 'future' | 'current' | 'employment' | 'tenancy' | 'move-in'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  required: false,
  selectClass: 'block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary',
  yearRangeType: 'past'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Parse initial value (YYYY-MM-DD format)
const parseInitialValue = (value: string) => {
  if (!value) return { day: '', month: '', year: '' }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match && match[1] && match[2] && match[3]) {
    return {
      year: match[1],
      month: match[2],
      day: String(parseInt(match[3], 10)) // Remove leading zero for display
    }
  }

  return { day: '', month: '', year: '' }
}

const initial = parseInitialValue(props.modelValue)
const selectedDay = ref(initial.day)
const selectedMonth = ref(initial.month)
const selectedYear = ref(initial.year)

// Generate year range based on type
const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const yearList: number[] = []

  switch (props.yearRangeType) {
    case 'past':
      // For dates of birth, etc. (100 years back to 18 years ago)
      for (let i = currentYear - 18; i >= currentYear - 100; i--) {
        yearList.push(i)
      }
      break

    case 'future':
      // For probation end dates, etc. (2 years forward, 5 years back)
      for (let i = currentYear + 2; i >= currentYear - 5; i--) {
        yearList.push(i)
      }
      break

    case 'current':
      // For signature dates (1 year back, 1 year forward)
      for (let i = currentYear + 1; i >= currentYear - 1; i--) {
        yearList.push(i)
      }
      break

    case 'employment':
      // For employment dates (50 years back to current)
      for (let i = currentYear; i >= currentYear - 50; i--) {
        yearList.push(i)
      }
      break

    case 'tenancy':
      // For tenancy dates (2 years forward, 50 years back)
      for (let i = currentYear + 2; i >= currentYear - 50; i--) {
        yearList.push(i)
      }
      break

    case 'move-in':
      // For move-in dates (current year and 2 years forward only)
      for (let i = currentYear + 2; i >= currentYear; i--) {
        yearList.push(i)
      }
      break

    default:
      // Default to past 50 years
      for (let i = currentYear; i >= currentYear - 50; i--) {
        yearList.push(i)
      }
  }

  return yearList
})

// Watch for changes and emit combined value
watch([selectedDay, selectedMonth, selectedYear], () => {
  if (selectedYear.value && selectedMonth.value && selectedDay.value) {
    const formattedDate = `${selectedYear.value}-${selectedMonth.value.padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
    emit('update:modelValue', formattedDate)
  } else {
    emit('update:modelValue', '')
  }
})

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  const parsed = parseInitialValue(newValue)
  if (parsed.day !== selectedDay.value || parsed.month !== selectedMonth.value || parsed.year !== selectedYear.value) {
    selectedDay.value = parsed.day
    selectedMonth.value = parsed.month
    selectedYear.value = parsed.year
  }
})
</script>
