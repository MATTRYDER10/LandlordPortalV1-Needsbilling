<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2" :style="{ borderColor: primaryColor }"></div>
    </div>

    <!-- Invalid Link -->
    <div v-else-if="invalidLink" class="flex items-center justify-center min-h-screen p-4">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
        <p class="text-gray-500">This offer link is no longer valid. Please contact your agent for a new link.</p>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="submitted" class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white rounded-2xl shadow-lg max-w-lg w-full p-8 text-center">
        <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Offer Submitted</h1>
        <p class="text-gray-600 mb-4">Thank you — your offer has been submitted to <strong>{{ companyName }}</strong>. They will review it and be in touch shortly.</p>
        <p v-if="!propertyMatched" class="text-sm text-amber-600">Your property address will be verified by the agent before your offer can be processed.</p>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="max-w-2xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <img v-if="companyLogo" :src="companyLogo" :alt="companyName" class="h-12 mx-auto mb-4" />
        <h1 class="text-2xl font-bold text-gray-900">Make an Offer</h1>
        <p class="text-gray-500 mt-1">Submit your rental offer to {{ companyName }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <!-- Property Details -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-3" :style="{ color: primaryColor }">Property</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Property Address *</label>
              <input v-model="form.property_address" type="text" required placeholder="e.g. Flat 1, 15 Church Road" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" :style="{ '--tw-ring-color': primaryColor }" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input v-model="form.property_postcode" type="text" required placeholder="BS1 1AA" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none uppercase" />
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input v-model="form.property_city" type="text" placeholder="e.g. Bristol" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
          </div>
        </div>

        <!-- Offer Terms -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-3" :style="{ color: primaryColor }">Offer Terms</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Rent (£) *</label>
              <input v-model.number="form.offered_rent_amount" type="number" min="1" required placeholder="1200" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Move-in Date</label>
              <input v-model="form.proposed_move_in_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Length (months)</label>
              <select v-model.number="form.proposed_tenancy_length_months" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none">
                <option :value="1">1 month (rolling)</option>
                <option :value="6">6 months</option>
                <option :value="12">12 months</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Your Details -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-3" :style="{ color: primaryColor }">Your Details</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input v-model="form.tenant_first_name" type="text" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input v-model="form.tenant_last_name" type="text" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input v-model="form.tenant_email" type="email" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input v-model="form.tenant_phone" type="tel" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none" />
            </div>
          </div>
        </div>

        <!-- Additional Tenants -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-900" :style="{ color: primaryColor }">Additional Tenants</h2>
            <button type="button" @click="addTenant" class="text-sm font-medium px-3 py-1 rounded-lg transition-colors" :style="{ color: primaryColor, backgroundColor: primaryColor + '10' }">+ Add Tenant</button>
          </div>
          <div v-for="(tenant, idx) in additionalTenants" :key="idx" class="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-2">
            <input v-model="tenant.first_name" placeholder="First name" class="col-span-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <input v-model="tenant.last_name" placeholder="Last name" class="col-span-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <input v-model="tenant.email" placeholder="Email" type="email" class="col-span-2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <button type="button" @click="additionalTenants.splice(idx, 1)" class="text-red-500 hover:text-red-700 text-sm">Remove</button>
          </div>
          <p v-if="additionalTenants.length === 0" class="text-sm text-gray-400">No additional tenants — you can add them later.</p>
        </div>

        <!-- Special Conditions -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Special Conditions</label>
          <textarea v-model="form.special_conditions" rows="3" placeholder="Any special conditions or requests..." class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"></textarea>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>

        <!-- Submit -->
        <button type="submit" :disabled="submitting" class="w-full py-3 text-white font-semibold rounded-lg transition-colors disabled:opacity-50" :style="{ backgroundColor: buttonColor }">
          {{ submitting ? 'Submitting...' : 'Submit Offer' }}
        </button>

        <p class="text-xs text-gray-400 text-center">By submitting, you agree that your details will be shared with {{ companyName }} for the purpose of processing your rental application.</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const token = route.params.token as string

const loading = ref(true)
const invalidLink = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const error = ref('')
const propertyMatched = ref(false)

const companyName = ref('Agency')
const companyLogo = ref('')
const primaryColor = ref('#f97316')
const buttonColor = ref('#f97316')

const form = ref({
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  tenant_phone: '',
  property_address: '',
  property_postcode: '',
  property_city: '',
  offered_rent_amount: null as number | null,
  proposed_move_in_date: '',
  proposed_tenancy_length_months: 12,
  special_conditions: '',
})

const additionalTenants = ref<Array<{ first_name: string; last_name: string; email: string; phone: string }>>([])

function addTenant() {
  additionalTenants.value.push({ first_name: '', last_name: '', email: '', phone: '' })
}

onMounted(async () => {
  try {
    const resp = await fetch(`${API_URL}/api/public/offer/${token}`)
    if (!resp.ok) {
      invalidLink.value = true
      return
    }
    const data = await resp.json()
    companyName.value = data.company_name || 'Agency'
    companyLogo.value = data.company_logo || ''
    primaryColor.value = data.primary_color || '#f97316'
    buttonColor.value = data.button_color || '#f97316'
  } catch {
    invalidLink.value = true
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const resp = await fetch(`${API_URL}/api/public/offer/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        tenants: additionalTenants.value.filter(t => t.first_name || t.last_name),
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      error.value = data.error || 'Failed to submit offer'
      return
    }
    propertyMatched.value = data.property_matched
    submitted.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to submit offer'
  } finally {
    submitting.value = false
  }
}
</script>
