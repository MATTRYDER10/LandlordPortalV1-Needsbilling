<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-6xl mx-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="goBack"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft class="w-5 h-5" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <Award class="w-6 h-6 text-green-600" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">Final Review</h1>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Senior Assessor Decision
              </p>
            </div>
          </div>
          <UKTimeClock />
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="max-w-6xl mx-auto p-6">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 animate-pulse">
        <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Main Content -->
    <main v-else-if="reference" class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- Reference Header -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ reference.tenant_name }}
              </h2>
              <span
                v-if="reference.is_guarantor"
                class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
              >
                Guarantor
              </span>
              <span
                v-if="reference.is_group_parent"
                class="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full"
              >
                Group Lead
              </span>
            </div>
            <p class="text-gray-500 dark:text-slate-400 mt-1">{{ reference.property_address }}</p>
            <p class="text-sm text-gray-400 dark:text-slate-500">{{ reference.company_name }}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary">£{{ reference.monthly_rent }}/mo</div>
            <div class="text-sm text-gray-500">Total Rent</div>
            <div v-if="reference.rent_share !== reference.monthly_rent" class="text-sm text-gray-400 mt-1">
              Share: £{{ reference.rent_share }}/mo
            </div>
          </div>
        </div>
      </div>

      <!-- Group Members (if group) -->
      <div v-if="groupMembers.length > 0" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Group Members</h3>
        <div class="space-y-3">
          <div
            v-for="member in groupMembers"
            :key="member.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
          >
            <div>
              <span class="font-medium text-gray-900 dark:text-white">{{ member.tenant_name }}</span>
              <span
                v-if="member.is_guarantor"
                class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
              >
                Guarantor for {{ member.guarantor_for_name }}
              </span>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-sm text-gray-500">£{{ member.rent_share }}/mo</span>
              <span
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getMemberStatusClass(member)"
              >
                {{ getMemberStatus(member) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section Results Grid -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Section Results</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            v-for="section in sections"
            :key="section.section_type"
            class="p-4 rounded-xl border-2"
            :class="getSectionCardClass(section)"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-gray-900 dark:text-white">{{ getSectionLabel(section.section_type) }}</span>
              <component :is="getSectionStatusIcon(section)" class="w-5 h-5" :class="getSectionIconClass(section)" />
            </div>
            <div class="text-sm" :class="getSectionTextClass(section)">
              {{ getSectionStatusText(section) }}
            </div>
            <div v-if="section.condition_text" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {{ section.condition_text }}
            </div>
            <button
              @click="viewSectionDetails(section)"
              class="mt-2 text-xs text-primary hover:underline"
            >
              View Details
            </button>
          </div>
        </div>
      </div>

      <!-- Affordability Summary -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Affordability</h3>
        <div class="grid grid-cols-3 gap-6">
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Annual Income</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">£{{ formatNumber(reference.annual_income) }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Rent Share (Annual)</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">£{{ formatNumber((reference.rent_share || 0) * 12) }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Affordability Ratio</div>
            <div
              class="text-xl font-bold"
              :class="reference.affordability_pass ? 'text-green-600' : 'text-red-600'"
            >
              {{ reference.affordability_ratio?.toFixed(1) || 'N/A' }}x
              <span class="text-sm font-normal">
                ({{ reference.is_guarantor ? '32x required' : '30x required' }})
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="!reference.affordability_pass"
          class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
        >
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Affordability Below Threshold</p>
              <p class="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Consider ACCEPTED_WITH_GUARANTOR or ACCEPTED_ON_CONDITION
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Final Decision Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Final Decision</h3>

        <!-- Decision Options -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            @click="selectDecision('ACCEPTED')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-green-300'"
          >
            <Check class="w-6 h-6 text-green-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">Accepted</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">All clear, approved</div>
          </button>

          <button
            @click="selectDecision('ACCEPTED_WITH_GUARANTOR')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED_WITH_GUARANTOR'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'"
          >
            <UserPlus class="w-6 h-6 text-blue-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">With Guarantor</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Requires guarantor</div>
          </button>

          <button
            @click="selectDecision('ACCEPTED_ON_CONDITION')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED_ON_CONDITION'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-amber-300'"
          >
            <AlertCircle class="w-6 h-6 text-amber-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">On Condition</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">With noted conditions</div>
          </button>

          <button
            @click="selectDecision('REJECTED')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'REJECTED'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-red-300'"
          >
            <XCircle class="w-6 h-6 text-red-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">Rejected</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Does not pass</div>
          </button>
        </div>

        <!-- Condition/Notes -->
        <div v-if="decision === 'ACCEPTED_ON_CONDITION'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Condition Details *
          </label>
          <textarea
            v-model="conditionText"
            rows="2"
            required
            placeholder="Describe the condition(s)..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Decision Notes
          </label>
          <textarea
            v-model="decisionNotes"
            rows="3"
            placeholder="Notes visible to agent..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            @click="goBack"
            class="px-6 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            @click="submitDecision"
            :disabled="!canSubmit || submitting"
            class="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ submitting ? 'Submitting...' : 'Submit Final Decision' }}
          </button>
        </div>
      </div>
    </main>

    <!-- Queue View (when not reviewing specific reference) -->
    <main v-else class="max-w-5xl mx-auto p-6">
      <div v-if="queueItems.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle class="w-8 h-8 text-green-600" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No references ready for final review</h3>
        <p class="text-gray-500 dark:text-slate-400 mt-1">Check back later</p>
      </div>

      <div v-else class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ queueItems.length }} Reference{{ queueItems.length > 1 ? 's' : '' }} Ready for Final Review
        </h2>
        <div
          v-for="item in queueItems"
          :key="item.id"
          @click="loadReference(item.id)"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">{{ item.tenant_name }}</span>
                <span
                  v-if="item.group_size > 1"
                  class="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full"
                >
                  Group of {{ item.group_size }}
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ item.property_address }}</p>
              <p class="text-xs text-gray-400 dark:text-slate-500">{{ item.company_name }}</p>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-primary">£{{ item.monthly_rent }}/mo</div>
              <ChevronRight class="w-5 h-5 text-gray-400 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import {
  ArrowLeft,
  Award,
  Check,
  XCircle,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  ChevronRight,
  Loader2
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const reference = ref<any>(null)
const sections = ref<any[]>([])
const groupMembers = ref<any[]>([])
const queueItems = ref<any[]>([])

