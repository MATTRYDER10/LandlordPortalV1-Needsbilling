<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div
        class="inline-block align-bottom bg-white dark:bg-slate-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
        @click.stop
      >
        <div class="bg-white dark:bg-slate-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ isEdit ? 'Edit Landlord' : 'Add new landlord' }}
            </h3>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-500"
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Is landlord a company? -->
            <div>
              <label class="flex items-center">
                <input
                  v-model="formData.is_company"
                  type="checkbox"
                  class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Is landlord a company?</span>
              </label>
            </div>

            <!-- Personal Details -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Title</label>
                <select
                  v-model="formData.title"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                >
                  <option value="">Choose title</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Miss">Miss</option>
                  <option value="Ms">Ms</option>
                  <option value="Dr">Dr</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">First name *</label>
                <input
                  v-model="formData.first_name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Middle name(s) (optional)</label>
                <input
                  v-model="formData.middle_name"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Last name *</label>
                <input
                  v-model="formData.last_name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <!-- Company Name (if company) -->
            <div v-if="formData.is_company">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company Name *</label>
              <input
                v-model="formData.company_name"
                type="text"
                :required="formData.is_company"
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <!-- Contact Details -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Preferred email greeting</label>
                <input
                  v-model="formData.preferred_email_greeting"
                  type="text"
                  placeholder="Dear"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Full name (displayed on contracts)</label>
                <input
                  v-model="formData.full_name_displayed_on_contracts"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Phone (optional)</label>
                <input
                  v-model="formData.phone"
                  type="tel"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email *</label>
                <input
                  v-model="formData.email"
                  type="email"
                  required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Date of birth (optional)</label>
                <input
                  v-model="formData.date_of_birth"
                  type="date"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <!-- Residential Address -->
            <div class="border-t dark:border-slate-700 pt-6">
              <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Landlord's residential address</h4>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Country</label>
                  <select
                    v-model="formData.residential_address.country"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Choose Country</option>
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="IE">Ireland</option>
                    <!-- Add more countries as needed -->
                  </select>
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address line 1</label>
                  <input
                    v-model="formData.residential_address.line1"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address line 2</label>
                  <input
                    v-model="formData.residential_address.line2"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Town or city</label>
                  <input
                    v-model="formData.residential_address.city"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Postcode</label>
                  <input
                    v-model="formData.residential_address.postcode"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <!-- Section 48 Address -->
            <div class="border-t dark:border-slate-700 pt-6">
              <div class="flex items-center gap-2 mb-4">
                <h4 class="text-lg font-semibold text-gray-900 dark:text-white">Landlord address in England or Wales (Section 48)</h4>
                <Info class="w-5 h-5 text-blue-500 cursor-help" title="Section 48 address information" />
              </div>
              <label class="flex items-center mb-4">
                <input
                  v-model="formData.has_section48_address"
                  type="checkbox"
                  class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Add a different address for use as a Section 48 address</span>
              </label>
              <div v-if="formData.has_section48_address" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address line 1</label>
                  <input
                    v-model="formData.section48_address.line1"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address line 2</label>
                  <input
                    v-model="formData.section48_address.line2"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">City</label>
                  <input
                    v-model="formData.section48_address.city"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Postcode</label>
                  <input
                    v-model="formData.section48_address.postcode"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Country</label>
                  <select
                    v-model="formData.section48_address.country"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <!-- Add more countries as needed -->
                  </select>
                </div>
              </div>
            </div>

            <!-- Bank Details -->
            <div class="border-t dark:border-slate-700 pt-6">
              <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Landlord bank details</h4>
              <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
                Payments to the landlord will be made using these bank details.
              </p>
              <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
                The landlord bank details will be displayed in contracts and standing order requests for Let Only tenancies. Managed contracts or Let Only + Rent Collect contracts will display the agency's bank details.
              </p>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Account name (optional)</label>
                  <input
                    v-model="formData.bank_details.account_name"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Account number (optional)</label>
                  <input
                    v-model="formData.bank_details.account_number"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Sort code (optional)</label>
                  <div class="flex gap-2 mt-1">
                    <input
                      v-model="formData.bank_details.sort_code_part1"
                      type="text"
                      maxlength="2"
                      placeholder="XX"
                      class="block w-20 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                    />
                    <span class="self-center text-gray-500 dark:text-slate-400">-</span>
                    <input
                      v-model="formData.bank_details.sort_code_part2"
                      type="text"
                      maxlength="2"
                      placeholder="XX"
                      class="block w-20 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                    />
                    <span class="self-center text-gray-500 dark:text-slate-400">-</span>
                    <input
                      v-model="formData.bank_details.sort_code_part3"
                      type="text"
                      maxlength="2"
                      placeholder="XX"
                      class="block w-20 px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label class="flex items-center mt-6">
                    <input
                      v-model="formData.bank_details.is_joint_account"
                      type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                    />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Is this a joint account? (optional)</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Regulatory Information -->
            <div class="border-t dark:border-slate-700 pt-6">
              <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Regulatory information</h4>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Landlord registration number (optional)
                    <a href="#" class="text-blue-500 hover:text-blue-700 ml-1" title="What is this?">What is this?</a>
                  </label>
                  <input
                    v-model="formData.regulatory.landlord_registration_number"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Landlord license number (optional)
                    <a href="#" class="text-blue-500 hover:text-blue-700 ml-1" title="What is this?">What is this?</a>
                  </label>
                  <input
                    v-model="formData.regulatory.landlord_license_number"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="flex items-center">
                    <input
                      v-model="formData.regulatory.agent_sign_on_behalf"
                      type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                    />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Agent to sign on behalf of the landlord</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button
                type="button"
                @click="close"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="submitting"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ submitting ? 'Saving...' : (isEdit ? 'Update Landlord' : 'Add landlord') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { isValidEmail } from '../utils/validation'
