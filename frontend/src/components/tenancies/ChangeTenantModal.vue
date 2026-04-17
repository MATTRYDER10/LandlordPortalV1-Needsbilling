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
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Change Tenant</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400">{{ propertyAddress }}</p>
            </div>
            <button
              @click="close"
              class="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Action Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">What would you like to do?</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  @click="actionType = 'remove'"
                  class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all"
                  :class="actionType === 'remove'
                    ? 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-300'"
                >
                  <UserMinus class="w-5 h-5" />
                  <div>
                    <p class="font-medium text-sm">Remove Tenant</p>
                    <p class="text-xs opacity-75">Tenant is leaving</p>
                  </div>
                </button>
                <button
                  @click="actionType = 'add'"
                  class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all"
                  :class="actionType === 'add'
                    ? 'border-green-300 bg-green-50 text-green-700 ring-1 ring-green-300 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-300'"
                >
                  <UserPlus class="w-5 h-5" />
                  <div>
                    <p class="font-medium text-sm">Add Tenant</p>
                    <p class="text-xs opacity-75">New tenant joining</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Remove Tenant Section -->
            <div v-if="actionType === 'remove'" class="space-y-4">
              <!-- Select Tenant to Remove -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Select tenant to remove</label>
                <div class="space-y-2">
                  <button
                    v-for="tenant in activeTenants"
                    :key="tenant.id"
                    @click="selectedTenantId = tenant.id"
                    class="w-full flex items-center justify-between p-3 border rounded-lg text-left transition-all"
                    :class="selectedTenantId === tenant.id
                      ? 'border-red-300 bg-red-50 ring-1 ring-red-300 dark:bg-red-900/30 dark:border-red-700'
                      : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600'"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-slate-400">
                        {{ tenant.first_name?.[0] }}{{ tenant.last_name?.[0] }}
                      </div>
                      <div>
                        <p class="font-medium text-gray-900 dark:text-white">{{ tenant.first_name }} {{ tenant.last_name }}</p>
                        <p class="text-xs text-gray-500 dark:text-slate-400">{{ tenant.email || 'No email' }}</p>
                      </div>
                    </div>
                    <div v-if="tenant.is_lead_tenant" class="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                      Lead
                    </div>
                  </button>
                </div>
              </div>

              <!-- Left Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date tenant is leaving</label>
                <input
                  v-model="leftDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
                />
              </div>

              <!-- Add Replacement Option -->
              <div class="border-t dark:border-slate-700 pt-4">
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                  <input
                    v-model="addReplacement"
                    type="checkbox"
                    class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-900"
                  />
                  Add a replacement tenant
                </label>
              </div>

              <!-- Replacement Tenant Form -->
              <div v-if="addReplacement" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                <h4 class="text-sm font-medium text-green-800 dark:text-green-400">Replacement Tenant Details</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">First Name *</label>
                    <input
                      v-model="newTenant.firstName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Last Name *</label>
                    <input
                      v-model="newTenant.lastName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Email</label>
                    <input
                      v-model="newTenant.email"
                      type="email"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Phone</label>
                    <input
                      v-model="newTenant.phone"
                      type="tel"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="07123456789"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Start Date</label>
                  <input
                    v-model="newTenant.startDate"
                    type="date"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <!-- Add Tenant Section -->
            <div v-if="actionType === 'add'" class="space-y-4">
              <!-- Source toggle: new vs link existing V2 reference -->
              <div class="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-sm">
                <button
                  type="button"
                  @click="addMode = 'new'"
                  class="flex-1 px-3 py-2 font-medium transition-colors"
                  :class="addMode === 'new'
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'"
                >
                  New tenant
                </button>
                <button
                  type="button"
                  @click="addMode = 'link'"
                  class="flex-1 px-3 py-2 font-medium transition-colors border-l border-gray-200 dark:border-slate-700"
                  :class="addMode === 'link'
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'"
                >
                  Link existing V2 reference
                </button>
              </div>

              <!-- New tenant form -->
              <div v-if="addMode === 'new'" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <h4 class="text-sm font-medium text-blue-800 dark:text-blue-400">New Tenant Details</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">First Name *</label>
                    <input
                      v-model="newTenant.firstName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Last Name *</label>
                    <input
                      v-model="newTenant.lastName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Email</label>
                    <input
                      v-model="newTenant.email"
                      type="email"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Phone</label>
                    <input
                      v-model="newTenant.phone"
                      type="tel"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                      placeholder="07123456789"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Start Date</label>
                  <input
                    v-model="newTenant.startDate"
                    type="date"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                    <input
                      v-model="newTenant.isLeadTenant"
                      type="checkbox"
                      class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-900"
                    />
                    Make this the lead tenant
                  </label>
                </div>
              </div>

              <!-- Link existing V2 reference -->
              <div v-else class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <h4 class="text-sm font-medium text-blue-800 dark:text-blue-400">Find an existing V2 reference</h4>
                <input
                  v-model="referenceQuery"
                  type="search"
                  placeholder="Search by name, email, or reference number…"
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                />
                <div v-if="referenceSearching" class="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  <Loader2 class="w-3 h-3 animate-spin" /> Searching…
                </div>
                <div v-else-if="referenceResults.length === 0 && referenceQuery.length > 0" class="text-xs text-gray-500 dark:text-slate-400">
                  No unlinked references match "{{ referenceQuery }}".
                </div>
                <div v-else-if="referenceResults.length > 0 && !selectedReference" class="max-h-56 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  <button
                    v-for="r in referenceResults"
                    :key="r.id"
                    type="button"
                    @click="selectReference(r)"
                    class="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ r.first_name }} {{ r.last_name }}</p>
                        <p class="text-xs text-gray-500 dark:text-slate-400 truncate">{{ r.email || 'No email' }}</p>
                        <p v-if="r.property_address" class="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{{ r.property_address }}</p>
                      </div>
                      <div class="flex-shrink-0 text-right">
                        <p class="text-xs font-mono text-gray-400">{{ r.reference_number }}</p>
                        <p class="text-xs mt-0.5 uppercase tracking-wide text-gray-500 dark:text-slate-400">{{ r.status }}</p>
                      </div>
                    </div>
                  </button>
                </div>
                <div v-if="selectedReference" class="border border-primary/40 dark:border-primary/60 bg-white dark:bg-slate-900 rounded-lg p-3 space-y-2">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedReference.first_name }} {{ selectedReference.last_name }}</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400 truncate">{{ selectedReference.email || 'No email' }}</p>
                      <p class="text-xs font-mono text-gray-400 mt-0.5">{{ selectedReference.reference_number }}</p>
                    </div>
                    <button
                      type="button"
                      @click="selectedReference = null"
                      class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white"
                    >Change</button>
                  </div>
                  <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer pt-1 border-t border-gray-100 dark:border-slate-700">
                    <input
                      v-model="newTenant.isLeadTenant"
                      type="checkbox"
                      class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-900"
                    />
                    Make this the lead tenant
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
            <button
              @click="close"
              :disabled="processing"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="submit"
              :disabled="!canSubmit || processing"
              class="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              :class="actionType === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
            >
              <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
              {{ processing ? 'Processing...' : (actionType === 'remove' ? 'Remove Tenant' : 'Add Tenant') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { X, UserMinus, UserPlus, Loader2 } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_lead_tenant: boolean
  status: string
}

const props = defineProps<{
  isOpen: boolean
  tenancyId: string
  propertyAddress: string
  tenants: Tenant[]
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// State
const actionType = ref<'remove' | 'add'>('remove')
const addMode = ref<'new' | 'link'>('new')
const selectedTenantId = ref<string | null>(null)
const leftDate = ref(new Date().toISOString().split('T')[0])
const addReplacement = ref(false)
const processing = ref(false)

const newTenant = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  startDate: new Date().toISOString().split('T')[0],
  isLeadTenant: false
})

