<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="handleClose"
        />

        <!-- Modal -->
        <div class="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/30">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <Scale class="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Section 8 Notice Generator</h2>
                  <p class="text-sm text-gray-600 dark:text-slate-400">Form 3 — Housing Act 1988</p>
                </div>
              </div>
              <button
                @click="handleClose"
                class="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Step Indicator -->
            <div class="mt-4">
              <div class="flex items-center justify-between">
                <template v-for="(title, index) in visibleSteps" :key="index">
                  <div class="flex items-center">
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                      :class="getStepClass(index + 1)"
                    >
                      <Check v-if="index + 1 < formState.currentStep" class="w-4 h-4" />
                      <span v-else>{{ index + 1 }}</span>
                    </div>
                    <span
                      class="ml-2 text-xs font-medium hidden sm:block"
                      :class="index + 1 === formState.currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'"
                    >
                      {{ title }}
                    </span>
                  </div>
                  <div
                    v-if="index < visibleSteps.length - 1"
                    class="flex-1 mx-2 h-0.5 bg-gray-200 dark:bg-slate-600"
                    :class="{ 'bg-red-500 dark:bg-red-500': index + 1 < formState.currentStep }"
                  />
                </template>
              </div>
            </div>
          </div>

          <!-- Data Warning Banner -->
          <div v-if="formState.pgDataLoaded && !formState.pgDataAvailable" class="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50">
            <div class="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Info class="w-4 h-4 flex-shrink-0" />
              <span>Tenancy data could not be loaded automatically — please complete the form manually.</span>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <Step1Tenant
              v-if="formState.currentStep === 1"
              :form-state="formState"
              @update="updateFormState"
            />
            <Step2Landlord
              v-else-if="formState.currentStep === 2"
              :form-state="formState"
              @update="updateFormState"
            />
            <Step3Tenancy
              v-else-if="formState.currentStep === 3"
              :form-state="formState"
              @update="updateFormState"
            />
            <Step4Grounds
              v-else-if="formState.currentStep === 4"
              :form-state="formState"
              :grounds="grounds"
              @update="updateFormState"
            />
            <Step5Arrears
              v-else-if="formState.currentStep === 5 && showArrearsStep"
              :form-state="formState"
              @update="updateFormState"
            />
            <Step6Explanations
              v-else-if="getActualStepNumber() === 6"
              :form-state="formState"
              :grounds="grounds"
              @update="updateFormState"
            />
            <Step7Service
              v-else-if="getActualStepNumber() === 7"
              :form-state="formState"
              @update="updateFormState"
            />
            <Step8Review
              v-else-if="getActualStepNumber() === 8"
              :form-state="formState"
              :grounds="grounds"
              @edit-step="goToStep"
            />
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-between">
            <button
              v-if="formState.currentStep > 1"
              @click="previousStep"
              :disabled="generating"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <ChevronLeft class="w-4 h-4" />
              Back
            </button>
            <div v-else></div>

            <div class="flex gap-3">
              <button
                @click="handleClose"
                :disabled="generating"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                v-if="getActualStepNumber() === 8"
                @click="generateDocument"
                :disabled="!canGenerate || generating"
                class="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="generating" class="w-4 h-4 animate-spin" />
                <FileDown v-else class="w-4 h-4" />
                {{ generating ? 'Generating...' : 'Generate & Download Notice' }}
              </button>
              <button
                v-else
                @click="nextStep"
                :disabled="!currentStepValid"
                class="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import {
  X, Scale, Check, Info, ChevronLeft, ChevronRight, FileDown, Loader2
} from 'lucide-vue-next'
import Step1Tenant from './section8/Step1Tenant.vue'
import Step2Landlord from './section8/Step2Landlord.vue'
import Step3Tenancy from './section8/Step3Tenancy.vue'
import Step4Grounds from './section8/Step4Grounds.vue'
import Step5Arrears from './section8/Step5Arrears.vue'
import Step6Explanations from './section8/Step6Explanations.vue'
import Step7Service from './section8/Step7Service.vue'
import Step8Review from './section8/Step8Review.vue'
import type {
  S8FormState,
  S8Ground,
} from '@/types/section8'
import {
  createInitialFormState,
  STEP_TITLES,
  ARREARS_GROUNDS,
} from '@/types/section8'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

