<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="close"
    >
      <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-xl">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Send Move-Out Confirmation</h3>
        </div>

        <!-- Content -->
        <div class="p-6">
          <!-- Loading State -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <Loader2 class="w-8 h-8 text-orange-500 animate-spin" />
          </div>

          <!-- Content -->
          <div v-else-if="proRataData" class="space-y-5">
            <!-- Property & Move Out Date -->
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <Home class="w-5 h-5 text-amber-600" />
                <span class="font-medium text-amber-800 dark:text-amber-200">{{ proRataData.propertyAddress }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Calendar class="w-5 h-5 text-amber-600" />
                <span class="text-amber-700 dark:text-amber-300">Move Out: <strong>{{ formatDate(proRataData.moveOutDate) }}</strong></span>
              </div>
            </div>

            <!-- Pro-Rata Calculation -->
            <div v-if="proRataData.proRata" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <Calculator class="w-4 h-4" />
                Pro-Rata Rent Calculation
              </h3>

              <div class="space-y-2 text-sm">
                <div class="flex justify-between text-blue-700 dark:text-blue-300">
                  <span>Monthly Rent:</span>
                  <span class="font-medium">{{ formatCurrency(proRataData.monthlyRent) }}</span>
                </div>
                <div class="flex justify-between text-blue-700 dark:text-blue-300">
                  <span>Rent Due Day:</span>
                  <span class="font-medium">{{ ordinal(proRataData.rentDueDay) }} of month</span>
                </div>
                <div class="flex justify-between text-blue-700 dark:text-blue-300">
                  <span>Days in Final Month:</span>
                  <span class="font-medium">{{ proRataData.proRata.daysCharged }} of {{ proRataData.proRata.daysInMonth }} days</span>
                </div>
                <div class="border-t border-blue-200 dark:border-blue-600 pt-2 mt-2">
                  <div class="flex justify-between items-center">
                    <span class="text-blue-800 dark:text-blue-200 font-semibold">Pro-Rata Amount:</span>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-500 dark:text-slate-400">£</span>
                      <input
                        v-model.number="editableAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        class="w-28 px-3 py-1.5 text-right font-bold text-lg text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <p v-if="editableAmount !== proRataData.proRata.amount" class="text-xs text-blue-600 dark:text-blue-400 mt-1 text-right">
                    Original calculation: {{ formatCurrency(proRataData.proRata.amount) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- No Pro-Rata (full month) -->
            <div v-else class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div class="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle class="w-5 h-5" />
                <span>Move-out aligns with rent cycle - no pro-rata required</span>
              </div>
            </div>

            <!-- Recipients -->
            <div>
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Email will be sent to:</h3>
              <div class="space-y-1">
                <div
                  v-for="tenant in proRataData.tenants"
                  :key="tenant.email"
                  class="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400"
                >
                  <Mail class="w-4 h-4" />
                  <span>{{ tenant.name }}</span>
                  <span class="text-gray-400 dark:text-slate-500">({{ tenant.email }})</span>
                </div>
              </div>
              <p v-if="proRataData.tenants.length === 0" class="text-sm text-red-600 dark:text-red-400">
                No tenants with email addresses found
              </p>
            </div>

            <!-- What's included -->
            <div class="text-xs text-gray-500 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
              <p class="font-medium mb-1">Email will include:</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li>Move-out date confirmation</li>
                <li>Move-out checklist (cleaning, repairs, keys)</li>
                <li v-if="proRataData.proRata">Pro-rata rent amount and payment details</li>
              </ul>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-8">
            <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p class="text-red-600 dark:text-red-400">{{ error }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            @click="close"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="sendNotice"
            :disabled="sending || !proRataData?.tenants.length"
            class="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            <Send class="w-4 h-4" />
            {{ sending ? 'Sending...' : 'Send Move-Out Notice' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Home, Calendar, Calculator, Mail, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent', result: any): void
}>()

const authStore = useAuthStore()
interface ProRataData {
  moveOutDate: string
  propertyAddress: string
  monthlyRent: number
  rentDueDay: number
  proRata: {
    amount: number
    daysCharged: number
    daysInMonth: number
    nextRentDueDate: string | null
  } | null
  tenants: { name: string; email: string }[]
}

const loading = ref(false)
const sending = ref(false)
const error = ref<string | null>(null)
const proRataData = ref<ProRataData | null>(null)
const editableAmount = ref(0)

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.tenancyId) {
    await loadProRataData()
  }
})

async function loadProRataData() {
  loading.value = true
  error.value = null
  proRataData.value = null

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/${props.tenancyId}/calculate-pro-rata`, {
      token
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to calculate pro-rata')
    }

    proRataData.value = await response.json()
    editableAmount.value = proRataData.value?.proRata?.amount || 0
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function sendNotice() {
  if (!proRataData.value) return

  sending.value = true
  error.value = null

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/${props.tenancyId}/send-move-out-notice`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        proRataAmount: proRataData.value.proRata ? editableAmount.value : undefined
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send notice')
    }

    const result = await response.json()
    emit('sent', result)
    close()
  } catch (err: any) {
    error.value = err.message
  } finally {
    sending.value = false
  }
}

function close() {
  emit('close')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  const idx = (v - 20) % 10
  return n + (s[idx] ?? s[v] ?? s[0] ?? 'th')
}
</script>
