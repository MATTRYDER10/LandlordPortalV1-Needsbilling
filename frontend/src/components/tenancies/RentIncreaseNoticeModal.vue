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
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Section 13 Rent Increase Notice</h2>
                <p class="text-sm text-gray-500 dark:text-slate-400">Form 4 - Housing Act 1988</p>
              </div>
              <button
                @click="close"
                class="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            <!-- Step indicator -->
            <div class="flex items-center gap-2 mt-4">
              <div v-for="(stepName, idx) in stepNames" :key="idx" class="flex items-center">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                  :class="idx + 1 <= step ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'"
                >
                  {{ idx + 1 }}
                </div>
                <span class="ml-2 text-sm hidden sm:inline" :class="idx + 1 === step ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-slate-500'">
                  {{ stepName }}
                </span>
                <ChevronRight v-if="idx < stepNames.length - 1" class="w-4 h-4 mx-2 text-gray-300 dark:text-slate-600" />
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Step 1: Review Tenancy Data -->
            <div v-if="step === 1" class="space-y-5">
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Property</p>
                <p class="font-medium text-gray-900 dark:text-white">{{ propertyAddress }}</p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tenant(s)</p>
                  <p class="font-medium text-gray-900 dark:text-white mt-1">{{ tenantNames }}</p>
                </div>
                <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Rent Due Day</p>
                  <p class="font-medium text-gray-900 dark:text-white mt-1">{{ ordinal(rentDueDay) }} of each month</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                  <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Rent</p>
                  <p class="text-xl font-bold text-slate-700 dark:text-slate-200">&pound;{{ currentRent.toLocaleString() }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">per {{ rentFrequency }}</p>
                </div>
                <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tenancy Start</p>
                  <p class="font-medium text-gray-900 dark:text-white mt-1">{{ formatDate(tenancyStartDate) }}</p>
                </div>
              </div>

              <!-- Previous S13 Notice Check -->
              <div v-if="loadingPreviousS13" class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <Loader2 class="w-5 h-5 text-blue-600 animate-spin" />
                  <p class="text-sm text-blue-800 dark:text-blue-200">Checking for previous Section 13 notices...</p>
                </div>
              </div>

              <div v-else-if="previousS13Date" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div class="flex gap-3">
                  <CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p class="text-sm font-medium text-green-800 dark:text-green-200">Previous Section 13 Notice Found</p>
                    <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                      Last rent increase took effect on <strong>{{ formatDate(previousS13Date) }}</strong>.
                      This will be used as the anchor date for this notice.
                    </p>
                    <div class="mt-3">
                      <label class="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                        <input type="checkbox" v-model="overridePreviousDate" class="rounded text-primary focus:ring-primary">
                        Override this date (if incorrect)
                      </label>
                      <input
                        v-if="overridePreviousDate"
                        v-model="customPreviousDate"
                        type="date"
                        class="mt-2 w-full px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div class="flex gap-3">
                  <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p class="text-sm font-medium text-amber-800 dark:text-amber-200">No Previous Section 13 Notice Found</p>
                    <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This will be treated as the first statutory rent increase for this tenancy.
                      The 52-week period will be calculated from the tenancy start date.
                    </p>
                    <label class="flex items-center gap-2 mt-3 text-sm text-amber-800 dark:text-amber-200">
                      <input type="checkbox" v-model="confirmFirstS13" class="rounded text-primary focus:ring-primary">
                      I confirm this is the first Section 13 notice on this tenancy
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: New Rent Amount -->
            <div v-if="step === 2" class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                  <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Rent</p>
                  <p class="text-xl font-bold text-slate-700 dark:text-slate-200">&pound;{{ currentRent.toLocaleString() }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">per {{ rentFrequency }}</p>
                </div>
                <div class="bg-primary/10 dark:bg-primary/20 rounded-lg p-4">
                  <p class="text-xs text-primary/70 uppercase tracking-wider">Proposed New Rent</p>
                  <p class="text-xl font-bold text-primary">&pound;{{ (form.newRent || 0).toLocaleString() }}</p>
                  <p class="text-xs text-primary/70">per {{ rentFrequency }}</p>
                </div>
              </div>

              <div v-if="form.newRent && form.newRent > currentRent" class="text-center">
                <span class="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-full text-sm font-medium">
                  <TrendingUp class="w-4 h-4" />
                  Increase: &pound;{{ (form.newRent - currentRent).toLocaleString() }} ({{ increasePercentage }}%)
                </span>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Proposed New Rent *</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400">&pound;</span>
                  <input
                    v-model.number="form.newRent"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    placeholder="Enter new rent amount"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rent Frequency</label>
                <select
                  v-model="form.rentFrequency"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <!-- Step 3: Effective Date -->
            <div v-if="step === 3" class="space-y-5">
              <!-- Date validation warnings -->
              <div v-if="dateWarning" class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div class="flex gap-3">
                  <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div class="text-sm text-amber-800 dark:text-amber-200">
                    <p class="font-medium">{{ dateWarning.title }}</p>
                    <p class="mt-1">{{ dateWarning.message }}</p>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Proposed Start Date (Paragraph 4) *</label>
                <input
                  v-model="form.effectiveDate"
                  type="date"
                  :min="calculatedMinDate"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                />
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Earliest valid date: <strong>{{ formatDate(calculatedMinDate) }}</strong>
                  (Rent due day: {{ ordinal(rentDueDay) }})
                </p>
              </div>

              <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Date Validation Rules:</p>
                <ul class="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                  <li class="flex items-center gap-2">
                    <component :is="weeksSinceAnchor >= 52 ? CheckCircle : XCircle" class="w-4 h-4" :class="weeksSinceAnchor >= 52 ? 'text-green-600' : 'text-red-500'" />
                    At least 52 weeks since {{ previousS13Date ? 'last increase' : 'tenancy start' }} ({{ weeksSinceAnchor }} weeks passed)
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle class="w-4 h-4 text-green-600" />
                    At least 1 month notice from today
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle class="w-4 h-4 text-green-600" />
                    Falls on rent due day ({{ ordinal(rentDueDay) }})
                  </li>
                </ul>
              </div>
            </div>

            <!-- Step 4: Charges Table -->
            <div v-if="step === 4" class="space-y-5">
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                <p class="text-sm font-medium text-gray-700 dark:text-slate-300">Paragraph 5 - Charges included in rent</p>
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Only enter values if these charges are paid via rent rather than directly by the tenant.
                </p>
              </div>

              <div class="space-y-4">
                <div class="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 pb-2">
                  <div>Charge</div>
                  <div>In existing rent</div>
                  <div>In proposed new rent</div>
                </div>

                <div class="grid grid-cols-3 gap-4 items-center">
                  <div class="text-sm text-gray-700 dark:text-slate-300">Council Tax</div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.councilTax.existing"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.councilTax.proposed"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-4 items-center">
                  <div class="text-sm text-gray-700 dark:text-slate-300">Water Charges</div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.water.existing"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.water.proposed"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-4 items-center">
                  <div class="text-sm text-gray-700 dark:text-slate-300">Fixed Service Charges</div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.serviceCharges.existing"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">&pound;</span>
                    <input
                      v-model="form.charges.serviceCharges.proposed"
                      type="text"
                      placeholder="nil"
                      class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 5: Signature & Serve -->
            <div v-if="step === 5" class="space-y-5">
              <!-- Signatory Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Your Name (Signatory) *</label>
                <input
                  v-model="signatoryName"
                  type="text"
                  placeholder="Enter your full name"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">This will appear on the notice as the person signing on behalf of the landlord</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Signature Method</label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2">
                    <input type="radio" v-model="signatureMethod" value="draw" class="text-primary focus:ring-primary">
                    <span class="text-sm text-gray-700 dark:text-slate-300">Draw signature</span>
                  </label>
                  <label class="flex items-center gap-2">
                    <input type="radio" v-model="signatureMethod" value="type" class="text-primary focus:ring-primary">
                    <span class="text-sm text-gray-700 dark:text-slate-300">Type name</span>
                  </label>
                </div>
              </div>

              <!-- Draw signature -->
              <div v-if="signatureMethod === 'draw'" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-2">
                <canvas
                  ref="signatureCanvas"
                  class="w-full h-32 bg-white dark:bg-slate-800 rounded cursor-crosshair"
                  @mousedown="startDrawing"
                  @mousemove="draw"
                  @mouseup="stopDrawing"
                  @mouseleave="stopDrawing"
                  @touchstart.prevent="startDrawingTouch"
                  @touchmove.prevent="drawTouch"
                  @touchend="stopDrawing"
                ></canvas>
                <button
                  @click="clearSignature"
                  class="mt-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                >
                  Clear signature
                </button>
              </div>

              <!-- Type signature -->
              <div v-else>
                <input
                  v-model="typedSignature"
                  type="text"
                  placeholder="Type your full name"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                />
                <div v-if="typedSignature" class="mt-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p class="text-2xl text-gray-800 dark:text-slate-200" style="font-family: 'Brush Script MT', cursive;">
                    {{ typedSignature }}
                  </p>
                </div>
              </div>

              <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p class="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Declaration:</strong> By signing, you confirm that you are authorised to serve this notice
                  on behalf of the landlord, and that the information provided is accurate to the best of your knowledge.
                </p>
              </div>

              <!-- Delivery Method -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Delivery Method</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                    :class="form.deliveryMethod === 'email' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'">
                    <input v-model="form.deliveryMethod" type="radio" value="email" class="text-primary focus:ring-primary">
                    <div>
                      <p class="font-medium text-sm text-gray-900 dark:text-white">Email to tenant</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Send PDF digitally to {{ leadTenantEmail || 'tenant email' }}</p>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all"
                    :class="form.deliveryMethod === 'download' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'">
                    <input v-model="form.deliveryMethod" type="radio" value="download" class="text-primary focus:ring-primary">
                    <div>
                      <p class="font-medium text-sm text-gray-900 dark:text-white">Download PDF</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Print and serve manually</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between">
            <button
              v-if="step > 1"
              @click="step--"
              :disabled="processing"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Back
            </button>
            <div v-else></div>

            <div class="flex gap-3">
              <button
                @click="close"
                :disabled="processing"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                v-if="step < 5"
                @click="nextStep"
                :disabled="!canProceed"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                Continue
                <ChevronRight class="w-4 h-4" />
              </button>
              <button
                v-else
                @click="submit"
                :disabled="!canSubmit || processing"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
                {{ processing ? 'Processing...' : (form.deliveryMethod === 'email' ? 'Send Notice' : 'Generate PDF') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { X, TrendingUp, AlertTriangle, Send, Loader2, ChevronRight, CheckCircle, XCircle } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  propertyAddress: string
  currentRent: number
  leadTenantEmail: string | null
  rentDueDay?: number
  tenantNames?: string
  tenancyStartDate?: string
  landlordName?: string
  agentName?: string
  correspondenceAddress?: string
  contactNumber?: string
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Wizard state
const step = ref(1)
const stepNames = ['Review', 'New Rent', 'Date', 'Charges', 'Sign & Serve']

// Form state
const form = ref({
  newRent: 0,
  rentFrequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
  effectiveDate: '',
  deliveryMethod: 'email' as 'email' | 'download',
  charges: {
    councilTax: { existing: '', proposed: '' },
    water: { existing: '', proposed: '' },
    serviceCharges: { existing: '', proposed: '' }
  }
})

// Previous S13 state
const loadingPreviousS13 = ref(false)
const previousS13Date = ref<string | null>(null)
const overridePreviousDate = ref(false)
const customPreviousDate = ref('')
const confirmFirstS13 = ref(false)

// Signature state
const signatureMethod = ref<'draw' | 'type'>('type')
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const typedSignature = ref('')
const signatoryName = ref('') // The name of the person signing (will appear as "Name, Agency")
const isDrawing = ref(false)
const processing = ref(false)

// Computed
const rentDueDay = computed(() => props.rentDueDay || 1)
const rentFrequency = computed(() => form.value.rentFrequency)
const tenantNames = computed(() => props.tenantNames || 'Tenant')
const tenancyStartDate = computed(() => props.tenancyStartDate || '')

const anchorDate = computed(() => {
  if (overridePreviousDate.value && customPreviousDate.value) {
    return customPreviousDate.value
  }
  if (previousS13Date.value) {
    return previousS13Date.value
  }
  return tenancyStartDate.value
})

const weeksSinceAnchor = computed(() => {
  if (!anchorDate.value) return 0
  const anchor = new Date(anchorDate.value)
  const today = new Date()
  const diffMs = today.getTime() - anchor.getTime()
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
})

const calculatedMinDate = computed(() => {
  const today = new Date()
  const rentDay = rentDueDay.value

  // Add 1 month for minimum notice
  const oneMonthAhead = new Date(today)
  oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1)

  // Find next rent due day on or after one month
  let targetMonth = oneMonthAhead.getMonth()
  let targetYear = oneMonthAhead.getFullYear()

  if (oneMonthAhead.getDate() > rentDay) {
    targetMonth++
    if (targetMonth > 11) {
      targetMonth = 0
      targetYear++
    }
  }

  let effectiveDate = new Date(targetYear, targetMonth, rentDay)

  // Check 52-week rule
  if (anchorDate.value) {
    const anchor = new Date(anchorDate.value)
    const fiftyTwoWeeksLater = new Date(anchor)
    fiftyTwoWeeksLater.setDate(fiftyTwoWeeksLater.getDate() + 52 * 7)

    // If effective date is before 52 weeks, find next valid rent due day
    while (effectiveDate < fiftyTwoWeeksLater) {
      targetMonth++
      if (targetMonth > 11) {
        targetMonth = 0
        targetYear++
      }
      effectiveDate = new Date(targetYear, targetMonth, rentDay)
    }
  }

  return effectiveDate.toISOString().split('T')[0]
})

const dateWarning = computed(() => {
  if (weeksSinceAnchor.value < 52) {
    const anchor = new Date(anchorDate.value)
    const earliest = new Date(anchor)
    earliest.setDate(earliest.getDate() + 52 * 7)
    return {
      title: 'Warning: Less than 52 weeks since last increase',
      message: `It has been ${weeksSinceAnchor.value} weeks since ${previousS13Date.value ? 'the last Section 13 increase' : 'the tenancy started'}. The earliest valid start date is ${formatDate(earliest.toISOString())}.`
    }
  }
  return null
})

const increasePercentage = computed(() => {
  if (!form.value.newRent || form.value.newRent <= props.currentRent) return '0'
  return ((((form.value.newRent - props.currentRent) / props.currentRent) * 100)).toFixed(1)
})

const canProceed = computed(() => {
  switch (step.value) {
    case 1:
      return previousS13Date.value ? true : confirmFirstS13.value
    case 2:
      return form.value.newRent && form.value.newRent > 0
    case 3:
      return form.value.effectiveDate !== ''
    case 4:
      return true
    default:
      return false
  }
})

const canSubmit = computed(() => {
  const hasSignature = signatureMethod.value === 'type' ? typedSignature.value.trim().length > 0 : hasDrawnSignature.value
  const hasSignatoryName = signatoryName.value.trim().length > 0
  return hasSignature && hasSignatoryName && (form.value.deliveryMethod === 'download' || props.leadTenantEmail)
})

const hasDrawnSignature = ref(false)

// Methods
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const loadPreviousS13 = async () => {
  loadingPreviousS13.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/activity?limit=100&category=financial`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      const s13Entry = data.activities?.find((a: any) =>
        a.action === 'RENT_INCREASE_NOTICE_SERVED' && a.metadata?.effectiveDate
      )
      if (s13Entry) {
        previousS13Date.value = s13Entry.metadata.effectiveDate
      }
    }
  } catch (error) {
    console.error('Error loading previous S13:', error)
  } finally {
    loadingPreviousS13.value = false
  }
}

const nextStep = () => {
  if (canProceed.value && step.value < 5) {
    step.value++
    if (step.value === 3) {
      // Pre-fill effective date
      form.value.effectiveDate = calculatedMinDate.value
    }
  }
}

// Signature canvas methods
const setupCanvas = () => {
  if (signatureCanvas.value) {
    const canvas = signatureCanvas.value
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
    }
  }
}

const startDrawing = (e: MouseEvent) => {
  isDrawing.value = true
  const canvas = signatureCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  ctx.beginPath()
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value) return
  const canvas = signatureCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
  ctx.stroke()
  hasDrawnSignature.value = true
}

const stopDrawing = () => {
  isDrawing.value = false
}

const startDrawingTouch = (e: TouchEvent) => {
  const touch = e.touches[0]
  startDrawing({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
}

const drawTouch = (e: TouchEvent) => {
  const touch = e.touches[0]
  draw({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
}

const clearSignature = () => {
  const canvas = signatureCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasDrawnSignature.value = false
}

const getSignatureData = (): string => {
  if (signatureMethod.value === 'type') {
    return typedSignature.value
  }
  if (signatureCanvas.value) {
    return signatureCanvas.value.toDataURL('image/png')
  }
  return ''
}

const submit = async () => {
  console.log('[S13-Frontend] Submit clicked')
  console.log('[S13-Frontend] canSubmit:', canSubmit.value)
  if (!canSubmit.value) {
    console.log('[S13-Frontend] canSubmit is false, aborting')
    return
  }

  processing.value = true
  try {
    const token = authStore.session?.access_token
    console.log('[S13-Frontend] Token present:', !!token)
    if (!token) throw new Error('Not authenticated')

    const signatureData = getSignatureData()
    console.log('[S13-Frontend] Sending request to:', `${API_URL}/api/tenancies/records/${props.tenancyId}/rent-increase-notice`)
    console.log('[S13-Frontend] deliveryMethod:', form.value.deliveryMethod)

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancyId}/rent-increase-notice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newRent: form.value.newRent,
          rentFrequency: form.value.rentFrequency,
          effectiveDate: form.value.effectiveDate,
          deliveryMethod: form.value.deliveryMethod,
          previousS13Date: overridePreviousDate.value ? customPreviousDate.value : previousS13Date.value,
          isFirstS13: !previousS13Date.value,
          charges: form.value.charges,
          signature: signatureData,
          signatureMethod: signatureMethod.value,
          signatoryName: signatoryName.value
        })
      }
    )

    console.log('[S13-Frontend] Response status:', response.status)
    if (!response.ok) {
      const error = await response.json()
      console.log('[S13-Frontend] Error response:', error)
      throw new Error(error.error || 'Failed to serve notice')
    }

    const data = await response.json()
    console.log('[S13-Frontend] Success response:', data)

    if (form.value.deliveryMethod === 'download' && data.pdfUrl) {
      window.open(data.pdfUrl, '_blank')
      toast.success('Section 13 notice generated')
    } else {
      toast.success('Section 13 notice sent to tenant')
      console.log('[S13-Frontend] emailSent:', data.emailSent)
    }

    emit('success')
    emit('close')
  } catch (error: any) {
    console.error('Error serving rent increase notice:', error)
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

// Watch for modal open
watch(() => props.isOpen, async (open) => {
  if (open) {
    // Reset state
    step.value = 1
    form.value = {
      newRent: props.currentRent,
      rentFrequency: 'monthly',
      effectiveDate: '',
      deliveryMethod: props.leadTenantEmail ? 'email' : 'download',
      charges: {
        councilTax: { existing: '', proposed: '' },
        water: { existing: '', proposed: '' },
        serviceCharges: { existing: '', proposed: '' }
      }
    }
    previousS13Date.value = null
    overridePreviousDate.value = false
    customPreviousDate.value = ''
    confirmFirstS13.value = false
    typedSignature.value = ''
    signatoryName.value = ''
    hasDrawnSignature.value = false

    // Load previous S13
    await loadPreviousS13()
  }
})

// Setup canvas when signature step is reached
watch(() => step.value, (newStep) => {
  if (newStep === 5 && signatureMethod.value === 'draw') {
    nextTick(() => setupCanvas())
  }
})

watch(() => signatureMethod.value, (method) => {
  if (method === 'draw' && step.value === 5) {
    nextTick(() => setupCanvas())
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
