<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center gap-4">
        <button @click="router.push({ name: 'StaffResponsesQueueV2' })" class="text-gray-400 hover:text-gray-600">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Review Tenant Response</h1>
          <p class="text-sm text-gray-500">{{ section?.tenant_name }} - {{ section?.section_type }}</p>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto p-6">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>

      <template v-else-if="section">
        <!-- Original Issue -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Original Issue</h2>
          <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-300">{{ sectionData?.issue_type }}</p>
            <p class="text-amber-700 dark:text-amber-400 mt-1">{{ sectionData?.issue_notes }}</p>
            <p class="text-xs text-amber-600 mt-2">Reported: {{ formatDate(sectionData?.issue_reported_at) }}</p>
          </div>
        </div>

        <!-- Tenant Response -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tenant Response</h2>
          <div v-if="evidence.length === 0" class="text-gray-400 text-sm">No response evidence found</div>
          <div v-else class="space-y-4">
            <div v-for="e in evidence" :key="e.id" class="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ e.evidence_type === 'tenant_response' ? 'Text Response' : 'Uploaded Document' }}
                </span>
                <span class="text-xs text-gray-400">{{ formatDate(e.created_at) }}</span>
              </div>
              <p v-if="e.notes" class="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{{ e.notes }}</p>
              <a
                v-if="e.file_url && e.file_path"
                :href="e.file_url"
                target="_blank"
                class="inline-flex items-center gap-2 mt-2 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
              >
                <FileText class="w-4 h-4" />
                View {{ e.file_name || 'Document' }}
              </a>
            </div>
          </div>
        </div>

        <!-- Referee Details (editable) -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Referee Details</h2>
          <div class="space-y-3">
            <div v-for="field in editableRefereeFields" :key="field.field" class="flex items-center gap-3">
              <span class="text-sm text-gray-500 w-24">{{ field.label }}</span>
              <input
                v-model="field.value"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-4">
          <button
            @click="acceptAndVerify"
            :disabled="submitting"
            class="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check class="w-5 h-5" />
            Accept & Send to Verify
          </button>
          <button
            @click="acceptAndChase"
            :disabled="submitting"
            class="flex-1 py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw class="w-5 h-5" />
            Update Details & Send to Chase
          </button>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, FileText, Check, RefreshCw } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const section = ref<any>(null)
const evidence = ref<any[]>([])
const editableRefereeFields = ref<{ label: string; field: string; value: string }[]>([])

const sectionData = computed(() => section.value?.section_data || {})

onMounted(async () => {
  const sectionId = route.params.sectionId as string
  try {
    // Fetch section details
    const sectionRes = await fetch(`${API_URL}/api/v2/sections/${sectionId}`, {
      headers: { 'Authorization': `Bearer ${authStore.session?.access_token}` }
    })
    if (sectionRes.ok) {
      section.value = await sectionRes.json()

      // Build editable referee fields based on section type
      const ref = section.value?.reference
      if (section.value?.section_type === 'INCOME') {
        editableRefereeFields.value = [
          { label: 'Name', field: 'employer_ref_name', value: ref?.employer_ref_name || '' },
          { label: 'Email', field: 'employer_ref_email', value: ref?.employer_ref_email || '' },
          { label: 'Phone', field: 'employer_ref_phone', value: ref?.employer_ref_phone || '' }
        ]
      } else if (section.value?.section_type === 'RESIDENTIAL') {
        editableRefereeFields.value = [
          { label: 'Name', field: 'previous_landlord_name', value: ref?.previous_landlord_name || '' },
          { label: 'Email', field: 'previous_landlord_email', value: ref?.previous_landlord_email || '' },
          { label: 'Phone', field: 'previous_landlord_phone', value: ref?.previous_landlord_phone || '' }
        ]
      }
    }

    // Fetch evidence
    const evidenceRes = await fetch(`${API_URL}/api/v2/sections/${sectionId}/pending-responses`, {
      headers: { 'Authorization': `Bearer ${authStore.session?.access_token}` }
    })
    if (evidenceRes.ok) {
      const data = await evidenceRes.json()
      evidence.value = data.evidence || []
    }
  } catch (error) {
    console.error('Error loading response review:', error)
  } finally {
    loading.value = false
  }
})

async function acceptAndVerify() {
  submitting.value = true
  try {
    const sectionId = route.params.sectionId as string
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId}/review-response`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'accept_and_verify' })
    })

    if (response.ok) {
      alert('Response accepted - section sent to verify queue')
      router.push({ name: 'StaffResponsesQueueV2' })
    } else {
      const data = await response.json()
      alert(data.error || 'Failed to process response')
    }
  } catch {
    alert('Failed to process response')
  } finally {
    submitting.value = false
  }
}

async function acceptAndChase() {
  submitting.value = true
  try {
    const sectionId = route.params.sectionId as string

    // Collect updated fields
    const updatedFields = editableRefereeFields.value
      .filter(f => f.value.trim())
      .map(f => ({ field: f.field, value: f.value }))

    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId}/review-response`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'accept_and_chase',
        updatedFields
      })
    })

    if (response.ok) {
      alert('Details updated - new chase item created')
      router.push({ name: 'StaffResponsesQueueV2' })
    } else {
      const data = await response.json()
      alert(data.error || 'Failed to process response')
    }
  } catch {
    alert('Failed to process response')
  } finally {
    submitting.value = false
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
  })
}
</script>
