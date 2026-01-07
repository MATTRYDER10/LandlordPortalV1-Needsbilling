<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading property...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="property" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button @click="$router.push('/properties')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
              <ArrowLeft class="w-5 h-5 mr-2" />
              Back to Properties
            </button>
            <h2 class="text-3xl font-bold text-gray-900">
              {{ displayAddress }}
            </h2>
            <p class="mt-2 text-gray-600">{{ property.address.postcode }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="showEditModal = true"
              class="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
              <Pencil class="w-4 h-4 mr-2" />
              Edit
            </button>
            <span class="px-3 py-1 text-sm font-semibold rounded-full" :class="{
              'bg-green-100 text-green-800': property.status === 'in_tenancy',
              'bg-gray-100 text-gray-800': property.status === 'vacant'
            }">
              {{ property.status === 'in_tenancy' ? 'In Tenancy' : 'Vacant' }}
            </span>
          </div>
        </div>

        <!-- Three Column Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left Column: Compliance -->
          <div class="lg:col-span-3 space-y-4">
            <div class="bg-white rounded-lg shadow p-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Compliance</h3>
                <button @click="showAddComplianceModal = true"
                  class="text-sm text-primary hover:text-primary/80">
                  + Add
                </button>
              </div>

              <div v-if="complianceRecords.length === 0" class="text-sm text-gray-500">
                No compliance records yet
              </div>

              <div v-else class="space-y-3">
                <div v-for="record in complianceRecords" :key="record.id"
                  class="p-3 rounded-lg border" :class="getComplianceBorderClass(record.status)">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="getComplianceDotClass(record.status)"></div>
                      <span class="text-sm font-medium text-gray-900">
                        {{ formatComplianceType(record.compliance_type) }}
                      </span>
                    </div>
                    <button @click="editCompliance(record)" class="text-gray-400 hover:text-gray-600">
                      <Pencil class="w-3 h-3" />
                    </button>
                  </div>
                  <div class="mt-1 text-xs text-gray-600">
                    <span v-if="record.expiry_date">
                      {{ record.status === 'expired' ? 'Expired' : 'Expires' }}:
                      {{ formatDate(record.expiry_date) }}
                    </span>
                    <span v-else>No expiry set</span>
                  </div>
                  <div v-if="record.certificate_number" class="mt-1 text-xs text-gray-500">
                    Cert: {{ record.certificate_number }}
                  </div>
                  <!-- Document link -->
                  <div v-if="record.documents && record.documents.length > 0" class="mt-2">
                    <button
                      @click="viewComplianceDocument(record)"
                      class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <FileText class="w-3 h-3" />
                      View Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Center Column: Property Details -->
          <div class="lg:col-span-5 space-y-4">
            <!-- Address Card -->
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Address</h3>
              <div class="space-y-2 text-sm text-gray-900">
                <p v-if="property.address.line1">{{ property.address.line1 }}</p>
                <p v-if="property.address.line2">{{ property.address.line2 }}</p>
                <p v-if="property.address.city">{{ property.address.city }}</p>
                <p v-if="property.address.county">{{ property.address.county }}</p>
                <p class="font-medium">{{ property.address.postcode }}</p>
              </div>
            </div>

            <!-- Property Details Card -->
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500">Property Type</label>
                  <p class="mt-1 text-sm text-gray-900">{{ formatPropertyType(property.property_type) || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Bedrooms</label>
                  <p class="mt-1 text-sm text-gray-900">{{ property.number_of_bedrooms || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Bathrooms</label>
                  <p class="mt-1 text-sm text-gray-900">{{ property.number_of_bathrooms || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Furnishing</label>
                  <p class="mt-1 text-sm text-gray-900">{{ formatFurnishing(property.furnishing_status) || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Management Type</label>
                  <p class="mt-1 text-sm text-gray-900">
                    <span v-if="property.management_type" :class="{
                      'px-2 py-0.5 text-xs font-medium rounded-full': true,
                      'bg-blue-100 text-blue-800': property.management_type === 'managed',
                      'bg-purple-100 text-purple-800': property.management_type === 'let_only'
                    }">
                      {{ formatManagementType(property.management_type) }}
                    </span>
                    <span v-else class="text-gray-400">Not specified</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- License Info Card -->
            <div v-if="property.is_licensed" class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">License</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500">License Number</label>
                  <p class="mt-1 text-sm text-gray-900">{{ property.license_number || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Expiry Date</label>
                  <p class="mt-1 text-sm text-gray-900">{{ property.license_expiry_date ? formatDate(property.license_expiry_date) : 'Not set' }}</p>
                </div>
              </div>
            </div>

            <!-- Notes Card -->
            <div v-if="property.notes" class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ property.notes }}</p>
            </div>

            <!-- Status Override Card -->
            <div v-if="property.status_override" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <AlertTriangle class="w-4 h-4 text-amber-600" />
                <span class="text-sm font-medium text-amber-800">Manual Status Override</span>
              </div>
              <p class="text-sm text-amber-700">{{ property.status_override_reason || 'No reason provided' }}</p>
            </div>
          </div>

          <!-- Right Column: Landlords & Documents Tabs -->
          <div class="lg:col-span-4">
            <div class="bg-white rounded-lg shadow">
              <!-- Tab Headers -->
              <div class="border-b border-gray-200">
                <nav class="-mb-px flex">
                  <button @click="rightTab = 'landlords'" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'landlords'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]">
                    Landlords
                  </button>
                  <button @click="rightTab = 'documents'" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'documents'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]">
                    Documents
                  </button>
                  <button @click="rightTab = 'activity'; fetchActivity()" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'activity'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  ]">
                    Activity
                  </button>
                </nav>
              </div>

              <!-- Landlords Tab Content -->
              <div v-if="rightTab === 'landlords'" class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-sm font-medium text-gray-700">Ownership</h4>
                  <button @click="showEditModal = true"
                    class="text-sm text-primary hover:text-primary/80">
                    Edit
                  </button>
                </div>

                <div v-if="propertyLandlords.length === 0" class="text-sm text-gray-500">
                  No landlords linked
                </div>

                <div v-else class="space-y-3">
                  <div v-for="pl in propertyLandlords" :key="pl.landlord_id"
                    class="p-3 border border-gray-200 rounded-lg">
                    <div class="flex justify-between items-start">
                      <div>
                        <router-link :to="`/landlords/${pl.landlord_id}`"
                          class="text-sm font-medium text-gray-900 hover:text-primary">
                          {{ pl.name }}
                        </router-link>
                        <p class="text-xs text-gray-500 mt-1">{{ pl.email }}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span v-if="pl.is_primary_contact"
                          class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Primary
                        </span>
                        <span class="text-sm font-semibold text-gray-900">
                          {{ pl.ownership_percentage }}%
                        </span>
                      </div>
                    </div>
                    <!-- Ownership bar visualization -->
                    <div class="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all"
                        :style="{ width: `${pl.ownership_percentage}%` }">
                      </div>
                    </div>
                  </div>

                  <!-- Total ownership indicator -->
                  <div class="pt-2 border-t border-gray-200">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-500">Total Ownership</span>
                      <span :class="totalOwnership === 100 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                        {{ totalOwnership }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Documents Tab Content -->
              <div v-if="rightTab === 'documents'" class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-sm font-medium text-gray-700">Property Documents</h4>
                  <button @click="showUploadDocumentModal = true"
                    class="text-sm text-primary hover:text-primary/80">
                    + Upload
                  </button>
                </div>

                <!-- Tag Filter -->
                <div class="flex flex-wrap gap-2 mb-4">
                  <button
                    v-for="tag in documentTags"
                    :key="tag.value"
                    @click="documentTagFilter = documentTagFilter === tag.value ? '' : tag.value"
                    :class="[
                      'px-2 py-1 text-xs rounded-full border transition-colors',
                      documentTagFilter === tag.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                    ]"
                  >
                    {{ tag.label }}
                  </button>
                </div>

                <div v-if="filteredDocuments.length === 0" class="text-sm text-gray-500">
                  No documents uploaded
                </div>

                <div v-else class="space-y-2">
                  <div v-for="doc in filteredDocuments" :key="doc.id"
                    class="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    @click="openDocumentPreview(doc)">
                    <div class="flex items-center gap-2 min-w-0">
                      <FileText class="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div class="min-w-0">
                        <p class="text-sm text-gray-900 truncate">{{ doc.file_name }}</p>
                        <p class="text-xs text-gray-500">{{ formatFileSize(doc.file_size) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        {{ formatDocumentTag(doc.tag) }}
                      </span>
                      <button @click.stop="downloadDocument(doc, true)" class="text-gray-400 hover:text-primary" title="Download">
                        <Download class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Activity Tab Content -->
              <div v-if="rightTab === 'activity'" class="p-4">
                <h4 class="text-sm font-medium text-gray-700 mb-4">Property Activity</h4>

                <!-- Loading State -->
                <div v-if="loadingActivity" class="text-center py-8">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>

                <!-- No Activity -->
                <div v-else-if="activities.length === 0" class="text-sm text-gray-500 text-center py-8">
                  No activity recorded yet
                </div>

                <!-- Activity Timeline -->
                <div v-else class="space-y-3">
                  <div
                    v-for="activity in activities"
                    :key="activity.id"
                    class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div class="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900">{{ activity.description }}</p>
                      <p class="text-xs text-gray-500 mt-1">
                        {{ formatActivityDate(activity.created_at) }}
                      </p>
                    </div>
                    <!-- Clickable action based on activity type -->
                    <button
                      v-if="getActivityLink(activity)"
                      @click="navigateToActivity(activity)"
                      class="flex-shrink-0 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Property Modal -->
    <AddEditPropertyModal
      v-if="showEditModal"
      :show="showEditModal"
      :property-id="property?.id"
      @close="showEditModal = false"
      @saved="handlePropertySaved"
    />

    <!-- Add Compliance Modal -->
    <AddComplianceModal
      v-if="showAddComplianceModal"
      :show="showAddComplianceModal"
      :property-id="property?.id"
      :compliance-record="editingComplianceRecord"
      @close="closeComplianceModal"
      @saved="handleComplianceSaved"
    />

    <!-- Upload Document Modal -->
    <UploadDocumentModal
      v-if="showUploadDocumentModal"
      :show="showUploadDocumentModal"
      :property-id="property?.id"
      @close="showUploadDocumentModal = false"
      @uploaded="handleDocumentUploaded"
    />

    <!-- Document Preview Modal -->
    <div v-if="showDocumentPreview" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closeDocumentPreview"></div>
      <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-gray-900 truncate">{{ previewDocument?.file_name }}</h3>
            <p class="text-sm text-gray-500">{{ previewDocument ? formatFileSize(previewDocument.file_size) : '' }}</p>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <button
              @click="previewDocument && downloadDocument(previewDocument, true)"
              class="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download class="w-5 h-5" />
            </button>
            <button
              @click="closeDocumentPreview"
              class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto p-4 min-h-[400px] flex items-center justify-center bg-gray-50">
          <div v-if="previewLoading" class="text-gray-500">Loading preview...</div>
          <template v-else-if="previewUrl && previewDocument">
            <!-- Image Preview -->
            <img
              v-if="previewDocument.file_type.startsWith('image/')"
              :src="previewUrl"
              :alt="previewDocument.file_name"
              class="max-w-full max-h-full object-contain"
            />
            <!-- PDF Preview -->
            <iframe
              v-else-if="previewDocument.file_type === 'application/pdf'"
              :src="previewUrl"
              class="w-full h-full min-h-[500px]"
              frameborder="0"
            ></iframe>
            <!-- Non-previewable file -->
            <div v-else class="text-center">
              <FileText class="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p class="text-gray-600 mb-4">This file type cannot be previewed</p>
              <button
                @click="downloadDocument(previewDocument, true)"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Download File
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { ArrowLeft, Pencil, FileText, Download, AlertTriangle, X } from 'lucide-vue-next'
import Sidebar from '../components/Sidebar.vue'
import AddEditPropertyModal from '../components/properties/AddEditPropertyModal.vue'
import AddComplianceModal from '../components/properties/AddComplianceModal.vue'
import UploadDocumentModal from '../components/properties/UploadDocumentModal.vue'
import { useAuthStore } from '../stores/auth'
import { useDownload } from '../composables/useDownload'
import { formatDate as formatUkDate } from '../utils/date'

interface PropertyLandlord {
  id: string
  landlord_id: string
  ownership_percentage: number
  is_primary_contact: boolean
  name: string
  email: string
}

interface ComplianceDocument {
  id: string
  file_name: string
  file_path: string
  is_current: boolean
}

interface ComplianceRecord {
  id: string
  compliance_type: string
  issue_date: string | null
  expiry_date: string | null
  status: 'valid' | 'expiring_soon' | 'expired'
  certificate_number: string | null
  issuer_name: string | null
  documents?: ComplianceDocument[]
}

interface PropertyDocument {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  tag: string
  description?: string
  source?: 'property' | 'compliance'
  compliance_record_id?: string
}

interface Property {
  id: string
  address: {
    line1?: string
    line2?: string
    city?: string
    county?: string
    postcode: string
    full_address?: string
    formatted?: string
  }
  property_type: string | null
  number_of_bedrooms: number | null
  number_of_bathrooms: number | null
  furnishing_status: string | null
  management_type: 'managed' | 'let_only' | null
  status: 'vacant' | 'in_tenancy'
  status_override: boolean
  status_override_reason?: string | null
  is_licensed: boolean
  license_number: string | null
  license_expiry_date: string | null
  notes: string | null
}

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { downloadFile, openInNewTab } = useDownload()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const error = ref('')
const property = ref<Property | null>(null)
const propertyLandlords = ref<PropertyLandlord[]>([])
const complianceRecords = ref<ComplianceRecord[]>([])
const propertyDocuments = ref<PropertyDocument[]>([])

const rightTab = ref<'landlords' | 'documents' | 'activity'>('landlords')
const documentTagFilter = ref('')
const showEditModal = ref(false)
const showAddComplianceModal = ref(false)
const showUploadDocumentModal = ref(false)
const editingComplianceRecord = ref<ComplianceRecord | null>(null)
const showDocumentPreview = ref(false)
const previewDocument = ref<PropertyDocument | null>(null)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)

// Activity tracking
const activities = ref<any[]>([])
const loadingActivity = ref(false)

const documentTags = [
  { value: 'gas', label: 'Gas' },
  { value: 'epc', label: 'EPC' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'other', label: 'Other' }
]

const displayAddress = computed(() => {
  if (!property.value) return ''
  if (property.value.address.formatted) return property.value.address.formatted
  if (property.value.address.full_address) return property.value.address.full_address
  return property.value.address.line1 || property.value.address.postcode
})

const totalOwnership = computed(() => {
  return propertyLandlords.value.reduce((sum, pl) => sum + (pl.ownership_percentage || 0), 0)
})

const filteredDocuments = computed(() => {
  if (!documentTagFilter.value) return propertyDocuments.value
  return propertyDocuments.value.filter(doc => doc.tag === documentTagFilter.value)
})

const fetchProperty = async () => {
  loading.value = true
  error.value = ''

  try {
    const propertyId = route.params.id as string
    const response = await fetch(`${API_URL}/api/properties/${propertyId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch property')
    }

    const data = await response.json()
    property.value = data.property
    propertyLandlords.value = data.landlords || []
    complianceRecords.value = data.compliance || []
    propertyDocuments.value = data.documents || []

    // Check if edit mode
    if (route.query.edit === 'true') {
      showEditModal.value = true
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load property'
    toast.error('Failed to load property')
  } finally {
    loading.value = false
  }
}

const handlePropertySaved = () => {
  showEditModal.value = false
  fetchProperty()
}

const editCompliance = (record: ComplianceRecord) => {
  editingComplianceRecord.value = record
  showAddComplianceModal.value = true
}

const viewComplianceDocument = async (record: ComplianceRecord) => {
  if (!record.documents || record.documents.length === 0 || !property.value) return

  const doc = record.documents[0] // Get the current document
  if (!doc) return
  const url = `${API_URL}/api/properties/${property.value.id}/compliance/${record.id}/document/${doc.id}`

  // Open in new tab with auth token
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch document')
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    // Open in new tab
    window.open(blobUrl, '_blank')
  } catch (err) {
    toast.error('Failed to open document')
  }
}

const closeComplianceModal = () => {
  showAddComplianceModal.value = false
  editingComplianceRecord.value = null
}

const handleComplianceSaved = () => {
  closeComplianceModal()
  fetchProperty()
}

const handleDocumentUploaded = () => {
  showUploadDocumentModal.value = false
  fetchProperty()
}

// Fetch property activity/audit log
const fetchActivity = async () => {
  if (!property.value) return

  loadingActivity.value = true
  try {
    const response = await fetch(`${API_URL}/api/properties/${property.value.id}/activity`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch activity')
    }

    const data = await response.json()
    activities.value = data.activities || []
  } catch (err: any) {
    console.error('Failed to fetch activity:', err)
    toast.error('Failed to load activity')
  } finally {
    loadingActivity.value = false
  }
}

// Format activity date
const formatActivityDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return formatDate(dateString)
  }
}

// Get clickable link for activity
const getActivityLink = (activity: any) => {
  if (!activity.metadata) return null

  // Check if activity has reference_id, offer_id, or agreement_id
  if (activity.metadata.reference_id) return `/references/${activity.metadata.reference_id}`
  if (activity.metadata.offer_id) return `/tenant-offers/${activity.metadata.offer_id}`
  if (activity.metadata.agreement_id) return `/agreements/${activity.metadata.agreement_id}`

  return null
}

// Navigate to activity item
const navigateToActivity = (activity: any) => {
  const link = getActivityLink(activity)
  if (link) {
    window.location.href = link
  }
}

const downloadDocument = (doc: PropertyDocument, forceDownload = false) => {
  try {
    // Use different endpoint for compliance documents vs property documents
    let path: string
    if (doc.source === 'compliance' && doc.compliance_record_id) {
      path = `/api/properties/${property.value?.id}/compliance/${doc.compliance_record_id}/document/${doc.id}`
    } else {
      path = `/api/properties/${property.value?.id}/documents/${doc.id}/download`
    }

    if (forceDownload) {
      // Force download using Safari-safe method
      downloadFile(path, doc.file_name)
    } else {
      // Open in new tab for viewing using Safari-safe method
      openInNewTab(path)
    }
  } catch (err) {
    toast.error('Failed to download document')
  }
}

const openDocumentPreview = async (doc: PropertyDocument) => {
  previewDocument.value = doc
  showDocumentPreview.value = true
  previewLoading.value = true
  previewUrl.value = null

  try {
    // Use different endpoint for compliance documents vs property documents
    let url: string
    if (doc.source === 'compliance' && doc.compliance_record_id) {
      url = `${API_URL}/api/properties/${property.value?.id}/compliance/${doc.compliance_record_id}/document/${doc.id}`
    } else {
      url = `${API_URL}/api/properties/${property.value?.id}/documents/${doc.id}/download`
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (!response.ok) throw new Error('Failed to load document')

    const blob = await response.blob()
    previewUrl.value = window.URL.createObjectURL(blob)
  } catch (err) {
    toast.error('Failed to load document preview')
    closeDocumentPreview()
  } finally {
    previewLoading.value = false
  }
}

const closeDocumentPreview = () => {
  if (previewUrl.value) {
    window.URL.revokeObjectURL(previewUrl.value)
  }
  showDocumentPreview.value = false
  previewDocument.value = null
  previewUrl.value = null
}

const getComplianceBorderClass = (status: string) => {
  switch (status) {
    case 'valid': return 'border-green-200 bg-green-50'
    case 'expiring_soon': return 'border-amber-200 bg-amber-50'
    case 'expired': return 'border-red-200 bg-red-50'
    default: return 'border-gray-200 bg-gray-50'
  }
}

const getComplianceDotClass = (status: string) => {
  switch (status) {
    case 'valid': return 'bg-green-500'
    case 'expiring_soon': return 'bg-amber-500'
    case 'expired': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

const formatComplianceType = (type: string) => {
  const types: Record<string, string> = {
    'gas_safety': 'Gas Safety',
    'eicr': 'EICR',
    'epc': 'EPC',
    'council_licence': 'Council Licence',
    'pat_test': 'PAT Test',
    'other': 'Other'
  }
  return types[type] || type
}

const formatPropertyType = (type: string | null) => {
  if (!type) return null
  const types: Record<string, string> = {
    'house': 'House',
    'flat': 'Flat',
    'studio': 'Studio',
    'room': 'Room',
    'bungalow': 'Bungalow',
    'maisonette': 'Maisonette',
    'other': 'Other'
  }
  return types[type] || type
}

const formatFurnishing = (status: string | null) => {
  if (!status) return null
  const statuses: Record<string, string> = {
    'furnished': 'Furnished',
    'part_furnished': 'Part Furnished',
    'unfurnished': 'Unfurnished'
  }
  return statuses[status] || status
}

const formatManagementType = (type: string | null) => {
  if (!type) return null
  const types: Record<string, string> = {
    'managed': 'Managed',
    'let_only': 'Let Only'
  }
  return types[type] || type
}

const formatDocumentTag = (tag: string) => {
  const tags: Record<string, string> = {
    'gas': 'Gas',
    'epc': 'EPC',
    'agreement': 'Agreement',
    'reference': 'Reference',
    'inventory': 'Inventory',
    'other': 'Other'
  }
  return tags[tag] || tag
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

onMounted(() => {
  fetchProperty()
})
</script>
