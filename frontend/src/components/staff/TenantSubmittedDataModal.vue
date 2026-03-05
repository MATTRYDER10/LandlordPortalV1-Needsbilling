<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 class="text-lg font-semibold text-gray-900">Tenant Submitted Data</h2>
          <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto p-6" style="max-height: calc(90vh - 120px);">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-12">
            <Loader2 class="w-8 h-8 animate-spin mx-auto text-primary" />
            <p class="mt-2 text-gray-600">Loading form data...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-12">
            <p class="text-red-600">{{ error }}</p>
          </div>

          <!-- Form Data -->
          <div v-else-if="formData" class="space-y-6">
            <!-- Personal Details -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Personal Details</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="First Name" :value="formData.personalDetails?.firstName" />
                <DataRow label="Middle Name" :value="formData.personalDetails?.middleName" />
                <DataRow label="Last Name" :value="formData.personalDetails?.lastName" />
                <DataRow label="Email" :value="formData.personalDetails?.email" />
                <DataRow label="Phone" :value="formData.personalDetails?.phone" />
                <DataRow label="Date of Birth" :value="formData.personalDetails?.dateOfBirth" />
                <DataRow label="National Insurance Number" :value="formData.personalDetails?.nationalInsuranceNumber" />
                <DataRow label="Nationality" :value="formData.personalDetails?.nationality" />
                <DataRow label="British Citizen" :value="formData.personalDetails?.isBritishCitizen === true ? 'Yes' : formData.personalDetails?.isBritishCitizen === false ? 'No' : null" />
              </div>
            </section>

            <!-- Current Address -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Current Address</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Address Line 1" :value="formData.currentAddress?.line1" />
                <DataRow label="Address Line 2" :value="formData.currentAddress?.line2" />
                <DataRow label="City" :value="formData.currentAddress?.city" />
                <DataRow label="County" :value="formData.currentAddress?.county" />
                <DataRow label="Postcode" :value="formData.currentAddress?.postcode" />
                <DataRow label="Country" :value="formData.currentAddress?.country" />
                <DataRow label="Move In Date" :value="formData.currentAddress?.moveInDate" />
                <DataRow label="Residential Status" :value="formData.currentAddress?.residentialStatus" />
              </div>
            </section>

            <!-- Previous Address -->
            <section v-if="hasPreviousAddress">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Previous Address</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Address Line 1" :value="formData.previousAddress?.line1" />
                <DataRow label="Address Line 2" :value="formData.previousAddress?.line2" />
                <DataRow label="City" :value="formData.previousAddress?.city" />
                <DataRow label="County" :value="formData.previousAddress?.county" />
                <DataRow label="Postcode" :value="formData.previousAddress?.postcode" />
                <DataRow label="Country" :value="formData.previousAddress?.country" />
              </div>
            </section>

            <!-- Employment -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Employment Details</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Employment Status" :value="formData.employment?.status" />
                <DataRow label="Company Name" :value="formData.employment?.companyName" />
                <DataRow label="Job Title" :value="formData.employment?.jobTitle" />
                <DataRow label="Employer Address" :value="formData.employment?.employerAddress" />
                <DataRow label="Employer Phone" :value="formData.employment?.employerPhone" />
                <DataRow label="Start Date" :value="formData.employment?.startDate" />
                <DataRow label="Annual Salary" :value="formData.employment?.annualSalary ? `£${formData.employment.annualSalary}` : null" />
                <DataRow label="Self Employed" :value="formData.employment?.isSelfEmployed ? 'Yes' : 'No'" />
                <DataRow v-if="formData.employment?.isSelfEmployed" label="Business Name" :value="formData.employment?.selfEmployedBusinessName" />
                <DataRow v-if="formData.employment?.isSelfEmployed" label="Self Employed Income" :value="formData.employment?.selfEmployedIncome ? `£${formData.employment.selfEmployedIncome}` : null" />
              </div>
            </section>

            <!-- Employer Referee -->
            <section v-if="hasEmployerReferee">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Employer Referee</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Name" :value="formData.employerReferee?.name" />
                <DataRow label="Email" :value="formData.employerReferee?.email" />
                <DataRow label="Phone" :value="formData.employerReferee?.phone" />
                <DataRow label="Position" :value="formData.employerReferee?.position" />
              </div>
            </section>

            <!-- Previous Landlord -->
            <section v-if="hasPreviousLandlord">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Previous Landlord / Agent</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Name" :value="formData.previousLandlord?.name" />
                <DataRow label="Email" :value="formData.previousLandlord?.email" />
                <DataRow label="Phone" :value="formData.previousLandlord?.phone" />
                <DataRow label="Address" :value="formData.previousLandlord?.address" />
                <DataRow label="Reference Type" :value="formData.previousLandlord?.referenceType" />
              </div>
            </section>

            <!-- Previous Agency -->
            <section v-if="hasPreviousAgency">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Previous Agency</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Agency Name" :value="formData.previousAgency?.name" />
                <DataRow label="Email" :value="formData.previousAgency?.email" />
                <DataRow label="Phone" :value="formData.previousAgency?.phone" />
              </div>
            </section>

            <!-- Accountant -->
            <section v-if="hasAccountant">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Accountant Details</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Name" :value="formData.accountant?.name" />
                <DataRow label="Email" :value="formData.accountant?.email" />
                <DataRow label="Phone" :value="formData.accountant?.phone" />
                <DataRow label="Company" :value="formData.accountant?.company" />
              </div>
            </section>

            <!-- Bank Details -->
            <section v-if="hasBankDetails">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Bank Details</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Bank Name" :value="formData.bankDetails?.bankName" />
                <DataRow label="Account Number" :value="formData.bankDetails?.accountNumber" />
                <DataRow label="Sort Code" :value="formData.bankDetails?.sortCode" />
              </div>
            </section>

            <!-- Guarantor Details -->
            <section v-if="hasGuarantor">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Guarantor Details</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Required" :value="formData.guarantor?.required ? 'Yes' : 'No'" />
                <DataRow label="First Name" :value="formData.guarantor?.firstName" />
                <DataRow label="Last Name" :value="formData.guarantor?.lastName" />
                <DataRow label="Email" :value="formData.guarantor?.email" />
                <DataRow label="Phone" :value="formData.guarantor?.phone" />
                <DataRow label="Relationship" :value="formData.guarantor?.relationship" />
                <DataRow label="Address" :value="formData.guarantor?.address" />
              </div>
            </section>

            <!-- Documents Uploaded -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Documents Uploaded</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Selfie" :value="formData.documents?.selfiePath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.selfiePath" />
                <DataRow label="ID Document" :value="formData.documents?.idDocumentPath ? `Uploaded (${formData.documents?.idDocumentType || 'Unknown type'})` : 'Not uploaded'" :highlight="!!formData.documents?.idDocumentPath" />
                <DataRow label="Payslips" :value="formData.documents?.payslipFiles?.length ? `${formData.documents.payslipFiles.length} file(s)` : 'None'" :highlight="formData.documents?.payslipFiles?.length > 0" />
                <DataRow label="Bank Statements" :value="formData.documents?.bankStatementsPaths?.length ? `${formData.documents.bankStatementsPaths.length} file(s)` : 'None'" :highlight="formData.documents?.bankStatementsPaths?.length > 0" />
                <DataRow label="Proof of Address" :value="formData.documents?.proofOfAddressPath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.proofOfAddressPath" />
                <DataRow label="RTR Passport" :value="formData.documents?.rtrBritishPassportPath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.rtrBritishPassportPath" />
                <DataRow label="RTR Alt Document" :value="formData.documents?.rtrBritishAltDocPath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.rtrBritishAltDocPath" />
                <DataRow label="RTR Alternative Doc" :value="formData.documents?.rtrAlternativeDocumentPath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.rtrAlternativeDocumentPath" />
                <DataRow label="Pension Statement" :value="formData.documents?.pensionStatementPath ? 'Uploaded' : 'Not uploaded'" :highlight="!!formData.documents?.pensionStatementPath" />
              </div>
            </section>

            <!-- Right to Rent -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Right to Rent</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="British Citizen" :value="formData.rightToRent?.isBritishCitizen === true ? 'Yes' : formData.rightToRent?.isBritishCitizen === false ? 'No' : null" />
                <DataRow label="Share Code" :value="formData.rightToRent?.shareCode" />
                <DataRow label="No Passport" :value="formData.rightToRent?.noPassport ? 'Yes' : 'No'" />
                <DataRow label="Alt Doc Type" :value="formData.rightToRent?.altDocType" />
                <DataRow label="Verified" :value="formData.rightToRent?.verified ? 'Yes' : 'No'" :highlight="formData.rightToRent?.verified" />
                <DataRow label="Verification Date" :value="formData.rightToRent?.verificationDate" />
                <DataRow label="Verification Method" :value="formData.rightToRent?.verificationMethod" />
                <DataRow label="Indefinite Leave" :value="formData.rightToRent?.indefiniteLeave ? 'Yes' : 'No'" />
              </div>
            </section>

            <!-- Consent -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Consent & Signature</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Printed Name" :value="formData.consent?.printedName" />
                <DataRow label="Signature Date" :value="formData.consent?.signatureDate" />
                <DataRow label="Signature" :value="formData.consent?.signature" :highlight="!!formData.consent?.signature" />
                <DataRow label="Credit Check Consent" :value="formData.consent?.creditCheckConsent ? 'Yes' : 'No'" :highlight="formData.consent?.creditCheckConsent" />
                <DataRow label="Data Processing Consent" :value="formData.consent?.dataProcessingConsent ? 'Yes' : 'No'" :highlight="formData.consent?.dataProcessingConsent" />
              </div>
            </section>

            <!-- Additional Info -->
            <section v-if="hasAdditionalInfo">
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Additional Information</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Has Pets" :value="formData.additionalInfo?.pets ? 'Yes' : 'No'" />
                <DataRow v-if="formData.additionalInfo?.pets" label="Pet Details" :value="formData.additionalInfo?.petDetails" />
                <DataRow label="Smoker" :value="formData.additionalInfo?.smoker ? 'Yes' : 'No'" />
                <DataRow label="Additional Occupants" :value="formData.additionalInfo?.additionalOccupants" />
                <DataRow label="Reason for Moving" :value="formData.additionalInfo?.reasonForMoving" />
                <DataRow label="Additional Notes" :value="formData.additionalInfo?.additionalNotes" />
              </div>
            </section>

            <!-- Metadata -->
            <section>
              <h3 class="text-md font-semibold text-gray-900 mb-3 pb-2 border-b">Submission Metadata</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <DataRow label="Submitted At" :value="formData.metadata?.submittedAt" />
                <DataRow label="Created At" :value="formData.metadata?.createdAt" />
                <DataRow label="Status" :value="formData.metadata?.status" />
                <DataRow label="Verification State" :value="formData.metadata?.verificationState" />
                <DataRow label="Is Guarantor" :value="formData.metadata?.isGuarantor ? 'Yes' : 'No'" />
              </div>
            </section>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end px-6 py-4 border-t bg-gray-50">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { X, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const props = defineProps<{
  referenceId: string
}>()

defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const loading = ref(true)
const error = ref('')
const formData = ref<any>(null)

const hasPreviousAddress = computed(() => {
  const pa = formData.value?.previousAddress
  return pa?.line1 || pa?.city || pa?.postcode
})

const hasEmployerReferee = computed(() => {
  const er = formData.value?.employerReferee
  return er?.name || er?.email
})

const hasPreviousLandlord = computed(() => {
  const pl = formData.value?.previousLandlord
  return pl?.name || pl?.email
})

const hasPreviousAgency = computed(() => {
  const pa = formData.value?.previousAgency
  return pa?.name || pa?.email
})

const hasAccountant = computed(() => {
  const a = formData.value?.accountant
  return a?.name || a?.email
})

const hasBankDetails = computed(() => {
  const b = formData.value?.bankDetails
  return b?.bankName || b?.accountNumber
})

const hasGuarantor = computed(() => {
  const g = formData.value?.guarantor
  return g?.required || g?.firstName || g?.email
})

const hasAdditionalInfo = computed(() => {
  const a = formData.value?.additionalInfo
  return a?.pets || a?.smoker || a?.additionalOccupants || a?.reasonForMoving || a?.additionalNotes
})

const fetchFormData = async () => {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${API_URL}/api/references/${props.referenceId}/tenant-form-data`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch form data')
    }

    const data = await response.json()
    formData.value = data.formData
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFormData()
})

// DataRow component using render function (no runtime compiler needed)
const DataRow = {
  props: {
    label: String,
    value: [String, Number, Boolean, null],
    highlight: Boolean
  },
  setup(props: { label?: string; value?: string | number | boolean | null; highlight?: boolean }) {
    return () => h('div', { class: 'flex justify-between py-1' }, [
      h('span', { class: 'text-gray-500' }, props.label),
      h('span', {
        class: [
          props.highlight ? 'text-green-600 font-medium' : 'text-gray-900',
          'text-right max-w-[60%]'
        ]
      }, props.value ?? '-')
    ])
  }
}
</script>