// V2 reference search state
interface V2ReferenceResult {
  id: string
  reference_number: string
  status: string
  first_name: string
  last_name: string
  email: string
  property_address: string
  final_decision_notes?: string | null
}
const referenceQuery = ref('')
const referenceResults = ref<V2ReferenceResult[]>([])
const referenceSearching = ref(false)
const selectedReference = ref<V2ReferenceResult | null>(null)
let referenceSearchTimer: ReturnType<typeof setTimeout> | null = null

async function runReferenceSearch(q: string) {
  referenceSearching.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return
    const response = await fetch(`${API_URL}/api/tenancies/search-references?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) {
      referenceResults.value = []
      return
    }
    const data = await response.json()
    referenceResults.value = data.references || []
  } catch (err) {
    console.error('Reference search failed:', err)
    referenceResults.value = []
  } finally {
    referenceSearching.value = false
  }
}

watch(referenceQuery, (q) => {
  if (referenceSearchTimer) clearTimeout(referenceSearchTimer)
  // If query is empty, still run once to show recent unlinked refs.
  referenceSearchTimer = setTimeout(() => runReferenceSearch(q), 200)
})

function selectReference(r: V2ReferenceResult) {
  selectedReference.value = r
}

// When the "Link existing" tab becomes active, fetch an initial list.
watch(addMode, (mode) => {
  if (mode === 'link' && referenceResults.value.length === 0 && !referenceSearching.value) {
    runReferenceSearch('')
  }
})

// Computed
const activeTenants = computed(() => {
  return props.tenants.filter(t => t.status === 'active')
})

const canSubmit = computed(() => {
  if (actionType.value === 'remove') {
    if (!selectedTenantId.value || !leftDate.value) return false
    if (addReplacement.value) {
      return !!newTenant.value.firstName && !!newTenant.value.lastName
    }
    return true
  }
  // add flow
  if (addMode.value === 'link') {
    return !!selectedReference.value
  }
  return !!newTenant.value.firstName && !!newTenant.value.lastName
})

// Reset on open / cleanup on close
watch(() => props.isOpen, (open) => {
  if (open) {
    actionType.value = 'remove'
    addMode.value = 'new'
    selectedTenantId.value = null
    leftDate.value = new Date().toISOString().split('T')[0]
    addReplacement.value = false
    referenceQuery.value = ''
    referenceResults.value = []
    selectedReference.value = null
    newTenant.value = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      startDate: new Date().toISOString().split('T')[0],
      isLeadTenant: false
    }
  } else if (referenceSearchTimer) {
    // Modal closing — cancel any pending search debounce so we don't fire a
    // stale request after the user cancels.
    clearTimeout(referenceSearchTimer)
    referenceSearchTimer = null
  }
})

const submit = async () => {
  if (!canSubmit.value) return

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    if (actionType.value === 'remove') {
      // First add replacement if needed
      let replacementTenantId: string | undefined
      if (addReplacement.value) {
        const addResponse = await fetch(
          `${API_URL}/api/tenancies/records/${props.tenancyId}/tenants`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              firstName: newTenant.value.firstName,
              lastName: newTenant.value.lastName,
              email: newTenant.value.email || null,
              phone: newTenant.value.phone || null,
              isLeadTenant: newTenant.value.isLeadTenant,
              startDate: newTenant.value.startDate
            })
          }
        )

        if (!addResponse.ok) {
          const error = await addResponse.json()
          throw new Error(error.error || 'Failed to add replacement tenant')
        }

        const addData = await addResponse.json()
        replacementTenantId = addData.tenant?.id
      }

      // Remove the tenant
      const removeResponse = await fetch(
        `${API_URL}/api/tenancies/records/${props.tenancyId}/tenants/${selectedTenantId.value}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            leftDate: leftDate.value,
            replacementTenantId
          })
        }
      )

      if (!removeResponse.ok) {
        const error = await removeResponse.json()
        throw new Error(error.error || 'Failed to remove tenant')
      }

      toast.success(addReplacement.value ? 'Tenant replaced successfully' : 'Tenant removed successfully')
    } else if (addMode.value === 'link' && selectedReference.value) {
      // Link an existing V2 reference as a tenant
      const response = await fetch(
        `${API_URL}/api/tenancies/records/${props.tenancyId}/tenants/from-reference`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            referenceId: selectedReference.value.id,
            isLeadTenant: newTenant.value.isLeadTenant,
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to link reference')
      }

      toast.success('Tenant linked from reference')
    } else {
      // Add new tenant
      const response = await fetch(
        `${API_URL}/api/tenancies/records/${props.tenancyId}/tenants`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            firstName: newTenant.value.firstName,
            lastName: newTenant.value.lastName,
            email: newTenant.value.email || null,
            phone: newTenant.value.phone || null,
            isLeadTenant: newTenant.value.isLeadTenant,
            startDate: newTenant.value.startDate
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add tenant')
      }

      toast.success('Tenant added successfully')
    }

    emit('success')
    emit('close')
  } catch (error: any) {
    console.error('Error processing tenant change:', error)
    toast.error(error.message || 'Failed to process tenant change')
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
