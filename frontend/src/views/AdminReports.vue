<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <AdminHeader />

    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p class="mt-1 text-sm text-gray-600">Comprehensive business insights and performance metrics</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Date Range Filter -->
      <div class="bg-white shadow rounded-lg p-4 mb-6">
        <div class="flex items-center gap-4 flex-wrap">
          <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Date Range:</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="option in dateRangeOptions"
              :key="option.value"
              @click="setDateRange(option.value)"
              :class="dateRange === option.value ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              {{ option.label }}
            </button>
            <input
              type="date"
              v-model="customStartDate"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary"
              placeholder="Start"
            />
            <span class="flex items-center text-gray-500">to</span>
            <input
              type="date"
              v-model="customEndDate"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary"
              placeholder="End"
            />
            <button
              @click="applyCustomDateRange"
              class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="bg-white shadow rounded-lg mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 px-6" aria-label="Reports">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <!-- Financial Tab -->
          <div v-if="activeTab === 'financial'">
            <div v-if="loadingRevenue" class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <div v-else>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Revenue Trends</h3>
                <p class="text-sm text-gray-600 mb-4">Revenue breakdown by source over time</p>

                <!-- Revenue Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <p class="text-sm text-blue-600 font-medium">Total Revenue</p>
                    <p class="text-2xl font-bold text-blue-900">£{{ revenueTotals.total }}</p>
                  </div>
                  <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <p class="text-sm text-green-600 font-medium">Subscriptions</p>
                    <p class="text-2xl font-bold text-green-900">£{{ revenueTotals.subscriptions }}</p>
                  </div>
                  <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <p class="text-sm text-purple-600 font-medium">Credit Packs</p>
                    <p class="text-2xl font-bold text-purple-900">£{{ revenueTotals.packs }}</p>
                  </div>
                  <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <p class="text-sm text-orange-600 font-medium">Agreements</p>
                    <p class="text-2xl font-bold text-orange-900">£{{ revenueTotals.agreements }}</p>
                  </div>
                </div>

                <div class="bg-white rounded-lg border border-gray-200 p-4">
                  <canvas ref="revenueChart"></canvas>
                </div>
                <div class="mt-4 flex justify-end">
                  <button
                    @click="exportCSV('revenue')"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- References Tab -->
          <div v-if="activeTab === 'references'">
            <div v-if="loadingPipeline" class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <div v-else>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Reference Pipeline Funnel</h3>
                <p class="text-sm text-gray-600 mb-4">Conversion rates through reference lifecycle</p>

                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Average Completion Time</p>
                    <p class="text-2xl font-bold text-gray-900">{{ pipelineData.avgCompletionTimeHours }} hours</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Completion Rate</p>
                    <p class="text-2xl font-bold text-gray-900">
                      {{ pipelineData.funnel?.[3]?.percentage || 0 }}%
                    </p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Total References</p>
                    <p class="text-2xl font-bold text-gray-900">{{ pipelineData.statusBreakdown?.total || 0 }}</p>
                  </div>
                </div>

                <!-- Funnel Visualization -->
                <div class="bg-white rounded-lg border border-gray-200 p-6">
                  <div class="space-y-4">
                    <div v-for="(stage, index) in pipelineData.funnel" :key="index" class="relative">
                      <div class="flex items-center gap-4">
                        <div class="flex-1">
                          <div class="flex justify-between mb-2">
                            <span class="text-sm font-medium text-gray-900">{{ stage.stage }}</span>
                            <span class="text-sm text-gray-600">{{ stage.count }} references ({{ stage.percentage }}%)</span>
                          </div>
                          <div class="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                            <div
                              class="h-8 rounded-full transition-all duration-500"
                              :class="getFunnelColor(index)"
                              :style="{ width: stage.percentage + '%' }"
                            >
                              <span class="flex items-center justify-center h-full text-xs font-semibold text-white">
                                {{ stage.percentage }}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-if="stage.conversionFromPrevious !== null" class="mt-1 text-xs text-gray-500 ml-4">
                        ↓ {{ stage.conversionFromPrevious }}% conversion from previous stage
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex justify-end">
                  <button
                    @click="exportCSV('pipeline')"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Staff Tab -->
          <div v-if="activeTab === 'staff'">
            <div v-if="loadingStaff" class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <div v-else>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Staff Performance Detail</h3>
                <p class="text-sm text-gray-600 mb-4">Detailed verification performance metrics by staff member</p>

                <div v-if="staffPerformance.length === 0" class="text-center py-12 text-gray-500">
                  No staff performance data for this period
                </div>
                <div v-else class="space-y-6">
                  <div v-for="staff in staffPerformance" :key="staff.staffId" class="bg-white rounded-lg border border-gray-200 p-6">
                    <div class="flex items-center justify-between mb-4">
                      <div>
                        <h4 class="text-lg font-semibold text-gray-900">{{ staff.staffName }}</h4>
                        <p class="text-sm text-gray-500">{{ staff.staffEmail }}</p>
                      </div>
                      <div class="text-right">
                        <div class="text-2xl font-bold text-gray-900">{{ staff.passRate }}%</div>
                        <div class="text-xs text-gray-500">Pass Rate</div>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div class="bg-gray-50 rounded p-3">
                        <p class="text-xs text-gray-600">Total Steps</p>
                        <p class="text-xl font-bold text-gray-900">{{ staff.totalSteps }}</p>
                      </div>
                      <div class="bg-green-50 rounded p-3">
                        <p class="text-xs text-green-600">Passed</p>
                        <p class="text-xl font-bold text-green-900">{{ staff.passedSteps }}</p>
                      </div>
                      <div class="bg-red-50 rounded p-3">
                        <p class="text-xs text-red-600">Failed</p>
                        <p class="text-xl font-bold text-red-900">{{ staff.failedSteps }}</p>
                      </div>
                      <div class="bg-blue-50 rounded p-3">
                        <p class="text-xs text-blue-600">Pass Rate</p>
                        <p class="text-xl font-bold text-blue-900">{{ staff.passRate }}%</p>
                      </div>
                    </div>

                    <div class="border-t pt-4">
                      <h5 class="text-sm font-semibold text-gray-700 mb-3">Step Breakdown</h5>
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div v-for="(step, stepName) in staff.stepBreakdown" :key="stepName" class="bg-gray-50 rounded p-3">
                          <p class="text-xs text-gray-600 mb-1">{{ formatStepName(stepName) }}</p>
                          <div class="flex items-baseline gap-2">
                            <span class="text-lg font-bold text-gray-900">{{ step.passed }}/{{ step.total }}</span>
                            <span class="text-xs text-gray-500">({{ step.passRate }}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex justify-end">
                  <button
                    @click="exportCSV('staff')"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Customers Tab -->
          <div v-if="activeTab === 'customers'">
            <div v-if="loadingCustomers" class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <div v-else>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Customer Segmentation</h3>
                <p class="text-sm text-gray-600 mb-4">Customer categories based on behavior and value</p>

                <!-- Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">🏆</span>
                      <p class="text-sm text-green-600 font-medium">High-Value</p>
                    </div>
                    <p class="text-2xl font-bold text-green-900">{{ segmentationData.summary?.highValue || 0 }}</p>
                    <p class="text-xs text-green-600 mt-1">Active & High Spending</p>
                  </div>
                  <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">⚠️</span>
                      <p class="text-sm text-yellow-600 font-medium">At-Risk</p>
                    </div>
                    <p class="text-2xl font-bold text-yellow-900">{{ segmentationData.summary?.atRisk || 0 }}</p>
                    <p class="text-xs text-yellow-600 mt-1">Declining Activity</p>
                  </div>
                  <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">📈</span>
                      <p class="text-sm text-blue-600 font-medium">Growth</p>
                    </div>
                    <p class="text-2xl font-bold text-blue-900">{{ segmentationData.summary?.growth || 0 }}</p>
                    <p class="text-xs text-blue-600 mt-1">Increasing Usage</p>
                  </div>
                  <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">💤</span>
                      <p class="text-sm text-gray-600 font-medium">Dormant</p>
                    </div>
                    <p class="text-2xl font-bold text-gray-900">{{ segmentationData.summary?.dormant || 0 }}</p>
                    <p class="text-xs text-gray-600 mt-1">No Recent Activity</p>
                  </div>
                </div>

                <!-- Segment Details -->
                <div class="space-y-4">
                  <div v-for="(segment, segmentName) in displaySegments" :key="segmentName" class="bg-white rounded-lg border border-gray-200">
                    <button
                      @click="toggleSegment(segmentName)"
                      class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div class="flex items-center gap-3">
                        <span class="text-xl">{{ getSegmentEmoji(segmentName) }}</span>
                        <div class="text-left">
                          <h4 class="text-base font-semibold text-gray-900">{{ getSegmentTitle(segmentName) }}</h4>
                          <p class="text-sm text-gray-500">{{ segment.length }} companies</p>
                        </div>
                      </div>
                      <ChevronDown
                        class="w-5 h-5 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': expandedSegments.includes(String(segmentName)) }"
                      />
                    </button>

                    <div v-if="expandedSegments.includes(String(segmentName))" class="border-t border-gray-200">
                      <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                          <thead class="bg-gray-50">
                            <tr>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">References</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                            </tr>
                          </thead>
                          <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="company in segment.slice(0, 20)" :key="company.companyId" class="hover:bg-gray-50">
                              <td class="px-6 py-4">
                                <div class="text-sm font-medium text-gray-900">{{ company.companyName }}</div>
                                <div class="text-sm text-gray-500">{{ company.companyEmail }}</div>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                £{{ company.totalSpent }}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {{ company.totalReferences }}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {{ company.currentCredits }}
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {{ company.daysSinceLastReference !== null ? company.daysSinceLastReference + ' days ago' : 'N/A' }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div v-if="segment.length > 20" class="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                        Showing top 20 of {{ segment.length }} companies
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex justify-end">
                  <button
                    @click="exportCSV('customers')"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Quality Tab -->
          <div v-if="activeTab === 'quality'">
            <div v-if="loadingOutcomes" class="flex justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <div v-else>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Reference Outcomes & Quality</h3>
                <p class="text-sm text-gray-600 mb-4">Pass rates, decisions, and quality metrics</p>

                <!-- Key Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Total References</p>
                    <p class="text-2xl font-bold text-gray-900">{{ outcomesData.totalReferences || 0 }}</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Average Score</p>
                    <p class="text-2xl font-bold text-gray-900">{{ outcomesData.averageScore }}/100</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600">Pass Rate</p>
                    <p class="text-2xl font-bold text-gray-900">
                      {{ calculatePassRate() }}%
                    </p>
                  </div>
                </div>

                <!-- Decision Breakdown -->
                <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                  <h4 class="text-base font-semibold text-gray-900 mb-4">Decision Breakdown</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <canvas ref="outcomeChart"></canvas>
                    </div>
                    <div class="space-y-3">
                      <div v-for="outcome in outcomesData.outcomes" :key="outcome.decision" class="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div class="flex items-center gap-3">
                          <div class="w-4 h-4 rounded" :style="{ backgroundColor: getOutcomeColor(outcome.decision) }"></div>
                          <span class="text-sm font-medium text-gray-700 dark:text-slate-200">{{ formatDecision(outcome.decision) }}</span>
                        </div>
                        <div class="text-right">
                          <p class="text-sm font-bold text-gray-900">{{ outcome.count }}</p>
                          <p class="text-xs text-gray-500">{{ outcome.percentage }}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TAS Category Distribution -->
                <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                  <h4 class="text-base font-semibold text-gray-900 mb-4">TAS Score Distribution</h4>
                  <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div v-for="category in outcomesData.tasCategories" :key="category.category" class="text-center p-4 bg-gray-50 rounded">
                      <p class="text-xs text-gray-600 mb-1">{{ category.category.replace('_', ' ') }}</p>
                      <p class="text-2xl font-bold text-gray-900">{{ category.count }}</p>
                      <p class="text-xs text-gray-500">{{ category.percentage }}%</p>
                    </div>
                  </div>
                </div>

                <!-- Top Decline Reasons -->
                <div v-if="outcomesData.topDeclineReasons && outcomesData.topDeclineReasons.length > 0" class="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 class="text-base font-semibold text-gray-900 mb-4">Top Decline Reasons</h4>
                  <div class="space-y-2">
                    <div v-for="reason in outcomesData.topDeclineReasons" :key="reason.reason" class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span class="text-sm text-gray-700">{{ reason.reason }}</span>
                      <span class="text-sm font-semibold text-gray-900">{{ reason.count }}</span>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex justify-end">
                  <button
                    @click="exportCSV('outcomes')"
                    class="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import AdminHeader from '../components/AdminHeader.vue'
import { Chart, registerables } from 'chart.js'
import { colors } from '../config/colors'
import { ChevronDown } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

Chart.register(...registerables)

const authStore = useAuthStore()
// Tab management
const activeTab = ref('financial')
const tabs = [
  { id: 'financial', name: 'Financial' },
  { id: 'references', name: 'References' },
  { id: 'staff', name: 'Staff' },
  { id: 'customers', name: 'Customers' },
  { id: 'quality', name: 'Quality' }
]

// Date range management
const dateRange = ref('30days')
const customStartDate = ref('')
const customEndDate = ref('')
const dateRangeOptions = [
  { value: '7days', label: 'Last 7 Days' },
  { value: '14days', label: 'Last 14 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' }
]

// Loading states
const loadingRevenue = ref(false)
const loadingPipeline = ref(false)
const loadingStaff = ref(false)
const loadingCustomers = ref(false)
const loadingOutcomes = ref(false)

// Data
const revenueData = ref<any>({ trends: [], totals: {} })
const pipelineData = ref<any>({ funnel: [], statusBreakdown: {}, avgCompletionTimeHours: '0' })
const staffPerformance = ref<any[]>([])
const segmentationData = ref<any>({ segments: {}, summary: {} })
const outcomesData = ref<any>({ outcomes: [], tasCategories: [], topDeclineReasons: [], totalReferences: 0, averageScore: '0' })

// Chart refs
const revenueChart = ref<HTMLCanvasElement | null>(null)
const outcomeChart = ref<HTMLCanvasElement | null>(null)
let revenueChartInstance: Chart | null = null
let outcomeChartInstance: Chart | null = null

// Customer segmentation expansion
const expandedSegments = ref<string[]>([])

// Computed
const revenueTotals = computed(() => {
  return {
    total: (revenueData.value.totals?.total || 0).toFixed(2),
    subscriptions: (revenueData.value.totals?.subscriptions || 0).toFixed(2),
    packs: (revenueData.value.totals?.packs || 0).toFixed(2),
    agreements: (revenueData.value.totals?.agreements || 0).toFixed(2)
  }
})

const displaySegments = computed(() => {
  return segmentationData.value.segments || {}
})

// Methods
const setDateRange = (range: string) => {
  dateRange.value = range
  customStartDate.value = ''
  customEndDate.value = ''
  fetchAllData()
}

const applyCustomDateRange = () => {
  if (customStartDate.value && customEndDate.value) {
    fetchAllData()
  }
}

const getDateParams = () => {
  if (customStartDate.value && customEndDate.value) {
    return {
      startDate: customStartDate.value,
      endDate: customEndDate.value
    }
  }

  const end = new Date()
  const daysMap: { [key: string]: number } = {
    '7days': 7,
    '14days': 14,
    '30days': 30,
    '90days': 90
  }
  const days = daysMap[dateRange.value] || 30
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  }
}

const fetchRevenueTrends = async () => {
  loadingRevenue.value = true
  try {
    const token = authStore.session?.access_token
    const params = getDateParams()
    const response = await axios.get(`${API_URL}/api/admin/reports/revenue/trends`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ...params, groupBy: 'day' }
    })
    revenueData.value = response.data
    await nextTick()
    renderRevenueChart()
  } catch (error) {
    console.error('Error fetching revenue trends:', error)
  } finally {
    loadingRevenue.value = false
  }
}

