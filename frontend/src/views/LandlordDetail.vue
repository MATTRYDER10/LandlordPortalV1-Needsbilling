<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading landlord...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="landlord" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button @click="$router.push('/landlords')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
              <ArrowLeft class="w-5 h-5 mr-2" />
              Back to Landlords
            </button>
            <h2 class="text-3xl font-bold text-gray-900">
              {{ landlord.first_name }} {{ landlord.middle_name ? landlord.middle_name + ' ' : '' }}{{
              landlord.last_name }}
            </h2>
            <p class="mt-2 text-gray-600">Complete Landlord Details</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="showEditModal = true"
              class="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
              <Pencil class="w-4 h-4 mr-2" />
              Edit
            </button>
            <span class="px-3 py-1 text-sm font-semibold rounded-full" :class="{
              'bg-green-100 text-green-800': landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed',
              'bg-red-100 text-red-800': landlord.aml_status === 'unsatisfactory' || landlord.aml_status === 'failed',
              'bg-blue-100 text-blue-800': landlord.aml_status === 'requested' || landlord.aml_status === 'pending' || landlord.aml_status === 'submitted',
              'bg-gray-100 text-gray-800': landlord.aml_status === 'not_requested'
            }">
              {{ formatAMLStatus(landlord.aml_status) }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button @click="activeTab = 'overview'" :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]">
              Overview
            </button>
            <button @click="activeTab = 'aml'" :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'aml'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]">
              AML checks
            </button>
          </nav>
        </div>

        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- AML Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">AML</h3>
            </div>
            <div>
              <span class="px-3 py-1 text-sm font-semibold rounded-full inline-flex items-center gap-2" :class="{
                'bg-green-100 text-green-800': landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed',
                'bg-red-100 text-red-800': landlord.aml_status === 'unsatisfactory' || landlord.aml_status === 'failed',
                'bg-blue-100 text-blue-800': landlord.aml_status === 'requested' || landlord.aml_status === 'pending' || landlord.aml_status === 'submitted',
                'bg-gray-100 text-gray-800': landlord.aml_status === 'not_requested'
              }">
                <CheckCircle v-if="landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed'" class="w-4 h-4" />
                {{ formatAMLStatus(landlord.aml_status) }}
              </span>
              <p v-if="landlord.aml_completed_at" class="mt-2 text-sm text-gray-500">
                Completed: {{ formatDate(landlord.aml_completed_at) }}
              </p>
            </div>
          </div>

          <!-- Linked Properties Card (from Properties module) -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Linked Properties</h3>
              <button
                @click="showLinkPropertyModal = true"
                class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                + Link Property
              </button>
            </div>
            <div v-if="landlord.linked_properties && landlord.linked_properties.length > 0" class="space-y-3">
              <router-link
                v-for="lp in landlord.linked_properties"
                :key="lp.id"
                :to="`/properties/${lp.property_id}`"
                class="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div class="flex justify-between items-start">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900">
                      {{ getPropertyDisplayAddress(lp) }}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span v-if="lp.property_type" class="capitalize">{{ lp.property_type }}</span>
                      <span v-if="lp.number_of_bedrooms">{{ lp.number_of_bedrooms }} bed</span>
                      <span :class="lp.status === 'in_tenancy' ? 'text-green-600' : 'text-gray-500'">
                        {{ lp.status === 'in_tenancy' ? 'In Tenancy' : 'Vacant' }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 ml-3">
                    <span v-if="lp.is_primary_contact"
                      class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Primary
                    </span>
                    <span class="text-sm font-semibold text-gray-900 bg-gray-200 px-2 py-0.5 rounded">
                      {{ lp.ownership_percentage }}%
                    </span>
                  </div>
                </div>
                <!-- Ownership bar -->
                <div class="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full" :style="{ width: `${lp.ownership_percentage}%` }"></div>
                </div>
              </router-link>
            </div>
            <div v-else class="text-sm text-gray-500">
              No properties linked to this landlord
            </div>
          </div>

          <!-- Legacy Properties Card (if any exist) -->
          <div v-if="landlord.properties && landlord.properties.length > 0" class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Properties (Legacy)</h3>
              <button @click="showAddPropertyModal = true"
                class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80">
                + Add
              </button>
            </div>
            <div class="space-y-3">
              <div v-for="property in landlord.properties" :key="property.id" class="p-3 bg-gray-50 rounded-lg">
                <div class="text-sm font-medium text-gray-900">
                  {{ property.address.line1 }}{{ property.address.line2 ? ', ' + property.address.line2 : '' }}
                </div>
                <div class="text-sm text-gray-600">
                  {{ property.address.city }}, {{ property.address.postcode }}
                </div>
              </div>
            </div>
          </div>

          <!-- Details Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">Name</label>
                <p class="mt-1 text-sm text-gray-900">
                  {{ landlord.title ? landlord.title + ' ' : '' }}{{ landlord.first_name }} {{ landlord.middle_name ?
                  landlord.middle_name + ' ' : '' }}{{ landlord.last_name }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Email</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.email }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Phone</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.phone || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Date of Birth</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.date_of_birth ? formatDate(landlord.date_of_birth) :
                  'Not provided' }}</p>
              </div>
            </div>
          </div>

          <!-- Residential Address Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Residential Address</h3>
            <div class="space-y-2">
              <p class="text-sm text-gray-900">
                {{ landlord.residential_address.line1 }}{{ landlord.residential_address.line2 ? ', ' +
                landlord.residential_address.line2 : '' }}
              </p>
              <p class="text-sm text-gray-900">
                {{ landlord.residential_address.city }}, {{ landlord.residential_address.postcode }}
              </p>
              <p class="text-sm text-gray-900">{{ landlord.residential_address.country || 'GB' }}</p>
            </div>
          </div>

          <!-- Bank Details Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Landlord bank details</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">Account name</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.account_name || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Account number</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.account_number || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Sort code</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.sort_code || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Joint account</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.is_joint_account ? 'Yes' : 'No' }}</p>
              </div>
            </div>
          </div>

          <!-- Regulatory Information Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Regulatory information</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">
                  Landlord registration number (optional)
                  <span class="text-blue-500 hover:text-blue-700 ml-1"
                    title="In Wales we require a Rent Smart Wales License Number, In England we require the Landlord’s registration number (From Feb 27th 2026)">What
                    is this?</span>
                </label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.regulatory.landlord_registration_number ||
                  'Notprovided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">
                  Landlord license number (optional)
                  <span class="text-blue-500 hover:text-blue-700 ml-1"
                    title="In Wales we require a Rent Smart Wales License Number, In England we require the Landlord’s registration number (From Feb 27th 2026)">What
                    is this?</span>
                </label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.regulatory.landlord_license_number || 'Not provided'
                  }}</p>
              </div>
              <div class="sm:col-span-2">
                <label class="flex items-center">
                  <input type="checkbox" :checked="landlord.regulatory.agent_sign_on_behalf" disabled
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
                  <span class="ml-2 text-sm text-gray-700">Agent to sign on behalf of the landlord</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- AML Checks Tab -->
        <div v-if="activeTab === 'aml'" class="space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">AML Check Status</h3>
              <button id="aml-request" @click="requestIdVerification" :disabled="initiatingAML"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                {{ initiatingAML ? 'Sending...' : landlord.aml_check ? 'Resend Verification Request' : 'Request ID Verification'
                }}
              </button>
            </div>

            <div v-if="landlord.aml_check">
              <!-- Top Summary (Status + Identity Match + Risk Level + Score) -->
              <section class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <header class="mb-6 border-b border-gray-100 pb-6">
                  <h2 class="text-lg font-semibold text-gray-900 mb-1">Verification Result</h2>
                </header>

                <!-- <div class="flex flex-wrap justify-between gap-6">
                 
                  <div class="flex flex-col gap-4 min-w-[240px]">
                    
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</span>
                      <span :class="badgeClass(landlord.aml_check.verification_status)">
                        {{ formatAMLStatus(landlord.aml_check.verification_status) }}
                      </span>
                    </div>

                   
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Identity Match</span>
                      <span :class="badgeClass(identityMatchLabel)">
                        {{ identityMatchLabel }}
                      </span>
                    </div>

                  </div>
                </div> -->

                <!-- Compliance Screening -->
                <div class="mt-10">
                  <h3 class="text-base font-semibold text-gray-800">Compliance Screening</h3>
                  <div class="mt-4 divide-y divide-gray-100">
                    <!-- PEP Check -->
                    <div class="flex items-center justify-between py-4">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">Politically Exposed Person (PEP)</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span :class="statusClass(getComplianceStatus(landlord.aml_check.pep_check_result))">
                          {{ getComplianceStatus(landlord.aml_check.pep_check_result) }}
                        </span>
                        <span
                          :class="statusIconWrapper(getComplianceStatus(landlord.aml_check.pep_check_result))">
                          <Check v-if="landlord.aml_check.pep_check_result === false" class="h-4 w-4 text-emerald-600" />
                          <X v-else-if="landlord.aml_check.pep_check_result === true" class="h-4 w-4 text-rose-500" />
                          <Minus v-else class="h-4 w-4 text-slate-500" />
                        </span>
                      </div>
                    </div>

                    <!-- Sanctions Check -->
                    <div class="flex items-center justify-between py-4">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">Sanctions Screening</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span
                          :class="statusClass(getComplianceStatus(landlord.aml_check.sanctions_check_result))">
                          {{ getComplianceStatus(landlord.aml_check.sanctions_check_result) }}
                        </span>
                        <span :class="statusIconWrapper(
                          getComplianceStatus(landlord.aml_check.sanctions_check_result)
                        )
                          ">
                          <Check v-if="landlord.aml_check.sanctions_check_result === false" class="h-4 w-4 text-emerald-600" />
                          <X v-else-if="landlord.aml_check.sanctions_check_result === true" class="h-4 w-4 text-rose-500" />
                          <Minus v-else class="h-4 w-4 text-slate-500" />
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                <div v-if="landlord.aml_check.verified_at" class="mt-6 border-t border-gray-100 pt-4">
                  <label class="block text-sm font-medium text-gray-500">Verified At</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ formatDateTime(landlord.aml_check.verified_at) }}
                  </p>
                </div>

                <!-- ID Document and Selfie -->
                <div v-if="landlord.aml_check.id_document_path || landlord.aml_check.selfie_path" class="mt-10">
                  <h3 class="text-base font-semibold text-gray-800">Uploaded Documents</h3>
                  <div class="mt-4 grid gap-6 sm:grid-cols-2">
                    <!-- ID Document -->
                    <div v-if="landlord.aml_check.id_document_path" class="rounded-lg border border-gray-200 p-4">
                      <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-medium text-gray-700">ID Document</span>
                        <span v-if="landlord.aml_check.id_document_type" class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {{ landlord.aml_check.id_document_type === 'driving_licence' ? 'Driving Licence' : 'Passport' }}
                        </span>
                      </div>
                      <div class="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          v-if="idDocumentUrl"
                          :src="idDocumentUrl"
                          alt="ID Document"
                          class="w-full h-full object-contain"
                        />
                        <div v-else class="flex items-center justify-center h-full">
                          <FileText class="w-12 h-12 text-gray-400" />
                        </div>
                      </div>
                      <a
                        v-if="idDocumentUrl"
                        :href="idDocumentUrl"
                        target="_blank"
                        class="mt-2 inline-flex items-center text-sm text-primary hover:text-primary/80"
                      >
                        <ExternalLink class="w-4 h-4 mr-1" />
                        View Full Size
                      </a>
                    </div>

                    <!-- Selfie -->
                    <div v-if="landlord.aml_check.selfie_path" class="rounded-lg border border-gray-200 p-4">
                      <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-medium text-gray-700">Selfie</span>
                      </div>
                      <div class="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          v-if="selfieUrl"
                          :src="selfieUrl"
                          alt="Selfie"
                          class="w-full h-full object-contain"
                        />
                        <div v-else class="flex items-center justify-center h-full">
                          <User class="w-12 h-12 text-gray-400" />
                        </div>
                      </div>
                      <a
                        v-if="selfieUrl"
                        :href="selfieUrl"
                        target="_blank"
                        class="mt-2 inline-flex items-center text-sm text-primary hover:text-primary/80"
                      >
                        <ExternalLink class="w-4 h-4 mr-1" />
                        View Full Size
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div v-else class="text-sm text-gray-500">
              No AML check has been initiated yet.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <AddEditLandlordModal v-if="showEditModal" :show="showEditModal" :landlord-id="landlord?.id"
      @close="showEditModal = false" @saved="handleLandlordSaved" />

    <!-- Link Property Modal -->
    <LinkPropertyModal
      v-if="landlord"
      :show="showLinkPropertyModal"
      :landlord-id="landlord.id"
      :landlord-name="`${landlord.first_name} ${landlord.last_name}`"
      @close="showLinkPropertyModal = false"
      @saved="handlePropertyLinked"
    />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { ArrowLeft, Pencil, CheckCircle, Check, X, Minus, FileText, User, ExternalLink } from 'lucide-vue-next'
