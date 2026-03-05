<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-icon">
          <FileText />
        </div>
        <h2>Offer Details</h2>
        <button class="close-button" @click="$emit('close')">
          <X />
        </button>
      </div>

      <div class="modal-body">
        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading offer details...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="error-state">
          <AlertCircle class="error-icon" />
          <p>{{ error }}</p>
        </div>

        <!-- Offer details -->
        <div v-else-if="offer" class="offer-details">
          <!-- Property section -->
          <div class="detail-section">
            <h3><MapPin class="section-icon" /> Property</h3>
            <p class="address-text">
              {{ offer.property_address }}<br />
              {{ offer.property_city }}, {{ offer.property_postcode }}
            </p>
          </div>

          <!-- Tenancy Terms section -->
          <div class="detail-section">
            <h3><Calendar class="section-icon" /> Tenancy Terms</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Rent</span>
                <span class="detail-value">{{ formatCurrency(offer.offered_rent_amount) }}/month</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Move-in Date</span>
                <span class="detail-value">{{ formatDate(offer.proposed_move_in_date) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Tenancy Length</span>
                <span class="detail-value">{{ offer.proposed_tenancy_length_months }} months</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Deposit</span>
                <span class="detail-value">{{ formatCurrency(offer.deposit_amount) }}</span>
              </div>
            </div>
          </div>

          <!-- Holding Deposit section -->
          <div v-if="offer.holding_deposit_received" class="detail-section">
            <h3><Wallet class="section-icon" /> Holding Deposit</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Amount Paid</span>
                <span class="detail-value">{{ formatCurrency(offer.holding_deposit_amount_paid) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Received</span>
                <span class="detail-value">{{ formatDate(offer.holding_deposit_received_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Tenants section -->
          <div v-if="offer.tenants && offer.tenants.length > 0" class="detail-section">
            <h3><Users class="section-icon" /> Tenants</h3>
            <div class="tenants-list">
              <div v-for="(tenant, index) in offer.tenants" :key="tenant.id" class="tenant-card">
                <div class="tenant-number">{{ index + 1 }}</div>
                <div class="tenant-info">
                  <p class="tenant-name">{{ tenant.name }}</p>
                  <p class="tenant-contact">{{ tenant.email }}</p>
                  <p v-if="tenant.phone" class="tenant-contact">{{ tenant.phone }}</p>
                  <p v-if="tenant.job_title || tenant.annual_income" class="tenant-job">
                    {{ tenant.job_title }}<span v-if="tenant.job_title && tenant.annual_income"> - </span>{{ tenant.annual_income ? formatCurrency(tenant.annual_income) + '/year' : '' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Special Conditions section -->
          <div v-if="offer.special_conditions" class="detail-section">
            <h3><FileText class="section-icon" /> Special Conditions</h3>
            <p class="conditions-text">{{ offer.special_conditions }}</p>
          </div>

          <!-- Status badge -->
          <div class="status-section">
            <span class="status-badge" :class="getStatusClass(offer.status)">
              {{ formatStatus(offer.status) }}
            </span>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="btn-secondary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FileText, X, AlertCircle, MapPin, Calendar, Wallet, Users } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

interface Tenant {
  id: string
  tenant_order: number
  name: string
  address: string
  phone: string
  email: string
  annual_income: string
  job_title: string
  no_ccj_bankruptcy_iva: boolean
  signature: string
  signature_name: string
  signed_at: string
}

interface Offer {
  id: string
  property_address: string
  property_city: string
  property_postcode: string
  offered_rent_amount: number
  proposed_move_in_date: string
  proposed_tenancy_length_months: number
  deposit_amount: number
  special_conditions: string
  status: string
  holding_deposit_received: boolean
  holding_deposit_amount_paid: number
  holding_deposit_received_at: string
  tenants: Tenant[]
}

interface Props {
  show: boolean
  referenceId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const authStore = useAuthStore()
const API_BASE = import.meta.env.VITE_API_URL
const loading = ref(false)
const error = ref<string | null>(null)
const offer = ref<Offer | null>(null)

// Fetch offer data when modal opens
watch(() => [props.show, props.referenceId], async ([isOpen, refId]) => {
  if (isOpen && refId) {
    await loadOffer(refId as string)
  } else {
    offer.value = null
    error.value = null
  }
}, { immediate: true })

async function loadOffer(referenceId: string) {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(`${API_BASE}/api/tenant-offers/by-reference/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to load offer')
    }

    const data = await response.json()
    offer.value = data.offer
  } catch (err: any) {
    error.value = err.message || 'Failed to load offer details'
  } finally {
    loading.value = false
  }
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '-'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function formatStatus(status: string): string {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'approved':
    case 'accepted':
      return 'status-success'
    case 'declined':
    case 'rejected':
      return 'status-error'
    case 'pending':
      return 'status-pending'
    case 'accepted_with_changes':
      return 'status-warning'
    default:
      return 'status-default'
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
  max-width: 560px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  text-align: center;
  padding: 2rem 2rem 1rem;
  position: relative;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  color: #6b7280;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #111827;
}

.header-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon svg {
  width: 28px;
  height: 28px;
  color: #2563eb;
}

.modal-header h2 {
  font-size: 1.375rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.modal-body {
  padding: 0 2rem 1.5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p,
.error-state p {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
}

.error-state {
  color: #dc2626;
}

.error-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  color: #dc2626;
}

.error-state p {
  color: #dc2626;
}

.offer-details {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-section {
  background: #f9fafb;
  border-radius: 12px;
  padding: 1rem;
}

.detail-section h3 {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.section-icon {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

.address-text {
  font-size: 0.9375rem;
  color: #111827;
  margin: 0;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.detail-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #111827;
}

.tenants-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tenant-card {
  display: flex;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.tenant-number {
  width: 24px;
  height: 24px;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.tenant-info {
  flex: 1;
  min-width: 0;
}

.tenant-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.25rem 0;
}

.tenant-contact {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0;
}

.tenant-job {
  font-size: 0.8125rem;
  color: #374151;
  margin: 0.25rem 0 0 0;
}

.conditions-text {
  font-size: 0.9375rem;
  color: #111827;
  margin: 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

.status-section {
  text-align: center;
  padding-top: 0.5rem;
}

.status-badge {
  display: inline-block;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-success {
  background: #dcfce7;
  color: #166534;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-warning {
  background: #ffedd5;
  color: #9a3412;
}

.status-default {
  background: #f3f4f6;
  color: #374151;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding: 0 2rem 2rem;
}

.btn-secondary {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