const fetchPipelineFunnel = async () => {
  loadingPipeline.value = true
  try {
    const token = authStore.session?.access_token
    const params = getDateParams()
    const response = await axios.get(`${API_URL}/api/admin/reports/references/pipeline-funnel`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    })
    pipelineData.value = response.data
  } catch (error) {
    console.error('Error fetching pipeline funnel:', error)
  } finally {
    loadingPipeline.value = false
  }
}

const fetchStaffPerformance = async () => {
  loadingStaff.value = true
  try {
    const token = authStore.session?.access_token
    const params = getDateParams()
    const response = await axios.get(`${API_URL}/api/admin/reports/staff/performance-detail`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    })
    staffPerformance.value = response.data.performance || []
  } catch (error) {
    console.error('Error fetching staff performance:', error)
  } finally {
    loadingStaff.value = false
  }
}

const fetchCustomerSegmentation = async () => {
  loadingCustomers.value = true
  try {
    const token = authStore.session?.access_token
    const response = await axios.get(`${API_URL}/api/admin/reports/customers/segmentation`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    segmentationData.value = response.data
  } catch (error) {
    console.error('Error fetching customer segmentation:', error)
  } finally {
    loadingCustomers.value = false
  }
}

const fetchReferenceOutcomes = async () => {
  loadingOutcomes.value = true
  try {
    const token = authStore.session?.access_token
    const params = getDateParams()
    const response = await axios.get(`${API_URL}/api/admin/reports/references/outcomes`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    })
    outcomesData.value = response.data
    await nextTick()
    renderOutcomeChart()
  } catch (error) {
    console.error('Error fetching reference outcomes:', error)
  } finally {
    loadingOutcomes.value = false
  }
}

