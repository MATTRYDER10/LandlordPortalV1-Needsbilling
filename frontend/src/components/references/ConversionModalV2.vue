<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <!-- Header -->
        <div class="p-6 pb-4 border-b border-gray-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Convert to Tenancy</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
              <X class="w-5 h-5" />
            </button>
          </div>
          <p class="mt-1 text-sm text-gray-500">Convert this reference into an active tenancy record.</p>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-12">
            <Loader2 class="w-8 h-8 animate-spin text-primary" />
            <span class="ml-3 text-gray-600 dark:text-slate-400">Validating conversion...</span>
          </div>

          <!-- Errors -->
          <div v-else-if="validationErrors.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 class="text-sm font-medium text-red-800 dark:text-red-300">Cannot Convert</h4>
                <ul class="mt-2 text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                  <li v-for="error in validationErrors" :key="error">{{ error }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Conversion Complete -->
          <div v-else-if="conversionComplete" class="text-center py-8">
            <CheckCircle class="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">Tenancy Created!</h4>
            <p class="text-gray-500 mt-2">The reference has been converted to a tenancy.</p>
            <div class="mt-6 flex gap-3 justify-center">
              <button
                @click="viewTenancy"
                class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                View Tenancy
              </button>
              <button
                @click="$emit('close')"
                class="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>

          <!-- Preview & Options -->
          <template v-else-if="previewData">
            <!-- Warnings -->
            <div v-if="validationWarnings.length > 0" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 class="text-sm font-medium text-amber-800 dark:text-amber-300">Warnings</h4>
                  <ul class="mt-2 text-sm text-amber-700 dark:text-amber-400 list-disc list-inside space-y-1">
                    <li v-for="warning in validationWarnings" :key="warning">{{ warning }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Property & Tenancy Details -->
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300">Tenancy Details</h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-gray-500">Property</span>
                  <p class="font-medium text-gray-900 dark:text-white">{{ previewData.propertyAddress }}</p>
                  <p class="text-gray-500">{{ previewData.propertyCity }} {{ previewData.propertyPostcode }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Monthly Rent</span>
                  <p class="font-medium text-gray-900 dark:text-white">&pound;{{ previewData.monthlyRent }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Move In Date</span>
                  <p class="font-medium text-gray-900 dark:text-white">{{ formatDate(previewData.moveInDate) }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Term</span>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ previewData.termYears ? previewData.termYears + ' year(s)' : '' }}
                    {{ previewData.termMonths ? previewData.termMonths + ' month(s)' : '' }}
                    {{ !previewData.termYears && !previewData.termMonths ? 'Periodic' : '' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Tenants -->
            <div class="space-y-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300">Tenants ({{ previewData.tenants.length }})</h4>
              <div
                v-for="tenant in previewData.tenants"
                :key="tenant.referenceId"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
              >
                <div>
                  <span class="font-medium text-gray-900 dark:text-white">{{ tenant.firstName }} {{ tenant.lastName }}</span>
                  <span v-if="tenant.isLeadTenant" class="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Lead</span>
                  <p class="text-sm text-gray-500">{{ tenant.email }}</p>
                </div>
                <span class="text-sm text-gray-700 dark:text-slate-300">&pound;{{ tenant.rentShare || previewData.monthlyRent }}/month</span>
              </div>
            </div>

            <!-- Deposit Options -->
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300">Deposit</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-600 dark:text-slate-400 mb-1">Scheme</label>
                  <select
                    v-model="options.depositScheme"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select scheme...</option>
                    <option value="dps">DPS</option>
                    <option value="mydeposits">mydeposits</option>
                    <option value="tds_custodial">TDS Custodial</option>
                    <option value="tds_insured">TDS Insured</option>
                    <option value="reposit">Reposit (Deposit-Free)</option>
                    <option value="landlord_held">Landlord Held</option>
                    <option value="no_deposit">No Deposit</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-gray-600 dark:text-slate-400 mb-1">Amount</label>
                  <input
                    v-model.number="options.depositAmount"
                    type="number"
                    step="0.01"
                    :placeholder="defaultDepositAmount.toString()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Rent Due Day -->
            <div>
              <label class="block text-sm text-gray-600 dark:text-slate-400 mb-1">Rent Due Day</label>
              <input
                v-model.number="options.rentDueDay"
                type="number"
                min="1"
                max="28"
                class="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm text-gray-600 dark:text-slate-400 mb-1">Notes (optional)</label>
              <textarea
                v-model="options.notes"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none"
              />
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div v-if="previewData && !conversionComplete" class="p-6 pt-4 border-t border-gray-200 dark:border-slate-700 flex gap-3">
          <button
            @click="$emit('close')"
            class="flex-1 py-2 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            @click="convert"
            :disabled="converting"
            class="flex-1 py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="converting" class="w-4 h-4 animate-spin" />
            {{ converting ? 'Converting...' : 'Convert to Tenancy' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { X, Loader2, AlertTriangle, CheckCircle } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  reference: any
}>()

const emit = defineEmits<{
  close: []
  converted: []
}>()

const API_URL = import.meta.env.VITE_API_URL ?? ''
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const converting = ref(false)
const conversionComplete = ref(false)
const createdTenancyId = ref('')
const validationErrors = ref<string[]>([])
const validationWarnings = ref<string[]>([])
const previewData = ref<any>(null)

const options = ref({
  depositScheme: '',
  depositAmount: null as number | null,
  rentDueDay: 1,
  notes: ''
})

const defaultDepositAmount = computed(() => {
  if (!previewData.value) return 0
  return Math.round((previewData.value.monthlyRent * 12 / 52) * 5 * 100) / 100
})

watch(() => props.show, async (isOpen) => {
  if (isOpen && props.reference?.id) {
    loading.value = true
    conversionComplete.value = false
    validationErrors.value = []
    validationWarnings.value = []
    previewData.value = null

    try {
      const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/convert/validate`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
        }
      })
      const data = await response.json()

      if (data.canConvert) {
        previewData.value = data.referenceData
        validationWarnings.value = data.warnings || []
        // Set rent due day from move-in date
        if (data.referenceData?.moveInDate) {
          const day = new Date(data.referenceData.moveInDate).getDate()
          options.value.rentDueDay = Math.min(day, 28)
        }
      } else {
        validationErrors.value = data.errors || ['Cannot convert this reference']
      }
    } catch (error) {
      validationErrors.value = ['Failed to validate conversion']
    } finally {
      loading.value = false
    }
  }
})

async function convert() {
  converting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        depositScheme: options.value.depositScheme || undefined,
        depositAmount: options.value.depositAmount || undefined,
        rentDueDay: options.value.rentDueDay,
        notes: options.value.notes || undefined,
        activateImmediately: false
      })
    })

    const data = await response.json()

    if (response.ok && data.tenancy) {
      createdTenancyId.value = data.tenancy.id
      conversionComplete.value = true
      emit('converted')
    } else {
      alert(data.error || 'Conversion failed')
    }
  } catch {
    alert('Conversion failed')
  } finally {
    converting.value = false
  }
}

function viewTenancy() {
  emit('close')
  router.push('/tenancies')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}
</script>