import Sidebar from '../components/Sidebar.vue'
import AddEditLandlordModal from '../components/AddEditLandlordModal.vue'
import LinkPropertyModal from '../components/landlords/LinkPropertyModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate, formatDateTime as formatUkDateTime } from '../utils/date'

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const error = ref('')
const landlord = ref<any>(null)
const activeTab = ref('overview')
const showEditModal = ref(false)
const showAddPropertyModal = ref(false)
const showLinkPropertyModal = ref(false)
const initiatingAML = ref(false)

// Document blob URLs for displaying images
const idDocumentBlobUrl = ref<string | null>(null)
const selfieBlobUrl = ref<string | null>(null)

const idDocumentUrl = computed(() => idDocumentBlobUrl.value)
const selfieUrl = computed(() => selfieBlobUrl.value)

const loadDocumentAsBlob = async (landlordId: string, docType: 'id' | 'selfie'): Promise<string | null> => {
  const token = authStore.session?.access_token
  if (!token) return null

  try {
    const url = `${API_URL}/api/landlords/${landlordId}/document/${docType}`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) return null

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error(`Error loading ${docType} document:`, error)
    return null
  }
}

type Tone = 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700'
}

const subtleToneClasses: Record<Tone, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-slate-600'
}

const detectTone = (value?: string): Tone => {
  const normalized = (value ?? '').toLowerCase()
  if (['pass', 'passed', 'match', 'low', 'clear', 'success', 'no', 'found'].some((word) => normalized.includes(word))) {
    return 'success'
  }
  if (['fail', 'failed', 'high', 'risk', 'alert', 'adverse'].some((word) => normalized.includes(word))) {
    return 'danger'
  }
  if (['pending', 'medium', 'review', 'assessed', 'partial'].some((word) => normalized.includes(word))) {
    return 'warning'
  }
  return 'info'
}

