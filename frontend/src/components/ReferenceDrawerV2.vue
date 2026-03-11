<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div v-if="open" class="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary/5 to-orange-500/5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {{ reference?.property_address }}, {{ reference?.property_city }}
            </p>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Status Badge -->
        <div class="mt-3 flex items-center gap-2">
          <span
            class="px-3 py-1 text-sm font-medium rounded-full"
            :class="getStatusClass(reference?.status)"
          >
            {{ formatStatus(reference?.status) }}
          </span>
          <span class="text-sm text-gray-500">
            £{{ reference?.monthly_rent }}/month
          </span>
        </div>

        <!-- Send to Landlord - Only show when reference is accepted -->
        <div v-if="hasFinalReport" class="mt-3">
          <button
            @click="openSendToLandlordModal"
            class="w-full px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Send class="w-4 h-4" />
            Send Report to Landlord
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 4" :key="i" class="animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
            <div class="h-20 bg-gray-100 dark:bg-slate-800 rounded"></div>
          </div>
        </div>

        <!-- Reference Details -->
        <div v-else class="space-y-6">
          <!-- Sections -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Verification Sections</h3>
            <div class="space-y-3">
              <div
                v-for="section in fullReference?.sections || []"
                :key="section.section_type"
                class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
              >
                <!-- Section Header (clickable) -->
                <div
                  @click="toggleSection(section.section_type)"
                  class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <component
                      :is="getSectionIcon(section)"
                      class="w-4 h-4"
                      :class="getSectionIconClass(section)"
                    />
                    <span class="font-medium text-gray-900 dark:text-white">
                      {{ getSectionLabel(section.section_type) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="getSectionBadgeClass(section)"
                    >
                      {{ getSectionStatusLabel(section) }}
                    </span>
                    <ChevronDown
                      class="w-4 h-4 text-gray-400 transition-transform"
                      :class="{ 'rotate-180': expandedSections.has(section.section_type) }"
                    />
                  </div>
                </div>

                <!-- Section Content (expandable) -->
                <Transition
                  enter-active-class="transition-all duration-200 ease-out"
                  enter-from-class="max-h-0 opacity-0"
                  enter-to-class="max-h-[500px] opacity-100"
                  leave-active-class="transition-all duration-150 ease-in"
                  leave-from-class="max-h-[500px] opacity-100"
                  leave-to-class="max-h-0 opacity-0"
                >
                  <div v-if="expandedSections.has(section.section_type)" class="border-t border-gray-200 dark:border-slate-700">
                    <div class="p-4 bg-gray-50 dark:bg-slate-800/30 space-y-3">
                      <!-- Section Notes -->
                      <p v-if="section.notes" class="text-sm text-gray-600 dark:text-slate-400 italic">
                        {{ section.notes }}
                      </p>

                      <!-- Section Data -->
                      <div v-if="getSectionFormData(section.section_type)" class="space-y-2">
                        <div
                          v-for="(value, key) in getSectionFormData(section.section_type)"
                          :key="key"
                          class="flex justify-between text-sm"
                        >
                          <span class="text-gray-500 dark:text-slate-400">{{ formatFieldLabel(key as string) }}</span>
                          <span class="text-gray-900 dark:text-white text-right max-w-[60%]">{{ formatFieldValue(value) }}</span>
                        </div>
                      </div>

                      <!-- No Data Message -->
                      <p v-else class="text-sm text-gray-400 dark:text-slate-500 italic">
                        No data submitted yet
                      </p>
                    </div>
                  </div>
                </Transition>
              </div>

              <div v-if="!fullReference?.sections?.length" class="text-center py-8 text-gray-500">
                <FileText class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No sections available yet</p>
              </div>
            </div>
          </div>

          <!-- Tenant Info -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Tenant Information</h3>
            <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Email</span>
                <span class="text-gray-900 dark:text-white">{{ reference?.tenant_email }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Phone</span>
                <span class="text-gray-900 dark:text-white">{{ reference?.tenant_phone || 'Not provided' }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Rent Share</span>
                <span class="text-gray-900 dark:text-white">£{{ reference?.rent_share || reference?.monthly_rent }}/month</span>
              </div>
            </div>
          </div>

          <!-- Property Info -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Property</h3>
            <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
              <p class="font-medium text-gray-900 dark:text-white">{{ reference?.property_address }}</p>
              <p class="text-sm text-gray-500">{{ reference?.property_city }}, {{ reference?.property_postcode }}</p>
              <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span v-if="reference?.move_in_date">
                  Move in: {{ formatDate(reference.move_in_date) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div class="flex gap-3">
          <button
            @click="showDeleteConfirm = true"
            class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
          >
            <Trash2 class="w-4 h-4" />
            Delete
          </button>
          <button
            v-if="canResendEmail"
            @click="resendReferenceEmail"
            :disabled="resendingEmail"
            class="px-4 py-2 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="resendingEmail" class="w-4 h-4 animate-spin" />
            <RefreshCw v-else class="w-4 h-4" />
            {{ resendingEmail ? 'Sending...' : 'Resend Email' }}
          </button>
          <button
            v-if="canMakeDecision"
            @click="showDecisionModal = true"
            class="flex-1 px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Make Decision
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Delete Confirmation Modal -->
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" @click="showDeleteConfirm = false"></div>
      <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Reference</h3>
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Are you sure you want to delete this reference for <strong>{{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}</strong>?
        </p>

        <!-- Credit refund info -->
        <div v-if="!formSubmitted" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p class="text-sm text-green-700 dark:text-green-400">
            <strong>Credit will be refunded</strong> - the tenant has not yet submitted their form.
          </p>
        </div>
        <div v-else class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p class="text-sm text-amber-700 dark:text-amber-400">
            <strong>No credit refund</strong> - the tenant has already submitted their form and checks have been performed.
          </p>
        </div>

        <div class="flex gap-3">
          <button
            @click="showDeleteConfirm = false"
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            @click="deleteReference"
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="deleting" class="w-4 h-4 animate-spin" />
            {{ deleting ? 'Deleting...' : 'Delete Reference' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Send to Landlord Modal -->
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showSendToLandlordModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" @click="showSendToLandlordModal = false"></div>
      <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Send Reference to Landlord</h3>

        <!-- Success State -->
        <div v-if="sendToLandlordSuccess" class="text-center py-6">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check class="w-8 h-8 text-green-600" />
          </div>
          <p class="text-green-600 font-medium">Reference summary sent successfully!</p>
        </div>

        <!-- Form -->
        <div v-else>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Send a summary of this reference to the landlord. Contact details will be excluded for privacy.
          </p>

          <!-- Landlord Email -->
          <div v-if="landlordEmailInfo.hasLandlord" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-sm text-green-700 dark:text-green-400">
              <strong>Linked landlord:</strong> {{ landlordEmailInfo.name }}
            </p>
            <p class="text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
              <Mail class="w-4 h-4" />
              {{ landlordEmailInfo.email }}
            </p>
          </div>

          <div v-else class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Landlord Email
            </label>
            <input
              v-model="manualLandlordEmail"
              type="email"
              placeholder="Enter landlord email address"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
              No landlord linked to this property. Enter email manually.
            </p>
          </div>

          <!-- Error Message -->
          <div v-if="sendToLandlordError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400">{{ sendToLandlordError }}</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              @click="showSendToLandlordModal = false"
              class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="sendToLandlord"
              :disabled="sendingToLandlord || (!landlordEmailInfo.email && !manualLandlordEmail)"
              class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="sendingToLandlord">Sending...</span>
              <span v-else class="flex items-center gap-2">
                <Send class="w-4 h-4" />
                Send
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      @click="$emit('close')"
      class="fixed inset-0 bg-black/30 z-40"
    />
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, Check, Clock, AlertCircle, XCircle, FileText, Send, Mail, RefreshCw, Loader2, ChevronDown, Trash2 } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'

const props = defineProps<{
  reference: any
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(false)
const fullReference = ref<any>(null)
const showDecisionModal = ref(false)
const resendingEmail = ref(false)
const showSendToLandlordModal = ref(false)
const sendingToLandlord = ref(false)
const landlordEmailInfo = ref<{ hasLandlord: boolean; email: string | null; name: string | null }>({ hasLandlord: false, email: null, name: null })
const manualLandlordEmail = ref('')
const sendToLandlordSuccess = ref(false)
const sendToLandlordError = ref('')
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const expandedSections = ref<Set<string>>(new Set())

// Check if form has been submitted (for credit refund logic)
const formSubmitted = computed(() => {
  return !!(fullReference.value?.reference?.form_submitted_at || props.reference?.form_submitted_at)
})

// Toggle section expansion
function toggleSection(sectionType: string) {
  if (expandedSections.value.has(sectionType)) {
    expandedSections.value.delete(sectionType)
  } else {
    expandedSections.value.add(sectionType)
  }
  expandedSections.value = new Set(expandedSections.value) // Trigger reactivity
}

// Map section type to form_data key
function getSectionFormDataKey(sectionType: string): string {
  const keyMap: Record<string, string> = {
    'IDENTITY': 'identity',
    'RTR': 'rightToRent',
    'INCOME': 'income',
    'RESIDENTIAL': 'residential',
    'CREDIT': 'credit',
    'AML': 'aml'
  }
  return keyMap[sectionType] || sectionType.toLowerCase()
}

// Get form data for a section
function getSectionFormData(sectionType: string): Record<string, any> | null {
  const formData = fullReference.value?.reference?.form_data
  if (!formData) return null

  const key = getSectionFormDataKey(sectionType)
  const sectionData = formData[key]

  if (!sectionData || typeof sectionData !== 'object') return null

  // Filter out internal/meta fields
  const filtered: Record<string, any> = {}
  for (const [k, v] of Object.entries(sectionData)) {
    if (!k.startsWith('_') && v !== null && v !== undefined && v !== '') {
      filtered[k] = v
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : null
}

// Format field label from camelCase
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

// Format field value for display
function formatFieldValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const canMakeDecision = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  return status === 'READY_FOR_REVIEW' || status === 'IN_REVIEW'
})

const hasFinalReport = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  return ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(status)
})

const canResendEmail = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  // Can resend if reference is still pending tenant submission
  return ['SENT', 'COLLECTING_EVIDENCE', 'ACTION_REQUIRED'].includes(status)
})

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.reference?.id) {
    await fetchFullReference()
  }
})

async function fetchFullReference() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      fullReference.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching reference:', error)
  } finally {
    loading.value = false
  }
}