interface Props {
  isOpen: boolean
  tenancyId: string
  tenancyData?: {
    tenantNames?: string[]
    tenantEmail?: string
    tenantPhone?: string
    propertyAddress?: {
      line1: string
      line2?: string
      town: string
      county?: string
      postcode: string
    }
    landlordName?: string
    landlordAddress?: string
    tenancyStartDate?: string
    rentAmount?: number
    rentFrequency?: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
    rentDueDay?: string
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
  generated: [noticeId: string]
}>()

const toast = useToast()
const authStore = useAuthStore()
// State
const formState = ref<S8FormState>(createInitialFormState())
const grounds = ref<S8Ground[]>([])
const generating = ref(false)
const groundsLoaded = ref(false)

// Computed
const showArrearsStep = computed(() => {
  return formState.value.selectedGroundIds.some(id => ARREARS_GROUNDS.includes(id))
})

const visibleSteps = computed(() => {
  if (showArrearsStep.value) {
    return STEP_TITLES
  }
  // Hide step 5 (Arrears) when no arrears grounds selected
  return [...STEP_TITLES.slice(0, 4), ...STEP_TITLES.slice(5)]
})

const currentStepValid = computed(() => {
  const step = formState.value.currentStep
  const actualStep = getActualStepNumber()
  const state = formState.value

  // Steps 1-4 are always the same regardless of arrears
  switch (step) {
    case 1:
      return state.tenantNames.filter(n => n.trim()).length > 0 &&
             state.propertyAddress.line1.trim() !== '' &&
             state.propertyAddress.town.trim() !== '' &&
             state.propertyAddress.postcode.trim() !== ''
    case 2:
      return state.landlordNames.filter(n => n.trim()).length > 0 &&
             state.landlordAddress.line1.trim() !== '' &&
             state.landlordAddress.town.trim() !== '' &&
             state.landlordAddress.postcode.trim() !== ''
    case 3:
      return state.tenancyStartDate !== '' &&
             state.rentAmount !== null && state.rentAmount > 0 &&
             state.rentFrequency !== null &&
             state.rentDueDay.trim() !== ''
    case 4:
      return state.selectedGroundIds.length > 0
  }

  // For step 5+, use actualStep to determine which component is shown
  if (actualStep === 5) {
    // Arrears step (only shown when showArrearsStep is true)
    return state.arrearsRows.length > 0
  }
  if (actualStep === 6) {
    // Explanations step - check all grounds have explanations
    return state.selectedGroundIds.every(id => {
      const explanation = state.groundExplanations[id]
      return explanation && explanation.trim().length >= 50
    })
  }
  if (actualStep === 7) {
    // Service step
    return state.serviceMethod !== null &&
           state.signatoryName.trim() !== '' &&
           state.signatoryCapacity !== null &&
           state.signature.trim() !== ''
  }

  return true // Step 8 (review) is always valid
})

const canGenerate = computed(() => {
  const state = formState.value

  // Check all required fields
  if (state.tenantNames.filter(n => n.trim()).length === 0) return false
  if (!state.propertyAddress.line1 || !state.propertyAddress.postcode) return false
  if (state.landlordNames.filter(n => n.trim()).length === 0) return false
  if (!state.landlordAddress.line1 || !state.landlordAddress.postcode) return false
  if (!state.tenancyStartDate || !state.rentAmount || !state.rentFrequency) return false
  if (state.selectedGroundIds.length === 0) return false
  if (!state.serviceMethod || !state.signatoryName || !state.signatoryCapacity) return false
  if (!state.signature) return false

  // Check ground explanations
  for (const groundId of state.selectedGroundIds) {
    const explanation = state.groundExplanations[groundId]
    if (!explanation || explanation.trim().length < 50) return false
  }

  return true
})

// Methods
function getStepClass(step: number): string {
  if (step < formState.value.currentStep) {
    return 'bg-red-600 text-white'
  }
  if (step === formState.value.currentStep) {
    return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 ring-2 ring-red-600 dark:ring-red-500'
  }
  return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
}

function getActualStepNumber(): number {
  const step = formState.value.currentStep
  if (!showArrearsStep.value && step >= 5) {
    // If arrears step is hidden and we're past step 4, add 1 to get actual step
    return step + 1
  }
  return step
}

function updateFormState(updates: Partial<S8FormState>) {
  formState.value = { ...formState.value, ...updates }
}

function goToStep(step: number) {
  formState.value.currentStep = step
}

function previousStep() {
  if (formState.value.currentStep > 1) {
    formState.value.currentStep -= 1
  }
}

function nextStep() {
  if (!currentStepValid.value) return

  // Calculate earliest court date when leaving step 4
  if (formState.value.currentStep === 4) {
    calculateCourtDate()
  }

  formState.value.currentStep += 1
}

async function loadGrounds() {
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/legal/section8-grounds`, {
      token,
    })

    if (!response.ok) throw new Error('Failed to load grounds')

    const data = await response.json()
    grounds.value = data.grounds
    groundsLoaded.value = true
  } catch (error) {
    console.error('Error loading Section 8 grounds:', error)
    toast.error('Failed to load Section 8 grounds')
  }
}

async function calculateCourtDate() {
  if (formState.value.selectedGroundIds.length === 0) return

  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/legal/section8-calculate-date`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        groundIds: formState.value.selectedGroundIds,
        serviceDate: formState.value.serviceDate,
      }),
    })

    if (!response.ok) throw new Error('Failed to calculate date')

    const data = await response.json()
    formState.value.earliestCourtDate = data.earliestCourtDate
    formState.value.longestNoticeGround = data.longestGround.number
    formState.value.noticeExplanation = data.explanation
  } catch (error) {
    console.error('Error calculating court date:', error)
  }
}

