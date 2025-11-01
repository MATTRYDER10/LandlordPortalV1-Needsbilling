<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Choose Your Subscription</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Step 1: Choose Subscription Tier -->
        <div v-if="!showPaymentForm">
          <p class="subtitle">Subscribe and save up to 50% on reference credits. Credits roll over every month.</p>

          <div v-if="billingStore.loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading subscription plans...</p>
          </div>

          <div v-else class="subscription-tiers-grid">
            <div
              v-for="tier in billingStore.subscriptionTiers"
              :key="tier.id"
              class="tier-card"
              :class="{
                popular: tier.is_popular,
                selected: selectedTier?.id === tier.id
              }"
              @click="selectTier(tier)"
            >
              <div v-if="tier.is_popular" class="popular-badge">
                ⭐ Most Popular
              </div>

              <div class="tier-header">
                <h3>{{ tier.product_name }}</h3>
                <p class="tier-description">{{ tier.description }}</p>
              </div>

              <div class="tier-pricing">
                <div class="price-main">
                  <span class="currency">£</span>
                  <span class="amount">{{ tier.price_gbp.toFixed(0) }}</span>
                  <span class="period">/month</span>
                </div>
                <p class="price-detail">£{{ tier.price_per_credit.toFixed(2) }} per credit</p>
              </div>

              <div class="tier-features">
                <div class="feature-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>{{ tier.credits_quantity }} credits per month</span>
                </div>
                <div class="feature-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Credits roll over</span>
                </div>
                <div class="feature-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Cancel anytime</span>
                </div>
                <div class="feature-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Save {{ calculateSavings(tier) }}% vs pay-as-you-go</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedTier" class="tier-actions">
            <button @click="proceedToPayment" class="btn-primary">
              Continue to Payment
            </button>
          </div>
        </div>

        <!-- Step 2: Payment Form -->
        <div v-else-if="showPaymentForm && selectedTier" class="payment-section">
          <!-- Order Summary -->
          <div class="order-summary">
            <h3>Subscription Summary</h3>
            <div class="summary-row">
              <span>{{ selectedTier.product_name }}</span>
              <span class="summary-amount">£{{ selectedTier.price_gbp.toFixed(2) }}/month</span>
            </div>
            <div class="summary-detail">
              {{ selectedTier.credits_quantity }} credits per month • £{{ selectedTier.price_per_credit.toFixed(2) }} per credit
            </div>
            <div class="summary-features">
              <div class="feature-badge">✓ Credits roll over forever</div>
              <div class="feature-badge">✓ Cancel anytime</div>
              <div class="feature-badge">✓ Billed monthly</div>
            </div>
            <div class="summary-total">
              <span>Monthly Total</span>
              <span class="total-amount">£{{ selectedTier.price_gbp.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Payment Form -->
          <h3 class="payment-title">Payment Information</h3>

          <div id="payment-element"></div>

          <div v-if="paymentError" class="error-message">
            {{ paymentError }}
          </div>

          <div class="payment-actions">
            <button @click="cancelPayment" class="btn-secondary">
              Back
            </button>
            <button
              @click="handleSubscribe"
              :disabled="processing"
              class="btn-primary"
            >
              <span v-if="processing">Processing...</span>
              <span v-else>Subscribe for £{{ selectedTier.price_gbp.toFixed(2) }}/mo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBillingStore } from '../stores/billing'
import { loadStripe } from '@stripe/stripe-js'
import type { SubscriptionTier } from '../stores/billing'

const emit = defineEmits(['close', 'subscribed'])
const billingStore = useBillingStore()

const selectedTier = ref<SubscriptionTier | null>(null)
const showPaymentForm = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  await billingStore.fetchSubscriptionTiers()

  // Initialize Stripe
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SOgxnLLQSrQhTAA1FbO3GHy58oEuSBY8UkpMZRqK0Yzk3F4y0CxuCyPnTWFgbEc34db2X2nIbQg7iMsvmFiy2KZ00AjdBk9nc'
  stripe = await loadStripe(stripeKey)
})

