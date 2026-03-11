<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <img src="/logo-icon.png" alt="PropertyGoose" class="h-8 w-8" />
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">Assessor Dashboard</h1>
            <p class="text-sm text-gray-500 dark:text-slate-400">V2 Verification System</p>
          </div>
        </div>
        <div class="flex items-center gap-6">
          <UKTimeClock />
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User class="w-4 h-4 text-primary" />
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ userName }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto p-6">
      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-3 gap-4">
        <div v-for="i in 8" :key="i" class="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <template v-else>
        <!-- Verification Queues -->
        <section class="mb-8">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verification Queues</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <QueueTile
              v-for="queue in verificationQueues"
              :key="queue.type"
              :title="queue.label"
              :count="queue.count"
              count-label="ready"
              :icon="queue.icon"
              :urgent-count="queue.urgentCount"
              :is-active="activeQueue === queue.type"
              @click="navigateToQueue(queue.type)"
            />
          </div>
        </section>

        <!-- Special Queues -->
        <section class="mb-8">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Special Queues</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <QueueTile
              title="Chase"
              :count="queueCounts.chase"
              count-label="overdue"
              :icon="PhoneCall"
              variant="warning"
              :urgent-count="queueCounts.chaseUrgent"
              @click="navigateToChase"
            />
            <QueueTile
              v-if="canAccessFinalReview"
              title="Final Review"
              subtitle="Senior Assessors Only"
              :count="queueCounts.finalReview"
              count-label="ready"
              :icon="Award"
              variant="success"
              large
              @click="navigateToFinalReview"
            />
          </div>
        </section>

        <!-- My Current Work -->
        <section v-if="myWork.length > 0">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Current Work</h2>
          <div class="space-y-3">
            <div
              v-for="item in myWork"
              :key="item.id"
              class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <component :is="getSectionIcon(item.section_type)" class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900 dark:text-white">{{ item.section_type }}</span>
                    <span class="text-gray-500">-</span>
                    <span class="text-gray-700 dark:text-slate-300">{{ item.tenant_name }}</span>
                  </div>
                  <p class="text-sm text-gray-500 dark:text-slate-400">{{ item.property_address }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-500">Started {{ formatTimeAgo(item.started_at) }}</span>
                <button
                  @click="continueWork(item)"
                  class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Stats -->
        <section class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.completedToday }}</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Completed Today</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.avgTime }}</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Avg. Review Time</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-green-600">{{ stats.passRate }}%</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Pass Rate</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div class="text-2xl font-bold text-amber-600">{{ queueCounts.total }}</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total in Queues</div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import QueueTile from './components/QueueTile.vue'
import {
  User,
  IdCard,
  Home,
  Briefcase,
  Building2,
  CreditCard,
  Shield,
  PhoneCall,
  Award,
  FileText
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const activeQueue = ref<string | null>(null)

const queueCounts = ref({
  identity: 0,
  rtr: 0,
  income: 0,
  residential: 0,
  credit: 0,
  aml: 0,
  chase: 0,
  chaseUrgent: 0,
  finalReview: 0,
  total: 0
})

const myWork = ref<any[]>([])

const stats = ref({
  completedToday: 0,
  avgTime: '0m',
  passRate: 0
})

const userName = computed(() => {
  return authStore.user?.user_metadata?.full_name || authStore.user?.email || 'Assessor'
})

const canAccessFinalReview = computed(() => {
  // Check if user has final review role
  return true // TODO: Implement role check
})

const verificationQueues = computed(() => [
  { type: 'IDENTITY', label: 'Identity', icon: IdCard, count: queueCounts.value.identity, urgentCount: 0 },
  { type: 'RTR', label: 'RTR', icon: Home, count: queueCounts.value.rtr, urgentCount: 0 },
  { type: 'INCOME', label: 'Income', icon: Briefcase, count: queueCounts.value.income, urgentCount: 0 },
  { type: 'RESIDENTIAL', label: 'Residential', icon: Building2, count: queueCounts.value.residential, urgentCount: 0 },
  { type: 'CREDIT', label: 'Credit', icon: CreditCard, count: queueCounts.value.credit, urgentCount: 0 },
  { type: 'AML', label: 'AML', icon: Shield, count: queueCounts.value.aml, urgentCount: 0 }
])

function getSectionIcon(type: string) {
  const icons: Record<string, any> = {
    IDENTITY: IdCard,
    RTR: Home,
    INCOME: Briefcase,
    RESIDENTIAL: Building2,
    CREDIT: CreditCard,
    AML: Shield
  }
  return icons[type] || FileText
}

async function fetchQueueCounts() {
  try {
    const response = await fetch(`${API_URL}/api/v2/admin/queue-counts`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      queueCounts.value = {
        identity: data.IDENTITY || 0,
        rtr: data.RTR || 0,
        income: data.INCOME || 0,
        residential: data.RESIDENTIAL || 0,
        credit: data.CREDIT || 0,
        aml: data.AML || 0,
        chase: data.CHASE || 0,
        chaseUrgent: data.CHASE_URGENT || 0,
        finalReview: data.FINAL_REVIEW || 0,
        total: Object.values(data).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)
      }
    }
  } catch (error) {
    console.error('Error fetching queue counts:', error)
  }
}

async function fetchMyWork() {
  try {
    const response = await fetch(`${API_URL}/api/v2/admin/my-work`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      myWork.value = data.items || []
    }
  } catch (error) {
    console.error('Error fetching my work:', error)
  }
}

async function fetchStats() {
  try {
    const response = await fetch(`${API_URL}/api/v2/admin/my-stats`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      stats.value = {
        completedToday: data.completedToday || 0,
        avgTime: data.avgTime || '0m',
        passRate: data.passRate || 0
      }
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
}

function navigateToQueue(type: string) {
  router.push({ name: 'StaffQueueV2', params: { type: type.toLowerCase() } })
}

function navigateToChase() {
  router.push({ name: 'StaffChaseQueueV2' })
}

function navigateToFinalReview() {
  router.push({ name: 'StaffFinalReviewV2' })
}

function continueWork(item: any) {
  router.push({
    name: 'StaffSectionReviewV2',
    params: { sectionId: item.id }
  })
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} mins ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${Math.floor(diffHours / 24)} days ago`
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    fetchQueueCounts(),
    fetchMyWork(),
    fetchStats()
  ])
  loading.value = false

  // Auto-refresh every 30 seconds
  setInterval(fetchQueueCounts, 30000)
})
</script>
