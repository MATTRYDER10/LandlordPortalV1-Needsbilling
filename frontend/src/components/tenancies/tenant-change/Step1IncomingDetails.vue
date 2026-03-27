<script setup lang="ts">
import { ref, computed } from 'vue'
import { UserMinus, UserPlus, Plus, Trash2, ChevronRight } from 'lucide-vue-next'
import AddressAutocomplete from '@/components/AddressAutocomplete.vue'

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_lead_tenant: boolean
}

interface IncomingTenant {
  title?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dob?: string
  currentAddress?: {
    line1: string
    line2?: string
    city: string
    postcode: string
  }
  hasGuarantor?: boolean
  guarantor?: {
    title?: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    address?: {
      line1: string
      line2?: string
      city: string
      postcode: string
    }
  }
}

interface TenantChange {
  outgoing_tenant_ids: string[]
  incoming_tenants: IncomingTenant[]
  expected_move_out_date: string | null
  expected_move_in_date: string | null
}

const props = defineProps<{
  tenants: Tenant[]
  tenantChange: TenantChange | null
  loading: boolean
  rentDueDay?: number // Day of month rent is due (1-31)
}>()

// Calculate next rent due date
function getNextRentDueDate(dueDay: number): string {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  let targetMonth = currentMonth
  let targetYear = currentYear

  // If we've passed this month's due date, go to next month
  if (currentDay >= dueDay) {
    targetMonth++
    if (targetMonth > 11) {
      targetMonth = 0
      targetYear++
    }
  }

  // Handle months with fewer days (e.g., due day 31 in a 30-day month)
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const actualDay = Math.min(dueDay, daysInMonth)

  const date = new Date(targetYear, targetMonth, actualDay)
  return date.toISOString().split('T')[0]!
}

// Default date based on rent due day
const defaultDate = props.rentDueDay ? getNextRentDueDate(props.rentDueDay) : ''

const emit = defineEmits<{
  (e: 'create', data: { outgoingTenantIds: string[], incomingTenants: IncomingTenant[], expectedMoveOutDate?: string, expectedMoveInDate?: string }): void
  (e: 'update', data: Partial<TenantChange>): void
  (e: 'next'): void
}>()

// Selected outgoing tenants
const selectedOutgoing = ref<string[]>(props.tenantChange?.outgoing_tenant_ids || [])

// Incoming tenants
const incomingTenants = ref<IncomingTenant[]>(
  props.tenantChange?.incoming_tenants || [{
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    hasGuarantor: false
  }]
)

// Expected dates - default to next rent due date
const expectedMoveOutDate = ref(props.tenantChange?.expected_move_out_date || defaultDate)
const expectedMoveInDate = ref(props.tenantChange?.expected_move_in_date || defaultDate)

// Computed
const isValid = computed(() => {
  if (selectedOutgoing.value.length === 0) return false
  if (incomingTenants.value.length === 0) return false

  return incomingTenants.value.every(t =>
    t.firstName.trim() !== '' && t.lastName.trim() !== ''
  )
})

// Methods
function toggleOutgoing(tenantId: string) {
  const index = selectedOutgoing.value.indexOf(tenantId)
  if (index === -1) {
    selectedOutgoing.value.push(tenantId)
  } else {
    selectedOutgoing.value.splice(index, 1)
  }
}

function ensureGuarantor(tenant: any) {
  if (tenant.hasGuarantor && !tenant.guarantor) {
    tenant.guarantor = { firstName: '', lastName: '', email: '', phone: '' }
  }
}

function addIncomingTenant() {
  incomingTenants.value.push({
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    hasGuarantor: false
  })
}

function removeIncomingTenant(index: number) {
  if (incomingTenants.value.length > 1) {
    incomingTenants.value.splice(index, 1)
  }
}

function ensureAddress(tenant: IncomingTenant) {
  if (!tenant.currentAddress) {
    tenant.currentAddress = { line1: '', line2: '', city: '', postcode: '' }
  }
  return tenant.currentAddress
}

function handleIncomingAddressSelected(index: number, data: { addressLine1: string; addressLine2?: string; city: string; postcode: string; country?: string }) {
  const tenant = incomingTenants.value[index]
  if (tenant) {
    if (!tenant.currentAddress) {
      tenant.currentAddress = { line1: '', line2: '', city: '', postcode: '' }
    }
    tenant.currentAddress.line1 = data.addressLine1
    if (data.addressLine2) tenant.currentAddress.line2 = data.addressLine2
    tenant.currentAddress.city = data.city
    tenant.currentAddress.postcode = data.postcode
  }
}

