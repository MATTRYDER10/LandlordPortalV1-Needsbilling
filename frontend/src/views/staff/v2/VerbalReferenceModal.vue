<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full my-8 shadow-2xl">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">Record Verbal Reference</h2>
                <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {{ item?.referee_type }} Reference - {{ item?.tenant_name }}
                </p>
              </div>
              <button
                @click="$emit('close')"
                class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 max-h-[60vh] overflow-y-auto">
            <!-- Call Details -->
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <h3 class="font-semibold text-blue-800 dark:text-blue-300 mb-3">Call Details</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Referee Name</label>
                  <input
                    v-model="form.refereeName"
                    type="text"
                    :placeholder="item?.referee_name"
                    class="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Position/Role</label>
                  <input
                    v-model="form.refereePosition"
                    type="text"
                    placeholder="e.g. HR Manager"
                    class="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Phone Number</label>
                  <input
                    v-model="form.refereePhone"
                    type="tel"
                    :placeholder="item?.referee_phone"
                    class="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Call Date/Time</label>
                  <input
                    v-model="form.callDatetime"
                    type="datetime-local"
                    class="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Reference Form Fields -->
            <template v-if="item?.referee_type === 'EMPLOYER'">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Employment Details</h3>
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Title *</label>
                    <input
                      v-model="form.jobTitle"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employment Type *</label>
                    <select
                      v-model="form.employmentType"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      <option value="PERMANENT">Permanent</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="TEMPORARY">Temporary</option>
                      <option value="PART_TIME">Part Time</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Start Date *</label>
                    <input
                      v-model="form.startDate"
                      type="date"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Salary (£) *</label>
                    <input
                      v-model.number="form.annualSalary"
                      type="number"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Is employment ongoing? *</label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2">
                      <input v-model="form.isOngoing" type="radio" :value="true" class="text-primary" />
                      <span>Yes</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.isOngoing" type="radio" :value="false" class="text-primary" />
                      <span>No</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any issues or concerns?</label>
                  <textarea
                    v-model="form.concerns"
                    rows="2"
                    placeholder="Note any issues mentioned..."
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </template>

            <template v-else-if="item?.referee_type === 'LANDLORD' || item?.referee_type === 'AGENT'">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Tenancy Details</h3>
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy Start Date *</label>
                    <input
                      v-model="form.tenancyStartDate"
                      type="date"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy End Date</label>
                    <input
                      v-model="form.tenancyEndDate"
                      type="date"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent (£) *</label>
                  <input
                    v-model.number="form.monthlyRent"
                    type="number"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rent paid on time? *</label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2">
                      <input v-model="form.rentOnTime" type="radio" value="ALWAYS" class="text-primary" />
                      <span>Always</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.rentOnTime" type="radio" value="MOSTLY" class="text-primary" />
                      <span>Mostly</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.rentOnTime" type="radio" value="SOMETIMES" class="text-primary" />
                      <span>Sometimes Late</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.rentOnTime" type="radio" value="OFTEN_LATE" class="text-primary" />
                      <span>Often Late</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any rent arrears?</label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2">
                      <input v-model="form.hasArrears" type="radio" :value="false" class="text-primary" />
                      <span>No</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.hasArrears" type="radio" :value="true" class="text-primary" />
                      <span>Yes</span>
                    </label>
                  </div>
                  <input
                    v-if="form.hasArrears"
                    v-model.number="form.arrearsAmount"
                    type="number"
                    placeholder="Amount (£)"
                    class="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Would you rent to them again? *</label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2">
                      <input v-model="form.wouldRentAgain" type="radio" :value="true" class="text-primary" />
                      <span>Yes</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="form.wouldRentAgain" type="radio" :value="false" class="text-primary" />
                      <span>No</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any issues or concerns?</label>
                  <textarea
                    v-model="form.concerns"
                    rows="2"
                    placeholder="Note any issues mentioned..."
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </template>

            <!-- Assessor Notes -->
            <div class="mt-6">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Assessor Notes</label>
              <textarea
                v-model="form.assessorNotes"
                rows="2"
                placeholder="Internal notes about this verbal reference..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3">
            <button
              @click="$emit('close')"
              class="flex-1 py-2.5 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              @click="submitVerbal"
              :disabled="!canSubmit || submitting"
              class="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
              {{ submitting ? 'Saving...' : 'Save Verbal Reference' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, Loader2 } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

const props = defineProps<{
  item: any
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const submitting = ref(false)

const form = reactive({
  // Call details
  refereeName: '',
  refereePosition: '',
  refereePhone: '',
  callDatetime: '',

  // Employer fields
  jobTitle: '',
  employmentType: '',
  startDate: '',
  annualSalary: null as number | null,
  isOngoing: true,

  // Landlord fields
  tenancyStartDate: '',
  tenancyEndDate: '',
  monthlyRent: null as number | null,
  rentOnTime: '',
  hasArrears: false,
  arrearsAmount: null as number | null,
  wouldRentAgain: true,

  // Common
  concerns: '',
  assessorNotes: ''
})

const canSubmit = computed(() => {
  if (!form.refereeName || !form.refereePhone || !form.callDatetime) return false

  if (props.item?.referee_type === 'EMPLOYER') {
    return form.jobTitle && form.employmentType && form.startDate && form.annualSalary
  }

  if (props.item?.referee_type === 'LANDLORD' || props.item?.referee_type === 'AGENT') {
    return form.tenancyStartDate && form.monthlyRent && form.rentOnTime && form.wouldRentAgain !== undefined
  }

  return true
})

watch(() => props.open, (isOpen) => {
  if (isOpen && props.item) {
    // Pre-fill from item
    form.refereeName = props.item.referee_name || ''
    form.refereePhone = props.item.referee_phone || ''
    form.callDatetime = new Date().toISOString().slice(0, 16)
  }
})

async function submitVerbal() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/chase/${props.item.id}/verbal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        referee: {
          name: form.refereeName,
          position: form.refereePosition,
          phone: form.refereePhone
        },
        callDatetime: form.callDatetime,
        responses: props.item.referee_type === 'EMPLOYER'
          ? {
              job_title: form.jobTitle,
              employment_type: form.employmentType,
              start_date: form.startDate,
              annual_salary: form.annualSalary,
              is_ongoing: form.isOngoing,
              concerns: form.concerns
            }
          : {
              tenancy_start_date: form.tenancyStartDate,
              tenancy_end_date: form.tenancyEndDate,
              monthly_rent: form.monthlyRent,
              rent_on_time: form.rentOnTime,
              has_arrears: form.hasArrears,
              arrears_amount: form.arrearsAmount,
              would_rent_again: form.wouldRentAgain,
              concerns: form.concerns
            },
        assessorNotes: form.assessorNotes
      })
    })

    if (response.ok) {
      emit('submitted')
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to save verbal reference')
    }
  } catch (error) {
    console.error('Error saving verbal reference:', error)
    alert('Failed to save verbal reference')
  } finally {
    submitting.value = false
  }
}
</script>
