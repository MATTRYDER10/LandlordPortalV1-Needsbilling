<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
    <div class="flex flex-wrap items-end gap-4">
      <!-- Service Type -->
      <div class="flex-1 min-w-[180px]">
        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Service Type</label>
        <select
          v-model="localServiceTypeId"
          @change="onServiceTypeChange"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
        >
          <option value="">— Select —</option>
          <option v-for="st in serviceTypes" :key="st.id" :value="st.id">{{ st.name }}</option>
        </select>
      </div>

      <!-- Management Fee (recurring) -->
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Management Fee (recurring)</label>
        <div class="flex items-center gap-1">
          <input
            v-model.number="localFeePercent"
            type="number"
            step="0.01"
            min="0"
            class="w-24 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
            placeholder="0.00"
          />
          <button
            @click="toggleFeeType"
            class="px-3 py-2 text-sm font-medium border rounded-md transition-colors bg-primary/10 border-primary text-primary"
            :title="localFeeType === 'percentage' ? 'Percentage of rent' : 'Fixed amount per month'"
          >
            {{ localFeeType === 'percentage' ? '%' : '£' }}
          </button>
        </div>
      </div>

      <!-- Letting/Setup Fee (one-off, always £) -->
      <div class="w-36">
        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Letting/Setup Fee (one-off)</label>
        <div class="flex items-center gap-1">
          <span class="text-sm text-gray-400 dark:text-slate-500">£</span>
          <input
            v-model.number="localLettingFeeAmount"
            type="number"
            step="0.01"
            min="0"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
            placeholder="0.00"
          />
        </div>
      </div>

      <!-- Additional Charges -->
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          Additional Charges
          <span v-if="charges.length > 0" class="text-xs text-gray-400">({{ charges.length }})</span>
        </label>
        <div class="flex items-center gap-2">
          <div v-if="charges.length > 0" class="flex flex-wrap gap-1 flex-1">
            <span
              v-for="charge in charges"
              :key="charge.id"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded"
            >
              {{ charge.description }} — £{{ Number(charge.amount).toFixed(2) }}
              <span class="text-gray-400">{{ charge.charge_type === 'recurring' ? '(monthly)' : '(one-off)' }}</span>
              <button @click="deleteCharge(charge.id)" class="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
            </span>
          </div>
          <span v-else class="text-sm text-gray-400 dark:text-slate-500 flex-1">None</span>
          <button
            @click="showAddCharge = true"
            class="px-3 py-2 text-xs font-medium text-primary border border-primary rounded-md hover:bg-primary/10 whitespace-nowrap"
          >
            + Add Charge
          </button>
        </div>
      </div>

      <!-- Save Button -->
      <div>
        <button
          @click="saveFees"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : saveStatus === 'Saved' ? 'Saved ✓' : 'Save Fees' }}
        </button>
      </div>
    </div>

    <!-- Add Charge Modal -->
    <AddChargeModal
      v-if="showAddCharge"
      :show="showAddCharge"
      :property-id="propertyId"
      @close="showAddCharge = false"
      @saved="onChargeSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useApi } from '../../composables/useApi'
import AddChargeModal from './AddChargeModal.vue'

const props = defineProps<{
  propertyId: string
  serviceTypeId: string | null
  feePercent: number | null
  managementFeeType: string | null
  lettingFeeAmount: number | null
}>()

const { get, put, del: apiDel } = useApi()

interface ServiceType {
  id: string
  name: string
  default_fee_percent: number | null
  default_letting_fee_amount: number | null
  default_letting_fee_type: string | null
}

interface Charge {
  id: string
  description: string
  amount: number
  charge_type: string
  is_vatable: boolean
}

const serviceTypes = ref<ServiceType[]>([])
const charges = ref<Charge[]>([])
const showAddCharge = ref(false)
const saving = ref(false)
const saveStatus = ref('')

const localServiceTypeId = ref(props.serviceTypeId || '')
const localFeePercent = ref(props.feePercent)
const localFeeType = ref(props.managementFeeType || 'percentage')
const localLettingFeeAmount = ref(props.lettingFeeAmount)

// Keep local state in sync when property reloads (e.g. after compliance upload)
watch(() => props.serviceTypeId, (v) => { if (v !== undefined) localServiceTypeId.value = v || '' })
watch(() => props.feePercent, (v) => { if (v !== undefined) localFeePercent.value = v })
watch(() => props.managementFeeType, (v) => { if (v !== undefined) localFeeType.value = v || 'percentage' })
watch(() => props.lettingFeeAmount, (v) => { if (v !== undefined) localLettingFeeAmount.value = v })

async function fetchServiceTypes() {
  try {
    serviceTypes.value = await get<ServiceType[]>('/api/service-types')
  } catch (err) {
    console.error('Failed to fetch service types:', err)
  }
}

async function fetchCharges() {
  try {
    charges.value = await get<Charge[]>(`/api/property-charges/${props.propertyId}`)
  } catch (err) {
    console.error('Failed to fetch charges:', err)
  }
}

function onServiceTypeChange() {
  const selected = serviceTypes.value.find(st => st.id === localServiceTypeId.value)
  if (selected) {
    if (selected.default_fee_percent != null) localFeePercent.value = selected.default_fee_percent
    if (selected.default_letting_fee_amount != null) localLettingFeeAmount.value = selected.default_letting_fee_amount
  }
}

function toggleFeeType() {
  localFeeType.value = localFeeType.value === 'percentage' ? 'fixed' : 'percentage'
}

async function saveFees() {
  saving.value = true
  saveStatus.value = ''
  try {
    await put(`/api/properties/${props.propertyId}`, {
      service_type_id: localServiceTypeId.value || null,
      fee_percent: localFeePercent.value,
      management_fee_type: localFeeType.value,
      letting_fee_amount: localLettingFeeAmount.value,
      letting_fee_type: 'fixed'
    })
    saveStatus.value = 'Saved'
    setTimeout(() => { saveStatus.value = '' }, 3000)
  } catch (err) {
    saveStatus.value = 'Failed'
    console.error('Failed to save fees:', err)
  } finally {
    saving.value = false
  }
}

async function deleteCharge(chargeId: string) {
  try {
    await apiDel(`/api/property-charges/${props.propertyId}/${chargeId}`)
    charges.value = charges.value.filter(c => c.id !== chargeId)
  } catch (err) {
    console.error('Failed to delete charge:', err)
  }
}

function onChargeSaved() {
  showAddCharge.value = false
  fetchCharges()
}

onMounted(() => {
  fetchServiceTypes()
  fetchCharges()
})
</script>
