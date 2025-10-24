<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Field
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {{ tenantColumnLabel }}
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {{ referenceColumnLabel }}
          </th>
          <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Auto-Detection
          </th>
          <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Verification
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="row in rows" :key="row.field" :class="getRowClass(row)">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {{ row.label }}
          </td>
          <td class="px-6 py-4 text-sm text-gray-900">
            <span v-if="row.tenantValue !== null && row.tenantValue !== undefined && row.tenantValue !== ''">
              {{ formatValue(row.tenantValue) }}
            </span>
            <span v-else class="text-gray-400 italic">Not provided</span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-900">
            <span v-if="row.referenceValue !== null && row.referenceValue !== undefined && row.referenceValue !== ''">
              {{ formatValue(row.referenceValue) }}
            </span>
            <span v-else-if="row.isNotApplicable" class="text-gray-400 italic">N/A</span>
            <span v-else class="text-gray-400 italic">Not provided</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span v-if="getMatchStatus(row) === 'match'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Match
            </span>
            <span v-else-if="getMatchStatus(row) === 'mismatch'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              Mismatch
            </span>
            <span v-else-if="getMatchStatus(row) === 'minor'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Minor Diff
            </span>
            <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              -
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="flex items-center justify-center gap-2">
              <button
                @click="markMatch(row.field)"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  manualVerifications[row.field] === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                ]"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button
                @click="markNoMatch(row.field)"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  manualVerifications[row.field] === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                ]"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ComparisonRow {
  field: string
  label: string
  tenantValue: any
  referenceValue: any
  isNotApplicable?: boolean
  customComparison?: (tenant: any, reference: any) => 'match' | 'mismatch' | 'minor' | 'n/a'
}

interface Props {
  rows: ComparisonRow[]
  tenantColumnLabel?: string
  referenceColumnLabel?: string
  modelValue?: Record<string, boolean> // field -> match/no match
}

const props = withDefaults(defineProps<Props>(), {
  tenantColumnLabel: 'Tenant Provided',
  referenceColumnLabel: 'Reference Confirmed',
  modelValue: () => ({})
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, boolean>]
}>()

const manualVerifications = ref<Record<string, boolean>>({ ...props.modelValue })

watch(() => props.modelValue, (newValue) => {
  manualVerifications.value = { ...newValue }
}, { deep: true })

const markMatch = (field: string) => {
  manualVerifications.value[field] = true
  emit('update:modelValue', { ...manualVerifications.value })
}

const markNoMatch = (field: string) => {
  manualVerifications.value[field] = false
  emit('update:modelValue', { ...manualVerifications.value })
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toLocaleDateString()
  return String(value)
}

const normalizeString = (value: any): string => {
  if (!value) return ''
  return String(value).toLowerCase().trim().replace(/\s+/g, ' ')
}

const getMatchStatus = (row: ComparisonRow): 'match' | 'mismatch' | 'minor' | 'n/a' => {
  if (row.customComparison) {
    return row.customComparison(row.tenantValue, row.referenceValue)
  }

  if (row.isNotApplicable ||
      (row.tenantValue === null || row.tenantValue === undefined || row.tenantValue === '') ||
      (row.referenceValue === null || row.referenceValue === undefined || row.referenceValue === '')) {
    return 'n/a'
  }

  if (row.tenantValue instanceof Date || row.referenceValue instanceof Date) {
    const tenant = new Date(row.tenantValue).toISOString().split('T')[0]
    const reference = new Date(row.referenceValue).toISOString().split('T')[0]
    return tenant === reference ? 'match' : 'mismatch'
  }

  if (typeof row.tenantValue === 'boolean' && typeof row.referenceValue === 'boolean') {
    return row.tenantValue === row.referenceValue ? 'match' : 'mismatch'
  }

  if (typeof row.tenantValue === 'number' && typeof row.referenceValue === 'number') {
    const diff = Math.abs(row.tenantValue - row.referenceValue)
    if (diff < 0.01) return 'match'
    if (diff < row.tenantValue * 0.05) return 'minor'
    return 'mismatch'
  }

  const tenantNormalized = normalizeString(row.tenantValue)
  const referenceNormalized = normalizeString(row.referenceValue)

  if (tenantNormalized === referenceNormalized) {
    return 'match'
  }

  if (tenantNormalized.includes(referenceNormalized) || referenceNormalized.includes(tenantNormalized)) {
    return 'minor'
  }

  if (calculateSimilarity(tenantNormalized, referenceNormalized) > 0.8) {
    return 'minor'
  }

  return 'mismatch'
}

const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshtein(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

const levenshtein = (str1: string, str2: string): number => {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        )
      }
    }
  }

  return matrix[str2.length]![str1.length]!
}

const getRowClass = (row: ComparisonRow): string => {
  const manual = manualVerifications.value[row.field]
  if (manual === false) return 'bg-red-50'
  if (manual === true) return 'bg-green-50'

  const status = getMatchStatus(row)
  if (status === 'mismatch') return 'bg-red-50'
  if (status === 'minor') return 'bg-yellow-50'
  return ''
}
</script>
