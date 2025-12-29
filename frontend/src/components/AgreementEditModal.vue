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

// Watch for agreement changes and populate form
watch(() => props.agreement, (newAgreement) => {
  if (newAgreement) {
    formData.value = agreementToFormData(newAgreement)
  } else {
    formData.value = getDefaultFormData()
  }
}, { immediate: true })

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
