<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col border-2 border-[#00A3E0]/30">
        <!-- mydeposits Branded Header -->
        <div class="px-6 py-4 border-b border-[#00A3E0]/30 flex-shrink-0 bg-gradient-to-r from-[#00A3E0]/10 to-[#003366]/5 dark:from-[#00A3E0]/20 dark:to-[#003366]/10 rounded-t-lg z-10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#00A3E0]">
                <Shield class="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-[#003366] dark:text-white">Register with mydeposits</h3>
                <p class="text-xs text-gray-500 dark:text-slate-400">{{ schemeLabel }} Scheme</p>
              </div>
            </div>
            <button @click="handleClose" :disabled="isSubmitting" class="text-gray-400 hover:text-[#003366] dark:text-slate-400 dark:hover:text-[#00A3E0]">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="overflow-y-auto flex-1">
        <!-- Success State -->
        <div v-if="registrationComplete" class="p-6">
          <div class="text-center py-8">
            <div class="w-16 h-16 bg-[#00A3E0]/20 dark:bg-[#00A3E0]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle class="w-8 h-8 text-[#00A3E0]" />
            </div>
            <h4 class="text-xl font-semibold text-[#003366] dark:text-white mb-2">Deposit Protected</h4>
            <p class="text-gray-600 dark:text-slate-400 mb-4">
              The deposit has been registered with mydeposits {{ schemeLabel }}.
            </p>
            <div class="bg-[#00A3E0]/10 dark:bg-[#00A3E0]/20 border border-[#00A3E0]/30 rounded-lg p-4 inline-block">
              <p class="text-sm text-gray-500 dark:text-slate-400">Deposit ID</p>
              <p class="text-2xl font-mono font-bold text-[#003366] dark:text-[#00A3E0]">{{ registrationDepositId }}</p>
            </div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-4">
              mydeposits will contact the tenant by email with deposit protection details.
            </p>
          </div>
          <div class="flex justify-center gap-3 pt-4 border-t border-[#00A3E0]/30">
            <button
              @click="handleDownloadCertificate"
              :disabled="downloadingCertificate"
              class="px-4 py-2 text-sm font-medium text-[#003366] border border-[#00A3E0] hover:bg-[#00A3E0]/10 dark:text-[#00A3E0] dark:hover:bg-[#00A3E0]/20 rounded-lg flex items-center gap-2"
            >
              <Download class="w-4 h-4" />
              {{ downloadingCertificate ? 'Downloading...' : 'Download Certificate' }}
            </button>
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-white bg-[#003366] hover:bg-[#003366]/90 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>

        <!-- Form State -->
        <div v-else class="p-6">
          <!-- Property Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Property</h4>
              <button
                @click="editingSections.property = !editingSections.property"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.property ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.property" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="relative overflow-visible">
                <AddressAutocomplete
                  v-model="formData.property.addressLine1"
                  label="Address Line 1"
                  :required="true"
                  id="mydeposits-property-address"
                  placeholder="Start typing address..."
                  @addressSelected="handlePropertyAddressSelected"
                  :allowManualEntry="true"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">City/Town *</label>
                  <input v-model="formData.property.city" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">County</label>
                  <input v-model="formData.property.county" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Postcode *</label>
                <input v-model="formData.property.postcode" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm max-w-[150px]" />
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p class="text-sm text-gray-900 dark:text-white">{{ formData.property.addressLine1 }}</p>
              <p class="text-sm text-gray-600 dark:text-slate-400">{{ formData.property.city }}, {{ formData.property.county }} {{ formData.property.postcode }}</p>
            </div>
          </div>

          <!-- Tenancy Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Tenancy</h4>
              <button
                @click="editingSections.tenancy = !editingSections.tenancy"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.tenancy ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.tenancy" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Start Date *</label>
                  <input v-model="formData.tenancy.startDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">End Date (optional)</label>
                  <input v-model="formData.tenancy.endDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <div class="flex gap-6 text-sm">
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Start:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formatDisplayDate(formData.tenancy.startDate) }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">End:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formData.tenancy.endDate ? formatDisplayDate(formData.tenancy.endDate) : 'Periodic' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Deposit Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Deposit</h4>
              <button
                @click="editingSections.deposit = !editingSections.deposit"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.deposit ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.deposit" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Amount to Protect *</label>
                  <div class="flex items-center">
                    <span class="text-gray-500 dark:text-slate-400 mr-1">&pound;</span>
                    <input v-model="formData.deposit.amount" type="number" step="0.01" min="0" required class="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Date Received *</label>
                  <input v-model="formData.deposit.receivedDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <div class="flex gap-6 text-sm">
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Amount:</span>
                  <span class="ml-1 text-gray-900 dark:text-white font-medium">&pound;{{ Number(formData.deposit.amount).toLocaleString() }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Received:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formatDisplayDate(formData.deposit.receivedDate) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Landlord Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Landlord</h4>
              <button
                @click="editingSections.landlord = !editingSections.landlord"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.landlord ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.landlord" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Title</label>
                  <select v-model="formData.landlord.title" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                    <option value="">Select...</option>
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                  <input v-model="formData.landlord.firstName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                  <input v-model="formData.landlord.lastName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email *</label>
                <input v-model="formData.landlord.email" type="email" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Address</label>
                <input v-model="formData.landlord.address" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" placeholder="Full address" />
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p class="text-sm text-gray-900 dark:text-white">{{ formData.landlord.title }} {{ formData.landlord.firstName }} {{ formData.landlord.lastName }}</p>
              <p class="text-sm text-gray-600 dark:text-slate-400">{{ formData.landlord.email }}</p>
              <p v-if="formData.landlord.address" class="text-sm text-gray-500 dark:text-slate-500">{{ formData.landlord.address }}</p>
            </div>
          </div>

          <!-- Tenants Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Tenants ({{ formData.tenants.length }})
              </h4>
              <button
                @click="editingSections.tenants = !editingSections.tenants"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.tenants ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.tenants" class="space-y-4">
              <div
                v-for="(tenant, index) in formData.tenants"
                :key="index"
                class="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg"
              >
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Tenant {{ index + 1 }}
                    <span v-if="tenant.isLead" class="ml-1 px-1.5 py-0.5 bg-[#00A3E0]/20 text-[#003366] dark:text-[#00A3E0] rounded text-[10px]">Lead</span>
                  </span>
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" v-model="tenant.isLead" @change="setLeadTenant(index)" class="rounded" />
                    Lead Tenant
                  </label>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Title</label>
                    <select v-model="tenant.title" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                      <option value="">Select...</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Miss">Miss</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                    <input v-model="tenant.firstName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                    <input v-model="tenant.lastName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email *</label>
                    <input v-model="tenant.email" type="email" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
                    <input v-model="tenant.phone" type="tel" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(tenant, index) in formData.tenants"
                :key="index"
                class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p class="text-sm text-gray-900 dark:text-white">
                    {{ tenant.title }} {{ tenant.firstName }} {{ tenant.lastName }}
                    <span v-if="tenant.isLead" class="ml-1 px-1.5 py-0.5 bg-[#00A3E0]/20 text-[#003366] dark:text-[#00A3E0] rounded text-[10px]">Lead</span>
                  </p>
                  <p class="text-xs text-gray-500 dark:text-slate-400">{{ tenant.email }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              @click="handleClose"
              :disabled="isSubmitting"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              @click="handleSubmit"
              :disabled="isSubmitting || !isFormValid"
              class="px-4 py-2 text-sm font-medium text-white bg-[#003366] hover:bg-[#003366]/90 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <Shield v-else class="w-4 h-4" />
              {{ isSubmitting ? 'Registering...' : 'Register Deposit' }}
            </button>
          </div>
        </div>
        </div><!-- end scrollable content -->
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, CheckCircle, Download, Shield, Loader2 } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'
import { API_URL } from '@/lib/apiUrl'
import AddressAutocomplete from '@/components/AddressAutocomplete.vue'

const props = defineProps<{
  show: boolean
  tenancy: any
  schemeType: 'custodial'
  landlords?: any[]
  property?: any
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  registered: [depositId: string]
}>()

const toast = useToast()
const authStore = useAuthStore()

// State
const isSubmitting = ref(false)
const registrationComplete = ref(false)
const registrationDepositId = ref('')
const downloadingCertificate = ref(false)
const errorMessage = ref('')

const editingSections = ref({
  property: false,
  tenancy: false,
  deposit: false,
  landlord: false,
  tenants: false
})

// Form data
const formData = ref({
  property: {
    addressLine1: '',
    city: '',
    county: '',
    postcode: ''
  },
  tenancy: {
    startDate: '',
    endDate: ''
  },
  deposit: {
    amount: 0,
    receivedDate: ''
  },
  landlord: {
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    address: ''
  },
  tenants: [] as Array<{
    title: string
    firstName: string
    lastName: string
    email: string
    phone: string
    isLead: boolean
  }>
})

// Computed
const schemeLabel = computed(() => 'Custodial')

const isFormValid = computed(() => {
  const { property, tenancy, deposit, landlord, tenants } = formData.value

  // Property validation
  if (!property.addressLine1 || !property.city || !property.postcode) return false

  // Tenancy validation
  if (!tenancy.startDate) return false

  // Deposit validation
  if (!deposit.amount || deposit.amount <= 0 || !deposit.receivedDate) return false

  // Landlord validation
  if (!landlord.firstName || !landlord.lastName || !landlord.email) return false

  // Tenants validation - at least one with name and email
  if (tenants.length === 0) return false
  const hasValidTenant = tenants.some(t => t.firstName && t.lastName && t.email)
  if (!hasValidTenant) return false

  return true
})

// Watch for tenancy changes to populate form
watch(() => props.tenancy, (newTenancy) => {
  if (newTenancy) {
    populateFormData(newTenancy)
  }
}, { immediate: true })

watch(() => props.show, (newShow) => {
  if (newShow && props.tenancy) {
    // Reset state when modal opens
    registrationComplete.value = false
    registrationDepositId.value = ''
    errorMessage.value = ''
    populateFormData(props.tenancy)
  }
})

function populateFormData(tenancy: any) {
  // Property — prefer decrypted prop, fall back to tenancy data
  const prop = props.property || tenancy.property || tenancy.properties || {}
  // Handle various property data shapes:
  // - Flat: { address_line1, city, county, postcode }
  // - Nested: { address: { line1, city, postcode, formatted } }
  const addr = (prop.address && typeof prop.address === 'object') ? prop.address : {}
  formData.value.property = {
    addressLine1: prop.address_line1 || addr.line1 || '',
    city: prop.city || addr.city || addr.town || '',
    county: prop.county || addr.county || '',
    postcode: prop.postcode || addr.postcode || ''
  }
  console.log('[MyDepositsModal] Property populated:', formData.value.property, 'from prop:', JSON.stringify(prop).substring(0, 200))

  // Tenancy dates
  formData.value.tenancy = {
    startDate: tenancy.tenancy_start_date || tenancy.start_date || '',
    endDate: tenancy.tenancy_end_date || tenancy.end_date || ''
  }

  // Deposit
  formData.value.deposit = {
    amount: tenancy.deposit_amount || 0,
    receivedDate: tenancy.deposit_received_at ? tenancy.deposit_received_at.split('T')[0] : new Date().toISOString().split('T')[0]
  }

  // Landlord — prefer decrypted props.landlords, fall back to tenancy data
  const landlordsList = props.landlords || []
  const primaryLandlord = landlordsList.find((l: any) => l.is_primary_contact) || landlordsList[0] || tenancy.landlord || {}
  // Landlord name may be a full "name" field or split into first/last
  let llFirstName = primaryLandlord.first_name || primaryLandlord.firstName || ''
  let llLastName = primaryLandlord.last_name || primaryLandlord.lastName || ''
  if (!llFirstName && !llLastName && primaryLandlord.name) {
    const parts = primaryLandlord.name.trim().split(' ')
    llFirstName = parts[0] || ''
    llLastName = parts.slice(1).join(' ') || ''
  }

  // Build landlord address from separate fields
  const llAddress = [
    primaryLandlord.address_line1 || primaryLandlord.addressLine1 || '',
    primaryLandlord.city || '',
    primaryLandlord.postcode || ''
  ].filter(Boolean).join(', ') || primaryLandlord.address || ''

  formData.value.landlord = {
    title: primaryLandlord.title || '',
    firstName: llFirstName,
    lastName: llLastName,
    email: primaryLandlord.email || '',
    address: llAddress
  }

  // Tenants
  const tenants = tenancy.tenants || []
  formData.value.tenants = tenants.map((t: any, index: number) => {
    // Tenant name may be full "first_name"/"last_name" or combined
    let firstName = t.first_name || t.firstName || ''
    let lastName = t.last_name || t.lastName || ''
    // If no split name, try parsing from a full name field
    if (!firstName && !lastName && t.name) {
      const parts = t.name.trim().split(' ')
      firstName = parts[0] || ''
      lastName = parts.slice(1).join(' ') || ''
    }

    return {
      title: t.title || '',
      firstName,
      lastName,
      email: t.email || '',
      phone: t.phone || '',
      isLead: t.is_lead_tenant || t.is_lead || t.isLead || index === 0
    }
  })

  // Ensure at least one tenant is marked as lead
  if (formData.value.tenants.length > 0 && !formData.value.tenants.some(t => t.isLead)) {
    formData.value.tenants[0].isLead = true
  }
}

function handlePropertyAddressSelected(data: { addressLine1: string; addressLine2?: string; city: string; postcode: string; country?: string }) {
  formData.value.property.addressLine1 = data.addressLine1
  formData.value.property.city = data.city
  formData.value.property.postcode = data.postcode
}

function setLeadTenant(index: number) {
  // Only one tenant can be lead
  formData.value.tenants.forEach((t, i) => {
    t.isLead = i === index
  })
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

async function handleSubmit() {
  if (!isFormValid.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/mydeposits/register/${props.tenancy.id}`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositReceivedDate: formData.value.deposit.receivedDate,
        property: formData.value.property,
        tenancy: formData.value.tenancy,
        deposit: {
          amount: formData.value.deposit.amount,
          amountToProtect: formData.value.deposit.amount
        },
        landlord: formData.value.landlord,
        tenants: formData.value.tenants
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to register deposit')
    }

    if (data.success && data.depositId) {
      registrationDepositId.value = data.depositId
      registrationComplete.value = true
      emit('registered', data.depositId)
      toast.success('Deposit registered with mydeposits successfully')
    } else if (data.status === 'pending') {
      toast.info('Deposit registration is being processed')
      handleClose()
    } else {
      throw new Error(data.error || 'Unexpected response from server')
    }
  } catch (error: any) {
    console.error('Error registering with mydeposits:', error)
    errorMessage.value = error.message || 'Failed to register deposit'
    toast.error(error.message || 'Failed to register deposit')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDownloadCertificate() {
  if (!registrationDepositId.value) return

  downloadingCertificate.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/mydeposits/certificate/${props.tenancy.id}`, {
      token
    })

    if (!response.ok) {
      throw new Error('Failed to download certificate')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mydeposits-certificate-${registrationDepositId.value}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast.success('Certificate downloaded')
  } catch (error: any) {
    console.error('Error downloading certificate:', error)
    toast.error(error.message || 'Failed to download certificate')
  } finally {
    downloadingCertificate.value = false
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>
