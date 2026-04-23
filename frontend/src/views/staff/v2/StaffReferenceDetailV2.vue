<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button @click="router.push({ name: 'StaffDashboardV2' })" class="text-gray-400 hover:text-gray-600">
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}
            </h1>
            <p class="text-sm text-gray-500">{{ reference?.property_address }}, {{ reference?.property_postcode }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="px-3 py-1 rounded-full text-sm font-medium" :class="getStatusBadgeClass(reference?.status)">
            {{ formatStatus(reference?.status) }}
          </span>
          <button
            v-if="reference"
            @click="showStatusOverride = true"
            class="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
          >
            Override Status
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto p-4 sm:p-6">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 4" :key="i" class="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-6 rounded-xl">
        {{ error }}
      </div>

      <template v-else-if="reference">
        <!-- Group Members Banner -->
        <div v-if="groupMembers.length > 1" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <p class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            Group Application ({{ groupMembers.length }} tenants)
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="member in groupMembers"
              :key="member.id"
              @click="member.is_current ? null : router.push({ name: 'StaffReferenceDetailV2', params: { id: member.id } })"
              class="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
              :class="member.is_current
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-slate-600 border border-blue-200 dark:border-slate-600'"
            >
              <span>{{ member.tenant_first_name }} {{ member.tenant_last_name }}</span>
              <span class="text-xs opacity-75">({{ formatStatus(member.status) }})</span>
              <span v-if="member.is_group_parent" class="text-xs">- Lead</span>
            </button>
          </div>
        </div>

        <!-- Reference Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Tenant Details -->
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tenant Details</h2>
            <div class="space-y-3">
              <EditableField label="First Name" :value="reference.tenant_first_name" field="tenant_first_name" :reference-id="reference.id" use-admin-endpoint @saved="refreshData" />
              <EditableField label="Last Name" :value="reference.tenant_last_name" field="tenant_last_name" :reference-id="reference.id" use-admin-endpoint @saved="refreshData" />
              <EditableField label="Email" :value="reference.tenant_email" field="tenant_email" :reference-id="reference.id" use-admin-endpoint @saved="refreshData" />
              <EditableField label="Phone" :value="reference.tenant_phone || ''" field="tenant_phone" :reference-id="reference.id" use-admin-endpoint @saved="refreshData" />
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Rent</span>
                <span class="text-gray-900 dark:text-white">&pound;{{ reference.monthly_rent || 0 }}/month</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Rent Share</span>
                <span class="text-gray-900 dark:text-white">&pound;{{ reference.rent_share || 0 }}/month</span>
              </div>
              <div v-if="reference.move_in_date" class="flex justify-between text-sm">
                <span class="text-gray-500">Move In</span>
                <span class="text-gray-900 dark:text-white">{{ formatDate(reference.move_in_date) }}</span>
              </div>
              <div v-if="reference.term_months || reference.term_years" class="flex justify-between text-sm">
                <span class="text-gray-500">Term</span>
                <span class="text-gray-900 dark:text-white">
                  {{ reference.term_years ? reference.term_years + ' year(s)' : '' }}
                  {{ reference.term_months ? reference.term_months + ' month(s)' : '' }}
                </span>
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
              <div v-if="reference.property_city" class="flex justify-between">
                <span class="text-gray-500">City</span>
                <span class="text-gray-900 dark:text-white">{{ reference.property_city }}</span>
              </div>
              <div v-if="reference.property_postcode" class="flex justify-between">
                <span class="text-gray-500">Postcode</span>
                <span class="text-gray-900 dark:text-white">{{ reference.property_postcode }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Status</span>
                <span class="font-medium" :class="getStatusClass(reference.status)">{{ formatStatus(reference.status) }}</span>
              </div>
              <div v-if="reference.final_decision_notes" class="flex justify-between">
                <span class="text-gray-500">Decision</span>
                <span class="text-gray-900 dark:text-white text-right">{{ reference.final_decision_notes }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Company</span>
                <span class="text-gray-900 dark:text-white">{{ reference.company_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created</span>
                <span class="text-gray-900 dark:text-white">{{ formatDate(reference.created_at) }}</span>
              </div>
              <div v-if="reference.final_decision_at" class="flex justify-between">
                <span class="text-gray-500">Decision Date</span>
                <span class="text-gray-900 dark:text-white">{{ formatDate(reference.final_decision_at) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Bills Included</span>
                <span class="text-gray-900 dark:text-white">{{ reference.bills_included ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Verification Sections -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verification Sections</h2>
          <div v-if="sections.length === 0" class="text-center text-gray-400 py-4">No sections found</div>
          <div v-else class="space-y-3">
            <div
              v-for="section in sections"
              :key="section.id"
              class="border border-gray-100 dark:border-slate-600 rounded-lg overflow-hidden"
            >
              <div
                class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                @click="toggleSection(section.id)"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center"
                    :class="getSectionIconClass(section)"
                  >
                    <Check v-if="section.decision === 'PASS'" class="w-4 h-4" />
                    <AlertTriangle v-else-if="section.decision === 'PASS_WITH_CONDITION'" class="w-4 h-4" />
                    <XCircle v-else-if="section.decision === 'FAIL' || section.decision === 'REFER'" class="w-4 h-4" />
                    <Clock v-else class="w-4 h-4" />
                  </div>
                  <div>
                    <span class="font-medium text-gray-900 dark:text-white">{{ sectionLabels[section.section_type] || section.section_type }}</span>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs px-2 py-0.5 rounded-full" :class="getQueueStatusClass(section.queue_status)">
                        {{ formatQueueStatus(section.queue_status) }}
                      </span>
                      <span v-if="getEvidenceLabel(section)" class="text-xs px-2 py-0.5 rounded-full" :class="getEvidenceClass(section)">
                        {{ getEvidenceLabel(section) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span v-if="section.decision" class="font-medium text-sm" :class="getDecisionClass(section.decision)">
                    {{ formatDecision(section.decision) }}
                  </span>
                  <span v-else class="text-sm text-gray-400">Pending</span>
                  <ChevronDown class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expandedSections.has(section.id) }" />
                </div>
              </div>

              <!-- Expanded section detail -->
              <div v-if="expandedSections.has(section.id)" class="bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-600 p-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div v-if="section.assigned_to">
                    <span class="text-gray-500">Assigned To</span>
                    <p class="text-gray-900 dark:text-white">{{ section.assigned_to }}</p>
                  </div>
                  <div v-if="section.queue_entered_at">
                    <span class="text-gray-500">Queue Entered</span>
                    <p class="text-gray-900 dark:text-white">{{ formatDate(section.queue_entered_at) }}</p>
                  </div>
                  <div v-if="section.completed_at">
                    <span class="text-gray-500">Completed</span>
                    <p class="text-gray-900 dark:text-white">{{ formatDate(section.completed_at) }}</p>
                  </div>
                  <div v-if="section.evidence_submitted_at">
                    <span class="text-gray-500">Evidence Submitted</span>
                    <p class="text-gray-900 dark:text-white">{{ formatDate(section.evidence_submitted_at) }}</p>
                  </div>
                  <div v-if="section.referee_submitted_at">
                    <span class="text-gray-500">Referee Submitted</span>
                    <p class="text-gray-900 dark:text-white">{{ formatDate(section.referee_submitted_at) }}</p>
                  </div>
                  <div v-if="section.condition_text">
                    <span class="text-gray-500">Condition</span>
                    <p class="text-gray-900 dark:text-white">{{ section.condition_text }}</p>
                  </div>
                  <div v-if="section.fail_reason">
                    <span class="text-gray-500">Fail Reason</span>
                    <p class="text-red-600">{{ section.fail_reason }}</p>
                  </div>
                  <div v-if="section.assessor_notes">
                    <span class="text-gray-500">Assessor Notes</span>
                    <p class="text-gray-900 dark:text-white">{{ section.assessor_notes }}</p>
                  </div>
                </div>

                <!-- Section Data -->
                <div v-if="section.section_data && Object.keys(section.section_data).length > 0" class="mt-4">
                  <p class="text-xs font-medium text-gray-400 uppercase mb-2">Section Data</p>
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                    <template v-if="section.section_data.checklist_results">
                      <div v-for="(val, key) in section.section_data.checklist_results" :key="key" class="flex justify-between">
                        <span class="text-gray-500">{{ formatDataKey(key as string) }}</span>
                        <span class="text-gray-900 dark:text-white">{{ val }}</span>
                      </div>
                    </template>
                    <template v-if="section.section_type === 'AML' && section.section_data.summary">
                      <p class="text-gray-900 dark:text-white">{{ section.section_data.summary }}</p>
                    </template>
                    <template v-if="section.section_type === 'CREDIT'">
                      <div v-if="section.section_data.riskScore !== undefined" class="flex justify-between">
                        <span class="text-gray-500">Risk Score</span>
                        <span class="text-gray-900 dark:text-white">{{ section.section_data.riskScore }}</span>
                      </div>
                      <div v-if="section.section_data.riskLevel" class="flex justify-between">
                        <span class="text-gray-500">Risk Level</span>
                        <span class="text-gray-900 dark:text-white capitalize">{{ section.section_data.riskLevel }}</span>
                      </div>
                      <div v-if="section.section_data.ccjCount !== undefined" class="flex justify-between">
                        <span class="text-gray-500">CCJ Count</span>
                        <span class="text-gray-900 dark:text-white">{{ section.section_data.ccjCount }}</span>
                      </div>
                      <div v-if="section.section_data.electoralRegisterMatch !== undefined" class="flex justify-between">
                        <span class="text-gray-500">Electoral Register</span>
                        <span :class="section.section_data.electoralRegisterMatch ? 'text-green-600' : 'text-red-600'">
                          {{ section.section_data.electoralRegisterMatch ? 'Match' : 'No Match' }}
                        </span>
                      </div>
                    </template>
                    <template v-if="section.section_type === 'IDENTITY' && section.section_data.checklist_results">
                      <div v-if="section.section_data.checklist_results.document_type" class="flex justify-between">
                        <span class="text-gray-500">Document Type</span>
                        <span class="text-gray-900 dark:text-white">{{ section.section_data.checklist_results.document_type }}</span>
                      </div>
                      <div v-if="section.section_data.checklist_results.expiry_date" class="flex justify-between">
                        <span class="text-gray-500">Expiry Date</span>
                        <span class="text-gray-900 dark:text-white">{{ section.section_data.checklist_results.expiry_date }}</span>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Form Data for this section -->
                <div v-if="getSectionFormData(section.section_type)" class="mt-4">
                  <p class="text-xs font-medium text-gray-400 uppercase mb-2">Tenant Submission</p>
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                    <div v-for="(val, fkey) in getSectionFormData(section.section_type)" :key="fkey" class="flex justify-between">
                      <span class="text-gray-500">{{ formatFormDataLabel(fkey as string) }}</span>
                      <a
                        v-if="isDocUrl(val)"
                        :href="val"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:text-primary/80 underline"
                      >View Document</a>
                      <span v-else class="text-gray-900 dark:text-white text-right max-w-[60%]">{{ formatFormValue(fkey as string, val) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Upload Evidence -->
                <div class="mt-3">
                  <label class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer">
                    <Upload class="w-4 h-4" />
                    Upload Evidence
                    <input type="file" class="hidden" @change="(e: Event) => handleUploadEvidence(e, section)" />
                  </label>
                </div>

                <!-- Verbal reference for this section -->
                <div v-if="getVerbalRefForSection(section)" class="mt-4">
                  <p class="text-xs font-medium text-gray-400 uppercase mb-2">Verbal Reference</p>
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-3 text-sm">
                    <p class="text-gray-900 dark:text-white whitespace-pre-wrap">{{ getVerbalRefForSection(section)?.notes }}</p>
                    <p class="text-xs text-gray-400 mt-2">{{ formatDate(getVerbalRefForSection(section)?.created_at) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Referee Details -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Referee Details</h2>
          <div v-if="referees.length === 0" class="text-center text-gray-400 py-4">No referees found</div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="referee in referees" :key="referee.id" class="border border-gray-100 dark:border-slate-600 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-medium uppercase px-2 py-1 rounded-full"
                  :class="referee.referee_type === 'EMPLOYER' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : referee.referee_type === 'LANDLORD' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'"
                >
                  {{ referee.referee_type }}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="referee.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : referee.status === 'SENT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ referee.status }}
                </span>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">Name</span>
                  <span class="text-gray-900 dark:text-white">{{ referee.referee_name || '-' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Email</span>
                  <span class="text-gray-900 dark:text-white truncate ml-2">{{ referee.referee_email || '-' }}</span>
                </div>
                <div v-if="referee.referee_phone" class="flex justify-between">
                  <span class="text-gray-500">Phone</span>
                  <span class="text-gray-900 dark:text-white">{{ referee.referee_phone }}</span>
                </div>
                <div v-if="referee.sent_at" class="flex justify-between">
                  <span class="text-gray-500">Sent</span>
                  <span class="text-gray-900 dark:text-white">{{ formatDate(referee.sent_at) }}</span>
                </div>
                <div v-if="referee.completed_at" class="flex justify-between">
                  <span class="text-gray-500">Completed</span>
                  <span class="text-gray-900 dark:text-white">{{ formatDate(referee.completed_at) }}</span>
                </div>
              </div>

              <!-- Referee form response summary -->
              <div v-if="referee.form_data && referee.status === 'COMPLETED'" class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-600">
                <p class="text-xs font-medium text-gray-400 uppercase mb-2">Response Summary</p>
                <div class="text-sm space-y-1">
                  <template v-for="(val, key) in getFormDataSummary(referee.form_data)" :key="key">
                    <div class="flex justify-between">
                      <span class="text-gray-500">{{ key }}</span>
                      <span class="text-gray-900 dark:text-white text-right max-w-[60%] truncate">{{ val }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Log -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h2>
          <div v-if="activity.length === 0" class="text-center text-gray-400 py-4">No activity yet</div>
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

    <!-- Status Override Modal -->
    <div v-if="showStatusOverride" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showStatusOverride = false">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Override Reference Status</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-500 mb-1">Current Status</label>
            <p class="font-medium" :class="getStatusClass(reference?.status)">{{ formatStatus(reference?.status) }}</p>
          </div>
          <div>
            <label class="block text-sm text-gray-500 mb-1">New Status</label>
            <select v-model="overrideStatus" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white">
              <option value="">Select status...</option>
              <option v-for="s in availableStatuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-500 mb-1">Notes</label>
            <textarea v-model="overrideNotes" rows="2" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" placeholder="Reason for override..." />
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showStatusOverride = false" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button @click="submitStatusOverride" :disabled="!overrideStatus || overrideSaving" class="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {{ overrideSaving ? 'Saving...' : 'Update Status' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, Check, XCircle, Clock, ChevronDown, AlertTriangle, Upload } from 'lucide-vue-next'
import EditableField from '@/components/EditableField.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')
const reference = ref<any>(null)
const sections = ref<any[]>([])
const referees = ref<any[]>([])
const activity = ref<any[]>([])
const groupMembers = ref<any[]>([])
const verbalReferences = ref<any[]>([])
const expandedSections = ref(new Set<string>())

// Status override
const showStatusOverride = ref(false)
const overrideStatus = ref('')
const overrideNotes = ref('')
const overrideSaving = ref(false)

const sectionLabels: Record<string, string> = {
  IDENTITY: 'Identity', RTR: 'Right to Rent', INCOME: 'Income',
  RESIDENTIAL: 'Residential', CREDIT: 'Credit', AML: 'AML', ADDRESS: 'Address'
}

const statusLabels: Record<string, string> = {
  SENT: 'Sent',
  COLLECTING_EVIDENCE: 'Collecting Evidence',
  ACTION_REQUIRED: 'Action Required',
  INDIVIDUAL_COMPLETE: 'Individual Complete',
  GROUP_ASSESSMENT: 'Group Assessment',
  ACCEPTED: 'Accepted',
  ACCEPTED_WITH_GUARANTOR: 'Accepted (Guarantor)',
  ACCEPTED_ON_CONDITION: 'Accepted (Conditional)',
  REJECTED: 'Rejected'
}

const availableStatuses = [
  { value: 'SENT', label: 'Sent' },
  { value: 'COLLECTING_EVIDENCE', label: 'Collecting Evidence' },
  { value: 'ACTION_REQUIRED', label: 'Action Required' },
  { value: 'INDIVIDUAL_COMPLETE', label: 'Individual Complete' },
  { value: 'GROUP_ASSESSMENT', label: 'Group Assessment' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'ACCEPTED_WITH_GUARANTOR', label: 'Accepted (Guarantor)' },
  { value: 'ACCEPTED_ON_CONDITION', label: 'Accepted (Conditional)' },
  { value: 'REJECTED', label: 'Rejected' }
]

onMounted(() => loadData())

async function loadData() {
  const id = route.params.id as string
  const headers = { 'Authorization': `Bearer ${authStore.session?.access_token}` }

  try {
    loading.value = true
    error.value = ''

    const res = await fetch(`${API_URL}/api/v2/admin/references/${id}/detail`, { headers })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Failed to load reference (${res.status})`)
    }

    const data = await res.json()
    reference.value = data.reference
    sections.value = data.sections || []
    referees.value = data.referees || []
    activity.value = data.activity || []
    groupMembers.value = data.groupMembers || []
    verbalReferences.value = data.verbalReferences || []
  } catch (err: any) {
    error.value = err.message || 'Failed to load reference'
    console.error('Error loading reference detail:', err)
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await loadData()
}

function toggleSection(sectionId: string) {
  if (expandedSections.value.has(sectionId)) {
    expandedSections.value.delete(sectionId)
  } else {
    expandedSections.value.add(sectionId)
  }
}

async function submitStatusOverride() {
  if (!overrideStatus.value || !reference.value) return
  overrideSaving.value = true

  try {
    const res = await fetch(`${API_URL}/api/v2/admin/references/${reference.value.id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: overrideStatus.value, notes: overrideNotes.value })
    })

    if (!res.ok) throw new Error('Failed to update status')

    showStatusOverride.value = false
    overrideStatus.value = ''
    overrideNotes.value = ''
    await refreshData()
  } catch (err: any) {
    alert(err.message || 'Failed to update status')
  } finally {
    overrideSaving.value = false
  }
}

function getVerbalRefForSection(section: any) {
  return verbalReferences.value.find(v => v.section_id === section.id)
}

function getFormDataSummary(formData: any): Record<string, string> {
  if (!formData) return {}
  const summary: Record<string, string> = {}
  const skipKeys = ['signature', 'token', 'hash', 'encrypted']
  for (const [key, val] of Object.entries(formData)) {
    if (skipKeys.some(s => key.toLowerCase().includes(s))) continue
    if (val === null || val === undefined || val === '') continue
    if (typeof val === 'object') continue
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    summary[label] = String(val)
  }
  return summary
}

// ---- Formatters ----

function formatStatus(status: string | undefined): string {
  if (!status) return ''
  return statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatDecision(decision: string): string {
  const labels: Record<string, string> = {
    PASS: 'Pass', FAIL: 'Fail', REFER: 'Refer', PASS_WITH_CONDITION: 'Pass (Conditional)'
  }
  return labels[decision] || decision
}

function formatQueueStatus(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending', READY: 'Ready', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed'
  }
  return labels[status] || status
}

function getEvidenceLabel(section: any): string | null {
  const es = section.section_data?.evidence_status
  if (!es) return null
  // Don't show stale evidence_status if section is already completed
  if (section.queue_status === 'COMPLETED') return null
  const labels: Record<string, string> = {
    AWAITING_EVIDENCE: 'Awaiting Evidence',
    AWAITING_REFEREE: 'Awaiting Referee',
    AWAITING_UPLOAD: 'Awaiting Upload',
    AUTO_PASSED: 'Auto-Passed',
    REFEREE_RECEIVED: 'Referee Received'
  }
  return labels[es] || es
}

function getEvidenceClass(section: any): string {
  const es = section.section_data?.evidence_status
  if (es === 'AWAITING_EVIDENCE') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (es === 'AWAITING_REFEREE' || es === 'AWAITING_UPLOAD') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (es === 'AUTO_PASSED' || es === 'REFEREE_RECEIVED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  return 'bg-gray-100 text-gray-600'
}

function getStatusClass(status: string | undefined): string {
  if (!status) return 'text-gray-600'
  if (status.startsWith('ACCEPTED')) return 'text-green-600'
  if (status === 'REJECTED') return 'text-red-600'
  if (status === 'INDIVIDUAL_COMPLETE' || status === 'GROUP_ASSESSMENT') return 'text-blue-600'
  if (status === 'ACTION_REQUIRED') return 'text-amber-600'
  return 'text-gray-600'
}

function getStatusBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-600'
  if (status.startsWith('ACCEPTED')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'REJECTED') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (status === 'INDIVIDUAL_COMPLETE' || status === 'GROUP_ASSESSMENT') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (status === 'ACTION_REQUIRED') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (status === 'COLLECTING_EVIDENCE') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

function getSectionIconClass(section: any): string {
  if (section.decision === 'PASS') return 'bg-green-100 text-green-600'
  if (section.decision === 'PASS_WITH_CONDITION') return 'bg-amber-100 text-amber-600'
  if (section.decision === 'FAIL' || section.decision === 'REFER') return 'bg-red-100 text-red-600'
  if (section.queue_status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-600'
  if (section.queue_status === 'READY') return 'bg-purple-100 text-purple-600'
  return 'bg-gray-100 text-gray-400'
}

function getQueueStatusClass(status: string): string {
  if (status === 'COMPLETED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (status === 'READY') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
}

function getDecisionClass(decision: string): string {
  if (decision === 'PASS') return 'text-green-600'
  if (decision === 'PASS_WITH_CONDITION') return 'text-amber-600'
  return 'text-red-600'
}

function getActivityDotClass(action: string): string {
  if (action === 'ISSUE_REPORTED') return 'bg-amber-500'
  if (action.includes('UPLOAD') || action.includes('RESPONSE')) return 'bg-blue-500'
  if (action === 'FIELD_EDITED') return 'bg-purple-500'
  if (action === 'STATUS_OVERRIDE') return 'bg-orange-500'
  if (action.includes('COMPLETE') || action.includes('PASS') || action.includes('ACCEPT')) return 'bg-green-500'
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
    'REFEREE_CHASED': 'Referee Chased',
    'STATUS_OVERRIDE': 'Status Override',
    'AML_CHECK_COMPLETED': 'AML Check Completed',
    'CREDIT_CHECK_COMPLETED': 'Credit Check Completed',
    'SECTION_DECISION': 'Section Decision',
    'FINAL_REVIEW_COMPLETED': 'Final Review Completed'
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

function formatDataKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Form data display for sections
const SECTION_FORM_KEYS: Record<string, string> = {
  IDENTITY: 'identity', RTR: 'rtr', INCOME: 'income', RESIDENTIAL: 'residential'
}

const FORM_LABELS: Record<string, string> = {
  'sources': 'Income Sources', 'jobTitle': 'Job Title', 'annualSalary': 'Annual Salary',
  'employerName': 'Employer Name', 'employerAddress': 'Employer Address',
  'employerRefName': 'Employer Ref Name', 'employerRefEmail': 'Employer Ref Email',
  'employerRefPhone': 'Employer Ref Phone', 'employmentStartDate': 'Employment Start Date',
  'payslipsUrl': 'Payslips', 'businessName': 'Business Name', 'businessNature': 'Nature of Business',
  'selfEmployedIncome': 'Self-Employed Income', 'accountantName': 'Accountant Name',
  'accountantEmail': 'Accountant Email', 'taxReturnUrl': 'Tax Return',
  'benefitsAmount': 'Benefits Amount', 'benefitsDocUrl': 'Benefits Document',
  'savingsAmount': 'Savings Amount', 'savingsDocUrl': 'Savings Document',
  'pensionAmount': 'Pension Amount', 'pensionProvider': 'Pension Provider',
  'university': 'University/College', 'course': 'Course', 'studentDocUrl': 'Student Document',
  'currentLivingSituation': 'Current Living Situation',
  'currentLandlordName': 'Current Landlord Name', 'currentLandlordEmail': 'Current Landlord Email',
  'currentLandlordPhone': 'Current Landlord Phone',
  'proofOfAddressUrl': 'Proof of Address',
  'firstName': 'First Name', 'lastName': 'Last Name', 'dateOfBirth': 'Date of Birth',
  'phone': 'Phone', 'idDocumentUrl': 'ID Document', 'selfieUrl': 'Selfie',
  'citizenshipStatus': 'Citizenship Status', 'passportDocUrl': 'Passport',
  'shareCode': 'Share Code',
}

function getSectionFormData(sectionType: string): Record<string, any> | null {
  const key = SECTION_FORM_KEYS[sectionType]
  if (!key || !reference.value?.form_data?.[key]) return null

  const data = reference.value.form_data[key]
  const flat: Record<string, any> = {}

  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'object' && !Array.isArray(v)) {
      // Flatten nested objects (e.g. currentAddress)
      for (const [nk, nv] of Object.entries(v as Record<string, any>)) {
        if (nv !== null && nv !== undefined && nv !== '') {
          flat[`${k}.${nk}`] = nv
        }
      }
    } else {
      flat[k] = v
    }
  }

  return Object.keys(flat).length > 0 ? flat : null
}

function formatFormDataLabel(key: string): string {
  const lastKey = key.includes('.') ? key.split('.').pop()! : key
  return FORM_LABELS[lastKey] || lastKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function formatFormValue(key: string, value: any): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    const lastKey = key.includes('.') ? key.split('.').pop()! : key
    if (lastKey.toLowerCase().includes('salary') || lastKey.toLowerCase().includes('income') || lastKey.toLowerCase().includes('amount') || lastKey.toLowerCase().includes('rent')) {
      return `£${value.toLocaleString()}`
    }
    return String(value)
  }
  return String(value || '-')
}

function isDocUrl(value: any): boolean {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
}

async function handleUploadEvidence(event: Event, section: any) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  const reader = new FileReader()
  const base64 = await new Promise<string>((resolve) => {
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  })

  try {
    const res = await fetch(`${API_URL}/api/v2/sections/${section.id}/upload-evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileData: base64, fileName: file.name, fileType: file.type })
    })

    if (res.ok) {
      alert('Evidence uploaded successfully')
      await loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to upload evidence')
    }
  } catch {
    alert('Failed to upload evidence')
  }

  target.value = ''
}
</script>