const statusClass = (value?: string) => `text-sm font-semibold ${subtleToneClasses[detectTone(value)]}`

const statusIconWrapper = (value?: string) =>
  `flex h-8 w-8 items-center justify-center rounded-full border ${toneClasses[detectTone(value)]}`

const getComplianceStatus = (value?: boolean | null) => {
  if (value === null || value === undefined) return 'Pending'
  return value === false ? 'Clear' : 'Failed'
}

const fetchLandlord = async () => {
  loading.value = true
  error.value = ''

  try {
    const landlordId = route.params.id as string
    const response = await fetch(`${API_URL}/api/landlords/${landlordId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch landlord')
    }

    const data = await response.json()
    landlord.value = data.landlord

    // Load document images if available
    if (landlord.value?.aml_check?.id_document_path) {
      idDocumentBlobUrl.value = await loadDocumentAsBlob(landlord.value.id, 'id')
    }
    if (landlord.value?.aml_check?.selfie_path) {
      selfieBlobUrl.value = await loadDocumentAsBlob(landlord.value.id, 'selfie')
    }

    // Check if edit mode
    if (route.query.edit === 'true') {
      showEditModal.value = true
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load landlord'
    toast.error('Failed to load landlord')
  } finally {
    loading.value = false
  }
}

const requestIdVerification = async () => {
  if (!landlord.value) return

  initiatingAML.value = true

  try {
    const response = await fetch(`${API_URL}/api/landlords/${landlord.value.id}/request-id-verification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send verification request')
    }

    toast.success('Verification request sent to landlord.')
    fetchLandlord()
    initiatingAML.value = false
  } catch (err: any) {
    toast.error(err.message || 'Failed to send verification request')
  } finally {
    initiatingAML.value = false
  }
}

