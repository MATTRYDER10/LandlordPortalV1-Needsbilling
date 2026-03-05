<template>
  <div v-if="isOpen" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-hidden z-50">
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Edit Agreement</h2>
          <p v-if="agreement" class="text-sm text-gray-500 mt-1">
            {{ formatPropertyAddress(agreement.property_address) }}
          </p>
        </div>
        <button @click="handleClose" class="text-gray-400 hover:text-gray-500">
          <X class="h-6 w-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto bg-gray-50">
        <div class="max-w-4xl mx-auto py-6 px-4 sm:px-6">
          <!-- Template & Language Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Template Settings</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  v-model="formData.language"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option value="english">English (AST)</option>
                  <option value="welsh">Welsh (Occupation Contract)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Scheme</label>
                <select
                  v-model="formData.templateType"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option value="dps">DPS</option>
                  <option value="mydeposits">Mydeposits</option>
                  <option value="tds">TDS</option>
                  <option value="reposit">Reposit</option>
                  <option value="no_deposit">No Deposit</option>
                </select>
              </div>
            </div>
          </section>

          <!-- Property Address Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Property Address</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                <input
                  v-model="formData.propertyAddress.line1"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  v-model="formData.propertyAddress.line2"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  v-model="formData.propertyAddress.city"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input
                  v-model="formData.propertyAddress.county"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                <input
                  v-model="formData.propertyAddress.postcode"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </section>

          <!-- Agreement Details Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Agreement Details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Rent (£) *</label>
                <input
                  v-model.number="formData.rentAmount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (£)</label>
                <input
                  v-model.number="formData.depositAmount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Start Date *</label>
                <input
                  v-model="formData.tenancyStartDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Term (months) *</label>
                <select
                  v-model="formData.tenancyTerm"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option :value="0">Rolling (Periodic)</option>
                  <option :value="6">6 months</option>
                  <option :value="12">12 months</option>
                  <option :value="24">24 months</option>
                  <option :value="36">36 months</option>
                </select>
              </div>
              <div v-if="Number(formData.tenancyTerm) !== 0" class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy End Date</label>
                <input
                  v-model="formData.tenancyEndDate"
                  type="date"
                  :min="formData.tenancyStartDate"
                  :disabled="!formData.tenancyStartDate"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary disabled:bg-gray-100"
                />
                <p v-if="isEndDateOverridden" class="text-xs text-amber-600 mt-1">
                  Custom end date (calculated: {{ displayCalculatedEndDate }})
                </p>
                <p v-else class="text-xs text-gray-500 mt-1">
                  Auto-calculated from start date + term. Edit for non-standard terms.
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Rent Due Day</label>
                <select
                  v-model="formData.rentDueDay"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option v-for="day in rentDueDays" :key="day" :value="day">{{ day }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Management Type</label>
                <select
                  v-model="formData.managementType"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option value="managed">Fully Managed</option>
                  <option value="let_only">Let Only</option>
                </select>
              </div>
            </div>

            <div v-if="formData.managementType === 'managed'" class="flex items-start space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-md mt-4">
              <input
                id="agentSignsOnBehalf"
                v-model="formData.agentSignsOnBehalf"
                type="checkbox"
                class="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <div class="flex-1">
                <label for="agentSignsOnBehalf" class="text-sm font-medium text-gray-900 cursor-pointer">
                  Agent to Sign on Landlord Behalf
                </label>
                <p class="text-xs text-gray-600 mt-1">
                  When checked, only the agent signs the agreement (no landlord signature required).
                  When unchecked, the landlord will sign and receive the agreement copy.
                  Agent always receives a copy for managed properties.
                </p>
              </div>
            </div>
          </section>

          <!-- Landlords Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">Landlords</h3>
              <button
                @click="addLandlord"
                type="button"
                class="text-sm text-primary hover:text-primary-dark"
              >
                + Add Landlord
              </button>
            </div>
            <div v-for="(landlord, index) in formData.landlords" :key="index" class="mb-4 p-4 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center mb-3">
                <span class="font-medium text-gray-700">Landlord {{ index + 1 }}</span>
                <button
                  v-if="formData.landlords.length > 1"
                  @click="removeLandlord(index)"
                  type="button"
                  class="text-red-500 hover:text-red-700"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    v-model="landlord.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    v-model="landlord.address.line1"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="landlord.address.city"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="landlord.address.postcode"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          <!-- Tenants Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">Tenants</h3>
              <button
                @click="addTenant"
                type="button"
                class="text-sm text-primary hover:text-primary-dark"
              >
                + Add Tenant
              </button>
            </div>
            <div v-for="(tenant, index) in formData.tenants" :key="index" class="mb-4 p-4 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center mb-3">
                <span class="font-medium text-gray-700">Tenant {{ index + 1 }}</span>
                <button
                  v-if="formData.tenants.length > 1"
                  @click="removeTenant(index)"
                  type="button"
                  class="text-red-500 hover:text-red-700"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    v-model="tenant.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    v-model="tenant.address.line1"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="tenant.address.city"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="tenant.address.postcode"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          <!-- Rent Shares Section (Multi-tenant only) -->
          <section v-if="formData.tenants.length > 1" class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">Rent Shares</h3>
              <button
                @click="splitRentEvenly"
                type="button"
                class="text-sm text-primary hover:text-primary-dark"
              >
                Split Evenly
              </button>
            </div>
            <p class="text-sm text-gray-500 mb-4">
              Specify how the monthly rent of £{{ formatNumber(formData.rentAmount || 0) }} is split between tenants.
            </p>

            <div class="space-y-3">
              <div v-for="(tenant, index) in formData.tenants" :key="index" class="flex items-center gap-3">
                <span class="flex-1 text-sm font-medium text-gray-700 dark:text-slate-200">{{ tenant.name || `Tenant ${index + 1}` }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500">£</span>
                  <input
                    v-model.number="tenant.rentShare"
                    type="number"
                    step="0.01"
                    min="0"
                    :max="formData.rentAmount"
                    placeholder="0.00"
                    class="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    @input="validateRentShares"
                  />
                  <span class="text-sm text-gray-500 w-12 text-right">{{ getRentSharePercentage(tenant.rentShare) }}%</span>
                </div>
              </div>
            </div>

            <!-- Validation Message -->
            <div class="mt-3 p-2 rounded" :class="rentSharesValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'">
              <p class="text-sm">
                Total: £{{ formatNumber(totalRentShares) }} / £{{ formatNumber(formData.rentAmount || 0) }}
                <span v-if="!rentSharesValid" class="font-medium">
                  ({{ rentShareDifference > 0 ? '+' : '' }}£{{ formatNumber(rentShareDifference) }})
                </span>
              </p>
            </div>
          </section>

          <!-- Guarantors Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">Guarantors (Optional)</h3>
              <button
                @click="addGuarantor"
                type="button"
                class="text-sm text-primary hover:text-primary-dark"
              >
                + Add Guarantor
              </button>
            </div>
            <div v-if="formData.guarantors.length === 0" class="text-sm text-gray-500 italic">
              No guarantors added
            </div>
            <div v-for="(guarantor, index) in formData.guarantors" :key="index" class="mb-4 p-4 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center mb-3">
                <span class="font-medium text-gray-700">Guarantor {{ index + 1 }}</span>
                <button
                  @click="removeGuarantor(index)"
                  type="button"
                  class="text-red-500 hover:text-red-700"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    v-model="guarantor.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    v-model="guarantor.email"
                    type="email"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    v-model="guarantor.address.line1"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="guarantor.address.city"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="guarantor.address.postcode"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          <!-- Email Recipients Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Email Recipients</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenant Email</label>
                <input
                  v-model="formData.tenantEmail"
                  type="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Landlord Email</label>
                <input
                  v-model="formData.landlordEmail"
                  type="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Agent Email (optional)</label>
                <input
                  v-model="formData.agentEmail"
                  type="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </section>

          <!-- Special Clauses Section -->
          <section class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Additional Clauses</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Permitted Occupiers</label>
              <input
                v-model="formData.permittedOccupiers"
                type="text"
                placeholder="e.g., John Smith (child)"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary mb-4"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Special Clauses</label>
              <textarea
                v-model="formData.specialClauses"
                rows="4"
                placeholder="Enter any additional clauses..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              ></textarea>
            </div>
          </section>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-white border-t px-6 py-4 flex justify-between items-center">
        <p v-if="isSentAgreement" class="text-sm text-amber-600">
          <AlertTriangle class="w-4 h-4 inline mr-1" />
          This will create a new draft and cancel the current signing process
        </p>
        <div class="flex gap-3 ml-auto">
          <button
            @click="handleClose"
            class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="saving"
            class="px-4 py-2 text-white font-medium bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : (isSentAgreement ? 'Save as New Draft' : 'Save Changes') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Trash2, AlertTriangle } from 'lucide-vue-next'
import {
  type AgreementFormData,
  type DatabaseAgreement,
  agreementToFormData,
  formDataToAgreementRequest,
  getDefaultFormData
} from '../utils/agreementDataMapper'

const props = defineProps<{
  isOpen: boolean
  agreement: DatabaseAgreement | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: { formData: any; isDraft: boolean; agreementId: string }): void
}>()

const formData = ref<AgreementFormData>(getDefaultFormData())
const saving = ref(false)

const isSentAgreement = computed(() => {
  return props.agreement?.signing_status &&
    ['pending_signatures', 'partially_signed'].includes(props.agreement.signing_status)
})

const rentDueDays = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
  '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st',
  'Last'
]

