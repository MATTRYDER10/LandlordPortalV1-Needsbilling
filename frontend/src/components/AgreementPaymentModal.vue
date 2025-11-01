<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Payment Required</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <div class="payment-info">
          <p class="info-text">
            To generate agreements, please add a payment method. This will be securely saved for future agreement generations.
          </p>

          <div class="price-info">
            <div class="price-label">Agreement Generation Fee:</div>
            <div class="price-amount">£{{ price.toFixed(2) }}</div>
          </div>
        </div>

        <h3 class="payment-title">Payment Details</h3>

        <div id="payment-element"></div>

        <div v-if="paymentError" class="error-message">
          {{ paymentError }}
        </div>

        <div class="payment-actions">
          <button @click="$emit('close')" class="btn-secondary">
            Cancel
          </button>
          <button
            @click="handlePayment"
            :disabled="processing"
            class="btn-primary"
          >
            <span v-if="processing">Processing...</span>
            <span v-else>Pay £{{ price.toFixed(2) }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'

const props = defineProps<{
  clientSecret: string
  price: number
}>()

const emit = defineEmits(['close', 'paid'])

const processing = ref(false)
const paymentError = ref<string | null>(null)

let stripe: any = null
let elements: any = null
let paymentElement: any = null

onMounted(async () => {
  // Initialize Stripe
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SOgxnLLQSrQhTAA1FbO3GHy58oEuSBY8UkpMZRqK0Yzk3F4y0CxuCyPnTWFgbEc34db2X2nIbQg7iMsvmFiy2KZ00AjdBk9nc'
  stripe = await loadStripe(stripeKey)

  if (!stripe) {
    paymentError.value = 'Failed to load payment system'
    return
  }

  // Create Elements instance
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#667eea',
    },
  }

  elements = stripe.elements({
    clientSecret: props.clientSecret,
    appearance,
  })

  // Create and mount Payment Element
  paymentElement = elements.create('payment', {
    fields: {
      billingDetails: 'auto',
    },
  })

  paymentElement.mount('#payment-element')
})

async function handlePayment() {
  if (!stripe || !elements) return

  try {
    processing.value = true
    paymentError.value = null

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/agreements?payment=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      paymentError.value = error.message || 'Payment failed'
    } else {
      // Payment succeeded
      emit('paid')

      // Close modal after a short delay
      await new Promise(resolve => setTimeout(resolve, 500))
      emit('close')
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
  max-width: 600px;
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

.payment-info {
  margin-bottom: 2rem;
}

.info-text {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.price-info {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-label {
  font-weight: 500;
  color: #374151;
}

.price-amount {
  font-size: 1.5rem;
  font-weight: 700;
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
