<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-icon">
          <AlertTriangle />
        </div>
        <h2>{{ title }}</h2>
        <p class="subtitle">{{ subtitle }}</p>
      </div>

      <div class="modal-body">
        <div class="warning-box">
          <AlertTriangle class="warning-icon" />
          <p>This action cannot be undone. All associated data references will be preserved but set to NULL.</p>
        </div>

        <div class="confirm-input-section">
          <label>
            To confirm, type <strong>{{ confirmValue }}</strong> below:
          </label>
          <input
            v-model="inputValue"
            type="text"
            :placeholder="confirmValue"
            class="confirm-input"
            @paste.prevent
            autocomplete="off"
          />
          <p v-if="inputValue && !isConfirmed" class="error-text">Email does not match</p>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="btn-secondary" :disabled="deleting">
          Cancel
        </button>
        <button
          @click="handleDelete"
          class="btn-danger"
          :disabled="!isConfirmed || deleting"
        >
          {{ deleting ? 'Deleting...' : 'Delete Permanently' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'

interface Props {
  title: string
  subtitle: string
  confirmValue: string
  deleting?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'confirm'])

const inputValue = ref('')

const isConfirmed = computed(() => {
  return inputValue.value.toLowerCase() === props.confirmValue.toLowerCase()
})

const handleDelete = () => {
  if (isConfirmed.value) {
    emit('confirm', inputValue.value)
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

.warning-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.warning-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.warning-box p {
  font-size: 0.875rem;
  color: #991b1b;
  margin: 0;
  line-height: 1.5;
}

.confirm-input-section {
  margin-top: 1rem;
}

.confirm-input-section label {
  display: block;
  font-size: 0.875rem;
  color: #374151;
  margin-bottom: 0.5rem;
}

.confirm-input-section label strong {
  color: #111827;
  font-weight: 600;
}

.confirm-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s;
}

.confirm-input:focus {
  outline: none;
  border-color: #dc2626;
}

.confirm-input::placeholder {
  color: #9ca3af;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
  margin: 0.5rem 0 0 0;
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

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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
