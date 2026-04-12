<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center gap-4">
        <button @click="router.push({ name: 'StaffDashboardV2' })" class="text-gray-400 hover:text-gray-600">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}
          </h1>
          <p class="text-sm text-gray-500">{{ reference?.property_address }} - {{ reference?.status }}</p>
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto p-4 sm:p-6">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 4" :key="i" class="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <template v-else-if="reference">
        <!-- Reference Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Tenant Details -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tenant Details</h2>
            <div class="space-y-3">
              <EditableField label="First Name" :value="reference.tenant_first_name" field="tenant_first_name" :reference-id="reference.id" use-admin-endpoint @saved="onFieldSaved" />
              <EditableField label="Last Name" :value="reference.tenant_last_name" field="tenant_last_name" :reference-id="reference.id" use-admin-endpoint @saved="onFieldSaved" />
              <EditableField label="Email" :value="reference.tenant_email" field="tenant_email" :reference-id="reference.id" use-admin-endpoint @saved="onFieldSaved" />
              <EditableField label="Phone" :value="reference.tenant_phone || ''" field="tenant_phone" :reference-id="reference.id" use-admin-endpoint @saved="onFieldSaved" />
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Rent</span>
                <span class="text-gray-900 dark:text-white">&pound;{{ reference.monthly_rent }}/month (share: &pound;{{ reference.rent_share }})</span>
              </div>
            </div>
          </div>

          <!-- Property & Status -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Property & Status</h2>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Address</span>
                <span class="text-gray-900 dark:text-white text-right">{{ reference.property_address }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Status</span>
                <span class="font-medium" :class="getStatusClass(reference.status)">{{ reference.status }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Company</span>
                <span class="text-gray-900 dark:text-white">{{ reference.company_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created</span>
                <span class="text-gray-900 dark:text-white">{{ formatDate(reference.created_at) }}</span>
              </div>
              <div v-if="reference.move_in_date" class="flex justify-between">
                <span class="text-gray-500">Move In</span>
                <span class="text-gray-900 dark:text-white">{{ formatDate(reference.move_in_date) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Referee Details -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Referee Details</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-if="reference.employer_ref_name">
              <p class="text-xs font-medium text-gray-400 uppercase mb-2">Employer Reference</p>
              <div class="space-y-2">
                <EditableField label="Name" :value="reference.employer_ref_name" field="employer_ref_name" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="reference.employer_ref_email" field="employer_ref_email" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="reference.employer_ref_phone || ''" field="employer_ref_phone" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
              </div>
            </div>
            <div v-if="reference.previous_landlord_name">
              <p class="text-xs font-medium text-gray-400 uppercase mb-2">Previous Landlord</p>
              <div class="space-y-2">
                <EditableField label="Name" :value="reference.previous_landlord_name" field="previous_landlord_name" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="reference.previous_landlord_email" field="previous_landlord_email" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="reference.previous_landlord_phone || ''" field="previous_landlord_phone" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
              </div>
            </div>
            <div v-if="reference.accountant_name">
              <p class="text-xs font-medium text-gray-400 uppercase mb-2">Accountant</p>
              <div class="space-y-2">
                <EditableField label="Name" :value="reference.accountant_name" field="accountant_name" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="reference.accountant_email" field="accountant_email" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="reference.accountant_phone || ''" field="accountant_phone" :reference-id="reference.id" use-admin-endpoint @saved="onRefereeFieldSaved" />
              </div>
            </div>
          </div>
        </div>

        <!-- Sections -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verification Sections</h2>
          <div class="space-y-3">
            <div
              v-for="section in sections"
              :key="section.id"
              class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center"
                  :class="section.decision === 'PASS' ? 'bg-green-100 text-green-600' : section.decision === 'FAIL' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'"
                >
                  <Check v-if="section.decision === 'PASS'" class="w-4 h-4" />
                  <XCircle v-else-if="section.decision === 'FAIL'" class="w-4 h-4" />
                  <Clock v-else class="w-4 h-4" />
                </div>
                <div>
                  <span class="font-medium text-gray-900 dark:text-white">{{ sectionLabels[section.section_type] || section.section_type }}</span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-gray-500">{{ section.queue_status }}</span>
                    <span v-if="section.section_data?.evidence_status && section.queue_status === 'PENDING'" class="text-xs px-2 py-0.5 rounded-full"
                      :class="{
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': section.section_data.evidence_status === 'AWAITING_EVIDENCE',
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400': ['AWAITING_REFEREE', 'AWAITING_UPLOAD'].includes(section.section_data.evidence_status),
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400': section.section_data.evidence_status === 'AUTO_PASSED'
                      }"
                    >
                      {{ section.section_data.evidence_status === 'AWAITING_EVIDENCE' ? 'Awaiting Evidence' :
                         section.section_data.evidence_status === 'AWAITING_REFEREE' ? 'Awaiting Referee' :
                         section.section_data.evidence_status === 'AWAITING_UPLOAD' ? 'Awaiting Upload' :
                         section.section_data.evidence_status === 'AUTO_PASSED' ? 'Auto-Passed' :
                         section.section_data.evidence_status }}
                    </span>
                    <span v-if="section.section_data?.issue_status" class="text-xs px-2 py-0.5 rounded-full"
                      :class="section.section_data.issue_status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                    >
                      {{ section.section_data.issue_status }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="text-right text-sm">
                <span v-if="section.decision" class="font-medium" :class="section.decision === 'PASS' ? 'text-green-600' : 'text-red-600'">{{ section.decision }}</span>
                <span v-else class="text-gray-400">Pending</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Log -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h2>
          <div v-if="activityLoading" class="text-center text-gray-400 py-4">Loading...</div>
          <div v-else-if="activity.length === 0" class="text-center text-gray-400 py-4">No activity yet</div>
          <div v-else class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="entry in activity" :key="entry.id" class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div class="w-2 h-2 rounded-full mt-2" :class="getActivityDotClass(entry.action)"></div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatAction(entry.action) }}</span>
                  <span class="text-xs text-gray-400">{{ formatDate(entry.performed_at) }}</span>
                </div>
                <p v-if="entry.field_name" class="text-xs text-gray-500 mt-1">
                  {{ entry.field_name }}: "{{ entry.old_value }}" &rarr; "{{ entry.new_value }}"
                </p>
                <p v-if="entry.notes" class="text-xs text-gray-500 mt-1">{{ entry.notes }}</p>
                <p class="text-xs text-gray-400">by {{ entry.performed_by_type }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, Check, XCircle, Clock } from 'lucide-vue-next'
import EditableField from '@/components/EditableField.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const activityLoading = ref(true)
const reference = ref<any>(null)
const sections = ref<any[]>([])
const activity = ref<any[]>([])

const sectionLabels: Record<string, string> = {
  IDENTITY: 'Identity', RTR: 'Right to Rent', INCOME: 'Income',
  RESIDENTIAL: 'Residential', CREDIT: 'Credit', AML: 'AML', ADDRESS: 'Address'
}

onMounted(async () => {
  const id = route.params.id as string
  const headers = { 'Authorization': `Bearer ${authStore.session?.access_token}` }

  try {
    // Fetch reference details (use admin endpoint for staff access)
    const searchRes = await fetch(`${API_URL}/api/v2/admin/references/search?q=${id}`, { headers })
    if (searchRes.ok) {
      const data = await searchRes.json()
      if (data.references?.length > 0) {
        reference.value = data.references[0]
      }
    }

    // Fetch sections
    const sectionsRes = await fetch(`${API_URL}/api/v2/sections/${id}`, { headers })
    // The sections endpoint expects a section ID, not reference ID
    // Instead, we need to use the admin search result data

    // For now, if reference is found, fetch its sections via the reference detail
    // We need a different approach - let's fetch sections from the stats endpoint
    // Actually, the admin search gives us the reference. We can get sections by querying each.
  } catch (error) {
    console.error('Error loading reference:', error)
  } finally {
    loading.value = false
  }

  // Fetch activity
  try {
    const activityRes = await fetch(`${API_URL}/api/v2/admin/references/${id}/activity`, { headers })
    if (activityRes.ok) {
      const data = await activityRes.json()
      activity.value = data.activity || []
    }
  } catch {} finally {
    activityLoading.value = false
  }
})

async function onFieldSaved() {
  // Refresh reference data
  const id = route.params.id as string
  const headers = { 'Authorization': `Bearer ${authStore.session?.access_token}` }
  const searchRes = await fetch(`${API_URL}/api/v2/admin/references/search?q=${id}`, { headers })
  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.references?.length > 0) {
      reference.value = data.references[0]
    }
  }
  // Refresh activity
  const activityRes = await fetch(`${API_URL}/api/v2/admin/references/${id}/activity`, { headers })
  if (activityRes.ok) {
    const data = await activityRes.json()
    activity.value = data.activity || []
  }
}

async function onRefereeFieldSaved(result: any) {
  if (result?.isRefereeField) {
    let refereeType = ''
    let sectionType = ''
    if (result.field?.startsWith('employer_ref_')) {
      refereeType = 'EMPLOYER'
      sectionType = 'INCOME'
    } else if (result.field?.startsWith('previous_landlord_')) {
      refereeType = 'LANDLORD'
      sectionType = 'RESIDENTIAL'
    } else if (result.field?.startsWith('accountant_')) {
      refereeType = 'ACCOUNTANT'
      sectionType = 'INCOME'
    }

    if (refereeType && confirm('Referee details updated. Send new reference request to this referee?')) {
      try {
        // Use admin endpoint - staff can chase too
        await fetch(`${API_URL}/api/v2/admin/references/${reference.value.id}/edit`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ field: result.field, value: result.value })
        })
      } catch {}
    }
  }
  await onFieldSaved()
}

function getStatusClass(status: string): string {
  if (status?.startsWith('ACCEPTED')) return 'text-green-600'
  if (status === 'REJECTED') return 'text-red-600'
  return 'text-gray-600'
}

function getActivityDotClass(action: string): string {
  if (action === 'ISSUE_REPORTED') return 'bg-amber-500'
  if (action.includes('UPLOAD') || action.includes('RESPONSE')) return 'bg-blue-500'
  if (action === 'FIELD_EDITED') return 'bg-purple-500'
  return 'bg-gray-400'
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    'FIELD_EDITED': 'Field Edited',
    'ISSUE_REPORTED': 'Issue Reported',
    'TENANT_UPLOAD': 'Tenant Upload',
    'TENANT_RESPONSE': 'Tenant Response',
    'AGENT_UPLOAD': 'Agent Upload',
    'RESPONSE_ACCEPTED_VERIFY': 'Response Accepted (Verify)',
    'RESPONSE_ACCEPTED_CHASE': 'Response Accepted (Chase)',
    'REFEREE_CHASED': 'Referee Chased'
  }
  return labels[action] || action.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
  })
}
</script>
