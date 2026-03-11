<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-4xl mx-auto">
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
                <component :is="sectionIcon" class="w-6 h-6 text-primary" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ sectionTitle }} Verification</h1>
              </div>
            </div>
          </div>
          <UKTimeClock />
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-4xl mx-auto p-6">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 animate-pulse">
        <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-1/2 mb-2"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-2/3"></div>
      </div>
    </div>

    <!-- Main Content -->
    <main v-else class="max-w-4xl mx-auto p-6 space-y-6">
      <!-- Applicant Info Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ section?.tenant_name }}
            </h2>
            <p class="text-gray-500 dark:text-slate-400 mt-1">
              {{ section?.property_address }}
            </p>
            <p class="text-sm text-gray-400 dark:text-slate-500">
              {{ section?.company_name }}
            </p>
          </div>
          <div class="text-right">
            <div class="text-lg font-semibold text-primary">£{{ section?.rent_share || section?.monthly_rent }}/mo</div>
            <div class="text-sm text-gray-500">Rent Share</div>
            <div v-if="section?.is_guarantor" class="mt-2 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full inline-block">
              Guarantor
            </div>
          </div>
        </div>

        <!-- Affordability indicator for income section -->
        <div v-if="section?.section_type === 'INCOME' && section?.affordability" class="mt-4 p-3 rounded-lg"
          :class="section.affordability.passes ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium" :class="section.affordability.passes ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'">
              Affordability: {{ section.affordability.ratio.toFixed(1) }}x
            </span>
            <span class="text-sm" :class="section.affordability.passes ? 'text-green-600' : 'text-amber-600'">
              {{ section.affordability.passes ? 'Passes' : 'Below threshold' }}
            </span>
          </div>
          <p class="text-xs mt-1" :class="section.affordability.passes ? 'text-green-600/80' : 'text-amber-600/80'">
            Required: {{ section.is_guarantor ? '32x' : '30x' }} monthly rent = £{{ section.affordability.required }}/year
          </p>
        </div>
      </div>

      <!-- Checklist -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <SectionChecklist
          :steps="checklistSteps"
          @view-image="viewImage"
          @step-complete="onStepComplete"
          @issue-reported="onIssueReported"
          @all-complete="onAllStepsComplete"
        />
      </div>

      <!-- Decision Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <DecisionPanel
          :section-type="section?.section_type || ''"
          :submitting="submitting"
          @submit="submitDecision"
          @release="releaseToQueue"
        />
      </div>
    </main>

    <!-- Image Viewer Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="viewingImage"
          class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          @click="viewingImage = null"
        >
          <button
            class="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            @click="viewingImage = null"
          >
            <X class="w-8 h-8" />
          </button>
          <img
            :src="viewingImage"
            class="max-w-full max-h-full object-contain"
            @click.stop
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import SectionChecklist from './components/SectionChecklist.vue'
import DecisionPanel from './components/DecisionPanel.vue'
import {
  ArrowLeft,
  X,
  IdCard,
  Home,
  Briefcase,
  Building2,
  CreditCard,
  Shield,
  FileText
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const section = ref<any>(null)
const viewingImage = ref<string | null>(null)

const sectionId = computed(() => route.params.sectionId as string)

const sectionTitle = computed(() => {
  const titles: Record<string, string> = {
    IDENTITY: 'Identity',
    RTR: 'Right to Rent',
    INCOME: 'Income',
    RESIDENTIAL: 'Residential',
    CREDIT: 'Credit',
    AML: 'AML'
  }
  return titles[section.value?.section_type] || section.value?.section_type || 'Section'
})

const sectionIcon = computed(() => {
  const icons: Record<string, any> = {
    IDENTITY: IdCard,
    RTR: Home,
    INCOME: Briefcase,
    RESIDENTIAL: Building2,
    CREDIT: CreditCard,
    AML: Shield
  }
  return icons[section.value?.section_type] || FileText
})

const checklistSteps = computed(() => {
  if (!section.value) return []

  // Build steps based on section type and evidence
  const type = section.value.section_type
  const evidence = section.value.evidence || {}

  switch (type) {
    case 'IDENTITY':
      return [
        {
          title: 'Review ID Document',
          checklistItems: [
            { label: 'Document is clear and readable', hint: 'Check all text is legible, no blur or glare' },
            { label: `Name matches: ${section.value.tenant_name}`, hint: 'Compare name on ID with application name exactly' },
            { label: 'Document is valid (check expiry date)', hint: 'Document must not be expired at move-in date' }
          ],
          evidence: evidence.id_document ? {
            type: 'image',
            url: evidence.id_document.url,
            label: 'ID Document'
          } : undefined,
          inputFields: [
            {
              name: 'document_type',
              label: 'Document Type',
              type: 'select',
              options: [
                { value: 'PASSPORT', label: 'Passport' },
                { value: 'DRIVING_LICENSE', label: 'Driving License' },
                { value: 'ID_CARD', label: 'ID Card' },
                { value: 'BRP', label: 'BRP Card' }
              ]
            },
            { name: 'expiry_date', label: 'Expiry Date', type: 'date' }
          ]
        },
        {
          title: 'Compare Selfie to ID',
          checklistItems: [
            { label: 'Same person in both photos', hint: 'Compare facial features, ears, nose shape' },
            { label: 'Selfie appears recent (matches ID age)', hint: 'Person should look same age as ID photo' },
            { label: 'No signs of photo manipulation', hint: 'Check for blurring, cut edges, inconsistent lighting' }
          ],
          evidence: evidence.selfie && evidence.id_document ? {
            type: 'compare',
            leftUrl: evidence.id_document.url,
            leftLabel: 'ID Photo',
            rightUrl: evidence.selfie.url,
            rightLabel: 'Selfie'
          } : undefined
        }
      ]

    case 'RTR':
      return [
        {
          title: 'Check Citizenship Status',
          checklistItems: [
            { label: 'Citizenship/visa status confirmed', hint: 'Verify the type of right to rent' },
            { label: 'Documentation is valid', hint: 'Check expiry dates and authenticity' }
          ],
          evidence: evidence.rtr_document ? {
            type: 'image',
            url: evidence.rtr_document.url,
            label: 'Right to Rent Evidence'
          } : undefined,
          inputFields: [
            {
              name: 'rtr_type',
              label: 'RTR Type',
              type: 'select',
              options: [
                { value: 'BRITISH_CITIZEN', label: 'British Citizen' },
                { value: 'EU_SETTLED', label: 'EU Settled Status' },
                { value: 'EU_PRE_SETTLED', label: 'EU Pre-Settled Status' },
                { value: 'VISA', label: 'Visa' },
                { value: 'SHARE_CODE', label: 'Share Code Verified' }
              ]
            }
          ]
        },
        {
          title: 'Confirm Right to Rent',
          checklistItems: [
            { label: 'Right to rent status allows tenancy', hint: 'Status must permit renting in the UK' },
            { label: 'Valid until after move-in date', hint: 'Check expiry is after proposed move date' }
          ]
        }
      ]

    case 'INCOME':
      const incomeSteps = [
        {
          title: 'Review Income Evidence',
          checklistItems: [
            { label: 'Income evidence is present', hint: 'Payslips, bank statements, or tax returns' },
            { label: 'Evidence covers required period', hint: '3 months for employed, 12 months for self-employed' },
            { label: 'Income amounts are consistent', hint: 'Check for irregularities' }
          ],
          evidence: evidence.payslips ? {
            type: 'document',
            url: evidence.payslips.url,
            label: 'Income Evidence',
            filename: evidence.payslips.filename
          } : undefined,
          inputFields: [
            { name: 'annual_income', label: 'Calculated Annual Income (£)', type: 'text', placeholder: 'e.g. 35000' }
          ]
        }
      ]

      // Add employer reference step if present
      if (section.value.employer_reference) {
        incomeSteps.push({
          title: 'Review Employer Reference',
          checklistItems: [
            { label: 'Employment confirmed', hint: 'Employer confirms active employment' },
            { label: 'Job title matches application', hint: 'Compare stated role' },
            { label: 'Salary matches income evidence', hint: 'Check for consistency' }
          ],
          evidence: {
            type: 'data',
            data: section.value.employer_reference
          },
          inputFields: []
        })
      }

      return incomeSteps

    case 'RESIDENTIAL':
      return [
        {
          title: 'Check Address History',
          checklistItems: [
            { label: 'Current address provided', hint: 'Verify current living situation' },
            { label: 'Previous addresses if < 3 years at current', hint: 'Check address history completeness' }
          ],
          evidence: section.value.address_history ? {
            type: 'data',
            data: section.value.address_history
          } : undefined
        },
        {
          title: 'Review Landlord/Agent Reference',
          checklistItems: [
            { label: 'Tenancy dates confirmed', hint: 'Verify move-in and move-out dates' },
            { label: 'Rent payment history reviewed', hint: 'Check for arrears or late payments' },
            { label: 'No issues reported', hint: 'Look for complaints or damages' }
          ],
          evidence: section.value.landlord_reference ? {
            type: 'data',
            data: section.value.landlord_reference
          } : undefined
        }
      ]

    case 'CREDIT':
      return [
        {
          title: 'Review Credit Check Results',
          checklistItems: [
            { label: 'Credit check completed', hint: 'Verify Creditsafe results received' },
            { label: 'No CCJs found', hint: 'Check for County Court Judgments' },
            { label: 'No bankruptcies or IVAs', hint: 'Check insolvency records' },
            { label: 'Credit score acceptable', hint: 'Review overall credit score' }
          ],
          evidence: section.value.credit_check ? {
            type: 'data',
            data: {
              'Credit Score': section.value.credit_check.score,
              'CCJs': section.value.credit_check.ccj_count || 'None',
              'Bankruptcies': section.value.credit_check.bankruptcy ? 'Yes' : 'None',
              'IVAs': section.value.credit_check.iva ? 'Yes' : 'None'
            }
          } : undefined
        }
      ]

    case 'AML':
      return [
        {
          title: 'Review AML Check Results',
          checklistItems: [
            { label: 'Sanctions screening completed', hint: 'Verify no matches on sanctions lists' },
            { label: 'PEP status checked', hint: 'Check Politically Exposed Person status' },
            { label: 'No adverse findings', hint: 'Review for any concerns' }
          ],
          evidence: section.value.aml_check ? {
            type: 'data',
            data: {
              'Sanctions': section.value.aml_check.sanctions_match ? 'MATCH' : 'Clear',
              'PEP Status': section.value.aml_check.pep_status || 'Not PEP',
              'Adverse Media': section.value.aml_check.adverse_media ? 'Found' : 'None'
            }
          } : undefined
        }
      ]

    default:
      return []
  }
})

async function fetchSection() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      section.value = await response.json()
    } else {
      router.push({ name: 'StaffDashboardV2' })
    }
  } catch (error) {
    console.error('Error fetching section:', error)
    router.push({ name: 'StaffDashboardV2' })
  } finally {
    loading.value = false
  }
}

function viewImage(url: string) {
  viewingImage.value = url
}

function onStepComplete(index: number, data: any) {
  console.log('Step complete:', index, data)
}

function onIssueReported(index: number, reason: string, notes: string) {
  console.log('Issue reported:', index, reason, notes)
}

function onAllStepsComplete(data: any) {
  console.log('All steps complete:', data)
}

async function submitDecision(data: any) {
  submitting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      router.push({ name: 'StaffDashboardV2' })
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

async function releaseToQueue() {
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      router.push({ name: 'StaffDashboardV2' })
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to release item')
    }
  } catch (error) {
    console.error('Error releasing item:', error)
    alert('Failed to release item')
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  fetchSection()
})
</script>
