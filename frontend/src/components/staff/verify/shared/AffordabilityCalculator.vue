<template>
  <div class="affordability-calculator">
    <h4 class="calculator-title">Live Affordability Calculation</h4>

    <div class="calc-grid">
      <div class="calc-item">
        <span class="calc-label">Monthly Rent</span>
        <span class="calc-value">{{ formatCurrency(monthlyRent) }}</span>
      </div>
      <div class="calc-item">
        <span class="calc-label">Annual Rent</span>
        <span class="calc-value">{{ formatCurrency(annualRent) }}</span>
      </div>
      <div class="calc-item highlight">
        <span class="calc-label">Income Ratio</span>
        <span :class="['calc-value', ratioClass]">
          {{ ratio.toFixed(2) }}x
          <span v-if="meetsRequirement" class="ratio-badge pass">Meets 2.5x</span>
          <span v-else class="ratio-badge fail">Below 2.5x</span>
        </span>
      </div>
      <div class="calc-item highlight">
        <span class="calc-label">Max Affordable Rent</span>
        <span class="calc-value">{{ formatCurrency(affordableRent) }}/month</span>
      </div>
    </div>

    <div class="calc-formula">
      <span class="formula-label">Calculation:</span>
      <span class="formula-text">
        {{ formatCurrency(income) }} (income) / {{ divisor }} = {{ formatCurrency(affordableRent) }}/month
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  income: number
  monthlyRent: number
  isGuarantor: boolean
}>()

const divisor = computed(() => props.isGuarantor ? 32 : 30)

const annualRent = computed(() => props.monthlyRent * 12)

const ratio = computed(() => {
  if (annualRent.value === 0) return 0
  return props.income / annualRent.value
})

const meetsRequirement = computed(() => ratio.value >= 2.5)

const affordableRent = computed(() => {
  return Math.round(props.income / divisor.value)
})

const ratioClass = computed(() => {
  if (ratio.value >= 2.5) return 'success'
  if (ratio.value >= 2.0) return 'warning'
  return 'danger'
})

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}
</script>

<style scoped>
.affordability-calculator {
  padding: 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
}

.calculator-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #166534;
  margin: 0 0 1rem;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.calc-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.calc-item.highlight {
  background: #dcfce7;
  border: 1px solid #86efac;
}

.calc-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.calc-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.calc-value.success {
  color: #166534;
}

.calc-value.warning {
  color: #92400e;
}

.calc-value.danger {
  color: #991b1b;
}

.ratio-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
}

.ratio-badge.pass {
  background: #d1fae5;
  color: #065f46;
}

.ratio-badge.fail {
  background: #fee2e2;
  color: #991b1b;
}

.calc-formula {
  margin-top: 1rem;
  padding: 0.5rem;
  background: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.formula-label {
  color: #6b7280;
  margin-right: 0.5rem;
}

.formula-text {
  color: #374151;
  font-family: monospace;
}

@media (max-width: 640px) {
  .calc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
