<template>
  <div class="billing-dashboard">
    <div class="dashboard-header">
      <h1>Billing & Credits</h1>
      <p class="subtitle">Manage your credits, subscriptions, and payment methods</p>
    </div>

    <!-- Credit Balance Card -->
    <div class="credit-balance-card" :class="{ 'low-credits': billingStore.isLowCredits }">
      <div class="balance-content">
        <div class="balance-info">
          <span class="label">Available Credits</span>
          <span class="credits-count">{{ billingStore.creditsCount }}</span>
          <span v-if="billingStore.isLowCredits" class="low-credits-warning">
            ⚠️ Low credits - Consider topping up
          </span>
        </div>
        <div class="balance-actions">
          <button @click="showPurchaseModal = true" class="btn-primary">
            Buy Credits
          </button>
          <button v-if="!billingStore.hasActiveSubscription" @click="showSubscriptionModal = true" class="btn-secondary">
            Subscribe & Save
          </button>
        </div>
      </div>
    </div>

    <!-- Active Subscription -->
    <div v-if="billingStore.activeSubscription" class="subscription-card">
      <h2>Active Subscription</h2>
      <div class="subscription-details">
        <div class="detail-row">
          <span class="label">Plan:</span>
          <span class="value">{{ formatTierName(billingStore.activeSubscription.tier) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Credits per month:</span>
          <span class="value">{{ billingStore.activeSubscription.credits_per_month }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Monthly cost:</span>
          <span class="value">£{{ billingStore.activeSubscription.monthly_total.toFixed(2) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Price per credit:</span>
          <span class="value">£{{ billingStore.activeSubscription.price_per_credit.toFixed(2) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Next billing date:</span>
          <span class="value">{{ formatDate(billingStore.activeSubscription.current_period_end) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Status:</span>
          <span class="value" :class="`status-${billingStore.activeSubscription.status}`">
            {{ billingStore.activeSubscription.status }}
          </span>
        </div>
      </div>
      <div class="subscription-actions">
        <button v-if="!billingStore.activeSubscription.cancel_at_period_end"
                @click="handleCancelSubscription"
                class="btn-danger">
          Cancel Subscription
        </button>
        <span v-else class="cancel-notice">
          Subscription will cancel on {{ formatDate(billingStore.activeSubscription.current_period_end) }}
        </span>
      </div>
    </div>

    <!-- Auto-Recharge Settings -->
    <div class="subscription-card">
      <h2>Auto-Recharge Settings</h2>
      <p class="subtitle" style="margin-top: 0.5rem; color: #6b7280; font-size: 0.875rem;">Automatically purchase credits when your balance runs low</p>

      <div class="auto-recharge-content" style="margin-top: 1.5rem;">
        <div class="toggle-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f9fafb; border-radius: 8px;">
          <div class="toggle-info">
            <label for="auto-recharge-toggle" class="toggle-label" style="font-weight: 600; color: #111827; display: block; margin-bottom: 0.25rem;">
              Enable Auto-Recharge
            </label>
            <p class="toggle-description" style="margin: 0; font-size: 0.875rem; color: #6b7280;">
              Automatically purchase a credit pack when your balance falls below the threshold
            </p>
          </div>
          <label class="toggle-switch" style="position: relative; display: inline-block; width: 60px; height: 34px; margin-left: 1rem;">
            <input
              id="auto-recharge-toggle"
              type="checkbox"
              v-model="autoRechargeEnabled"
              @change="handleAutoRechargeToggle"
              style="opacity: 0; width: 0; height: 0;"
            />
            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 34px;"></span>
          </label>
        </div>

        <div v-if="autoRechargeEnabled" class="auto-recharge-settings" style="margin-top: 1.5rem; padding: 1.5rem; background: #f9fafb; border-radius: 8px;">
          <div class="setting-row" style="margin-bottom: 1.5rem;">
            <label for="threshold" class="setting-label" style="display: block; font-weight: 600; color: #111827; margin-bottom: 0.5rem;">
              Threshold (credits)
              <span class="setting-help" style="display: block; font-size: 0.875rem; font-weight: 400; color: #6b7280; margin-top: 0.25rem;">Purchase credits when balance reaches this number</span>
            </label>
            <input
              id="threshold"
              type="number"
              v-model.number="autoRechargeThreshold"
              min="1"
              max="50"
              class="setting-input"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem;"
            />
          </div>

          <div class="setting-row" style="margin-bottom: 1.5rem;">
            <label for="pack-size" class="setting-label" style="display: block; font-weight: 600; color: #111827; margin-bottom: 0.5rem;">
              Pack Size (credits)
              <span class="setting-help" style="display: block; font-size: 0.875rem; font-weight: 400; color: #6b7280; margin-top: 0.25rem;">Number of credits to purchase each time</span>
            </label>
            <select
              id="pack-size"
              v-model.number="autoRechargePackSize"
              class="setting-select"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; background: white;"
            >
              <option :value="10">10 credits (£210)</option>
              <option :value="25">25 credits (£525)</option>
              <option :value="50">50 credits (£1,050)</option>
              <option :value="100">100 credits (£2,100)</option>
            </select>
          </div>

          <div class="setting-actions">
            <button
              @click="saveAutoRechargeSettings"
              :disabled="savingAutoRecharge"
              class="btn-primary"
              style="padding: 0.75rem 1.5rem; background: #f97316; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;"
            >
              {{ savingAutoRecharge ? 'Saving...' : 'Save Settings' }}
            </button>
          </div>

          <div v-if="autoRechargeSaved" class="success-message" style="margin-top: 1rem; padding: 0.75rem; background: #dcfce7; color: #166534; border-radius: 6px; font-size: 0.875rem;">
            ✓ Auto-recharge settings saved successfully
          </div>
          <div v-if="autoRechargeError" class="error-message" style="margin-top: 1rem; padding: 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 0.875rem;">
            {{ autoRechargeError }}
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="transactions-card">
      <h2>Transaction History</h2>
      <div v-if="billingStore.transactions.length === 0" class="empty-state">
        <p>No transactions yet</p>
      </div>
      <table v-else class="transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Credits</th>
            <th>Amount</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in billingStore.transactions" :key="transaction.id">
            <td>{{ formatDate(transaction.created_at) }}</td>
            <td>{{ transaction.description }}</td>
            <td>
              <span class="transaction-type" :class="`type-${transaction.type}`">
                {{ formatTransactionType(transaction.type) }}
              </span>
            </td>
            <td :class="transaction.credits_change > 0 ? 'positive' : 'negative'">
              {{ transaction.credits_change > 0 ? '+' : '' }}{{ transaction.credits_change }}
            </td>
            <td>
              <span v-if="transaction.amount_gbp">£{{ transaction.amount_gbp.toFixed(2) }}</span>
              <span v-else>-</span>
            </td>
            <td>{{ transaction.credits_balance_after }}</td>
          </tr>
        </tbody>
      </table>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useBillingStore } from '../stores/billing'
import CreditPacksModal from '../components/CreditPacksModal.vue'
import SubscriptionModal from '../components/SubscriptionModal.vue'
import CancelSubscriptionModal from '../components/CancelSubscriptionModal.vue'

const toast = useToast()

const billingStore = useBillingStore()
const showPurchaseModal = ref(false)
const showSubscriptionModal = ref(false)
const showCancelModal = ref(false)

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatTransactionType(type: string): string {
  const types: Record<string, string> = {
    subscription_credit: 'Subscription',
    pack_purchase: 'Purchase',
    credit_used: 'Used',
    auto_recharge: 'Auto-recharge',
    refund: 'Refund'
  }
  return types[type] || type
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
</script>

<style scoped>
.billing-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1rem;
}

.credit-balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  color: white;
}

.credit-balance-card.low-credits {
  background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);
}

.balance-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.balance-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.balance-info .label {
  font-size: 0.875rem;
  opacity: 0.9;
}

.credits-count {
  font-size: 3rem;
  font-weight: 700;
}

.low-credits-warning {
  font-size: 0.875rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  width: fit-content;
}

.balance-actions {
  display: flex;
  gap: 1rem;
}

.subscription-card,
.transactions-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.subscription-card h2,
.transactions-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1.5rem;
}

.subscription-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-row .value {
  color: #111827;
  font-weight: 600;
}

.status-active {
  color: #10b981;
}

.status-past_due {
  color: #ef4444;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
}

.transactions-table th {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
  color: #6b7280;
  font-weight: 600;
  font-size: 0.875rem;
}

.transactions-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.transaction-type {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-subscription_credit,
.type-pack_purchase {
  background: #dcfce7;
  color: #166534;
}

.type-credit_used {
  background: #fee2e2;
  color: #991b1b;
}

.positive {
  color: #10b981;
  font-weight: 600;
}

.negative {
  color: #ef4444;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  background: #f3f4f6;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
}

.btn-danger:hover {
  background: #fecaca;
}

.cancel-notice {
  color: #6b7280;
  font-style: italic;
}

/* Toggle Switch */
.toggle-switch input:checked + .toggle-slider {
  background-color: #f97316;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(26px);
}
</style>
