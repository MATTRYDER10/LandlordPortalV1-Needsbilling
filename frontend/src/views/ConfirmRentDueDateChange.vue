<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, Calendar, Banknote, AlertCircle, Loader2, Home } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'

const route = useRoute()
const api = useApi()

const isLoading = ref(true)
const isConfirming = ref(false)
const error = ref('')
const change = ref<any>(null)
const confirmed = ref(false)

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2)
}

const token = computed(() => route.params.token as string)

onMounted(async () => {
  if (!token.value) {
    error.value = 'Invalid confirmation link'
    isLoading.value = false
    return
  }

  try {
    const response = await api.get(`/api/tenancies/rent-due-date-change/${token.value}`)
    change.value = response

    if ((response as any).alreadyConfirmed) {
      confirmed.value = true
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to load change request'
  } finally {
    isLoading.value = false
  }
})

async function confirmPayment() {
  if (!token.value) return

  isConfirming.value = true
  error.value = ''

  try {
    await api.post(`/api/tenancies/rent-due-date-change/${token.value}/confirm-payment`)
    confirmed.value = true
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to confirm payment'
  } finally {
    isConfirming.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <div class="flex flex-col items-center gap-4">
        <Loader2 class="w-8 h-8 text-orange-500 animate-spin" />
        <p class="text-gray-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !change" class="flex items-center justify-center min-h-screen p-4">
      <div class="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle class="w-8 h-8 text-red-600" />
        </div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Unable to Load</h1>
        <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
      </div>
    </div>

    <!-- Confirmed State -->
    <div v-else-if="confirmed" class="flex items-center justify-center min-h-screen p-4">
      <div class="w-full max-w-md">
        <div class="p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-center">
          <!-- Company Logo -->
          <img
            v-if="change?.companyLogoUrl"
            :src="change.companyLogoUrl"
            :alt="change.companyName"
            class="h-12 mx-auto mb-6"
          />

          <div class="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 class="w-10 h-10 text-green-600" />
          </div>

          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Payment Confirmed</h1>
          <p class="text-gray-600 dark:text-slate-400 mb-6">
            Thank you for confirming your payment. Your letting agent will verify the payment and activate the change.
          </p>

          <div class="p-4 bg-gray-50 dark:bg-slate-700 rounded-xl mb-6">
            <div class="flex items-center gap-3 mb-3">
              <Home class="w-5 h-5 text-gray-400 dark:text-slate-400" />
              <p class="text-sm text-gray-900 dark:text-white font-medium">{{ change?.propertyAddress }}</p>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-slate-400">New rent due date:</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ change?.newDueDay }}{{ getDaySuffix(change?.newDueDay) }} of each month</span>
            </div>
          </div>

          <p class="text-sm text-gray-500 dark:text-slate-400">
            You will receive an email confirmation once the change has been activated.
          </p>
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-slate-500 mt-6">
          Powered by PropertyGoose
        </p>
      </div>
    </div>

    <!-- Payment Details State -->
    <div v-else-if="change" class="flex items-center justify-center min-h-screen p-4">
      <div class="w-full max-w-lg">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <img
              v-if="change.companyLogoUrl"
              :src="change.companyLogoUrl"
              :alt="change.companyName"
              class="h-10 mb-4"
            />
            <h1 class="text-xl font-bold">Rent Due Date Change</h1>
            <p class="text-orange-100 mt-1">Confirm your pro-rata payment</p>
          </div>

          <!-- Property -->
          <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
            <div class="flex items-center gap-3">
              <Home class="w-5 h-5 text-gray-400 dark:text-slate-400" />
              <p class="font-medium text-gray-900 dark:text-white">{{ change.propertyAddress }}</p>
            </div>
          </div>

          <!-- Change Details -->
          <div class="px-6 py-5">
            <div class="flex items-center gap-3 mb-4">
              <Calendar class="w-5 h-5 text-blue-500" />
              <h2 class="font-semibold text-gray-900 dark:text-white">Change Details</h2>
            </div>

            <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-blue-700 dark:text-blue-300">Current due date</span>
                <span class="font-semibold text-blue-900 dark:text-blue-100">{{ change.currentDueDay }}{{ getDaySuffix(change.currentDueDay) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-blue-700 dark:text-blue-300">New due date</span>
                <span class="font-semibold text-blue-900 dark:text-blue-100">{{ change.newDueDay }}{{ getDaySuffix(change.newDueDay) }}</span>
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-700">
                <span class="text-blue-700 dark:text-blue-300">Effective from</span>
                <span class="font-semibold text-blue-900 dark:text-blue-100">{{ change.effectiveDate }}</span>
              </div>
            </div>
          </div>

          <!-- Payment Breakdown -->
          <div class="px-6 py-5 border-t border-gray-100 dark:border-slate-700">
            <div class="flex items-center gap-3 mb-4">
              <Banknote class="w-5 h-5 text-amber-500" />
              <h2 class="font-semibold text-gray-900 dark:text-white">Payment Required</h2>
            </div>

            <div class="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-amber-700 dark:text-amber-300">Monthly rent</span>
                <span class="font-medium text-amber-900 dark:text-amber-100">£{{ formatCurrency(change.monthlyRent) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-amber-700 dark:text-amber-300">Daily rate (£{{ formatCurrency(change.monthlyRent) }} × 12 ÷ 365)</span>
                <span class="font-medium text-amber-900 dark:text-amber-100">£{{ formatCurrency(change.dailyRate) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-amber-700 dark:text-amber-300">Days to cover</span>
                <span class="font-medium text-amber-900 dark:text-amber-100">{{ change.proRataDays }} days</span>
              </div>
              <div class="flex justify-between">
                <span class="text-amber-700 dark:text-amber-300">Pro-rata amount</span>
                <span class="font-medium text-amber-900 dark:text-amber-100">£{{ formatCurrency(change.proRataAmount) }}</span>
              </div>
              <div v-if="change.adminFee > 0" class="flex justify-between">
                <span class="text-amber-700 dark:text-amber-300">Administration fee</span>
                <span class="font-medium text-amber-900 dark:text-amber-100">£{{ formatCurrency(change.adminFee) }}</span>
              </div>
              <div class="flex justify-between pt-3 border-t-2 border-amber-300 dark:border-amber-600">
                <span class="font-semibold text-amber-800 dark:text-amber-200">Total Due</span>
                <span class="text-xl font-bold text-amber-900 dark:text-amber-100">£{{ formatCurrency(change.totalAmount) }}</span>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="px-6 pb-4">
            <div class="p-4 bg-red-50 rounded-xl">
              <div class="flex items-center gap-2 text-red-700">
                <AlertCircle class="w-5 h-5" />
                <p class="text-sm font-medium">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Action -->
          <div class="px-6 py-5 bg-gray-50 dark:bg-slate-700 border-t border-gray-100 dark:border-slate-600">
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Once you have made the payment to the bank details provided in the email, click the button below to confirm.
            </p>
            <button
              @click="confirmPayment"
              :disabled="isConfirming"
              class="w-full py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 v-if="!isConfirming" class="w-5 h-5" />
              <Loader2 v-else class="w-5 h-5 animate-spin" />
              {{ isConfirming ? 'Confirming...' : "I've Made the Payment" }}
            </button>
          </div>
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-slate-500 mt-6">
          Powered by PropertyGoose
        </p>
      </div>
    </div>
  </div>
</template>