async function fetchLandlordEmail() {
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/landlord-email`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      landlordEmailInfo.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching landlord email:', error)
  }
}

async function openSendToLandlordModal() {
  sendToLandlordSuccess.value = false
  sendToLandlordError.value = ''
  manualLandlordEmail.value = ''
  await fetchLandlordEmail()
  showSendToLandlordModal.value = true
}

async function sendToLandlord() {
  sendingToLandlord.value = true
  sendToLandlordError.value = ''
  sendToLandlordSuccess.value = false

  try {
    const emailToUse = landlordEmailInfo.value.email || manualLandlordEmail.value
    if (!emailToUse) {
      sendToLandlordError.value = 'Please enter a landlord email address'
      return
    }

    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/send-to-landlord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        landlordEmail: landlordEmailInfo.value.email ? null : manualLandlordEmail.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      sendToLandlordError.value = data.error || 'Failed to send to landlord'
      return
    }

    sendToLandlordSuccess.value = true
    setTimeout(() => {
      showSendToLandlordModal.value = false
    }, 2000)
  } catch (error: any) {
    console.error('Error sending to landlord:', error)
    sendToLandlordError.value = error.message || 'Failed to send to landlord'
  } finally {
    sendingToLandlord.value = false
  }
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    'SENT': 'Sent',
    'COLLECTING_EVIDENCE': 'Collecting Evidence',
    'READY_FOR_REVIEW': 'Ready for Review',
    'IN_REVIEW': 'In Review',
    'ACTION_REQUIRED': 'Action Required',
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted (Guarantor)',
    'ACCEPTED_ON_CONDITION': 'Accepted (Condition)',
    'REJECTED': 'Rejected'
  }
  return labels[status] || status
}

function getStatusClass(status: string) {
  if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(status)) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (status === 'IN_REVIEW' || status === 'READY_FOR_REVIEW') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  }
  if (status === 'COLLECTING_EVIDENCE') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (status === 'ACTION_REQUIRED') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
}

function getSectionLabel(type: string) {
  const labels: Record<string, string> = {
    'IDENTITY': 'Identity Verification',
    'RTR': 'Right to Rent',
    'INCOME': 'Income Verification',
    'RESIDENTIAL': 'Residential History',
    'CREDIT': 'Credit Check',
    'AML': 'AML Check'
  }
  return labels[type] || type
}

function getSectionStatusLabel(section: any) {
  if (section.decision === 'PASS') return 'Passed'
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return 'Failed'
  if (section.status === 'IN_REVIEW') return 'In Review'
  if (section.is_ready_for_review) return 'Ready for Review'
  if (section.status === 'COLLECTING') return 'Collecting'
  return 'Pending'
}

function getSectionIcon(section: any) {
  if (section.decision === 'PASS') return Check
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return XCircle
  if (section.status === 'IN_REVIEW') return Clock
  if (section.is_ready_for_review) return AlertCircle
  return Clock
}

function getSectionIconClass(section: any) {
  if (section.decision === 'PASS') return 'text-green-600'
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return 'text-red-600'
  if (section.status === 'IN_REVIEW') return 'text-blue-600'
  if (section.is_ready_for_review) return 'text-amber-600'
  return 'text-gray-400'
}

function getSectionBadgeClass(section: any) {
  if (section.decision === 'PASS') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (section.decision === 'FAIL' || section.decision === 'REJECT') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (section.status === 'IN_REVIEW') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (section.is_ready_for_review) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

async function resendReferenceEmail() {
  resendingEmail.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/resend-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to resend email')
      return
    }

    toast.success('Reference request email resent successfully')
    emit('updated')
  } catch (error: any) {
    console.error('Error resending email:', error)
    toast.error(error.message || 'Failed to resend email')
  } finally {
    resendingEmail.value = false
  }
}

async function deleteReference() {
  deleting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to delete reference')
      return
    }

    const message = data.creditRefunded
      ? 'Reference deleted and credit refunded'
      : 'Reference deleted'
    toast.success(message)

    showDeleteConfirm.value = false
    emit('close')
    emit('updated')
  } catch (error: any) {
    console.error('Error deleting reference:', error)
    toast.error(error.message || 'Failed to delete reference')
  } finally {
    deleting.value = false
  }
}
</script>