// Track whether user has manually edited the end date
const endDateManuallyEdited = ref(false)

// Calculate end date from start date + term
const calculatedEndDate = computed(() => {
  if (!formData.value.tenancyStartDate) {
    return null
  }

  const months = Number(formData.value.tenancyTerm)

  // 0 months means rolling tenancy
  if (isNaN(months) || months === 0) {
    return null
  }

  const startDate = new Date(formData.value.tenancyStartDate)
  startDate.setMonth(startDate.getMonth() + months)
  // Subtract 1 day (UK tenancy convention)
  startDate.setDate(startDate.getDate() - 1)
  return startDate.toISOString().split('T')[0]
})

// Display-friendly calculated end date
const displayCalculatedEndDate = computed(() => {
  if (!calculatedEndDate.value) {
    return 'Rolling'
  }
  const date = new Date(calculatedEndDate.value)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})

// Check if end date differs from calculated value
const isEndDateOverridden = computed(() => {
  if (!formData.value.tenancyEndDate || !calculatedEndDate.value) {
    return false
  }
  return formData.value.tenancyEndDate !== calculatedEndDate.value
})

// Auto-update tenancy end date when start date changes (if not manually edited)
watch(() => formData.value.tenancyStartDate, () => {
  if (!endDateManuallyEdited.value) {
    formData.value.tenancyEndDate = calculatedEndDate.value || ''
  }
})

