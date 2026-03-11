<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-5xl mx-auto">
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
                <component :is="queueIcon" class="w-6 h-6 text-primary" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ queueTitle }} Queue</h1>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {{ items.length }} items ready for review
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="refresh"
              :disabled="loading"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <RefreshCcw :class="{ 'animate-spin': loading }" class="w-5 h-5" />
            </button>
            <UKTimeClock />
          </div>
        </div>

        <!-- Sort/Filter -->
        <div class="mt-4 flex gap-3">
          <select
            v-model="sortBy"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
            <option value="urgent">Most Urgent</option>
          </select>
          <div class="flex-1 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, property, company..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="max-w-5xl mx-auto p-6">
      <!-- Loading -->
      <div v-if="loading && items.length === 0" class="space-y-4">
        <div v-for="i in 5" :key="i" class="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
          <div class="h-3 bg-gray-100 dark:bg-slate-600 rounded w-1/2"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredItems.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle class="w-8 h-8 text-green-600" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Queue is empty</h3>
        <p class="text-gray-500 dark:text-slate-400 mt-1">
          {{ searchQuery ? 'No items match your search' : 'All caught up! Check back later.' }}
        </p>
        <button
          @click="goBack"
          class="mt-4 px-4 py-2 text-primary hover:bg-primary/5 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>

      <!-- Queue Items -->
      <div v-else class="space-y-4">
        <QueueItem
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @select="claimItem"
        />
      </div>

      <!-- Load More -->
      <div v-if="hasMore" class="mt-6 text-center">
        <button
          @click="loadMore"
          :disabled="loadingMore"
          class="px-6 py-2 text-primary hover:bg-primary/5 rounded-lg"
        >
          {{ loadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import QueueItem from './components/QueueItem.vue'
import {
  ArrowLeft,
  RefreshCcw,
  Search,
  CheckCircle,
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

const loading = ref(false)
const loadingMore = ref(false)
const items = ref<any[]>([])
const searchQuery = ref('')
const sortBy = ref('oldest')
const hasMore = ref(false)
const offset = ref(0)
const limit = 20

const queueType = computed(() => (route.params.type as string || 'identity').toUpperCase())

const queueTitle = computed(() => {
  const titles: Record<string, string> = {
    IDENTITY: 'Identity',
    RTR: 'Right to Rent',
    INCOME: 'Income',
    RESIDENTIAL: 'Residential',
    CREDIT: 'Credit',
    AML: 'AML'
  }
  return titles[queueType.value] || queueType.value
})

const queueIcon = computed(() => {
  const icons: Record<string, any> = {
    IDENTITY: IdCard,
    RTR: Home,
    INCOME: Briefcase,
    RESIDENTIAL: Building2,
    CREDIT: CreditCard,
    AML: Shield
  }
  return icons[queueType.value] || FileText
})

const filteredItems = computed(() => {
  let result = [...items.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      item.tenant_name?.toLowerCase().includes(query) ||
      item.property_address?.toLowerCase().includes(query) ||
      item.company_name?.toLowerCase().includes(query)
    )
  }

  // Sort
  if (sortBy.value === 'oldest') {
    result.sort((a, b) => new Date(a.queue_entered_at).getTime() - new Date(b.queue_entered_at).getTime())
  } else if (sortBy.value === 'newest') {
    result.sort((a, b) => new Date(b.queue_entered_at).getTime() - new Date(a.queue_entered_at).getTime())
  } else if (sortBy.value === 'urgent') {
    result.sort((a, b) => (b.age_hours || 0) - (a.age_hours || 0))
  }

  return result
})

async function fetchItems(append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    offset.value = 0
  }

  try {
    const response = await fetch(
      `${API_URL}/api/v2/admin/queue/${queueType.value.toLowerCase()}?limit=${limit}&offset=${offset.value}`,
      {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      if (append) {
        items.value = [...items.value, ...(data.items || [])]
      } else {
        items.value = data.items || []
      }
      hasMore.value = (data.items || []).length === limit
    }
  } catch (error) {
    console.error('Error fetching queue items:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function claimItem(item: any) {
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${item.id}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      router.push({
        name: 'StaffSectionReviewV2',
        params: { sectionId: item.id }
      })
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to claim item')
    }
  } catch (error) {
    console.error('Error claiming item:', error)
    alert('Failed to claim item')
  }
}

function loadMore() {
  offset.value += limit
  fetchItems(true)
}

function refresh() {
  fetchItems()
}

function goBack() {
  router.push({ name: 'StaffDashboardV2' })
}

// Watch for route changes
watch(() => route.params.type, () => {
  fetchItems()
})

onMounted(() => {
  fetchItems()
})
</script>
