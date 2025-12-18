<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-icon">
          <AlertTriangle />
        </div>
        <h2>Cancel Subscription?</h2>
        <p class="subtitle">You can continue using your subscription until {{ billingEndDate }}</p>
      </div>

      <div class="modal-body">
        <div class="info-box">
          <div class="info-item">
            <Check class="info-icon" />
            <span>Your credits will remain available until {{ billingEndDate }}</span>
          </div>
          <div class="info-item">
            <Check class="info-icon" />
            <span>You can reactivate anytime before the billing period ends</span>
          </div>
          <div class="info-item">
            <Check class="info-icon" />
            <span>No refunds for unused time in current billing period</span>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="btn-secondary">
          Keep Subscription
        </button>
        <button @click="$emit('confirm')" class="btn-danger">
          Yes, Cancel Subscription
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Check } from 'lucide-vue-next'

interface Props {
  billingEndDate: string
}

defineProps<Props>()
defineEmits(['close', 'confirm'])
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
  max-width: 500px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  text-align: center;
  padding: 2.5rem 2rem 1.5rem;
}

.header-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.25rem;
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon svg {
  width: 32px;
  height: 32px;
  color: #dc2626;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem 0;
}

.subtitle {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.modal-body {
  padding: 0 2rem 2rem;
}

.info-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.5;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #10b981;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding: 0 2rem 2rem;
}

.btn-secondary,
.btn-danger {
  flex: 1;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
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

.btn-danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
}

@media (max-width: 768px) {
  .modal-actions {
    flex-direction: column-reverse;
  }

  .btn-secondary,
  .btn-danger {
    width: 100%;
  }
}
</style>
