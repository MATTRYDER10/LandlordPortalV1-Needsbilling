<template>
  <Sidebar>
    <div class="p-6 sm:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Landlords</h2>
          <p class="mt-2 text-gray-600 dark:text-slate-400">Your landlord profile and company landlords</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-20">
          <Loader2 class="w-8 h-8 animate-spin text-primary" />
        </div>

        <div v-else class="space-y-8">

          <!-- ═══════════════ YOUR PROFILE ═══════════════ -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Your Landlord Profile</h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Primary landlord on all tenancies and agreements</p>
                </div>
              </div>
              <button @click="showEditLandlord = true" class="text-sm text-primary hover:text-primary/80 font-medium">Edit</button>
            </div>

            <div v-if="landlordProfile" class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Personal -->
                <div class="space-y-3">
                  <h4 class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Personal Details</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Name</span><span class="text-gray-900 dark:text-white">{{ [landlordProfile.title, landlordProfile.first_name, landlordProfile.last_name].filter(Boolean).join(' ') || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Email</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.email || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Phone</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.phone || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Date of Birth</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.date_of_birth || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Contract Name</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.full_name_displayed_on_contracts || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Greeting</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.preferred_email_greeting || '—' }}</span></div>
                  </div>
                </div>

                <!-- Address + Bank -->
                <div class="space-y-3">
                  <h4 class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Address</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Address</span><span class="text-gray-900 dark:text-white">{{ [landlordProfile.residential_address_line1, landlordProfile.residential_address_line2].filter(Boolean).join(', ') || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">City</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.residential_city || '—' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Postcode</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.residential_postcode || '—' }}</span></div>
                  </div>

                  <h4 class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider pt-3">Bank Details</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Account</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.bank_account_name || 'Not set' }}</span></div>
                    <div class="flex gap-2"><span class="text-gray-400 w-28 flex-shrink-0">Sort Code</span><span class="text-gray-900 dark:text-white">{{ landlordProfile.bank_sort_code || '—' }}</span></div>
                  </div>
                </div>
              </div>

              <!-- AML Status -->
              <div class="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">AML Verification</h4>
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                      :class="amlBadgeClass"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="amlDotClass"></span>
                      {{ amlLabel }}
                    </span>
                  </div>
                  <span v-if="landlordProfile.aml_completed_at" class="text-xs text-gray-400 dark:text-slate-500">
                    Verified {{ new Date(landlordProfile.aml_completed_at).toLocaleDateString('en-GB') }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="p-6 text-center text-gray-500 dark:text-slate-400">
              <p>No landlord profile found. <router-link to="/onboarding" class="text-primary underline">Complete onboarding</router-link></p>
            </div>
          </div>

          <!-- ═══════════════ COMPANIES ═══════════════ -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building2 class="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Your Companies</h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400">
                    SPV or Ltd companies that act as landlords
                    <span class="text-gray-400">({{ companies.length }}/{{ maxCompanies }})</span>
                  </p>
                </div>
              </div>
              <button
                v-if="companies.length < maxCompanies"
                @click="openAddCompany"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                Add Company
              </button>
            </div>

            <div class="divide-y divide-gray-100 dark:divide-slate-700">
              <!-- Company cards -->
              <div
                v-for="company in companies"
                :key="company.id"
                class="p-6 hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ company.company_name }}</h4>
                    <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                      <span v-if="company.registered_address_line1" class="text-gray-600 dark:text-slate-400">
                        {{ company.registered_address_line1 }}, {{ company.registered_city }} {{ company.registered_postcode }}
                      </span>
                      <span v-if="company.directors" class="text-gray-600 dark:text-slate-400">
                        Directors: {{ company.directors }}
                      </span>
                      <span v-if="company.phone" class="text-gray-600 dark:text-slate-400">{{ company.phone }}</span>
                      <span v-if="company.email" class="text-gray-600 dark:text-slate-400">{{ company.email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    <button @click="editCompany(company)" class="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button @click="confirmDeleteCompany(company)" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="companies.length === 0" class="p-8 text-center">
                <Building2 class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p class="text-gray-500 dark:text-slate-400">No companies added yet</p>
                <p class="text-sm text-gray-400 dark:text-slate-500 mt-1">Add an SPV or Ltd company to use as a landlord on agreements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Landlord Modal -->
      <EditLandlordModal
        v-if="showEditLandlord && landlordProfile"
        :landlord="landlordProfile"
        @close="showEditLandlord = false"
        @saved="showEditLandlord = false; refreshData()"
      />

      <!-- Add/Edit Company Modal -->
      <AddEditCompanyModal
        v-if="showCompanyModal"
        :company="editingCompany"
        :max-companies="maxCompanies"
        @close="showCompanyModal = false"
        @saved="onCompanySaved"
      />

      <!-- Delete Confirmation -->
      <div v-if="deletingCompany" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="deletingCompany = null">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Company</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400">
            Are you sure you want to delete <strong>{{ deletingCompany.company_name }}</strong>? This cannot be undone.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="deletingCompany = null" class="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
            <button @click="doDeleteCompany" :disabled="deleting" class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm disabled:opacity-50">
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { getMaxCompanies, type SubscriptionTier } from '../utils/pricing'
import axios from 'axios'
import Sidebar from '../components/Sidebar.vue'
import AddEditCompanyModal from '../components/landlords/AddEditCompanyModal.vue'
import EditLandlordModal from '../components/landlords/EditLandlordModal.vue'
import { User, Building2, Pencil, Trash2, Loader2 } from 'lucide-vue-next'

const showEditLandlord = ref(false)

const API_URL = import.meta.env.VITE_API_URL
const authStore = useAuthStore()

const loading = ref(true)
const landlordProfile = ref<any>(null)
const companies = ref<any[]>([])
const showCompanyModal = ref(false)
const editingCompany = ref<any>(null)
const deletingCompany = ref<any>(null)
const deleting = ref(false)

// Determine tier for company limits
const tier = computed<SubscriptionTier>(() => {
  if (!authStore.hasSubscription) return 'payg'
  // TODO: distinguish standard vs professional from auth store
  return 'standard'
})

const maxCompanies = computed(() => getMaxCompanies(tier.value))

// AML badge
const amlLabel = computed(() => {
  const s = landlordProfile.value?.aml_status
  if (s === 'satisfactory') return 'Verified'
  if (s === 'requested') return 'Pending'
  if (s === 'unsatisfactory') return 'Failed'
  return 'Not Verified'
})
const amlBadgeClass = computed(() => {
  const s = landlordProfile.value?.aml_status
  if (s === 'satisfactory') return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
  if (s === 'requested') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
  if (s === 'unsatisfactory') return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
  return 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
})
const amlDotClass = computed(() => {
  const s = landlordProfile.value?.aml_status
  if (s === 'satisfactory') return 'bg-green-500'
  if (s === 'requested') return 'bg-amber-500'
  if (s === 'unsatisfactory') return 'bg-red-500'
  return 'bg-gray-400'
})



async function refreshData() {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers = { Authorization: `Bearer ${token}` }

    const [profileRes, companiesRes] = await Promise.all([
      axios.get(`${API_URL}/api/landlord-portal/profile`, { headers }),
      axios.get(`${API_URL}/api/landlord-portal/companies`, { headers }),
    ])

    landlordProfile.value = profileRes.data.landlord
    companies.value = companiesRes.data.companies || []
  } catch (err) {
    console.error('Failed to load landlord data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => refreshData())

function openAddCompany() {
  editingCompany.value = null
  showCompanyModal.value = true
}

function editCompany(company: any) {
  editingCompany.value = company
  showCompanyModal.value = true
}

function confirmDeleteCompany(company: any) {
  deletingCompany.value = company
}

async function doDeleteCompany() {
  if (!deletingCompany.value) return
  deleting.value = true
  try {
    const token = authStore.session?.access_token
    await axios.delete(`${API_URL}/api/landlord-portal/companies/${deletingCompany.value.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    companies.value = companies.value.filter(c => c.id !== deletingCompany.value.id)
    deletingCompany.value = null
  } catch (err) {
    console.error('Delete error:', err)
  } finally {
    deleting.value = false
  }
}

async function onCompanySaved() {
  showCompanyModal.value = false
  // Refresh companies
  try {
    const token = authStore.session?.access_token
    const res = await axios.get(`${API_URL}/api/landlord-portal/companies`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    companies.value = res.data.companies || []
  } catch {}
}
</script>
