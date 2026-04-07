<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-[15px] font-semibold text-primary">Landlords</h2>
      <div class="flex items-center gap-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search landlords..."
          class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white w-56 focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        <p v-if="filteredLandlords.length > 0" class="text-[13px] text-gray-500 dark:text-slate-400">
          {{ filteredLandlords.length }} landlord{{ filteredLandlords.length !== 1 ? 's' : '' }} &middot;
          &pound;{{ formatMoney(filteredLandlords.reduce((s: number, l: any) => s + (l.total_paid || 0), 0)) }} total paid
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="filteredLandlords.length === 0" class="flex flex-col items-center justify-center py-16">
      <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No landlords yet</p>
      <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Landlords linked to active tenancies will appear here with their financial history.</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="landlord in filteredLandlords"
        :key="landlord.id"
        :class="['rounded-[10px] border overflow-hidden transition-colors', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 hover:border-gray-300']"
      >
        <!-- Landlord header -->
        <button
          @click="toggleExpand(landlord.id)"
          class="w-full px-5 py-4 flex items-center text-left hover:bg-[#fff7ed] dark:hover:bg-slate-700/50 transition-colors"
        >
          <div class="flex-1">
            <p class="font-semibold text-sm">{{ landlord.name }}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
              <span class="bg-[#dcfce7] text-[#15803d] rounded-full text-[10px] font-medium px-2 py-0.5">Active</span>
            </div>
          </div>
          <div class="w-32 text-center">
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
          </div>
          <div class="text-right flex items-center gap-4">
            <div>
              <p :class="['font-bold tabular-nums', landlord.total_paid > 0 ? 'text-[#15803d]' : 'text-gray-400 dark:text-slate-500']">&pound;{{ formatMoney(landlord.total_paid) }}</p>
              <p class="text-xs text-[#f97316] mt-0.5">View statement &rarr;</p>
            </div>
            <svg :class="['w-5 h-5 transition-transform text-gray-400 dark:text-slate-500', expandedId === landlord.id ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        <!-- Expanded content -->
        <div v-if="expandedId === landlord.id" :class="['border-t px-5 py-4', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-[15px] font-semibold" :class="isDark ? 'text-slate-300' : 'text-primary'">Annual Tax Statement</h3>
            <div class="flex items-center gap-2">
              <select v-model="selectedTaxYear" :class="['text-sm rounded-lg px-3 py-1.5 border', isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200']">
                <option v-for="yr in taxYears" :key="yr" :value="yr">{{ yr - 1 }}/{{ yr }} (Apr 6 – Apr 5)</option>
              </select>
              <button @click="openStatement(landlord)" class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-4 py-2 text-xs transition-colors flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Annual Statement
              </button>
            </div>
          </div>

          <!-- Statements table -->
          <div v-if="filteredStatements(landlord.id).length > 0">
            <div :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
              <table class="w-full">
                <thead>
                  <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                    <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Date</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Gross Rent</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Charges</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Net Paid</th>
                    <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">Statement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(s, idx) in filteredStatements(landlord.id)"
                    :key="s.id"
                    :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-[#fff8f3]') : '']"
                  >
                    <td class="px-4 py-3 text-sm">{{ formatDate(s.paid_at) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-medium tabular-nums">&pound;{{ formatMoney(s.gross_rent) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-medium text-[#dc2626] tabular-nums">-&pound;{{ formatMoney(s.total_charges) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-medium text-[#15803d] tabular-nums">&pound;{{ formatMoney(s.net_payout) }}</td>
                    <td class="px-4 py-3 text-right">
                      <button v-if="s.statement_pdf_path" @click="downloadPdf(s.statement_pdf_path, s.id)" class="text-xs text-primary hover:underline">Download PDF</button>
                      <span v-else class="text-xs text-gray-400 dark:text-slate-500">---</span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr :class="['border-t-2 font-medium', isDark ? 'border-slate-600' : 'border-gray-300']">
                    <td class="px-4 py-3 text-sm font-semibold">Total</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold tabular-nums">&pound;{{ formatMoney(filteredStatements(landlord.id).reduce((s: number, r: any) => s + r.gross_rent, 0)) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold text-[#dc2626] tabular-nums">-&pound;{{ formatMoney(filteredStatements(landlord.id).reduce((s: number, r: any) => s + r.total_charges, 0)) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold text-[#15803d] tabular-nums">&pound;{{ formatMoney(filteredStatements(landlord.id).reduce((s: number, r: any) => s + r.net_payout, 0)) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-8">
            <p class="text-[13px] text-gray-500 dark:text-slate-400">No payouts recorded yet.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Annual Statement Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showStatementModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showStatementModal = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div :class="['relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden', isDark ? 'bg-slate-900' : 'bg-white']">

            <!-- Modal header -->
            <div class="flex items-start justify-between px-6 py-5 border-b" :class="isDark ? 'border-slate-700' : 'border-gray-200'">
              <div>
                <h2 class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">Annual Tax Statement</h2>
                <p class="text-sm mt-0.5" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                  {{ statementData?.landlord_name }} &middot; Tax Year {{ statementData?.tax_year }}
                </p>
              </div>
              <button @click="showStatementModal = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Modal body -->
            <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              <!-- Summary cards -->
              <div class="grid grid-cols-3 gap-3">
                <div class="rounded-xl border p-4 text-center" :class="isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1">Gross Income</p>
                  <p class="text-lg font-bold text-green-700">&pound;{{ formatMoney(statementData?.totals?.gross_income || 0) }}</p>
                </div>
                <div class="rounded-xl border p-4 text-center" :class="isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1">Total Deductions</p>
                  <p class="text-lg font-bold text-red-700">-&pound;{{ formatMoney(statementData?.totals?.charges_gross || 0) }}</p>
                </div>
                <div class="rounded-xl border p-4 text-center" :class="isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Net Paid to You</p>
                  <p class="text-lg font-bold text-blue-700">&pound;{{ formatMoney(statementData?.totals?.net_paid || 0) }}</p>
                </div>
              </div>

              <!-- Period -->
              <p class="text-xs text-gray-500 dark:text-slate-400">
                Period: {{ formatDate(statementData?.period_start) }} – {{ formatDate(statementData?.period_end) }}
              </p>

              <!-- Items table -->
              <div v-if="statementData?.items?.length > 0">
                <div :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
                  <table class="w-full text-sm">
                    <thead>
                      <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
                        <th class="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Date</th>
                        <th class="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ref</th>
                        <th class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Gross Rent</th>
                        <th class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Deductions</th>
                        <th class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Net Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(item, idx) in statementData.items"
                        :key="idx"
                        :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100', idx % 2 === 1 ? (isDark ? 'bg-slate-800/40' : 'bg-gray-50/60') : '']"
                      >
                        <td class="px-4 py-2.5 text-gray-700 dark:text-slate-300">{{ formatDate(item.date) }}</td>
                        <td class="px-4 py-2.5 text-gray-400 dark:text-slate-500 text-xs">{{ item.statement_ref }}</td>
                        <td class="px-4 py-2.5 text-right font-medium text-green-700 tabular-nums">&pound;{{ formatMoney(item.gross_rent) }}</td>
                        <td class="px-4 py-2.5 text-right text-red-600 tabular-nums">-&pound;{{ formatMoney(item.total_charges) }}</td>
                        <td class="px-4 py-2.5 text-right font-medium text-blue-700 tabular-nums">&pound;{{ formatMoney(item.net_payout) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr :class="['border-t-2 font-semibold', isDark ? 'border-slate-600 bg-slate-800' : 'border-gray-300 bg-gray-50']">
                        <td colspan="2" class="px-4 py-3 text-sm">Totals</td>
                        <td class="px-4 py-3 text-right text-green-700 tabular-nums">&pound;{{ formatMoney(statementData.totals.gross_income) }}</td>
                        <td class="px-4 py-3 text-right text-red-600 tabular-nums">-&pound;{{ formatMoney(statementData.totals.charges_gross) }}</td>
                        <td class="px-4 py-3 text-right text-blue-700 tabular-nums">&pound;{{ formatMoney(statementData.totals.net_paid) }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div v-else class="text-center py-6 text-sm text-gray-400 dark:text-slate-500">No payouts in this tax year.</div>

              <!-- VAT / tax note -->
              <div :class="['rounded-xl border p-4 text-xs leading-relaxed', isDark ? 'bg-amber-900/10 border-amber-800/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800']">
                <strong>VAT on charges:</strong> &pound;{{ formatMoney(statementData?.totals?.charges_vat || 0) }} included in deductions above.
                Net charges (ex. VAT): &pound;{{ formatMoney(statementData?.totals?.charges_net || 0) }}.
                Management fees are generally allowable deductions against rental income — please consult your accountant.
              </div>

              <!-- Email success/error feedback -->
              <div v-if="emailResult" :class="['rounded-xl border p-3 text-sm text-center font-medium', emailResult === 'sent' ? (isDark ? 'bg-green-900/20 border-green-700 text-green-400' : 'bg-green-50 border-green-200 text-green-700') : (isDark ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-700')]">
                {{ emailResult === 'sent' ? `Statement emailed to landlord successfully.` : emailError }}
              </div>

            </div>

            <!-- Modal footer -->
            <div class="px-6 py-4 border-t flex items-center justify-between gap-3" :class="isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'">
              <button @click="showStatementModal = false" class="px-4 py-2 text-sm rounded-lg border transition-colors" :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                Close
              </button>
              <button
                @click="emailStatement"
                :disabled="sendingEmail || emailResult === 'sent'"
                class="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-60"
                :class="emailResult === 'sent' ? 'bg-green-600' : 'bg-[#f97316] hover:bg-[#ea6d10]'"
              >
                <svg v-if="sendingEmail" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <svg v-else-if="emailResult === 'sent'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                {{ sendingEmail ? 'Sending…' : emailResult === 'sent' ? 'Sent!' : 'Email to Landlord' }}
              </button>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const { isDark } = useDarkMode()
const { get, post } = useApi()

const loading = ref(true)
const landlords = ref<any[]>([])
const searchQuery = ref('')
const expandedId = ref<string | null>(null)
const landlordStatements = ref<Record<string, any[]>>({})

// Annual statement modal state
const showStatementModal = ref(false)
const statementData = ref<any>(null)
const statementLandlordId = ref<string | null>(null)
const sendingEmail = ref(false)
const emailResult = ref<'sent' | 'error' | null>(null)
const emailError = ref('')

const filteredLandlords = computed(() => {
  if (!searchQuery.value.trim()) return landlords.value
  const q = searchQuery.value.toLowerCase()
  return landlords.value.filter((l: any) =>
    (l.name || '').toLowerCase().includes(q) ||
    (l.property_addresses || []).some((addr: string) => addr.toLowerCase().includes(q))
  )
})

// Tax year selection
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const currentDay = new Date().getDate()
const defaultTaxYear = (currentMonth > 4 || (currentMonth === 4 && currentDay > 5)) ? currentYear + 1 : currentYear
const selectedTaxYear = ref(defaultTaxYear)
const taxYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]

function filteredStatements(landlordId: string): any[] {
  const all = landlordStatements.value[landlordId] || []
  const yr = selectedTaxYear.value
  const from = new Date(`${yr - 1}-04-06T00:00:00`)
  const to = new Date(`${yr}-04-05T23:59:59`)
  return all.filter((s: any) => {
    const d = new Date(s.paid_at || s.created_at)
    return d >= from && d <= to
  })
}

async function toggleExpand(id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    return
  }
  expandedId.value = id
  if (!landlordStatements.value[id]) {
    try {
      const data = await get<any>(`/api/rentgoose/landlord/${id}/statements`)
      landlordStatements.value[id] = data.statements || []
    } catch {
      landlordStatements.value[id] = []
    }
  }
}

async function openStatement(landlord: any) {
  try {
    statementData.value = null
    emailResult.value = null
    emailError.value = ''
    statementLandlordId.value = landlord.id
    showStatementModal.value = true
    const data = await get<any>(`/api/rentgoose/landlord/${landlord.id}/annual-statement?tax_year=${selectedTaxYear.value}`)
    statementData.value = data
  } catch (err) {
    console.error('Failed to load annual statement:', err)
    showStatementModal.value = false
  }
}

async function emailStatement() {
  if (!statementLandlordId.value || sendingEmail.value) return
  sendingEmail.value = true
  emailResult.value = null
  emailError.value = ''
  try {
    await post<any>(`/api/rentgoose/landlord/${statementLandlordId.value}/annual-statement/email`, {
      tax_year: selectedTaxYear.value
    })
    emailResult.value = 'sent'
  } catch (err: any) {
    emailResult.value = 'error'
    emailError.value = err?.message || 'Failed to send email'
  } finally {
    sendingEmail.value = false
  }
}

async function downloadPdf(storagePath: string, payoutId: string) {
  try {
    const data = await get<any>(`/api/rentgoose/statement/${payoutId}/pdf`)
    if (data.pdf_url) {
      window.open(data.pdf_url, '_blank')
    } else if (data.pdf_path) {
      const res = await get<any>(`/api/storage/signed-url?path=${encodeURIComponent(data.pdf_path)}&bucket=documents`)
      if (res.url) window.open(res.url, '_blank')
    }
  } catch (err) {
    console.error('Failed to download PDF:', err)
  }
}

async function loadLandlords() {
  loading.value = true
  try {
    const data = await get<any>('/api/rentgoose/landlords')
    landlords.value = data.landlords || []
  } catch (err) {
    console.error('Failed to load landlords:', err)
  } finally {
    loading.value = false
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(str: string) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(loadLandlords)
</script>
