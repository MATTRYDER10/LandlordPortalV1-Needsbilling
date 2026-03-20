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
                <Users class="w-6 h-6 text-blue-600" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">Group Assessment</h1>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Combined Affordability Review
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

    <!-- Detail View (when group loaded) -->
    <main v-else-if="groupData" class="max-w-6xl mx-auto p-6 space-y-6">

      <!-- Property Header Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-1">Property</p>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ groupData.property_address }}
              <span v-if="groupData.property_city">, {{ groupData.property_city }}</span>
              <span v-if="groupData.property_postcode"> {{ groupData.property_postcode }}</span>
            </h2>
            <p class="text-sm text-gray-400 dark:text-slate-500 mt-1">{{ groupData.company_name || 'Unknown Company' }}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary">&pound;{{ groupData.monthly_rent }}/mo</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Monthly Rent</div>
          </div>
        </div>
      </div>

      <!-- Member Cards -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Group Members</h3>
        <div
          v-for="member in groupMembers"
          :key="member.id"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-lg font-semibold text-gray-900 dark:text-white">{{ member.name }}</h4>
                <span
                  v-if="member.isGuarantor"
                  class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
                >
                  Guarantor
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {{ member.role_label }}
              </p>
            </div>
            <div class="text-right">
              <span
                class="px-3 py-1 text-sm font-medium rounded-full"
                :class="getIndividualResultClass(member.individual_result)"
              >
                {{ member.individual_result || 'Pending' }}
              </span>
            </div>
          </div>

          <!-- Affordability info -->
          <div class="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div class="text-xs text-gray-500 dark:text-slate-400">Annual Income</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">&pound;{{ formatNumber(member.annual_income) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 dark:text-slate-400">Max Affordable Rent</div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">
                &pound;{{ formatNumber(member.max_affordable_rent) }}/mo
              </div>
            </div>
            <div v-if="member.report_pdf_url">
              <a
                :href="member.report_pdf_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <FileText class="w-4 h-4" />
                Individual Report
              </a>
            </div>
          </div>

          <!-- Guarantor sub-card -->
          <div
            v-if="member.guarantor"
            class="mt-3 ml-6 border-l-2 border-blue-300 dark:border-blue-700 pl-4"
          >
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div class="flex items-center gap-2 mb-2">
                <Shield class="w-4 h-4 text-blue-600" />
                <span class="font-semibold text-gray-900 dark:text-white text-sm">
                  Guarantor: {{ member.guarantor.name }}
                </span>
                <span
                  class="px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="getIndividualResultClass(member.guarantor.individual_result)"
                >
                  {{ member.guarantor.individual_result || 'Pending' }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div class="text-xs text-gray-500 dark:text-slate-400">Annual Income</div>
                  <div class="font-semibold text-gray-900 dark:text-white">&pound;{{ formatNumber(member.guarantor.annual_income) }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 dark:text-slate-400">Max Affordable Rent (32x)</div>
                  <div class="font-semibold text-gray-900 dark:text-white">&pound;{{ formatNumber(member.guarantor.max_affordable_rent) }}/mo</div>
                </div>
                <div v-if="member.guarantor.report_pdf_url">
                  <a
                    :href="member.guarantor.report_pdf_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-blue-600 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <FileText class="w-3 h-3" />
                    Report
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rent Share Editor -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Rent Share Allocation</h3>
        <div class="space-y-3">
          <div
            v-for="tenant in tenantMembers"
            :key="tenant.id"
            class="flex items-center gap-4"
          >
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ tenant.name }}</div>
              <div class="text-xs text-gray-500 dark:text-slate-400">
                Max affordable: &pound;{{ formatNumber(tenant.max_affordable_rent) }}/mo
              </div>
            </div>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">&pound;</span>
              <input
                type="number"
                :value="rentShares[tenant.id] ?? ''"
                @input="updateRentShare(tenant.id, ($event.target as HTMLInputElement).value)"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-36 pl-7 pr-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-right"
                :class="getRentShareInputClass(tenant.id)"
              />
            </div>
          </div>
        </div>

        <!-- Running total -->
        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div class="text-sm text-gray-500 dark:text-slate-400">Rent share total</div>
          <div class="flex items-center gap-3">
            <span
              class="text-lg font-bold"
              :class="rentShareTotalMatches ? 'text-green-600' : 'text-red-600'"
            >
              &pound;{{ formatNumber(rentShareTotal) }}
            </span>
            <span class="text-sm text-gray-400">/</span>
            <span class="text-sm text-gray-500 dark:text-slate-400">
              &pound;{{ formatNumber(groupData.monthly_rent) }} total rent
            </span>
            <component
              :is="rentShareTotalMatches ? CheckCircle : AlertTriangle"
              class="w-5 h-5"
              :class="rentShareTotalMatches ? 'text-green-600' : 'text-red-600'"
            />
          </div>
        </div>
      </div>

      <!-- Combined Affordability Summary -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Combined Affordability Summary</h3>
        <div class="grid grid-cols-3 gap-6">
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Combined Annual Income</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              &pound;{{ formatNumber(combinedAffordability.totalAnnualIncome) }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Monthly Rent</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              &pound;{{ formatNumber(combinedAffordability.totalMonthlyRent) }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Combined Ratio</div>
            <div
              class="text-xl font-bold"
              :class="combinedAffordability.pass ? 'text-green-600' : 'text-red-600'"
            >
              {{ combinedAffordability.ratio.toFixed(1) }}x
              <span class="text-sm font-normal">(2.5x required)</span>
            </div>
          </div>
        </div>

        <div
          v-if="!combinedAffordability.pass"
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

      <!-- Group Decision Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Group Decision</h3>

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

        <!-- Notes -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Decision Notes
          </label>
          <textarea
            v-model="decisionNotes"
            rows="3"
            placeholder="Notes about the group decision..."
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
            {{ submitting ? 'Submitting...' : 'Submit Group Decision' }}
          </button>
        </div>
      </div>
    </main>

    <!-- Queue View (when no group selected) -->
    <main v-else class="max-w-5xl mx-auto p-6">
      <div v-if="queueItems.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle class="w-8 h-8 text-blue-600" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No groups ready for assessment</h3>
        <p class="text-gray-500 dark:text-slate-400 mt-1">Check back later</p>
      </div>

      <div v-else class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ queueItems.length }} Group{{ queueItems.length > 1 ? 's' : '' }} Ready for Assessment
        </h2>
        <div
          v-for="item in queueItems"
          :key="item.id"
          @click="loadGroup(item.parent_id || item.id)"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">{{ item.property_address }}</span>
                <span
                  class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
                >
                  {{ item.tenant_count }} tenant{{ item.tenant_count > 1 ? 's' : '' }}
                </span>
              </div>
              <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">{{ item.company_name }}</p>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-primary">&pound;{{ item.monthly_rent }}/mo</div>
              <ChevronRight class="w-5 h-5 text-gray-400 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import {
  ArrowLeft,
  Users,
  Check,
  XCircle,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  ChevronRight,
  Loader2,
  FileText,
  Shield
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const router = useRouter()
const authStore = useAuthStore()

// ============================================================================
// Types
// ============================================================================

interface GroupMember {
  id: string
  name: string
  isGuarantor: boolean
  isTenant: boolean
  role_label: string
  individual_result: string | null
  annual_income: number
  max_affordable_rent: number
  report_pdf_url: string | null
  guarantor: GroupMember | null
}

// ============================================================================
// State
// ============================================================================

const loading = ref(true)
const submitting = ref(false)
const groupData = ref<any>(null)
const queueItems = ref<any[]>([])

const decision = ref<string | null>(null)
const decisionNotes = ref('')
const rentShares = reactive<Record<string, number>>({})

// ============================================================================
// Computed
// ============================================================================

const groupMembers = computed<GroupMember[]>(() => {
  if (!groupData.value?.members) return []

  return groupData.value.members.map((m: any) => {
    const name = `${m.tenant_first_name || ''} ${m.tenant_last_name || ''}`.trim()
    const isGuarantor = m.reference_type === 'GUARANTOR'
    const annualIncome = m.annual_income || 0
    const divisor = isGuarantor ? 32 : 30
    const maxAffordable = annualIncome / divisor

    // Parse individual result from final_decision_notes
    let individualResult: string | null = null
    if (m.final_decision_notes) {
      const match = m.final_decision_notes.match(/INDIVIDUAL_DECISION:\s*(\S+)/)
      if (match) individualResult = match[1]
    }
    if (m.individual_decision) individualResult = m.individual_decision
    if (m.individual_result) individualResult = m.individual_result

    // Build guarantor if present
    let guarantor: GroupMember | null = null
    if (m.guarantor) {
      const gName = `${m.guarantor.tenant_first_name || ''} ${m.guarantor.tenant_last_name || ''}`.trim()
      const gIncome = m.guarantor.annual_income || 0
      let gResult: string | null = null
      if (m.guarantor.final_decision_notes) {
        const gMatch = m.guarantor.final_decision_notes.match(/INDIVIDUAL_DECISION:\s*(\S+)/)
        if (gMatch) gResult = gMatch[1]
      }
      if (m.guarantor.individual_decision) gResult = m.guarantor.individual_decision
      if (m.guarantor.individual_result) gResult = m.guarantor.individual_result

      guarantor = {
        id: m.guarantor.id,
        name: gName,
        isGuarantor: true,
        isTenant: false,
        role_label: 'Guarantor',
        individual_result: gResult,
        annual_income: gIncome,
        max_affordable_rent: gIncome / 32,
        report_pdf_url: m.guarantor.report_pdf_url || null,
        guarantor: null
      }
    }

    return {
      id: m.id,
      name,
      isGuarantor,
      isTenant: !isGuarantor,
      role_label: isGuarantor ? 'Guarantor' : 'Tenant',
      individual_result: individualResult,
      annual_income: annualIncome,
      max_affordable_rent: maxAffordable,
      report_pdf_url: m.report_pdf_url || null,
      guarantor
    }
  })
})

const tenantMembers = computed(() => {
  return groupMembers.value.filter(m => m.isTenant)
})

const rentShareTotal = computed(() => {
  return Object.values(rentShares).reduce((sum, val) => sum + (val || 0), 0)
})

const rentShareTotalMatches = computed(() => {
  if (!groupData.value) return false
  return Math.abs(rentShareTotal.value - groupData.value.monthly_rent) < 0.01
})

const combinedAffordability = computed(() => {
  const tenants = tenantMembers.value
  const totalAnnualIncome = tenants.reduce((sum, t) => sum + t.annual_income, 0)
  const totalMonthlyRent = groupData.value?.monthly_rent || 0
  const totalAnnualRent = totalMonthlyRent * 12
  const ratio = totalAnnualRent > 0 ? totalAnnualIncome / totalAnnualRent : 0
  const pass = ratio >= 2.5

  return {
    totalAnnualIncome,
    totalMonthlyRent,
    ratio,
    pass
  }
})

const canSubmit = computed(() => {
  if (!decision.value) return false
  if (!rentShareTotalMatches.value) return false
  return true
})

// ============================================================================
// Helpers
// ============================================================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)
}

function getIndividualResultClass(result: string | null): string {
  if (!result) return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
  if (result === 'ACCEPTED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (result === 'REJECTED') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (result.startsWith('ACCEPTED')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
}

function getRentShareInputClass(tenantId: string): string {
  const val = rentShares[tenantId]
  if (val === undefined || val === null) return 'border-gray-300 dark:border-slate-600'
  const member = tenantMembers.value.find(m => m.id === tenantId)
  if (member && val > member.max_affordable_rent) {
    return 'border-red-400 dark:border-red-600'
  }
  return 'border-gray-300 dark:border-slate-600'
}

function updateRentShare(tenantId: string, value: string) {
  const num = parseFloat(value)
  if (isNaN(num)) {
    delete rentShares[tenantId]
  } else {
    rentShares[tenantId] = num
  }
}

function selectDecision(d: string) {
  decision.value = d
}

// ============================================================================
// API calls
// ============================================================================

async function fetchQueueItems() {
  try {
    const response = await fetch(`${API_URL}/api/v2/group-assessment/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      queueItems.value = data.items || []
    }
  } catch (error) {
    console.error('Error fetching group assessment queue:', error)
  }
}

async function loadGroup(parentId: string) {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/group-assessment/${parentId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      // Flatten parent data for easy template access
      groupData.value = {
        ...data.parent,
        monthly_rent: data.totalMonthlyRent || data.parent?.monthly_rent || 0,
        company_name: data.companyName || data.parent?.company_name || 'Unknown',
        members: data.members || [],
        children: data.children || [],
        parent_id: data.parent?.id
      }

      // Initialize rent shares from members
      if (data.members) {
        for (const member of data.members) {
          if (!member.guarantor && member.rent_share) {
            rentShares[member.id] = member.rent_share
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading group:', error)
  } finally {
    loading.value = false
  }
}

async function submitDecision() {
  if (!canSubmit.value || !groupData.value) return

  submitting.value = true
  try {
    const parentId = groupData.value.parent_id || groupData.value.id
    const rentSharePayload = tenantMembers.value.map(t => ({
      referenceId: t.id,
      rentShare: rentShares[t.id] || 0
    }))

    const response = await fetch(`${API_URL}/api/v2/group-assessment/${parentId}/decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        decision: decision.value,
        notes: decisionNotes.value || undefined,
        rentShares: rentSharePayload
      })
    })

    if (response.ok) {
      // Clear state and refresh queue
      groupData.value = null
      decision.value = null
      decisionNotes.value = ''
      Object.keys(rentShares).forEach(k => delete rentShares[k])
      await fetchQueueItems()
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to submit group decision')
    }
  } catch (error) {
    console.error('Error submitting group decision:', error)
    alert('Failed to submit group decision')
  } finally {
    submitting.value = false
  }
}

// ============================================================================
// Navigation
// ============================================================================

function goBack() {
  if (groupData.value) {
    groupData.value = null
    decision.value = null
    decisionNotes.value = ''
    Object.keys(rentShares).forEach(k => delete rentShares[k])
  } else {
    router.push({ name: 'StaffDashboardV2' })
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  await fetchQueueItems()
  loading.value = false
})
</script>