const fetchAllData = () => {
  fetchRevenueTrends()
  fetchPipelineFunnel()
  fetchStaffPerformance()
  fetchCustomerSegmentation()
  fetchReferenceOutcomes()
}

const renderRevenueChart = () => {
  if (!revenueChart.value || !revenueData.value.trends) return

  if (revenueChartInstance) {
    revenueChartInstance.destroy()
  }

  const ctx = revenueChart.value.getContext('2d')
  if (!ctx) return

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: revenueData.value.trends.map((t: any) => t.date),
      datasets: [
        {
          label: 'Total Revenue',
          data: revenueData.value.trends.map((t: any) => t.total),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Subscriptions',
          data: revenueData.value.trends.map((t: any) => t.subscriptions),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'Credit Packs',
          data: revenueData.value.trends.map((t: any) => t.packs),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4
        },
        {
          label: 'Agreements',
          data: revenueData.value.trends.map((t: any) => t.agreements),
          borderColor: colors.primary,
          backgroundColor: 'rgba(254, 122, 15, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: £${(context.parsed.y ?? 0).toFixed(2)}`
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => '£' + value
          }
        }
      }
    }
  })
}

const renderOutcomeChart = () => {
  if (!outcomeChart.value || !outcomesData.value.outcomes) return

  if (outcomeChartInstance) {
    outcomeChartInstance.destroy()
  }

  const ctx = outcomeChart.value.getContext('2d')
  if (!ctx) return

  outcomeChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: outcomesData.value.outcomes.map((o: any) => formatDecision(o.decision)),
      datasets: [{
        data: outcomesData.value.outcomes.map((o: any) => o.count),
        backgroundColor: outcomesData.value.outcomes.map((o: any) => getOutcomeColor(o.decision))
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const outcome = outcomesData.value.outcomes[context.dataIndex]
              return `${context.label}: ${outcome.count} (${outcome.percentage}%)`
            }
          }
        }
      }
    }
  })
}

