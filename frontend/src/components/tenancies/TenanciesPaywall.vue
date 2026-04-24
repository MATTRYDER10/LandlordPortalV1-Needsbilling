<template>
  <div class="max-w-2xl mx-auto px-4 py-12">
    <!-- Header -->
    <div class="text-center mb-10">
      <div class="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6" />
          <path d="M9 15l2 2 4-4" stroke-width="2" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">Full Self-Management</h1>
      <p class="text-lg text-gray-500 dark:text-gray-400">Everything a managing agent does. Priced like software.</p>
    </div>

    <!-- Pricing Card -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/30 shadow-xl p-8 mb-8">
      <div class="flex items-baseline gap-2 mb-1">
        <span class="text-4xl font-bold text-gray-900 dark:text-white">{{ formatPrice(subscriptionPrice) }}</span>
        <span class="text-gray-500 dark:text-gray-400">per month</span>
      </div>
      <p v-if="isLaunch" class="text-sm text-primary font-medium mb-6">
        <span class="line-through text-gray-400 mr-1">{{ formatPrice(STANDARD_SUBSCRIPTION_PRICE) }}</span>
        early-adopter price &mdash; reverts 1 May
      </p>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400 mb-6">Unlimited properties</p>

      <!-- Features list -->
      <div class="space-y-3 mb-8">
        <div v-for="feature in features" :key="feature" class="flex items-start gap-3">
          <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ feature }}</span>
        </div>
      </div>

      <!-- Subscribe button -->
      <button
        @click="handleSubscribe"
        :disabled="subscribing"
        class="w-full py-4 bg-gradient-to-r from-primary to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
      >
        {{ subscribing ? 'Setting up...' : 'Start free — upgrade anytime' }}
      </button>

      <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
        TRU-COST pricing &mdash; no hidden fees, no commissions, cancel anytime.
      </p>
    </div>

    <!-- Bottom note -->
    <div class="text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Don't need tenancy management? You can still use
        <router-link to="/offers" class="text-primary hover:underline">Offers</router-link> and
        <router-link to="/referencing" class="text-primary hover:underline">Referencing</router-link> on a pay-per-reference basis.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import {
  getSubscriptionPrice,
  isLaunchPeriod,
  formatPrice,
  STANDARD_SUBSCRIPTION_PRICE
} from '@/utils/pricing'

const authStore = useAuthStore()
const billingStore = useBillingStore()
const subscribing = ref(false)

const subscriptionPrice = computed(() => getSubscriptionPrice())
const isLaunch = computed(() => isLaunchPeriod())

const features = [
  'AST builder with RRA-compliant periodic tenancy template',
  'Unlimited tenancy agreements',
  'Section 13, 8, 21 & 48 notices — served from the app',
  'One-click deposit registration: TDS or MyDeposits',
  'Compliance packs sent automatically',
  'Gas, EPC & electrical reminders',
  'End-of-tenancy automation',
  'Tenant referencing at £13/ref (£1 off)',
  'Free utility bill management & switching',
  'Access to RentGuarantor and more',
  'InventoryGoose inspections (optional add-on)',
  'Industry updates'
]

async function handleSubscribe() {
  subscribing.value = true
  try {
    // Use existing billing store subscription flow
    const result = await billingStore.createSubscription('landlord_full_management')
    if (result) {
      // Refresh subscription status
      await authStore.fetchSubscriptionStatus()
      window.location.reload()
    }
  } catch (err) {
    console.error('Subscription error:', err)
  } finally {
    subscribing.value = false
  }
}
</script>