const handleLandlordSaved = () => {
  showEditModal.value = false
  fetchLandlord()
}

const handlePropertyLinked = async () => {
  showLinkPropertyModal.value = false
  await fetchLandlord()
}

const formatAMLStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    'not_requested': 'Not Requested',
    'requested': 'Requested',
    'pending': 'Pending',
    'submitted': 'Submitted',
    'passed': 'Passed',
    'failed': 'Failed',
    'verified': 'Verified',
    'satisfactory': 'AML Satisfactory',
    'unsatisfactory': 'AML Unsatisfactory'
  }
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDate = (dateString?: string | null, fallback = 'n/a') =>
  formatUkDate(
    dateString,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    },
    fallback
  )

const formatDateTime = (dateString?: string | null, fallback = 'n/a') =>
  formatUkDateTime(
    dateString,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    fallback
  )

const getPropertyDisplayAddress = (lp: any) => {
  if (!lp.address) return lp.postcode || 'Unknown address'
  if (lp.address.full_address) return lp.address.full_address
  if (lp.address.line1) {
    let addr = lp.address.line1
    if (lp.address.city) addr += `, ${lp.address.city}`
    if (lp.address.postcode) addr += `, ${lp.address.postcode}`
    return addr
  }
  return lp.address.postcode || 'Unknown address'
}

onMounted(() => {
  if (route.query.tab === 'aml') {
    activeTab.value = 'aml'
  }

  if (route.hash === '#aml-request') {
    nextTick(() => {
      const button = document.getElementById('aml-request')
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' })
        button.focus()
      }
    })
  }

  fetchLandlord()
})
</script>
