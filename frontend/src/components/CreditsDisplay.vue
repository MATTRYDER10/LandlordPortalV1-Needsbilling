<template>
  <div
    class="credits-display transition-all duration-300"
    :class="[
      billingStore.isLowCredits ? 'low-credits' : '',
      isDark ? 'dark-mode' : 'light-mode'
    ]"
  >
    <router-link to="/billing" class="credits-link">
      <div class="credits-icon">
        <Coins />
      </div>
      <div class="credits-info">
        <span class="credits-label" :class="isDark ? 'text-white/50' : 'text-gray-500'">Credits</span>
        <span class="credits-count" :class="isDark ? 'text-white' : 'text-gray-900'">{{ billingStore.creditsCount.toFixed(2) }}</span>
      </div>
      <div v-if="billingStore.isLowCredits" class="low-badge">
        !
      </div>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Coins } from 'lucide-vue-next'
import { useBillingStore } from '../stores/billing'
import { useDarkMode } from '@/composables/useDarkMode'

const billingStore = useBillingStore()
const { isDark } = useDarkMode()

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
  margin: 0.75rem;
  border-radius: 10px;
  transition: all 0.2s;
}

/* Dark mode styles */
.credits-display.dark-mode {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.credits-display.dark-mode:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
}

/* Light mode styles */
.credits-display.light-mode {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.credits-display.light-mode:hover {
  background: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.3);
  transform: translateX(4px);
}

/* Low credits state */
.credits-display.low-credits {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
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
  opacity: 0.9;
}

.credits-icon {
  flex-shrink: 0;
}

.credits-icon svg {
  width: 1.25rem;
  height: 1.25rem;
  color: #f97316;
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
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.credits-count {
  font-size: 1rem;
  font-weight: 700;
}

.low-badge {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #f59e0b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
}
</style>
