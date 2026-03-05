<template>
  <div class="space-y-6">
    <!-- Credit Balance Card -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6" :class="{ 'border-l-4 border-amber-500': billingStore.isLowCredits }">
      <div class="flex justify-between items-center">
        <div>
          <p class="text-sm text-gray-500 dark:text-slate-400">Available Credits</p>
          <p class="text-4xl font-bold text-gray-900 dark:text-white">{{ billingStore.creditsCount }}</p>
          <p v-if="billingStore.isLowCredits" class="mt-1 text-sm text-amber-600">
            Low credits -- consider topping up
          </p>
        </div>
        <div class="flex gap-3">
          <button @click="showPurchaseModal = true" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
            Buy Credits
          </button>
          <button v-if="!billingStore.hasActiveSubscription" @click="showSubscriptionModal = true" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md">
            Subscribe & Save
          </button>
        </div>
      </div>
    </div>

    <!-- Active Subscription -->
    <div v-if="billingStore.activeSubscription" class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Active Subscription</h3>
      </div>
      <dl class="divide-y divide-gray-200 dark:divide-slate-700">
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Plan</dt>
          <dd class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatTierName(billingStore.activeSubscription.tier) }}</dd>
        </div>
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Credits per month</dt>
          <dd class="text-sm font-semibold text-gray-900 dark:text-white">{{ billingStore.activeSubscription.credits_per_month }}</dd>
        </div>
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Monthly cost</dt>
          <dd class="text-sm font-semibold text-gray-900 dark:text-white">&pound;{{ billingStore.activeSubscription.monthly_total.toFixed(2) }}</dd>
        </div>
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Price per credit</dt>
          <dd class="text-sm font-semibold text-gray-900 dark:text-white">&pound;{{ billingStore.activeSubscription.price_per_credit.toFixed(2) }}</dd>
        </div>
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Next billing date</dt>
          <dd class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatDate(billingStore.activeSubscription.current_period_end) }}</dd>
        </div>
        <div class="px-6 py-3 flex justify-between">
          <dt class="text-sm text-gray-500 dark:text-slate-400">Status</dt>
          <dd>
            <span
              class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
              :class="billingStore.activeSubscription.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'"
            >
              {{ billingStore.activeSubscription.status }}
            </span>
          </dd>
        </div>
      </dl>
      <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700">
        <button
          v-if="!billingStore.activeSubscription.cancel_at_period_end"
          @click="handleCancelSubscription"
          class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"
        >
          Cancel Subscription
        </button>
        <p v-else class="text-sm text-gray-500 dark:text-slate-400 italic">
          Subscription will cancel on {{ formatDate(billingStore.activeSubscription.current_period_end) }}
        </p>
      </div>
    </div>

    <!-- Payment Methods -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage your saved payment methods for subscriptions and auto-recharge</p>
      </div>

      <div v-if="loadingPaymentMethods" class="p-8 text-center">
        <div class="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-slate-700 border-t-primary"></div>
      </div>

      <div v-else-if="paymentMethods.length === 0" class="p-8">
        <div class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
          <CreditCard class="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
          <p class="mt-2 text-sm text-gray-500 dark:text-slate-400">No payment methods saved</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">Add a payment method to enable auto-recharge</p>
          <button @click="showAddPaymentMethod = true" class="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
            Add Payment Method
          </button>
        </div>
      </div>

      <div v-else class="p-6 space-y-3">
        <div
          v-for="method in paymentMethods"
          :key="method.id"
          class="flex items-center justify-between p-4 border-2 rounded-lg"
          :class="method.id === defaultPaymentMethodId ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-slate-700'"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <CreditCard class="w-6 h-6 text-gray-500 dark:text-slate-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">
                  {{ method.card.brand.toUpperCase() }} &bull;&bull;&bull;&bull; {{ method.card.last4 }}
                </span>
                <span
                  v-if="method.id === defaultPaymentMethodId"
                  class="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary"
                >
                  Default
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400">Expires {{ method.card.exp_month }}/{{ method.card.exp_year }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              v-if="!method.is_default"
              @click="setDefaultPaymentMethod(method.id)"
              class="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              Set as Default
            </button>
            <button
              @click="confirmDeletePaymentMethod(method.id)"
              class="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="method.is_default && paymentMethods.length > 1"
              :title="method.is_default && paymentMethods.length > 1 ? 'Set another card as default before deleting' : 'Delete payment method'"
            >
              Delete
            </button>
          </div>
        </div>

        <button @click="showAddPaymentMethod = true" class="mt-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md">
          + Add New Payment Method
        </button>
      </div>
    </div>

    <!-- Auto-Recharge Settings -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Auto-Recharge Settings</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">Automatically purchase credits when your balance runs low</p>
      </div>

      <div class="p-6 space-y-6">
        <div class="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">Enable Auto-Recharge</p>
            <p class="text-sm text-gray-500 dark:text-slate-400">Automatically purchase a credit pack when your balance falls below the threshold</p>
          </div>
          <button
            role="switch"
            :aria-checked="autoRechargeEnabled"
            @click="autoRechargeEnabled = !autoRechargeEnabled; handleAutoRechargeToggle()"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            :class="autoRechargeEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-600'"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="autoRechargeEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div v-if="autoRechargeEnabled" class="space-y-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
          <div>
            <label for="threshold" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Threshold (credits)
            </label>
            <p class="text-xs text-gray-500 dark:text-slate-400 mb-1">Purchase credits when balance reaches this number</p>
            <input
              id="threshold"
              type="number"
              v-model.number="autoRechargeThreshold"
              min="1"
              max="50"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label for="pack-size" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Pack Size (credits)
            </label>
            <p class="text-xs text-gray-500 dark:text-slate-400 mb-1">Number of credits to purchase each time</p>
            <select
              id="pack-size"
              v-model.number="autoRechargePackSize"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
            >
              <option :value="10">10 credits (&pound;210)</option>
              <option :value="25">25 credits (&pound;525)</option>
              <option :value="50">50 credits (&pound;1,050)</option>
              <option :value="100">100 credits (&pound;2,100)</option>
            </select>
          </div>

          <button
            @click="saveAutoRechargeSettings"
            :disabled="savingAutoRecharge"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
          >
            {{ savingAutoRecharge ? 'Saving...' : 'Save Settings' }}
          </button>

          <div v-if="autoRechargeSaved" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
            Auto-recharge settings saved successfully
          </div>
          <div v-if="autoRechargeError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
            {{ autoRechargeError }}
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h3>
      </div>

      <div v-if="billingStore.transactions.length === 0" class="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
        No transactions yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead class="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Credits</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Balance</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            <tr v-for="transaction in billingStore.transactions" :key="transaction.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{{ formatDate(transaction.created_at) }}</td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{{ transaction.description }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="transactionTypeBadgeClass(transaction.type)"
                >
                  {{ formatTransactionType(transaction.type) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold" :class="transaction.credits_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ transaction.credits_change > 0 ? '+' : '' }}{{ transaction.credits_change }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                <span v-if="transaction.amount_gbp">&pound;{{ transaction.amount_gbp.toFixed(2) }}</span>
                <span v-else>-</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{{ transaction.credits_balance_after }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Purchase Credits Modal -->
    <CreditPacksModal
      v-if="showPurchaseModal"
      @close="showPurchaseModal = false"
      @purchased="handleCreditsPurchased"
    />

    <!-- Subscribe Modal -->
    <SubscriptionModal
      v-if="showSubscriptionModal"
      @close="showSubscriptionModal = false"
      @subscribed="handleSubscribed"
    />

    <!-- Cancel Subscription Modal -->
    <CancelSubscriptionModal
      v-if="showCancelModal"
      :billing-end-date="formatDate(billingStore.activeSubscription?.current_period_end || '')"
      @close="showCancelModal = false"
      @confirm="confirmCancelSubscription"
    />

    <!-- Add Payment Method Modal -->
    <AddPaymentMethodModal
      v-if="showAddPaymentMethod"
      @close="showAddPaymentMethod = false"
      @added="handlePaymentMethodAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useBillingStore } from '../stores/billing'
import { useAuthStore } from '../stores/auth'
import CreditPacksModal from '../components/CreditPacksModal.vue'
import SubscriptionModal from '../components/SubscriptionModal.vue'
import CancelSubscriptionModal from '../components/CancelSubscriptionModal.vue'
import AddPaymentMethodModal from '../components/AddPaymentMethodModal.vue'
import { CreditCard } from 'lucide-vue-next'
import axios from 'axios'
import { formatDate as formatUkDate } from '../utils/date'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const toast = useToast()
const billingStore = useBillingStore()
const authStore = useAuthStore()
const showPurchaseModal = ref(false)
const showSubscriptionModal = ref(false)
const showCancelModal = ref(false)
const showAddPaymentMethod = ref(false)

// Payment methods state
const paymentMethods = ref<any[]>([])
const defaultPaymentMethodId = ref<string | null>(null)
const loadingPaymentMethods = ref(false)

// Auto-recharge state
const autoRechargeEnabled = ref(false)
const autoRechargeThreshold = ref(5)
const autoRechargePackSize = ref(25)
const savingAutoRecharge = ref(false)
const autoRechargeSaved = ref(false)
const autoRechargeError = ref('')

onMounted(async () => {
  await billingStore.initialize()
  await billingStore.fetchTransactions()
  await loadPaymentMethods()

  // Load auto-recharge settings from credit balance
  if (billingStore.creditBalance) {
    autoRechargeEnabled.value = billingStore.creditBalance.auto_recharge_enabled ?? false
    autoRechargeThreshold.value = billingStore.creditBalance.auto_recharge_threshold ?? 5
    autoRechargePackSize.value = billingStore.creditBalance.auto_recharge_pack_size ?? 25
  }
})

function formatTierName(tier: string): string {
  const names: Record<string, string> = {
    small: 'Small (Under 20)',
    medium: 'Medium (20-39)',
    large: 'Large (40-49)',
    enterprise: 'Enterprise (50+)'
  }
  return names[tier] || tier
}

function formatDate(dateString?: string | null, fallback = 'N/A'): string {
  return formatUkDate(
    dateString,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )
}

function formatTransactionType(type: string): string {
  const types: Record<string, string> = {
    subscription_credit: 'Subscription',
    pack_purchase: 'Purchase',
    credit_used: 'Used',
    auto_recharge: 'Auto-recharge',
    refund: 'Refund',
    signup_bonus: 'Signup Bonus'
  }
  return types[type] || type
}

function transactionTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    subscription_credit: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    pack_purchase: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    signup_bonus: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    auto_recharge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    credit_used: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    refund: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
  }
  return classes[type] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300'
}

function handleCancelSubscription() {
  showCancelModal.value = true
}

async function confirmCancelSubscription() {
  showCancelModal.value = false
  try {
    await billingStore.cancelSubscription(true)
    toast.success('Subscription canceled successfully')
  } catch (err) {
    toast.error('Failed to cancel subscription')
  }
}

async function handleCreditsPurchased() {
  showPurchaseModal.value = false

  // Store the current balance
  const initialBalance = billingStore.creditsCount

  // Show success message
  toast.info('Payment successful! Your credits are being added...', { timeout: 5000 })

  // Poll for credit balance update (webhook takes a moment)
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
    await billingStore.fetchCreditBalance()

    // If balance has increased, credits have been added
    if (billingStore.creditsCount > initialBalance) {
      toast.success(`Success! ${billingStore.creditsCount - initialBalance} credits have been added to your account!`, { timeout: 5000 })
      await billingStore.fetchTransactions()
      break
    }

    attempts++
  }

  // If we didn't see the update after 10 seconds, still refresh
  if (attempts >= maxAttempts) {
    await billingStore.fetchTransactions()
  }
}

