<template>
  <div class="credits-display" :class="{ 'low-credits': billingStore.isLowCredits }">
    <router-link to="/billing" class="credits-link">
      <div class="credits-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z">
          </path>
        </svg>
      </div>
      <div class="credits-info">
        <span class="credits-label">Credits</span>
        <span class="credits-count">{{ billingStore.creditsCount }}</span>
      </div>
      <div v-if="billingStore.isLowCredits" class="low-badge">
        !
      </div>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useBillingStore } from '../stores/billing'

const billingStore = useBillingStore()

let refreshInterval: number | null = null

onMounted(async () => {
  await billingStore.fetchCreditBalance()

  // Refresh balance every 30 seconds
  refreshInterval = window.setInterval(() => {
    billingStore.fetchCreditBalance()
  }, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.credits-display {
  padding: 0.75rem 1rem;
  margin: 0.5rem;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.credits-display.low-credits {
  background: #fef3c7;
  border-color: #f59e0b;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.credits-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
}

.credits-link:hover {
  opacity: 0.8;
}

.credits-icon {
  flex-shrink: 0;
}

.credits-icon svg {
  width: 1.5rem;
  height: 1.5rem;
  color: #667eea;
}

.credits-display.low-credits .credits-icon svg {
  color: #f59e0b;
}

.credits-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.credits-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.credits-count {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.low-badge {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #f59e0b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
}
</style>
