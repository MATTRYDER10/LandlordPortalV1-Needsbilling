<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Sent Emails</h2>
      <div class="flex items-center gap-3">
        <select
          v-model="selectedCategory"
          :class="['text-sm rounded-lg px-3 py-1.5 border', isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900']"
        >
          <option value="all">All Categories</option>
          <option value="rent_reminder">Rent Reminders</option>
          <option value="missed_payment">Missed Payment</option>
          <option value="arrears_day7">Arrears Day 7</option>
          <option value="arrears_day14">Arrears Day 14</option>
          <option value="arrears_day21">Arrears Day 21</option>
          <option value="arrears_day28">Arrears Day 28</option>
          <option value="landlord_statement">Landlord Statements</option>
          <option value="tenant_receipt">Tenant Receipts</option>
          <option value="contractor_remittance">Contractor Remittances</option>
        </select>
        <button @click="fetchEmails" :class="['text-sm px-3 py-1.5 rounded-lg transition-colors', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600']">
          Refresh
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="emails.length === 0" class="text-center py-12">
      <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">No sent emails found.</p>
    </div>

    <div v-else :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="thClass">Date/Time</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="thClass">Recipient</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="thClass">Subject</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide hidden md:table-cell" :class="thClass">Category</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide" :class="thClass">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="email in emails"
            :key="email.id"
            @click="viewEmail(email.id)"
            :class="['border-t cursor-pointer transition-colors', isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-100 hover:bg-gray-50']"
          >
            <td class="px-4 py-3 text-sm whitespace-nowrap">{{ formatDate(email.sent_at) }}</td>
            <td class="px-4 py-3 text-sm">{{ email.to_email }}</td>
            <td class="px-4 py-3 text-sm truncate max-w-xs">{{ email.subject }}</td>
            <td class="px-4 py-3 text-center hidden md:table-cell">
              <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', categoryBadgeClass(email.email_category)]">
                {{ categoryLabel(email.email_category) }}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass(email.status)]">
                {{ email.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-4">
      <button
        @click="goToPage(page - 1)"
        :disabled="page <= 1"
        :class="['px-3 py-1.5 text-sm rounded-lg transition-colors', page <= 1 ? 'opacity-40 cursor-not-allowed' : '', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600']"
      >Previous</button>
      <span :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">Page {{ page }} of {{ totalPages }}</span>
      <button
        @click="goToPage(page + 1)"
        :disabled="page >= totalPages"
        :class="['px-3 py-1.5 text-sm rounded-lg transition-colors', page >= totalPages ? 'opacity-40 cursor-not-allowed' : '', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600']"
      >Next</button>
    </div>

    <!-- Preview Modal -->
    <EmailPreviewModal :show="showPreview" :email="previewEmail" @close="showPreview = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'
import EmailPreviewModal from './EmailPreviewModal.vue'

const { isDark } = useDarkMode()
const { get } = useApi()

const thClass = computed(() => isDark.value ? 'text-slate-400' : 'text-gray-500')

const loading = ref(false)
const emails = ref<any[]>([])
const selectedCategory = ref('all')
const page = ref(1)
const totalPages = ref(1)
const showPreview = ref(false)
const previewEmail = ref<any>(null)

async function fetchEmails() {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: '25' })
    if (selectedCategory.value !== 'all') params.set('category', selectedCategory.value)
    const data = await get<any>(`/api/rentgoose/sent-emails?${params}`)
    emails.value = data.emails || []
    totalPages.value = data.pagination?.totalPages || 1
  } catch (err) {
    console.error('Failed to fetch sent emails:', err)
  } finally {
    loading.value = false
  }
}

async function viewEmail(id: string) {
  try {
    const data = await get<any>(`/api/rentgoose/sent-emails/${id}`)
    previewEmail.value = data
    showPreview.value = true
  } catch (err) {
    console.error('Failed to fetch email:', err)
  }
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchEmails()
}

watch(selectedCategory, () => {
  page.value = 1
  fetchEmails()
})

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function categoryLabel(cat: string | null) {
  const labels: Record<string, string> = {
    rent_reminder: 'Reminder',
    missed_payment: 'Missed',
    arrears_day7: 'Arrears 7d',
    arrears_day14: 'Arrears 14d',
    arrears_day21: 'Arrears 21d',
    arrears_day28: 'Arrears 28d',
    landlord_statement: 'Statement',
    tenant_receipt: 'Receipt',
    contractor_remittance: 'Remittance',
  }
  return labels[cat || ''] || cat || 'Other'
}

function categoryBadgeClass(cat: string | null) {
  const map: Record<string, string> = {
    rent_reminder: isDark.value ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700',
    missed_payment: isDark.value ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700',
    arrears_day7: isDark.value ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700',
    arrears_day14: isDark.value ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700',
    arrears_day21: isDark.value ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700',
    arrears_day28: isDark.value ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700',
    landlord_statement: isDark.value ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
    tenant_receipt: isDark.value ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-100 text-teal-700',
    contractor_remittance: isDark.value ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700',
  }
  return map[cat || ''] || (isDark.value ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500')
}

function statusBadgeClass(status: string) {
  if (status === 'delivered') return isDark.value ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
  if (status === 'bounced') return isDark.value ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
  if (status === 'sent') return isDark.value ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
  return isDark.value ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
}

onMounted(fetchEmails)
</script>