async function generateDocument() {
  if (!canGenerate.value) return

  generating.value = true

  try {
    const token = authStore.session?.access_token

    // Prepare form data
    const payload = {
      tenancyId: props.tenancyId,
      tenantNames: formState.value.tenantNames.filter(n => n.trim()),
      propertyAddress: formState.value.propertyAddress,
      tenantEmail: formState.value.tenantEmail,
      tenantPhone: formState.value.tenantPhone,
      landlordNames: formState.value.landlordNames.filter(n => n.trim()),
      landlordAddress: formState.value.landlordAddress,
      servedByAgent: formState.value.servedByAgent,
      agentName: formState.value.servedByAgent ? formState.value.agentName : undefined,
      agentAddress: formState.value.servedByAgent ? formState.value.agentAddress : undefined,
      tenancyStartDate: formState.value.tenancyStartDate,
      rentAmount: formState.value.rentAmount,
      rentFrequency: formState.value.rentFrequency,
      rentDueDay: formState.value.rentDueDay,
      selectedGroundIds: formState.value.selectedGroundIds,
      serviceDate: formState.value.serviceDate,
      earliestCourtDate: formState.value.earliestCourtDate,
      noticeExplanation: formState.value.noticeExplanation,
      arrearsRows: showArrearsStep.value ? formState.value.arrearsRows.map(row => ({
        period: row.period,
        dueDate: row.dueDate,
        amountDue: row.amountDue,
        amountPaid: row.amountPaid,
        paidDate: row.paidDate,
        balance: row.balance,
      })) : undefined,
      totalArrears: showArrearsStep.value
        ? formState.value.arrearsRows.reduce((sum, row) => sum + row.balance, 0)
        : undefined,
      arrearsNotes: showArrearsStep.value ? formState.value.arrearsNotes : undefined,
      groundExplanations: formState.value.groundExplanations,
      serviceMethod: formState.value.serviceMethod,
      emailServedTo: formState.value.emailServedTo,
      signatoryName: formState.value.signatoryName,
      signatoryCapacity: formState.value.signatoryCapacity,
      signature: formState.value.signature,
      signatureMethod: formState.value.signatureMethod,
    }

    const response = await authFetch(`${API_URL}/api/legal/generate-section8`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate document')
    }

    const result = await response.json()

    // Convert base64 to blob and download
    const byteCharacters = atob(result.pdfBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })

    // Download the file
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename || 'Section8_Notice.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    // Show appropriate toast based on what was saved
    if (result.savedToDocuments && result.savedNoticeRecord) {
      toast.success('Section 8 notice generated and saved to Documents')
    } else if (result.savedToDocuments) {
      toast.success('Section 8 notice generated and saved to Documents')
      toast.warning('Notice record could not be saved - check backend logs')
    } else if (result.savedNoticeRecord) {
      toast.success('Section 8 notice generated')
      toast.warning('Document not saved to Documents tab - property may not be linked')
    } else {
      toast.success('Section 8 notice generated')
      toast.warning('Could not save to database - check migration 180 has been run')
    }
    emit('success')

    // Emit the notice ID so the parent can offer to serve it
    if (result.noticeId) {
      emit('generated', result.noticeId)
    }

    emit('close')
  } catch (error: any) {
    console.error('Error generating Section 8 notice:', error)
    toast.error(error.message || 'Failed to generate document')
  } finally {
    generating.value = false
  }
}