// Auto-update tenancy end date when term changes (if not manually edited)
watch(() => formData.value.tenancyTerm, () => {
  if (!endDateManuallyEdited.value) {
    formData.value.tenancyEndDate = calculatedEndDate.value || ''
  }
})

// Track manual edits to end date field
watch(() => formData.value.tenancyEndDate, (newDate, oldDate) => {
  if (newDate !== calculatedEndDate.value && newDate !== oldDate && oldDate !== undefined) {
    endDateManuallyEdited.value = true
  }
  if (newDate === calculatedEndDate.value || newDate === '') {
    endDateManuallyEdited.value = false
  }
})

// Watch for agreement changes and populate form
watch(() => props.agreement, (newAgreement) => {
  if (newAgreement) {
    formData.value = agreementToFormData(newAgreement)
    // Reset manual edit flag - check if loaded end date differs from calculated
    endDateManuallyEdited.value = formData.value.tenancyEndDate !== calculatedEndDate.value
  } else {
    formData.value = getDefaultFormData()
    endDateManuallyEdited.value = false
  }
}, { immediate: true })

// Update agentSignsOnBehalf when management type changes
watch(() => formData.value.managementType, (newType) => {
  if (newType === 'managed') {
    formData.value.agentSignsOnBehalf = true
  } else {
    formData.value.agentSignsOnBehalf = false
  }
})

const formatPropertyAddress = (address: any): string => {
  if (!address) return ''
  if (typeof address === 'string') return address

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postcode
  ].filter(Boolean)

  return parts.join(', ')
}

const addLandlord = () => {
  formData.value.landlords.push({
    name: '',
    address: { line1: '', line2: '', city: '', county: '', postcode: '' }
  })
}

const removeLandlord = (index: number) => {
  if (formData.value.landlords.length > 1) {
    formData.value.landlords.splice(index, 1)
  }
}

const addTenant = () => {
  formData.value.tenants.push({
    name: '',
    address: { line1: '', line2: '', city: '', county: '', postcode: '' }
  })
}

const removeTenant = (index: number) => {
  if (formData.value.tenants.length > 1) {
    formData.value.tenants.splice(index, 1)
  }
}

const addGuarantor = () => {
  formData.value.guarantors.push({
    name: '',
    email: '',
    address: { line1: '', line2: '', city: '', county: '', postcode: '' }
  })
}

const removeGuarantor = (index: number) => {
  formData.value.guarantors.splice(index, 1)
}

// Rent share computed properties and methods
const totalRentShares = computed(() => {
  return formData.value.tenants.reduce((sum, t) => sum + (Number(t.rentShare) || 0), 0)
})

const rentShareDifference = computed(() => {
  return totalRentShares.value - (formData.value.rentAmount || 0)
})

const rentSharesValid = computed(() => {
  return Math.abs(rentShareDifference.value) < 0.01
})

const formatNumber = (amount: number) => {
  return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getRentSharePercentage = (rentShare?: number) => {
  if (!formData.value.rentAmount || formData.value.rentAmount === 0) return '0'
  return (((rentShare || 0) / formData.value.rentAmount) * 100).toFixed(0)
}

const splitRentEvenly = () => {
  const rentAmount = formData.value.rentAmount || 0
  const tenantCount = formData.value.tenants.length
  if (tenantCount === 0 || rentAmount === 0) return

  const shareAmount = rentAmount / tenantCount
  let remaining = rentAmount

  formData.value.tenants.forEach((tenant, index) => {
    if (index === tenantCount - 1) {
      // Last tenant gets remainder to avoid rounding issues
      tenant.rentShare = Math.round(remaining * 100) / 100
    } else {
      tenant.rentShare = Math.round(shareAmount * 100) / 100
      remaining -= tenant.rentShare
    }
  })
}

const validateRentShares = () => {
  // Just triggers reactivity, validation is done via computed
}

const handleClose = () => {
  emit('close')
}

const handleSave = () => {
  if (!props.agreement) return

  const isDraft = !isSentAgreement.value

  emit('save', {
    formData: formDataToAgreementRequest(formData.value),
    isDraft,
    agreementId: props.agreement.id
  })
}
</script>
