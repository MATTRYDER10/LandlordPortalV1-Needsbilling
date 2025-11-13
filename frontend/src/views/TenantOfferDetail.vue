<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading offer...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="offer" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button @click="$router.push('/tenant-offers')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Tenant Offers
            </button>
            <h2 class="text-3xl font-bold text-gray-900">{{ offer.property_address }}</h2>
            <p class="mt-2 text-gray-600">Tenant Offer Details</p>
          </div>
          <span class="px-3 py-1 text-sm font-semibold rounded-full" :class="{
            'bg-yellow-100 text-yellow-800': offer.status === 'pending',
            'bg-blue-100 text-blue-800': offer.status === 'approved',
            'bg-red-100 text-red-800': offer.status === 'declined',
            'bg-purple-100 text-purple-800': offer.status === 'accepted_with_changes',
            'bg-green-100 text-green-800': offer.status === 'holding_deposit_received' || offer.status === 'reference_created'
          }">
            {{ formatStatus(offer.status) }}
          </span>
        </div>

        <!-- Action Buttons -->
        <div v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'" class="bg-white rounded-lg shadow p-6">
          <div class="flex gap-3">
            <button
              @click="showApproveModal = true"
              class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              Approve Offer
            </button>
            <button
              @click="showDeclineModal = true"
              class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              Decline Offer
            </button>
            <button
              @click="showEditModal = true"
              class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              Accept with Changes
            </button>
          </div>
        </div>

        <div v-if="offer.status === 'approved' && !offer.holding_deposit_received" class="bg-white rounded-lg shadow p-6">
          <button
            @click="markHoldingDepositReceived"
            :disabled="processing"
            class="w-full px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {{ processing ? 'Processing...' : 'Holding Deposit Received - Send References' }}
          </button>
        </div>

        <!-- Offer Details -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Offer Details</h3>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-gray-500">Property Address</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ offer.property_address }}</dd>
            </div>
            <div v-if="offer.property_city">
              <dt class="text-sm font-medium text-gray-500">City</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ offer.property_city }}</dd>
            </div>
            <div v-if="offer.property_postcode">
              <dt class="text-sm font-medium text-gray-500">Postcode</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ offer.property_postcode }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Offered Rent Amount</dt>
              <dd class="mt-1 text-sm text-gray-900">£{{ offer.offered_rent_amount }} per month</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Proposed Move-in Date</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ formatDate(offer.proposed_move_in_date) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Proposed Tenancy Length</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ offer.proposed_tenancy_length_months }} months</dd>
            </div>
            <div v-if="offer.deposit_amount">
              <dt class="text-sm font-medium text-gray-500">Deposit Amount</dt>
              <dd class="mt-1 text-sm text-gray-900">£{{ offer.deposit_amount }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Holding Deposit Amount</dt>
              <dd class="mt-1 text-sm text-gray-900">£{{ holdingDepositAmount.toFixed(2) }} (one week's rent)</dd>
            </div>
            <div v-if="offer.special_conditions" class="sm:col-span-2">
              <dt class="text-sm font-medium text-gray-500">Special Conditions</dt>
              <dd class="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{{ offer.special_conditions }}</dd>
            </div>
            <div v-if="offer.declined_reason" class="sm:col-span-2">
              <dt class="text-sm font-medium text-red-500">Decline Reason</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ offer.declined_reason }}</dd>
            </div>
          </dl>
        </div>

        <!-- Tenants -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Tenants</h3>
          <div class="space-y-4">
            <div v-for="(tenant, index) in offer.tenants" :key="index" class="border border-gray-200 rounded-lg p-4">
              <h4 class="text-lg font-medium text-gray-900 mb-3">Tenant {{ index + 1 }}</h4>
              <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-sm font-medium text-gray-500">Name</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ tenant.name }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">Email</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ tenant.email }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">Phone</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ tenant.phone }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">Address</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ tenant.address }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">Annual Income</dt>
                  <dd class="mt-1 text-sm text-gray-900">£{{ tenant.annual_income }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500">No CCJ/Bankruptcy/IVA</dt>
                  <dd class="mt-1 text-sm text-gray-900">
                    <span :class="tenant.no_ccj_bankruptcy_iva ? 'text-green-600' : 'text-red-600'">
                      {{ tenant.no_ccj_bankruptcy_iva ? 'Confirmed' : 'Not Confirmed' }}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Timestamps -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Timeline</h3>
          <dl class="space-y-2">
            <div>
              <dt class="text-sm font-medium text-gray-500">Submitted</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ formatDate(offer.created_at) }}</dd>
            </div>
            <div v-if="offer.approved_at">
              <dt class="text-sm font-medium text-gray-500">Approved</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ formatDate(offer.approved_at) }}</dd>
            </div>
            <div v-if="offer.declined_at">
              <dt class="text-sm font-medium text-gray-500">Declined</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ formatDate(offer.declined_at) }}</dd>
            </div>
            <div v-if="offer.holding_deposit_received_at">
              <dt class="text-sm font-medium text-gray-500">Holding Deposit Received</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ formatDate(offer.holding_deposit_received_at) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Terms & Conditions and Signatures -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Terms & Conditions Agreement</h3>
          
          <!-- Holding Deposit Agreement -->
          <div class="mb-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Holding Deposit Agreement</h4>
            <div class="space-y-4 text-sm text-gray-700">
              <div>
                <p class="font-semibold mb-2">Deposit Amount:</p>
                <p>A holding deposit equivalent to <strong>one week's rent</strong> is payable upon
                  acceptance of your application. This sum will be deducted from your initial tenancy
                  deposit at the start of the tenancy.</p>
              </div>
              <div>
                <p class="font-semibold mb-2">Privacy Policy Agreement:</p>
                <p>By paying the holding deposit, you agree to our Privacy Policy
                  (rgproperty.co.uk/privacypolicy).</p>
              </div>
              <div>
                <p class="font-semibold mb-2">Non-Refundable Clause:</p>
                <p>Please note: the holding deposit is <strong>non-refundable</strong> in the following
                  circumstances:</p>
                <ol class="list-decimal list-inside mt-2 space-y-1 ml-4">
                  <li>You provide false or misleading information during the application process,
                    resulting in a failed reference.</li>
                  <li>You withdraw from the tenancy application voluntarily.</li>
                  <li>You fail to provide satisfactory Right to Rent documentation as required by law.</li>
                  <li>You do not engage in reasonable communication with us and/or fail to take the
                    necessary steps to progress and enter into the tenancy.</li>
                </ol>
              </div>
              <div>
                <p class="font-semibold mb-2">Refund Clause:</p>
                <p>If the landlord or agent decides not to proceed with the tenancy for reasons other than
                  those listed above, the holding deposit will be refunded in full.</p>
              </div>
            </div>
          </div>

          <!-- Declaration -->
          <div class="mb-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Declaration</h4>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-gray-700">
                I agree that Propertygoose Ltd will use the information I provide on this application form
                and any information acquired from relevant sources to process my application for tenancy/to become a
                Guarantor for a tenancy. I understand that this application and the results of the findings will be
                forwarded to the instructing letting agent and/or landlord and that this information may be accessed
                again in the future should I default on my rental payments or payments due as a Guarantor, apply for a
                new tenancy or if there is a complaint or legal challenge with significance to this process.
              </p>
            </div>
          </div>

          <!-- Tenant Signatures -->
          <div class="space-y-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Tenant Signatures</h4>
            <div v-for="(tenant, index) in offer.tenants" :key="index" class="border border-gray-200 rounded-lg p-4">
              <h5 class="text-md font-medium text-gray-900 mb-3">Tenant {{ index + 1 }}: {{ tenant.name }}</h5>
              <dl class="space-y-3">
                <div v-if="tenant.signature_name">
                  <dt class="text-sm font-medium text-gray-500">Signature Name</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ tenant.signature_name }}</dd>
                </div>
                <div v-if="tenant.signature">
                  <dt class="text-sm font-medium text-gray-500 mb-2">Signature</dt>
                  <dd class="mt-1">
                    <img 
                      :src="tenant.signature" 
                      alt="Signature" 
                      class="border border-gray-300 rounded bg-white p-2 max-w-md"
                      style="max-height: 150px;"
                    />
                  </dd>
                </div>
                <div v-if="tenant.signed_at">
                  <dt class="text-sm font-medium text-gray-500">Signed At</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ formatDate(tenant.signed_at) }}</dd>
                </div>
                <div v-if="!tenant.signature && !tenant.signature_name" class="text-sm text-gray-500 italic">
                  No signature provided
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Approve Modal -->
      <div v-if="showApproveModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click.self="showApproveModal = false">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Approve Offer</h3>
          <p class="text-sm text-gray-600 mb-4">
            This will send an email to the tenant(s) with bank details and request for holding deposit payment.
          </p>
          <div class="flex gap-3">
            <button
              @click="approveOffer"
              :disabled="processing"
              class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {{ processing ? 'Processing...' : 'Confirm Approve' }}
            </button>
            <button
              @click="showApproveModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Decline Modal -->
      <div v-if="showDeclineModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click.self="showDeclineModal = false">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Decline Offer</h3>
          <div class="mb-4">
            <label for="decline-reason" class="block text-sm font-medium text-gray-700 mb-2">
              Reason for Decline *
            </label>
            <textarea
              id="decline-reason"
              v-model="declineReason"
              rows="4"
              required
              placeholder="Enter reason for declining this offer..."
              class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            ></textarea>
          </div>
          <div class="flex gap-3">
            <button
              @click="declineOffer"
              :disabled="processing || !declineReason"
              class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {{ processing ? 'Processing...' : 'Confirm Decline' }}
            </button>
            <button
              @click="showDeclineModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Modal (Accept with Changes) -->
      <div v-if="showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click.self="showEditModal = false">
        <div class="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Accept with Changes</h3>
          <p class="text-sm text-gray-600 mb-4">Edit the offer details before accepting.</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Property Address *</label>
              <input
                v-model="editForm.property_address"
                type="text"
                required
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  v-model="editForm.property_city"
                  type="text"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                <input
                  v-model="editForm.property_postcode"
                  type="text"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Offered Rent (£) *</label>
                <input
                  v-model.number="editForm.offered_rent_amount"
                  type="number"
                  step="0.01"
                  required
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Move-in Date *</label>
                <input
                  v-model="editForm.proposed_move_in_date"
                  type="date"
                  required
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Tenancy Length (months) *</label>
                <input
                  v-model.number="editForm.proposed_tenancy_length_months"
                  type="number"
                  min="1"
                  max="12"
                  required
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Deposit Amount (£)</label>
                <input
                  v-model.number="editForm.deposit_amount"
                  type="number"
                  step="0.01"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Special Conditions</label>
              <textarea
                v-model="editForm.special_conditions"
                rows="3"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              ></textarea>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              @click="acceptWithChanges"
              :disabled="processing"
              class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {{ processing ? 'Processing...' : 'Save Changes' }}
            </button>
            <button
              @click="showEditModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const offer = ref<any>(null)