function handleSubmit() {
  if (!isValid.value) return

  if (props.tenantChange) {
    // Update existing
    emit('update', {
      outgoing_tenant_ids: selectedOutgoing.value,
      incoming_tenants: incomingTenants.value,
      expected_move_out_date: expectedMoveOutDate.value || null,
      expected_move_in_date: expectedMoveInDate.value || null
    } as any)
    emit('next')
  } else {
    // Create new
    emit('create', {
      outgoingTenantIds: selectedOutgoing.value,
      incomingTenants: incomingTenants.value,
      expectedMoveOutDate: expectedMoveOutDate.value || undefined,
      expectedMoveInDate: expectedMoveInDate.value || undefined
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Outgoing Tenants -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <UserMinus class="w-5 h-5 text-red-500" />
        Select Outgoing Tenant(s)
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Choose which tenant(s) are leaving the tenancy.
      </p>

      <div class="space-y-2">
        <label
          v-for="tenant in tenants"
          :key="tenant.id"
          class="flex items-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          :class="{ 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/30': selectedOutgoing.includes(tenant.id) }"
        >
          <input
            type="checkbox"
            :checked="selectedOutgoing.includes(tenant.id)"
            @change="toggleOutgoing(tenant.id)"
            class="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
          >
          <div class="ml-3">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ tenant.first_name }} {{ tenant.last_name }}
              <span v-if="tenant.is_lead_tenant" class="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded">Lead</span>
            </p>
            <p class="text-sm text-gray-500 dark:text-slate-400">{{ tenant.email || 'No email' }}</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Incoming Tenants -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <UserPlus class="w-5 h-5 text-green-500" />
        Add Incoming Tenant(s)
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Enter details for the new tenant(s) joining the tenancy.
      </p>

      <div class="space-y-4">
        <div
          v-for="(tenant, index) in incomingTenants"
          :key="index"
          class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-4"
        >
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-gray-900 dark:text-white">Incoming Tenant {{ index + 1 }}</h4>
            <button
              v-if="incomingTenants.length > 1"
              @click="removeIncomingTenant(index)"
              class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
              <input
                v-model="tenant.firstName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
              <input
                v-model="tenant.lastName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                v-model="tenant.email"
                type="email"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                v-model="tenant.phone"
                type="tel"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
            </div>
          </div>

          <!-- Current Address -->
          <div class="space-y-3">
            <h5 class="font-medium text-gray-900 dark:text-white text-sm">Current Address</h5>
            <div class="relative overflow-visible">
              <AddressAutocomplete
                v-model="ensureAddress(tenant).line1"
                label="Address Line 1"
                :id="`incoming-address-${index}`"
                placeholder="Start typing address..."
                @addressSelected="(data: any) => handleIncomingAddressSelected(index, data)"
                :allowManualEntry="true"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 2</label>
              <input
                v-model="ensureAddress(tenant).line2"
                type="text"
                placeholder="Flat, apartment, etc."
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City</label>
                <input
                  v-model="ensureAddress(tenant).city"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode</label>
                <input
                  v-model="ensureAddress(tenant).postcode"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
            </div>
          </div>

          <!-- Guarantor Toggle -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="tenant.hasGuarantor"
              type="checkbox"
              class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              @change="ensureGuarantor(tenant)"
            >
            <span class="text-sm text-gray-700 dark:text-slate-300">This tenant has a guarantor</span>
          </label>

          <!-- Guarantor Details -->
          <div v-if="tenant.hasGuarantor && tenant.guarantor" class="pl-6 border-l-2 border-orange-200 dark:border-orange-800 space-y-4">
            <h5 class="font-medium text-gray-900 dark:text-white text-sm">Guarantor Details</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name</label>
                <input
                  v-model="tenant.guarantor.firstName"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name</label>
                <input
                  v-model="tenant.guarantor.lastName"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  v-model="tenant.guarantor.email"
                  type="email"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  v-model="tenant.guarantor.phone"
                  type="tel"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
              </div>
            </div>
          </div>
        </div>

        <button
          @click="addIncomingTenant"
          class="w-full py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-500 dark:text-slate-400 hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus class="w-4 h-4" />
          Add Another Tenant
        </button>
      </div>
    </div>

    <!-- Expected Dates -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Expected Move-Out Date</label>
        <input
          v-model="expectedMoveOutDate"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Expected Move-In Date</label>
        <input
          v-model="expectedMoveInDate"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
      </div>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-end">
      <button
        @click="handleSubmit"
        :disabled="!isValid || loading"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {{ tenantChange ? 'Save & Continue' : 'Start Tenant Change' }}
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
