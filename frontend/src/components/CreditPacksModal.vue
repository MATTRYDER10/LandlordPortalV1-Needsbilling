<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Purchase Credit Pack</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Step 1: Choose Credit Pack -->
        <div v-if="!showPaymentForm">
          <p class="subtitle">Choose a credit pack to purchase. Credits never expire.</p>

          <div v-if="billingStore.loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading credit packs...</p>
          </div>

          <div v-else class="credit-packs-grid">
            <div
              v-for="pack in billingStore.creditPacks"
              :key="pack.id"
              class="credit-pack-card"
              :class="{ recommended: pack.is_recommended, selected: selectedPack?.id === pack.id }"
              @click="selectPack(pack)"
            >
              <div v-if="pack.is_recommended" class="recommended-badge">
                ⭐ Recommended
              </div>

              <div class="pack-header">
                <h3>{{ pack.product_name }}</h3>
                <p class="pack-description">{{ pack.description }}</p>
              </div>

              <div class="pack-pricing">
                <div class="price-main">
                  <span class="currency">£</span>
                  <span class="amount">{{ pack.price_gbp.toFixed(2) }}</span>
                </div>
                <div class="price-details">
                  <div class="detail-item">
                    <span class="label">Credits:</span>
                    <span class="value">{{ pack.credits_quantity }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Per credit:</span>
                    <span class="value">£{{ pack.price_per_credit.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <div class="pack-savings">
                <span v-if="calculateSavings(pack) > 0" class="savings-badge">
                  Save £{{ calculateSavings(pack).toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="selectedPack" class="pack-actions">
            <button @click="proceedToPayment" class="btn-primary">
              Continue to Payment
            </button>
          </div>
        </div>

        <!-- Step 2: Payment Form -->
        <div v-else-if="showPaymentForm && selectedPack" class="payment-section">
          <!-- Order Summary -->
          <div class="order-summary">
            <h3>Order Summary</h3>
            <div class="summary-row">
              <span>{{ selectedPack.product_name }}</span>
              <span class="summary-amount">£{{ selectedPack.price_gbp.toFixed(2) }}</span>
            </div>
            <div class="summary-detail">
              {{ selectedPack.credits_quantity }} credits • £{{ selectedPack.price_per_credit.toFixed(2) }} per credit
            </div>
            <div class="summary-total">
              <span>Total</span>
              <span class="total-amount">£{{ selectedPack.price_gbp.toFixed(2) }}</span>
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
              @click="handlePayment"
              :disabled="processing"
              class="btn-primary"
            >
              <span v-if="processing">Processing...</span>
              <span v-else>Pay £{{ selectedPack.price_gbp.toFixed(2) }}</span>
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
import type { CreditPack } from '../stores/billing'

const emit = defineEmits(['close', 'purchased'])
const billingStore = useBillingStore()

const selectedPack = ref<CreditPack | null>(null)
const showPaymentForm = ref(false)
const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  await billingStore.fetchCreditPacks()

  // Initialize Stripe
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SOgxnLLQSrQhTAA1FbO3GHy58oEuSBY8UkpMZRqK0Yzk3F4y0CxuCyPnTWFgbEc34db2X2nIbQg7iMsvmFiy2KZ00AjdBk9nc'
  stripe = await loadStripe(stripeKey)
})

function selectPack(pack: CreditPack) {
  selectedPack.value = pack
}

function calculateSavings(pack: CreditPack): number {
  const payAsYouGoPrice = 26.99 // Price for single reference without subscription
  const totalPayAsYouGo = pack.credits_quantity * payAsYouGoPrice
  const savings = totalPayAsYouGo - pack.price_gbp
  return savings > 0 ? savings : 0
}

async function proceedToPayment() {
  if (!selectedPack.value) return

  try {
    processing.value = true
    paymentError.value = null

    // Create payment intent on backend
    const result = await billingStore.purchaseCreditPack(selectedPack.value.product_key)

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
          address: 'always',
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

async function handlePayment() {
  if (!stripe || !elements) return

  try {
    processing.value = true
    paymentError.value = null

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?payment=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      // Payment succeeded
      emit('purchased')
    }
  } catch (error: any) {
    paymentError.value = error.message || 'Payment processing failed'
    console.error('Payment error:', error)
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
  max-width: 900px;
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

.credit-packs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.credit-pack-card {
  position: relative;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.credit-pack-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 6px rgba(102, 126, 234, 0.1);
}

.credit-pack-card.selected {
  border-color: #667eea;
  background: #f5f7ff;
}

.credit-pack-card.recommended {
  border-color: #f59e0b;
}

.recommended-badge {
  position: absolute;
  top: -12px;
  right: 1rem;
  background: #f59e0b;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pack-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem;
}

.pack-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1rem;
}

.pack-pricing {
  margin-bottom: 1rem;
}

.price-main {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
}

.amount {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.price-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.detail-item .label {
  color: #6b7280;
}

.detail-item .value {
  color: #111827;
  font-weight: 600;
}

.pack-savings {
  min-height: 1.5rem;
}

.savings-badge {
  display: inline-block;
  background: #dcfce7;
  color: #166534;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pack-actions {
  display: flex;
  justify-content: flex-end;
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
