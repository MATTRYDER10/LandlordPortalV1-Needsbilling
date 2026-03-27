<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center gap-4">
        <button @click="router.push({ name: 'StaffDashboardV2' })" class="text-gray-400 hover:text-gray-600">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Tenant Responses</h1>
          <p class="text-sm text-gray-500">Sections with pending tenant responses requiring review</p>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto p-6">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-20 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <div v-else-if="sections.length === 0" class="text-center py-16 text-gray-500">
        <MessageCircle class="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p class="text-lg font-medium">No pending responses</p>
        <p class="text-sm mt-1">All tenant responses have been reviewed</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="section in sections"
          :key="section.id"
          @click="router.push({ name: 'StaffResponseReviewV2', params: { sectionId: section.id } })"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary/50 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-white">{{ section.tenant_name }}</span>
                <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">{{ section.section_type }}</span>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ section.property_address }}</p>
              <p class="text-xs text-gray-400 mt-1">Issue: {{ section.issue_type }} - {{ section.issue_notes }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500">{{ section.company_name }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ formatDate(section.issue_reported_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, MessageCircle } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const sections = ref<any[]>([])

onMounted(async () => {
  try {
    const response = await fetch(`${API_URL}/api/v2/admin/pending-responses`, {
      headers: { 'Authorization': `Bearer ${authStore.session?.access_token}` }
    })
    if (response.ok) {
      const data = await response.json()
      sections.value = data.sections || []
    }
  } catch (error) {
    console.error('Error fetching pending responses:', error)
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
  })
}
</script>