import { X, Info } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const props = defineProps<{
  show: boolean
  landlordId?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const submitting = ref(false)
const isEdit = computed(() => !!props.landlordId)

const formData = ref({
  title: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  preferred_email_greeting: 'Dear',
  full_name_displayed_on_contracts: '',
  phone: '',
  email: '',
  date_of_birth: '',
  is_company: false,
  company_name: '',
  residential_address: {
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    country: 'GB'
  },
  has_section48_address: false,
  section48_address: {
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    country: 'GB'
  },
  bank_details: {
    account_name: '',
    account_number: '',
    sort_code_part1: '',
    sort_code_part2: '',
    sort_code_part3: '',
    is_joint_account: false
  },
  regulatory: {
    landlord_registration_number: '',
    landlord_license_number: '',
    agent_sign_on_behalf: false
  }
})

const fetchLandlord = async () => {
  if (!props.landlordId) return

  try {
    const response = await fetch(`${API_URL}/api/landlords/${props.landlordId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch landlord')
    }

    const data = await response.json()
    const landlord = data.landlord

    formData.value = {
      title: landlord.title || '',
      first_name: landlord.first_name || '',
      middle_name: landlord.middle_name || '',
      last_name: landlord.last_name || '',
      preferred_email_greeting: landlord.preferred_email_greeting || 'Dear',
      full_name_displayed_on_contracts: landlord.full_name_displayed_on_contracts || '',
      phone: landlord.phone || '',
      email: landlord.email || '',
      date_of_birth: landlord.date_of_birth || '',
      is_company: landlord.is_company || false,
      company_name: landlord.company_name || '',
      residential_address: {
        line1: landlord.residential_address?.line1 || '',
        line2: landlord.residential_address?.line2 || '',
        city: landlord.residential_address?.city || '',
        postcode: landlord.residential_address?.postcode || '',
        country: landlord.residential_address?.country || 'GB'
      },
      has_section48_address: landlord.has_section48_address || false,
      section48_address: landlord.section48_address || {
        line1: '',
        line2: '',
        city: '',
        postcode: '',
        country: 'GB'
      },
      bank_details: {
        account_name: landlord.bank_details?.account_name || '',
        account_number: landlord.bank_details?.account_number || '',
        sort_code_part1: landlord.bank_details?.sort_code?.split('-')[0] || '',
        sort_code_part2: landlord.bank_details?.sort_code?.split('-')[1] || '',
        sort_code_part3: landlord.bank_details?.sort_code?.split('-')[2] || '',
        is_joint_account: landlord.bank_details?.is_joint_account || false
      },
      regulatory: {
        landlord_registration_number: landlord.regulatory?.landlord_registration_number || '',
        landlord_license_number: landlord.regulatory?.landlord_license_number || '',
        agent_sign_on_behalf: landlord.regulatory?.agent_sign_on_behalf || false
      }
    }
  } catch (err: any) {
    toast.error('Failed to load landlord details')
  }
}

const handleSubmit = async () => {
  submitting.value = true

  // Validate email
  if (!isValidEmail(formData.value.email)) {
    toast.error('Please enter a valid email address')
    submitting.value = false
    return
  }

  try {
    // Combine sort code parts
    const sortCode = formData.value.bank_details.sort_code_part1 &&
      formData.value.bank_details.sort_code_part2 &&
      formData.value.bank_details.sort_code_part3
      ? `${formData.value.bank_details.sort_code_part1}-${formData.value.bank_details.sort_code_part2}-${formData.value.bank_details.sort_code_part3}`
      : ''

    const payload = {
      title: formData.value.title || null,
      first_name: formData.value.first_name,
      middle_name: formData.value.middle_name || null,
      last_name: formData.value.last_name,
      preferred_email_greeting: formData.value.preferred_email_greeting || null,
      full_name_displayed_on_contracts: formData.value.full_name_displayed_on_contracts || null,
      phone: formData.value.phone || null,
      email: formData.value.email,
      date_of_birth: formData.value.date_of_birth || null,
      is_company: formData.value.is_company,
      company_name: formData.value.is_company ? formData.value.company_name : null,
      residential_address: formData.value.residential_address,
      has_section48_address: formData.value.has_section48_address,
      section48_address: formData.value.has_section48_address ? formData.value.section48_address : null,
      bank_details: {
        account_name: formData.value.bank_details.account_name || null,
        account_number: formData.value.bank_details.account_number || null,
        sort_code: sortCode || null,
        is_joint_account: formData.value.bank_details.is_joint_account
      },
      regulatory: formData.value.regulatory
    }

    const url = isEdit.value
      ? `${API_URL}/api/landlords/${props.landlordId}`
      : `${API_URL}/api/landlords`

    const method = isEdit.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save landlord')
    }

    toast.success(isEdit.value ? 'Landlord updated successfully' : 'Landlord created successfully')
    emit('saved')
    close()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save landlord')
  } finally {
    submitting.value = false
  }
}

const close = () => {
  emit('close')
  // Reset form
  formData.value = {
    title: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    preferred_email_greeting: 'Dear',
    full_name_displayed_on_contracts: '',
    phone: '',
    email: '',
    date_of_birth: '',
    is_company: false,
    company_name: '',
    residential_address: {
      line1: '',
      line2: '',
      city: '',
      postcode: '',
      country: 'GB'
    },
    has_section48_address: false,
    section48_address: {
      line1: '',
      line2: '',
      city: '',
      postcode: '',
      country: 'GB'
    },
    bank_details: {
      account_name: '',
      account_number: '',
      sort_code_part1: '',
      sort_code_part2: '',
      sort_code_part3: '',
      is_joint_account: false
    },
    regulatory: {
      landlord_registration_number: '',
      landlord_license_number: '',
      agent_sign_on_behalf: false
    }
  }
}

watch(() => props.show, (newVal) => {
  if (newVal && isEdit.value) {
    fetchLandlord()
  }
})

onMounted(() => {
  if (props.show && isEdit.value) {
    fetchLandlord()
  }
})
</script>