const getFunnelColor = (index: number) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500'
  ]
  return colors[index] || 'bg-gray-500'
}

const formatStepName = (stepName: string | number) => {
  const names: { [key: string]: string } = {
    'ID_SELFIE': 'ID & Selfie',
    'INCOME_AFFORDABILITY': 'Income & Affordability',
    'RESIDENTIAL': 'Residential',
    'CREDIT_TAS': 'Credit & TAS'
  }
  return names[String(stepName)] || String(stepName)
}

const toggleSegment = (segmentName: string | number) => {
  const name = String(segmentName)
  const index = expandedSegments.value.indexOf(name)
  if (index > -1) {
    expandedSegments.value.splice(index, 1)
  } else {
    expandedSegments.value.push(name)
  }
}

const getSegmentEmoji = (segmentName: string | number) => {
  const emojis: { [key: string]: string } = {
    'highValue': '🏆',
    'atRisk': '⚠️',
    'growth': '📈',
    'dormant': '💤'
  }
  return emojis[String(segmentName)] || '📊'
}

const getSegmentTitle = (segmentName: string | number) => {
  const titles: { [key: string]: string } = {
    'highValue': 'High-Value Customers',
    'atRisk': 'At-Risk Customers',
    'growth': 'Growth Customers',
    'dormant': 'Dormant Customers'
  }
  return titles[String(segmentName)] || String(segmentName)
}

