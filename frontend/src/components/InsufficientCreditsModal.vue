<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="warning-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
            </path>
          </svg>
        </div>
        <h2>Insufficient Credits</h2>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <p class="message">
          You don't have enough credits to create a reference. Purchase credits or subscribe to continue.
        </p>

        <div class="options-container">
          <div class="option-card" @click="showCreditPacks = true">
            <div class="option-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z">
                </path>
              </svg>
            </div>
            <h3>Buy Credit Pack</h3>
            <p>One-time purchase</p>
            <span class="starting-from">From £210 for 10 credits</span>
            <button class="btn-secondary">Purchase Now</button>
          </div>

          <div class="option-card featured" @click="showSubscription = true">
            <div class="featured-badge">⭐ Best Value</div>
            <div class="option-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z">
                </path>
              </svg>
            </div>
            <h3>Subscribe & Save</h3>
            <p>Monthly subscription</p>
            <span class="starting-from">From £350/month • Save up to 50%</span>
            <button class="btn-primary">Subscribe Now</button>
          </div>
        </div>

        <div class="current-balance">
          <span class="label">Current balance:</span>
          <span class="value">{{ billingStore.creditsCount }} credits</span>
        </div>

        <div class="actions">
          <router-link to="/billing" class="btn-link">
            View All Pricing Options
          </router-link>
        </div>
      </div>
    </div>
  </div>

  <!-- Nested Modals -->
  <CreditPacksModal
    v-if="showCreditPacks"
    @close="showCreditPacks = false"
    @purchased="handlePurchased"
  />

  <SubscriptionModal
    v-if="showSubscription"
    @close="showSubscription = false"
    @subscribed="handleSubscribed"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBillingStore } from '../stores/billing'
import CreditPacksModal from './CreditPacksModal.vue'
import SubscriptionModal from './SubscriptionModal.vue'

const emit = defineEmits(['close', 'credits-added'])
const billingStore = useBillingStore()

const showCreditPacks = ref(false)
const showSubscription = ref(false)

function handlePurchased() {
  showCreditPacks.value = false
  emit('credits-added')
  emit('close')
}

function handleSubscribed() {
  showSubscription.value = false
  emit('credits-added')
  emit('close')
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
  position: relative;
  text-align: center;
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.warning-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  color: #f59e0b;
}

.warning-icon svg {
  width: 100%;
  height: 100%;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
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

.message {
  text-align: center;
  color: #6b7280;
  margin-bottom: 2rem;
  font-size: 1rem;
}

.options-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.option-card {
  position: relative;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.option-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 6px rgba(102, 126, 234, 0.1);
  transform: translateY(-2px);
}

.option-card.featured {
  border-color: #667eea;
  background: linear-gradient(135deg, #f5f7ff 0%, #ffffff 100%);
}

.featured-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.option-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  color: #667eea;
}

.option-icon svg {
  width: 100%;
  height: 100%;
}

.option-card h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem;
}

.option-card p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1rem;
}

.starting-from {
  display: block;
  font-size: 0.875rem;
  color: #667eea;
  font-weight: 600;
  margin-bottom: 1rem;
}

.current-balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.current-balance .label {
  color: #6b7280;
  font-weight: 500;
}

.current-balance .value {
  color: #111827;
  font-weight: 700;
  font-size: 1.125rem;
}

.actions {
  text-align: center;
}

.btn-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-primary,
.btn-secondary {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 640px) {
  .options-container {
    grid-template-columns: 1fr;
  }
}
</style>