function selectTier(tier: SubscriptionTier) {
  selectedTier.value = tier
}

function calculateSavings(tier: SubscriptionTier): number {
  const payAsYouGoPrice = 26.99
  const subscriptionPricePerCredit = tier.price_per_credit
  const savings = ((payAsYouGoPrice - subscriptionPricePerCredit) / payAsYouGoPrice) * 100
  return Math.round(savings)
}

async function proceedToPayment() {
  if (!selectedTier.value) return

  try {
    processing.value = true
    paymentError.value = null

    // Create subscription on backend
    const result = await billingStore.createSubscription(selectedTier.value.product_key)

    if (!stripe) {
      throw new Error('Stripe not initialized')
    }

    // Create Elements instance
    const appearance = {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#667eea',
      },
    }

    elements = stripe.elements({
      clientSecret: result.client_secret,
      appearance,
    })

    // Create and mount Payment Element with billing details
    paymentElement = elements.create('payment', {
      fields: {
        billingDetails: {
          address: {
            country: 'auto',
            postalCode: 'auto',
          },
        },
      },
    })

    showPaymentForm.value = true

    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 100))

    paymentElement.mount('#payment-element')
  } catch (error: any) {
    paymentError.value = error.message || 'Failed to initialize payment'
    console.error('Payment initialization error:', error)
  } finally {
    processing.value = false
  }
}

function cancelPayment() {
  showPaymentForm.value = false
  if (paymentElement) {
    paymentElement.unmount()
    paymentElement = null
  }
  paymentError.value = null
}

async function handleSubscribe() {
  if (!stripe || !elements) return

  try {
    processing.value = true
    paymentError.value = null

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?subscription=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Subscription failed'
    } else {
      // Subscription succeeded
      emit('subscribed')
    }
  } catch (error: any) {
    paymentError.value = error.message || 'Subscription processing failed'
    console.error('Subscription error:', error)
  } finally {
    processing.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 1100px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.close-button:hover {
  color: #111827;
}

.modal-body {
  padding: 2rem;
}

.subtitle {
  color: #6b7280;
  margin-bottom: 2rem;
  text-align: center;
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.spinner {
  border: 3px solid #f3f4f6;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.subscription-tiers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.tier-card {
  position: relative;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.tier-card:hover {
  border-color: #667eea;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
  transform: translateY(-4px);
}

.tier-card.selected {
  border-color: #667eea;
  background: #f5f7ff;
}

.tier-card.popular {
  border-color: #667eea;
  border-width: 3px;
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  padding: 0.25rem 1rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.tier-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem;
}

.tier-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1.5rem;
  min-height: 3rem;
}

.tier-pricing {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.price-main {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.25rem;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-right: 0.25rem;
}

.amount {
  font-size: 2.5rem;
  font-weight: 700;
  color: #111827;
}

.period {
  font-size: 1rem;
  color: #6b7280;
  margin-left: 0.25rem;
}

.price-detail {
  font-size: 0.875rem;
  color: #667eea;
  font-weight: 600;
  margin: 0;
}

.tier-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
}

.check-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #10b981;
  flex-shrink: 0;
}

.tier-actions {
  display: flex;
  justify-content: center;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.payment-section {
  min-height: 400px;
}

.order-summary {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.order-summary h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.summary-row span:first-child {
  font-weight: 500;
  color: #111827;
}

.summary-amount {
  font-weight: 600;
  color: #111827;
}

.summary-detail {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.summary-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.feature-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-weight: 500;
}

.summary-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 2px solid #e5e7eb;
  font-weight: 600;
}

.total-amount {
  font-size: 1.5rem;
  color: #667eea;
}

.payment-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

#payment-element {
  margin-bottom: 1.5rem;
}

.error-message {
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 1rem;
  color: #991b1b;
  margin-bottom: 1rem;
}

.payment-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}
</style>
