<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h2>Add Payment Method</h2>
          <p class="subtitle">This will be used for auto-recharge and subscriptions</p>
        </div>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <div id="payment-element"></div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="info-box">
          <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p>Your payment method will be securely stored by Stripe and used only when you make a purchase or enable auto-recharge.</p>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="btn-secondary">
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="processing"
          class="btn-primary"
        >
          {{ processing ? 'Adding...' : 'Add Payment Method' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'

const emit = defineEmits(['close', 'added'])
const processing = ref(false)
const error = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  try {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SOgxnLLQSrQhTAA1FbO3GHy58oEuSBY8UkpMZRqK0Yzk3F4y0CxuCyPnTWFgbEc34db2X2nIbQg7iMsvmFiy2KZ00AjdBk9nc'
    stripe = await loadStripe(stripeKey)

    if (!stripe) {
      throw new Error('Failed to load Stripe')
    }

    // Create Elements instance for SetupIntent
    const appearance = {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#667eea',
      },
    }

    elements = stripe.elements({
      mode: 'setup',
      currency: 'gbp',
      appearance,
      setupFutureUsage: 'off_session', // Allow charging later without customer being present
    })

    // Create and mount Payment Element
    paymentElement = elements.create('payment', {
      fields: {
        billingDetails: 'auto',
      },
    })

    // Wait for DOM
    await new Promise(resolve => setTimeout(resolve, 100))
    paymentElement.mount('#payment-element')
  } catch (err: any) {
    error.value = err.message || 'Failed to initialize payment form'
    console.error('Payment element initialization error:', err)
  }
})

async function handleSubmit() {
  if (!stripe || !elements) {
    error.value = 'Payment form not ready'
    return
  }

  try {
    processing.value = true
    error.value = null

    const { error: submitError } = await elements.submit()
    if (submitError) {
      error.value = submitError.message || 'Failed to submit payment details'
      return
    }

    // Confirm the setup
    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/billing`,
      },
    })

    if (confirmError) {
      error.value = confirmError.message || 'Failed to add payment method'
    } else if (setupIntent?.status === 'succeeded') {
      // Payment method added successfully
      emit('added', setupIntent.payment_method)
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred'
    console.error('Payment method add error:', err)
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
  max-width: 600px;
  width: 100%;
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

.subtitle {
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

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #075985;
  line-height: 1.5;
}

.info-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #0284c7;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-box p {
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding: 0 2.5rem 2.5rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
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

@media (max-width: 768px) {
  .modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