const formatDecision = (decision: string) => {
  const formatted: { [key: string]: string } = {
    'PASS': 'Pass',
    'PASS_WITH_GUARANTOR': 'Pass with Guarantor',
    'MANUAL_REVIEW': 'Manual Review',
    'DECLINE': 'Decline',
    'NO_DECISION': 'No Decision'
  }
  return formatted[decision] || decision
}

const getOutcomeColor = (decision: string) => {
  const colors: { [key: string]: string } = {
    'PASS': '#10b981',
    'PASS_WITH_GUARANTOR': '#3b82f6',
    'MANUAL_REVIEW': '#f59e0b',
    'DECLINE': '#ef4444',
    'NO_DECISION': '#6b7280'
  }
  return colors[decision] || '#6b7280'
}

const calculatePassRate = () => {
  if (!outcomesData.value.outcomes || outcomesData.value.totalReferences === 0) return '0.0'

  const passOutcome = outcomesData.value.outcomes.find((o: any) => o.decision === 'PASS')
  const passWithGuarantorOutcome = outcomesData.value.outcomes.find((o: any) => o.decision === 'PASS_WITH_GUARANTOR')

  const passCount = (passOutcome?.count || 0) + (passWithGuarantorOutcome?.count || 0)
  return ((passCount / outcomesData.value.totalReferences) * 100).toFixed(1)
}