async function handleSubscribed() {
  showSubscriptionModal.value = false

  // Store the current balance
  const initialBalance = billingStore.creditsCount

  // Show success message
  toast.info('Subscription activated! Your credits are being added...', { timeout: 5000 })

  // Poll for credit balance update (webhook takes a moment)
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
    await Promise.all([
      billingStore.fetchActiveSubscription(),
      billingStore.fetchCreditBalance()
    ])

    // If balance has increased, credits have been added
    if (billingStore.creditsCount > initialBalance) {
      toast.success(`Success! Your subscription is active and ${billingStore.creditsCount - initialBalance} credits have been added!`, { timeout: 5000 })
      await billingStore.fetchTransactions()
      break
    }

    attempts++
  }

  // If we didn't see the update after 10 seconds, still refresh
  if (attempts >= maxAttempts) {
    await billingStore.fetchTransactions()
  }
}

async function handleAutoRechargeToggle() {
  // If disabling, save immediately
  if (!autoRechargeEnabled.value) {
    await saveAutoRechargeSettings()
  }
}

async function saveAutoRechargeSettings() {
  try {
    savingAutoRecharge.value = true
    autoRechargeError.value = ''
    autoRechargeSaved.value = false

    await billingStore.updateAutoRecharge({
      enabled: autoRechargeEnabled.value,
      threshold: autoRechargeThreshold.value,
      pack_size: autoRechargePackSize.value
    })

    // Refresh credit balance to get updated settings
    await billingStore.fetchCreditBalance()

    autoRechargeSaved.value = true

    // Hide success message after 3 seconds
    setTimeout(() => {
      autoRechargeSaved.value = false
    }, 3000)
  } catch (err: any) {
    autoRechargeError.value = err.response?.data?.error || 'Failed to save auto-recharge settings'
  } finally {
    savingAutoRecharge.value = false
  }
}

