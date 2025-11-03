<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h2>Purchase Credits</h2>
          <p class="header-subtitle">Choose a pack that fits your needs. Credits never expire.</p>
        </div>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Step 1: Choose Credit Pack -->
        <div v-if="!showPaymentForm">
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
                Recommended
              </div>

              <div class="pack-content">
                <div class="pack-credits">
                  <div class="credits-number">{{ pack.credits_quantity }}</div>
                  <div class="credits-label">Reference Credits</div>
                </div>

                <div class="pack-price">
                  <span class="currency">£</span>
                  <span class="amount">{{ pack.price_gbp.toFixed(2) }}</span>
                </div>

                <div class="pack-details">
                  <div class="detail-row">
                    <span class="detail-label">Per credit</span>
                    <span class="detail-value">£{{ pack.price_per_credit.toFixed(2) }}</span>
                  </div>
                  <div v-if="calculateSavings(pack) > 0" class="savings">
                    Save £{{ calculateSavings(pack).toFixed(2) }}
                  </div>
                </div>

                <div class="pack-description">
                  {{ pack.description }}
                </div>
              </div>

              <div class="pack-footer">
                <button class="select-button">
                  <span v-if="selectedPack?.id === pack.id">✓ Selected</span>
                  <span v-else>Select Pack</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Payment Form -->
        <div v-else-if="showPaymentForm && selectedPack" class="payment-section">
          <!-- Order Summary -->
          <div class="order-summary">
            <h3>Order Summary</h3>
            <div class="summary-content">
              <div class="summary-item">
                <div class="summary-label">
                  <div class="summary-pack-name">{{ selectedPack.product_name }}</div>
                  <div class="summary-pack-detail">{{ selectedPack.credits_quantity }} credits</div>
                </div>
                <div class="summary-price">£{{ selectedPack.price_gbp.toFixed(2) }}</div>
              </div>
              <div class="summary-total">
                <span class="total-label">Total</span>
                <span class="total-amount">£{{ selectedPack.price_gbp.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Payment Form -->
          <div class="payment-form-section">
            <h3>Payment Details</h3>
            <div id="payment-element"></div>

            <div v-if="paymentError" class="error-message">
              {{ paymentError }}
            </div>
          </div>

          <div class="payment-actions">
            <button @click="cancelPayment" class="btn-secondary">
              ← Back
            </button>
            <button
              @click="handlePayment"
              :disabled="processing"
              class="btn-primary btn-large"
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
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!stripeKey) {
    throw new Error('Stripe publishable key not configured')
  }
  stripe = await loadStripe(stripeKey)
})

async function selectPack(pack: CreditPack) {
  selectedPack.value = pack
  // Immediately proceed to payment to reduce friction
  await proceedToPayment()
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

    // If payment was auto-charged with saved payment method, skip payment form
    if (result.charged === true) {
      console.log('Payment auto-charged successfully')
      emit('purchased')
      return
    }

    // If no client_secret, something went wrong
    if (!result.client_secret) {
      throw new Error('No payment details received from server')
    }

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
        billingDetails: 'auto',
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
      // Payment succeeded - close modal and refresh
      emit('purchased')
      // Give a brief moment for user to see success before closing
      await new Promise(resolve => setTimeout(resolve, 500))
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 1400px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem 2.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.header-subtitle {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 2.5rem;
}

.loading-state {
  text-align: center;
  padding: 4rem 2rem;
}

.spinner {
  border: 3px solid #f3f4f6;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.credit-packs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.credit-pack-card {
  position: relative;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  display: flex;
  flex-direction: column;
}

.credit-pack-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -10px rgba(102, 126, 234, 0.3);
}

.credit-pack-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #f5f7ff 0%, #ffffff 100%);
  box-shadow: 0 8px 16px -6px rgba(102, 126, 234, 0.2);
}

.credit-pack-card.recommended {
  border-color: #f97316;
}

.credit-pack-card.recommended.selected {
  border-color: #f97316;
  background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%);
}

.recommended-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  padding: 0.4rem 0.875rem;
  border-bottom-left-radius: 8px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
  z-index: 10;
}

.pack-content {
  padding: 1.5rem 1.25rem 1.25rem;
  flex: 1;
}

.credit-pack-card.recommended .pack-content {
  padding-top: 2.25rem;
}

.pack-credits {
  text-align: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.credits-number {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 0.4rem;
}

.credits-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pack-price {
  text-align: center;
  margin-bottom: 1rem;
}

.currency {
  font-size: 2rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.02em;
}

.amount {
  font-size: 2rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.02em;
}

.pack-details {
  background: #f9fafb;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.detail-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 700;
}

.savings {
  text-align: center;
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
  padding: 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-top: 0.4rem;
}

.pack-description {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
  line-height: 1.4;
  min-height: 2.8em;
}

.pack-footer {
  padding: 0 1.25rem 1.25rem;
}

.select-button {
  width: 100%;
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.select-button:hover {
  background: #5568d3;
  transform: scale(1.02);
}

.credit-pack-card.selected .select-button {
  background: #10b981;
}

.credit-pack-card.selected .select-button:hover {
  background: #059669;
}

/* Payment Section */
.payment-section {
  max-width: 600px;
  margin: 0 auto;
}

.order-summary {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.order-summary h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  margin: 0 0 1.25rem 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-pack-name {
  font-weight: 600;
  color: #111827;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.summary-pack-detail {
  font-size: 0.875rem;
  color: #6b7280;
}

.summary-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.summary-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1.25rem;
  border-top: 2px solid #e5e7eb;
}

.total-label {
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.875rem;
}

.total-amount {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.payment-form-section {
  margin-bottom: 2rem;
}

.payment-form-section h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

#payment-element {
  margin-bottom: 1.5rem;
}

.error-message {
  background: #fee2e2;
  border-left: 4px solid #dc2626;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  color: #991b1b;
  margin-bottom: 1.5rem;
  font-size: 0.9375rem;
}

.payment-actions {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.btn-primary,
.btn-secondary {
  padding: 0.875rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

@media (max-width: 1024px) {
  .credit-packs-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .credit-packs-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }

  .modal-header {
    padding: 1.5rem;
  }

  .modal-header h2 {
    font-size: 1.5rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .pack-content {
    padding: 1rem;
  }

  .credits-number {
    font-size: 2rem;
  }

  .amount {
    font-size: 1.75rem;
  }

  .payment-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .credit-packs-grid {
    grid-template-columns: 1fr;
  }
}
</style>
