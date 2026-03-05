<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="close"
        />
        <div class="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 bg-red-50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle class="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Serve Section 8 Notice</h2>
                  <p class="text-sm text-red-600">Housing Act 1988 - Seeking Possession</p>
                </div>
              </div>
              <button
                @click="close"
                class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Property Info -->
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Property</p>
              <p class="font-medium text-gray-900">{{ propertyAddress }}</p>
            </div>

            <!-- Warning Notice -->
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex gap-3">
                <AlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0" />
                <div class="text-sm text-red-800">
                  <p class="font-medium">This is a serious legal action</p>
                  <p class="mt-1 text-xs">
                    Section 8 is used to seek possession when a tenant has breached their tenancy agreement.
                    This action may lead to court proceedings and eviction.
                  </p>
                </div>
              </div>
            </div>

            <!-- Grounds Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Select Grounds for Possession *
              </label>
              <p class="text-xs text-gray-500 mb-3">
                Select all applicable grounds. Different grounds have different notice periods.
              </p>

              <!-- Mandatory Grounds (2 months) -->
              <div class="mb-4">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-red-500"></span>
                  Mandatory Grounds (Court must grant possession)
                </h4>
                <div class="space-y-2">
                  <label
                    v-for="ground in mandatoryGrounds"
                    :key="ground.number"
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                    :class="selectedGrounds.includes(ground.number)
                      ? 'border-red-300 bg-red-50 ring-1 ring-red-300'
                      : 'border-gray-200 hover:border-gray-300'"
                  >
                    <input
                      type="checkbox"
                      :value="ground.number"
                      v-model="selectedGrounds"
                      class="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    >
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-red-600">Ground {{ ground.number }}</span>
                        <span class="text-xs text-gray-500">({{ ground.noticePeriod }})</span>
                      </div>
                      <p class="text-sm text-gray-700">{{ ground.title }}</p>
                      <p class="text-xs text-gray-500 mt-1">{{ ground.description }}</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Discretionary Grounds (2 weeks) -->
              <div>
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  Discretionary Grounds (Court decides if reasonable)
                </h4>
                <div class="space-y-2">
                  <label
                    v-for="ground in discretionaryGrounds"
                    :key="ground.number"
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                    :class="selectedGrounds.includes(ground.number)
                      ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-300'
                      : 'border-gray-200 hover:border-gray-300'"
                  >
                    <input
                      type="checkbox"
                      :value="ground.number"
                      v-model="selectedGrounds"
                      class="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    >
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-amber-600">Ground {{ ground.number }}</span>
                        <span class="text-xs text-gray-500">({{ ground.noticePeriod }})</span>
                      </div>
                      <p class="text-sm text-gray-700">{{ ground.title }}</p>
                      <p class="text-xs text-gray-500 mt-1">{{ ground.description }}</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Ground Details -->
            <div v-if="selectedGrounds.length > 0">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Ground Details (Optional but Recommended)
              </label>
              <p class="text-xs text-gray-500 mb-3">
                Provide specific details for each ground to strengthen your case.
              </p>
              <div class="space-y-3">
                <div
                  v-for="groundNum in selectedGrounds"
                  :key="groundNum"
                  class="border border-gray-200 rounded-lg p-3"
                >
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    Ground {{ groundNum }}: {{ getGroundTitle(groundNum) }}
                  </label>
                  <textarea
                    v-model="groundDetails[groundNum]"
                    rows="2"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    :placeholder="getGroundPlaceholder(groundNum)"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Notice Period Info -->
            <div v-if="selectedGrounds.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex gap-3">
                <Info class="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div class="text-sm text-blue-800">
                  <p class="font-medium">Required Notice Period: {{ requiredNoticePeriod }}</p>
                  <p class="text-xs mt-1">
                    Based on your selected grounds, the earliest you can apply for a court hearing is:
                    <strong>{{ earliestCourtDate }}</strong>
                  </p>
                </div>
              </div>
            </div>

            <!-- Additional Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Additional Notes (Internal)</label>
              <textarea
                v-model="additionalNotes"
                rows="2"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                placeholder="Internal notes about this notice (not sent to tenant)"
              ></textarea>
            </div>

            <!-- Delivery Method -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">How will you serve this notice?</label>
              <div class="space-y-2">
                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                  :class="deliveryMethod === 'email' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'">
                  <input v-model="deliveryMethod" type="radio" value="email" class="text-primary focus:ring-primary">
                  <div>
                    <p class="font-medium text-sm text-gray-900">Email to tenant</p>
                    <p class="text-xs text-gray-500">Send digitally to {{ leadTenantEmail || 'tenant email' }}</p>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                  :class="deliveryMethod === 'download' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'">
                  <input v-model="deliveryMethod" type="radio" value="download" class="text-primary focus:ring-primary">
                  <div>
                    <p class="font-medium text-sm text-gray-900">Download PDF</p>
                    <p class="text-xs text-gray-500">Print and serve manually or via recorded delivery</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Legal Confirmation -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  v-model="legalConfirmation"
                  type="checkbox"
                  class="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                >
                <div class="text-sm text-gray-700">
                  <p class="font-medium">I confirm that:</p>
                  <ul class="mt-1 text-xs text-gray-600 space-y-1 ml-4 list-disc">
                    <li>I have authority to serve this notice on behalf of the landlord</li>
                    <li>The grounds stated above are accurate and can be evidenced</li>
                    <li>I understand this may lead to court proceedings</li>
                    <li>I have considered alternative dispute resolution options</li>
                  </ul>
                </div>
              </label>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              @click="close"
              :disabled="processing"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="submit"
              :disabled="!canSubmit || processing"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
              <Send v-else class="w-4 h-4" />
              {{ processing ? 'Processing...' : (deliveryMethod === 'email' ? 'Send Notice' : 'Generate Notice') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { X, AlertTriangle, Info, Send, Loader2 } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

interface Ground {
  number: number
  title: string
  description: string
  noticePeriod: string
  isMandatory: boolean
}

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  propertyAddress: string
  leadTenantEmail: string | null
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Grounds data
const mandatoryGrounds: Ground[] = [
  {
    number: 8,
    title: 'Serious rent arrears',
    description: 'At least 2 months rent arrears (or 8 weeks for weekly tenancies) at notice date and hearing date',
    noticePeriod: '2 weeks',
    isMandatory: true
  },
  {
    number: 1,
    title: 'Owner-occupier seeking possession',
    description: 'Landlord previously occupied the property as their main home',
    noticePeriod: '2 months',
    isMandatory: true
  },
  {
    number: 2,
    title: 'Mortgagee seeking possession',
    description: 'Mortgage lender is repossessing the property',
    noticePeriod: '2 months',
    isMandatory: true
  },
  {
    number: 7,
    title: 'Death of previous tenant',
    description: 'Periodic tenancy passed on death and no longer needed',
    noticePeriod: '2 months',
    isMandatory: true
  }
]

const discretionaryGrounds: Ground[] = [
  {
    number: 10,
    title: 'Some rent arrears',
    description: 'Rent was in arrears when notice served and proceedings began',
    noticePeriod: '2 weeks',
    isMandatory: false
  },
  {
    number: 11,
    title: 'Persistent delay in paying rent',
    description: 'Tenant persistently delays paying rent even if not currently in arrears',
    noticePeriod: '2 weeks',
    isMandatory: false
  },
  {
    number: 12,
    title: 'Breach of tenancy agreement',
    description: 'Any obligation of the tenancy has been broken (except rent payment)',
    noticePeriod: '2 weeks',
    isMandatory: false
  },
  {
    number: 13,
    title: 'Property deterioration',
    description: 'Condition of property has deteriorated due to tenant or lodger',
    noticePeriod: '2 weeks',
    isMandatory: false
  },
  {
    number: 14,
    title: 'Nuisance or annoyance',
    description: 'Tenant or visitor has caused nuisance/annoyance to neighbours',
    noticePeriod: '2 weeks',
    isMandatory: false
  },
  {
    number: 17,
    title: 'False statement',
    description: 'Tenant made false statement to induce the granting of the tenancy',
    noticePeriod: '2 weeks',
    isMandatory: false
  }
]

// State
const selectedGrounds = ref<number[]>([])
const groundDetails = reactive<Record<number, string>>({})
const additionalNotes = ref('')
const deliveryMethod = ref<'email' | 'download'>('email')
const legalConfirmation = ref(false)
const processing = ref(false)

// Computed
const allGrounds = computed(() => [...mandatoryGrounds, ...discretionaryGrounds])

const requiredNoticePeriod = computed(() => {
  if (selectedGrounds.value.length === 0) return 'Select grounds'

  // 2 month grounds: 1, 2, 5, 6, 7, 9, 16
  const twoMonthGrounds = [1, 2, 5, 6, 7, 9, 16]
  const requiresTwoMonths = selectedGrounds.value.some(g => twoMonthGrounds.includes(g))

  return requiresTwoMonths ? '2 months' : '2 weeks'
})

const earliestCourtDate = computed(() => {
  if (selectedGrounds.value.length === 0) return 'Select grounds'

  const twoMonthGrounds = [1, 2, 5, 6, 7, 9, 16]
  const requiresTwoMonths = selectedGrounds.value.some(g => twoMonthGrounds.includes(g))

  const date = new Date()
  if (requiresTwoMonths) {
    date.setMonth(date.getMonth() + 2)
  } else {
    date.setDate(date.getDate() + 14)
  }

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

const canSubmit = computed(() => {
  return selectedGrounds.value.length > 0 &&
         legalConfirmation.value &&
         (deliveryMethod.value === 'download' || props.leadTenantEmail)
})

// Methods
const getGroundTitle = (num: number) => {
  return allGrounds.value.find(g => g.number === num)?.title || ''
}

const getGroundPlaceholder = (num: number) => {
  const placeholders: Record<number, string> = {
    8: 'e.g., "Current arrears: £2,450 as of 28/02/2026"',
    10: 'e.g., "Arrears of £500 when notice served"',
    11: 'e.g., "Rent paid late on 8 occasions in past 12 months"',
    12: 'e.g., "Unauthorized subletting contrary to clause 5.2"',
    13: 'e.g., "Significant damage to bathroom fixtures"',
    14: 'e.g., "Multiple noise complaints from neighbours at 42 and 46"',
    17: 'e.g., "False employment information provided on application"'
  }
  return placeholders[num] || 'Provide specific details...'
}

// Reset on open
watch(() => props.isOpen, (open) => {
  if (open) {
    selectedGrounds.value = []
    Object.keys(groundDetails).forEach(key => delete groundDetails[Number(key)])
    additionalNotes.value = ''
    deliveryMethod.value = props.leadTenantEmail ? 'email' : 'download'
    legalConfirmation.value = false
  }
})

const submit = async () => {
  if (!canSubmit.value) return

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/section-8-notice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grounds: selectedGrounds.value,
          groundDetails: groundDetails,
          deliveryMethod: deliveryMethod.value,
          additionalNotes: additionalNotes.value
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to serve notice')
    }

    const data = await response.json()

    if (deliveryMethod.value === 'download' && data.pdfUrl) {
      window.open(data.pdfUrl, '_blank')
      toast.success('Section 8 notice generated')
    } else {
      toast.success('Section 8 notice sent to tenant')
    }

    emit('success')
    emit('close')
  } catch (error: any) {
    console.error('Error serving Section 8 notice:', error)
    toast.error(error.message || 'Failed to serve notice')
  } finally {
    processing.value = false
  }
}

const close = () => {
  if (!processing.value) {
    emit('close')
  }
}
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