async function loadPaymentMethods() {
  try {
    loadingPaymentMethods.value = true
    const token = authStore.session?.access_token

    const response = await axios.get(`${API_URL}/api/billing/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    // Backend returns payment methods array directly (not wrapped in an object)
    if (Array.isArray(response.data)) {
      paymentMethods.value = response.data
      // Find default payment method (marked with is_default: true)
      const defaultMethod = response.data.find((pm: any) => pm.is_default)
      defaultPaymentMethodId.value = defaultMethod?.id || null
    } else {
      // Fallback for wrapped response
      paymentMethods.value = response.data.payment_methods || []
      defaultPaymentMethodId.value = response.data.default_payment_method || null
    }
  } catch (err: any) {
    // Silently fail - payment methods are optional
  } finally {
    loadingPaymentMethods.value = false
  }
}

async function handlePaymentMethodAdded() {
  showAddPaymentMethod.value = false

  // SetupIntent already attached the payment method to the customer
  // Just refresh the payment methods list
  toast.success('Payment method added successfully')
  await loadPaymentMethods()
}

async function setDefaultPaymentMethod(paymentMethodId: string) {
  try {
    const token = authStore.session?.access_token
    await axios.put(
      `${API_URL}/api/billing/payment-methods/default`,
      { payment_method_id: paymentMethodId },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    toast.success('Default payment method updated')
    await loadPaymentMethods()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to update default payment method')
  }
}

async function confirmDeletePaymentMethod(paymentMethodId: string) {
  const method = paymentMethods.value.find(pm => pm.id === paymentMethodId)

  if (method?.is_default && paymentMethods.value.length > 1) {
    toast.error('Please set another card as default before deleting this one')
    return
  }

  const cardInfo = method ? `${method.card.brand.toUpperCase()} •••• ${method.card.last4}` : 'this card'

  if (!confirm(`Are you sure you want to delete ${cardInfo}?`)) {
    return
  }

  await deletePaymentMethod(paymentMethodId)
}

async function deletePaymentMethod(paymentMethodId: string) {
  try {
    const token = authStore.session?.access_token
    await axios.delete(
      `${API_URL}/api/billing/payment-methods/${paymentMethodId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    toast.success('Payment method deleted successfully')
    await loadPaymentMethods()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to delete payment method')
  }
}
</script>