function handleClose() {
  if (!generating.value) {
    emit('close')
  }
}

function prefillFromTenancyData() {
  if (!props.tenancyData) {
    formState.value.pgDataLoaded = true
    formState.value.pgDataAvailable = false
    return
  }

  const data = props.tenancyData
  formState.value.pgDataLoaded = true
  formState.value.pgDataAvailable = true

  if (data.tenantNames?.length) {
    formState.value.tenantNames = data.tenantNames
  }
  if (data.tenantEmail) {
    formState.value.tenantEmail = data.tenantEmail
    formState.value.emailServedTo = data.tenantEmail
  }
  if (data.tenantPhone) {
    formState.value.tenantPhone = data.tenantPhone
  }
  if (data.propertyAddress) {
    formState.value.propertyAddress = { ...data.propertyAddress }
  }
  if (data.tenancyStartDate) {
    formState.value.tenancyStartDate = data.tenancyStartDate
  }
  if (data.rentAmount) {
    formState.value.rentAmount = data.rentAmount
  }
  if (data.rentFrequency) {
    formState.value.rentFrequency = data.rentFrequency
  }
  if (data.rentDueDay) {
    formState.value.rentDueDay = data.rentDueDay
  }
}

async function fetchTenancyDetails() {
  if (!props.tenancyId) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Fetch company details for agent info
    const companyResponse = await authFetch(`${API_URL}/api/company`, {
      token,
    })

    if (companyResponse.ok) {
      const companyResult = await companyResponse.json()
      const companyData = companyResult.company
      if (companyData) {
        // Set agent details from company settings
        if (companyData.name) {
          formState.value.agentName = companyData.name
        }
        if (companyData.address || companyData.city || companyData.postcode) {
          formState.value.agentAddress = {
            line1: companyData.address || '',
            line2: '',
            town: companyData.city || '',
            county: '',
            postcode: companyData.postcode || '',
          }
        }
      }
    }

    // Fetch full tenancy details including property and landlords
    const response = await authFetch(`${API_URL}/api/tenancies/records/${props.tenancyId}`, {
      token,
    })

    if (!response.ok) return

    const tenancyResult = await response.json()
    const tenancy = tenancyResult.tenancy
    const propertyId = tenancy?.property_id

    if (propertyId) {
      // Fetch property data which includes landlords
      const propertyResponse = await authFetch(`${API_URL}/api/properties/${propertyId}`, {
        token,
      })

      if (propertyResponse.ok) {
        const propertyData = await propertyResponse.json()
        const landlords = propertyData.landlords || []

        if (landlords.length > 0) {
          // Use primary landlord or first landlord
          const primaryLandlord = landlords.find((l: any) => l.is_primary_contact) || landlords[0]

          // Set landlord names (all landlords)
          formState.value.landlordNames = landlords.map((l: any) => l.name).filter(Boolean)
          if (formState.value.landlordNames.length === 0) {
            formState.value.landlordNames = ['']
          }

          // Set landlord address from primary landlord
          if (primaryLandlord.address_line1) {
            formState.value.landlordAddress = {
              line1: primaryLandlord.address_line1 || '',
              line2: primaryLandlord.address_line2 || '',
              town: primaryLandlord.city || '',
              county: primaryLandlord.county || '',
              postcode: primaryLandlord.postcode || '',
            }
          }

          formState.value.pgDataAvailable = true
        }
      }
    }
  } catch (error) {
    console.error('Error fetching tenancy details for Section 8:', error)
  }
}

// Watch for modal open
watch(() => props.isOpen, async (open) => {
  if (open) {
    formState.value = createInitialFormState()
    if (!groundsLoaded.value) {
      loadGrounds()
    }
    prefillFromTenancyData()
    // Fetch landlord data from API
    await fetchTenancyDetails()
  }
})

onMounted(() => {
  if (props.isOpen && !groundsLoaded.value) {
    loadGrounds()
  }
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
