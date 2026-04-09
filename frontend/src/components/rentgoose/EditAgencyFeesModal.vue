<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div>
            <h2 :class="['text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900']">Edit Agency Fees</h2>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ entry.property_address }}, {{ entry.property_postcode }}</p>
          </div>
          <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500']">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <div v-if="loading" class="text-center py-8">
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">Loading fees...</p>
          </div>
          <template v-else>
            <!-- Management Fee -->
            <div>
              <label :class="labelClass">Management Fee (recurring)</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="feePercent"
                  type="number"
                  step="0.01"
                  min="0"
                  :class="inputClass"
                  class="flex-1"
                  placeholder="0.00"
                />
                <button
                  @click="feeType = feeType === 'percentage' ? 'fixed' : 'percentage'"
                  class="px-3 py-2 text-sm font-medium border rounded-lg transition-colors bg-primary/10 border-primary text-primary"
                >
                  {{ feeType === 'percentage' ? '%' : '£' }}
                </button>
              </div>
              <p :class="['text-xs mt-1', isDark ? 'text-slate-500' : 'text-gray-400']">
                {{ feeType === 'percentage' ? 'Percentage of monthly rent' : 'Fixed amount per month' }}
              </p>
            </div>

            <!-- Letting/Setup Fee -->
            <div>
              <label :class="labelClass">Letting/Setup Fee (one-off)</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="lettingFeeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  :class="inputClass"
                  class="flex-1"
                  placeholder="0.00"
                />
                <button
                  @click="lettingFeeType = lettingFeeType === 'percentage' ? 'fixed' : 'percentage'"
                  class="px-3 py-2 text-sm font-medium border rounded-lg transition-colors bg-primary/10 border-primary text-primary"
                >
                  {{ lettingFeeType === 'percentage' ? '%' : '£' }}
                </button>
              </div>
              <p :class="['text-xs mt-1', isDark ? 'text-slate-500' : 'text-gray-400']">
                {{ lettingFeeType === 'percentage' ? 'Percentage of monthly rent' : 'Fixed amount' }}
              </p>
            </div>

            <!-- Current charges info -->
            <div v-if="entry.fee_percent" :class="['rounded-lg p-3 border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200']">
              <p :class="['text-xs font-medium', isDark ? 'text-slate-400' : 'text-gray-500']">Current fee on this rent:</p>
              <p :class="['text-sm font-medium mt-1', isDark ? 'text-white' : 'text-gray-900']">
                {{ entry.fee_percent }}{{ entry.management_type === 'fixed' ? '/month' : '%' }}
              </p>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700']">
            Cancel
          </button>
          <button
            @click="saveFees"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save & Update' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const props = defineProps<{
  entry: {
    property_id: string
    property_address: string
    property_postcode: string
    fee_percent?: number
    management_type?: string
  }
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { isDark } = useDarkMode()
const { get, put } = useApi()

const loading = ref(true)
const saving = ref(false)
const feePercent = ref<number | null>(null)
const feeType = ref('percentage')
const lettingFeeAmount = ref<number | null>(null)
const lettingFeeType = ref('fixed')

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-primary/50 focus:border-primary`)

async function loadCurrentFees() {
  loading.value = true
  try {
    const data = await get<any>(`/api/properties/${props.entry.property_id}`)
    feePercent.value = data.fee_percent != null ? parseFloat(data.fee_percent) : null
    feeType.value = data.management_fee_type || 'percentage'
    lettingFeeAmount.value = data.letting_fee_amount != null ? parseFloat(data.letting_fee_amount) : null
    lettingFeeType.value = data.letting_fee_type || 'fixed'
  } catch (err) {
    console.error('Failed to load property fees:', err)
  } finally {
    loading.value = false
  }
}

async function saveFees() {
  saving.value = true
  try {
    await put(`/api/properties/${props.entry.property_id}`, {
      fee_percent: feePercent.value,
      management_fee_type: feeType.value,
      letting_fee_amount: lettingFeeAmount.value,
      letting_fee_type: lettingFeeType.value
    })
    emit('saved')
    emit('close')
  } catch (err) {
    console.error('Failed to save fees:', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCurrentFees()
})
</script>