const exportCSV = (reportType: string) => {
  let csvContent = ''
  let filename = ''

  switch (reportType) {
    case 'revenue':
      filename = 'revenue-trends.csv'
      csvContent = 'Date,Subscriptions,Packs,Agreements,Total\n'
      revenueData.value.trends.forEach((row: any) => {
        csvContent += `${row.date},${row.subscriptions},${row.packs},${row.agreements},${row.total}\n`
      })
      break

    case 'pipeline':
      filename = 'pipeline-funnel.csv'
      csvContent = 'Stage,Count,Percentage,Conversion From Previous\n'
      pipelineData.value.funnel.forEach((stage: any) => {
        csvContent += `${stage.stage},${stage.count},${stage.percentage}%,${stage.conversionFromPrevious || 'N/A'}\n`
      })
      break

    case 'staff':
      filename = 'staff-performance.csv'
      csvContent = 'Staff Name,Email,Total Steps,Passed Steps,Failed Steps,Pass Rate\n'
      staffPerformance.value.forEach((staff: any) => {
        csvContent += `${staff.staffName},${staff.staffEmail},${staff.totalSteps},${staff.passedSteps},${staff.failedSteps},${staff.passRate}%\n`
      })
      break

    case 'customers':
      filename = 'customer-segmentation.csv'
      csvContent = 'Segment,Company,Email,Total Spent,Total References,Current Credits,Days Since Last Reference\n'
      Object.entries(displaySegments.value).forEach(([segment, companies]: [string, any]) => {
        companies.forEach((company: any) => {
          csvContent += `${segment},${company.companyName},${company.companyEmail},${company.totalSpent},${company.totalReferences},${company.currentCredits},${company.daysSinceLastReference || 'N/A'}\n`
        })
      })
      break

    case 'outcomes':
      filename = 'reference-outcomes.csv'
      csvContent = 'Decision,Count,Percentage\n'
      outcomesData.value.outcomes.forEach((outcome: any) => {
        csvContent += `${formatDecision(outcome.decision)},${outcome.count},${outcome.percentage}%\n`
      })
      break
  }

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

// Watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === 'financial' && revenueData.value.trends.length > 0) {
    nextTick(() => renderRevenueChart())
  } else if (newTab === 'quality' && outcomesData.value.outcomes.length > 0) {
    nextTick(() => renderOutcomeChart())
  }
})

onMounted(() => {
  fetchAllData()
})
</script>
