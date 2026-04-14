<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-2xl">
      <!-- Loading State -->
      <div v-if="loading" class="text-center">
        <div class="inline-flex items-center justify-center">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-slate-700" style="border-top-color: #f97316;"></div>
        </div>
        <p class="mt-6 text-gray-600 dark:text-slate-400">Verifying reference...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 text-center border border-gray-200 dark:border-slate-700">
        <div class="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reference Not Found</h2>
        <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
        <p class="text-sm text-gray-500 dark:text-slate-500 mt-4">If you believe this is incorrect, please contact the property manager or agent.</p>
      </div>

      <!-- Success State -->
      <div v-else-if="data" class="space-y-6">
        <!-- Hero Card -->
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg p-8 border border-green-200 dark:border-green-800">
          <div class="flex items-start justify-between gap-6 mb-6">
            <div>
              <div class="flex items-center gap-3 mb-4">
                <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
              <h1 class="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">Verified Reference</h1>
              <p class="text-green-800 dark:text-green-200">This reference has been verified and approved</p>
            </div>
          </div>

          <!-- Status Badge -->
          <div class="flex flex-wrap gap-2">
            <span :class="[
              'inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold',
              {
                'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100': data.status === 'ACCEPTED',
                'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100': data.status === 'ACCEPTED_WITH_GUARANTOR',
                'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100': data.status === 'ACCEPTED_ON_CONDITION',
                'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100': data.status === 'REJECTED'
              }
            ]">
              {{ formatStatus(data.status) }}
            </span>
          </div>
        </div>

        <!-- Verification Details -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-slate-700">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Verification Details</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Tenant Name</p>
              <p class="text-lg text-gray-900 dark:text-white font-semibold">{{ data.tenantName }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Property Address</p>
              <p class="text-lg text-gray-900 dark:text-white font-semibold">{{ data.propertyAddress }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Report Generated</p>
              <p class="text-lg text-gray-900 dark:text-white font-semibold">{{ formatDate(data.reportGeneratedAt) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Verified</p>
              <p class="text-lg text-gray-900 dark:text-white font-semibold">{{ formatDate(data.verifiedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Sections Table -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-8 py-6 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">Reference Sections</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th class="px-8 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Section Type</th>
                  <th class="px-8 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Decision</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-slate-700">
                <tr v-for="section in data.sections" :key="section.type" class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td class="px-8 py-4 text-sm text-gray-900 dark:text-slate-300 font-medium">
                    {{ formatSectionType(section.type) }}
                  </td>
                  <td class="px-8 py-4 text-sm">
                    <span :class="[
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                      {
                        'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300': section.decision === 'PASSED',
                        'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300': section.decision === 'FAILED',
                        'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300': section.decision === 'CONDITIONAL',
                        'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300': !section.decision
                      }
                    ]">
                      {{ formatDecision(section.decision) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center py-6 px-6 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
          <p class="text-sm text-gray-600 dark:text-slate-400">
            Powered by <span class="font-semibold text-gray-900 dark:text-white">PropertyGoose</span>
          </p>
          <p class="text-xs text-gray-500 dark:text-slate-500 mt-2">
            Reference ID: {{ referenceId }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const referenceId = computed(() => route.params.referenceId as string)

const loading = ref(true)
const error = ref('')
const data = ref<any>(null)

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function loadVerification() {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_URL}/api/v2/verify/${referenceId.value}`)

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      error.value = errorData.error || 'Unable to verify this reference. It may not have been finalized yet.'
      return
    }

    data.value = await res.json()
  } catch (e) {
    error.value = 'Failed to load verification. Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted with Guarantor',
    'ACCEPTED_ON_CONDITION': 'Accepted on Condition',
    'REJECTED': 'Rejected'
  }
  return statusMap[status] || status
}

function formatSectionType(type: string): string {
  const typeMap: Record<string, string> = {
    'EMPLOYER': 'Employment Reference',
    'LANDLORD': 'Landlord Reference',
    'ACCOUNTANT': 'Accountant Reference',
    'CREDIT': 'Credit Check',
    'AML': 'AML/Sanctions',
    'RESIDENTIAL': 'Residential History',
    'INCOME': 'Income Verification',
    'GUARANTOR': 'Guarantor Reference',
    'GUARANTOR_EMPLOYER': 'Guarantor Employment',
    'GUARANTOR_CREDIT': 'Guarantor Credit Check'
  }
  return typeMap[type] || type
}

function formatDecision(decision: string | null): string {
  if (!decision) return 'Pending'
  const decisionMap: Record<string, string> = {
    'PASSED': 'Passed',
    'FAILED': 'Failed',
    'CONDITIONAL': 'Conditional',
    'PASS': 'Passed',
    'FAIL': 'Failed'
  }
  return decisionMap[decision] || decision
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

onMounted(() => {
  loadVerification()
})
</script>