const decision = ref<string | null>(null)
const conditionText = ref('')
const decisionNotes = ref('')

const canSubmit = computed(() => {
  if (!decision.value) return false
  if (decision.value === 'ACCEPTED_ON_CONDITION' && !conditionText.value.trim()) return false
  return true
})

function getSectionLabel(type: string): string {
  const labels: Record<string, string> = {
    IDENTITY: 'Identity',
    RTR: 'Right to Rent',
    INCOME: 'Income',
    RESIDENTIAL: 'Residential',
    CREDIT: 'Credit',
    AML: 'AML'
  }
  return labels[type] || type
}

function getSectionCardClass(section: any): string {
  if (section.decision === 'PASS') return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
  if (section.decision === 'PASS_WITH_CONDITION') return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
  if (section.decision === 'FAIL') return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
  return 'border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-700'
}

function getSectionStatusIcon(section: any) {
  if (section.decision === 'PASS') return Check
  if (section.decision === 'PASS_WITH_CONDITION') return AlertCircle
  if (section.decision === 'FAIL') return XCircle
  return AlertCircle
}

function getSectionIconClass(section: any): string {
  if (section.decision === 'PASS') return 'text-green-600'
  if (section.decision === 'PASS_WITH_CONDITION') return 'text-amber-600'
  if (section.decision === 'FAIL') return 'text-red-600'
  return 'text-gray-400'
}

function getSectionTextClass(section: any): string {
  if (section.decision === 'PASS') return 'text-green-700 dark:text-green-400'
  if (section.decision === 'PASS_WITH_CONDITION') return 'text-amber-700 dark:text-amber-400'
  if (section.decision === 'FAIL') return 'text-red-700 dark:text-red-400'
  return 'text-gray-500'
}

function getSectionStatusText(section: any): string {
  if (section.decision === 'PASS') return 'Passed'
  if (section.decision === 'PASS_WITH_CONDITION') return 'Passed with Condition'
  if (section.decision === 'FAIL') return 'Failed'
  return 'Pending'
}

function getMemberStatus(member: any): string {
  if (member.all_sections_complete) return 'Ready'
  return `${member.completed_sections}/${member.total_sections} complete`
}

function getMemberStatusClass(member: any): string {
  if (member.all_sections_complete) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  return 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-slate-300'
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GB').format(num)
}

function viewSectionDetails(section: any) {
  // Could open a modal with full section details
  console.log('View section:', section)
}

function selectDecision(d: string) {
  decision.value = d
  if (d !== 'ACCEPTED_ON_CONDITION') {
    conditionText.value = ''
  }
}

async function fetchQueueItems() {
  try {
    const response = await fetch(`${API_URL}/api/v2/final-review/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      queueItems.value = data.items || []
    }
  } catch (error) {
    console.error('Error fetching final review queue:', error)
  }
}

async function loadReference(referenceId: string) {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/final-review/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      reference.value = data.reference
      sections.value = data.sections || []
      groupMembers.value = data.groupMembers || []
    }
  } catch (error) {
    console.error('Error loading reference:', error)
  } finally {
    loading.value = false
  }
}

async function submitDecision() {
  if (!canSubmit.value || !reference.value) return

  submitting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/final-review/${reference.value.id}/decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        decision: decision.value,
        conditionText: conditionText.value || undefined,
        notes: decisionNotes.value || undefined
      })
    })

    if (response.ok) {
      // Clear and go back
      reference.value = null
      decision.value = null
      conditionText.value = ''
      decisionNotes.value = ''
      await fetchQueueItems()
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to submit decision')
    }
  } catch (error) {
    console.error('Error submitting decision:', error)
    alert('Failed to submit decision')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (reference.value) {
    reference.value = null
    decision.value = null
  } else {
    router.push({ name: 'StaffDashboardV2' })
  }
}

onMounted(async () => {
  const refId = route.params.referenceId as string
  if (refId) {
    await loadReference(refId)
  } else {
    await fetchQueueItems()
  }
  loading.value = false
})
</script>