const loading = ref(false)
const error = ref('')
const processing = ref(false)
const showApproveModal = ref(false)
const showDeclineModal = ref(false)
const showEditModal = ref(false)
const declineReason = ref('')

const editForm = ref({
  property_address: '',
  property_city: '',
  property_postcode: '',
  offered_rent_amount: null as number | null,
  proposed_move_in_date: '',
  proposed_tenancy_length_months: 12,
  deposit_amount: null as number | null,
  special_conditions: ''
})

const holdingDepositAmount = computed(() => {
  if (!offer.value?.offered_rent_amount) return 0
  return (offer.value.offered_rent_amount * 12) / 52
})

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
    accepted_with_changes: 'Accepted with Changes',
    holding_deposit_received: 'Holding Deposit Received',
    reference_created: 'Reference Created'
  }
  return statusMap[status] || status
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const fetchOffer = async () => {
  loading.value = true
  error.value = ''
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch(`${API_URL}/api/tenant-offers/${route.params.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch offer')
    }

    const data = await response.json()
    offer.value = data.offer

    // Initialize edit form
    editForm.value = {
      property_address: offer.value.property_address || '',
      property_city: offer.value.property_city || '',
      property_postcode: offer.value.property_postcode || '',
      offered_rent_amount: offer.value.offered_rent_amount || null,
      proposed_move_in_date: offer.value.proposed_move_in_date || '',
      proposed_tenancy_length_months: offer.value.proposed_tenancy_length_months || 12,
      deposit_amount: offer.value.deposit_amount || null,
      special_conditions: offer.value.special_conditions || ''
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load offer'
  } finally {
    loading.value = false
  }
}

const approveOffer = async () => {
  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/tenant-offers/${route.params.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve offer')
    }

    showApproveModal.value = false
    await fetchOffer()
  } catch (err: any) {
    error.value = err.message || 'Failed to approve offer'
  } finally {
    processing.value = false
  }
}

const declineOffer = async () => {
  if (!declineReason.value.trim()) return

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/tenant-offers/${route.params.id}/decline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: declineReason.value })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to decline offer')
    }

    showDeclineModal.value = false
    declineReason.value = ''
    await fetchOffer()
  } catch (err: any) {
    error.value = err.message || 'Failed to decline offer'
  } finally {
    processing.value = false
  }
}

const acceptWithChanges = async () => {
  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/tenant-offers/${route.params.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editForm.value)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update offer')
    }

    showEditModal.value = false
    await fetchOffer()
  } catch (err: any) {
    error.value = err.message || 'Failed to update offer'
  } finally {
    processing.value = false
  }
}

const markHoldingDepositReceived = async () => {
  if (!confirm('Mark holding deposit as received and create references? This will send reference forms to all tenants.')) {
    return
  }

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/tenant-offers/${route.params.id}/holding-deposit-received`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to mark holding deposit as received')
    }

    await fetchOffer()
    alert('Holding deposit marked as received. References have been created and sent to tenants.')
  } catch (err: any) {
    error.value = err.message || 'Failed to mark holding deposit as received'
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  fetchOffer()
})
</script>

