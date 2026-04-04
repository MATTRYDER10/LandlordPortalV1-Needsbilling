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
          <!-- ZONE 1: Name + property count + Active pill -->
          <div class="flex-1">
            <p class="font-semibold text-sm">{{ landlord.name }}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
              <span class="bg-[#dcfce7] text-[#15803d] rounded-full text-[10px] font-medium px-2 py-0.5">Active</span>
            </div>
          </div>
          <!-- ZONE 2: Property count muted -->
          <div class="w-32 text-center">
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
          </div>
          <!-- ZONE 3: Total paid + view statement + chevron -->
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
          <!-- Annual statement download -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-[15px] font-semibold" :class="isDark ? 'text-slate-300' : 'text-primary'">Annual Tax Statement</h3>
            <div class="flex items-center gap-2">
              <select v-model="selectedTaxYear" :class="['text-sm rounded-lg px-3 py-1.5 border', isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200']">
                <option v-for="yr in taxYears" :key="yr" :value="yr">{{ yr - 1 }}/{{ yr }} (Apr 6 – Apr 5)</option>
              </select>
              <button @click="downloadAnnualStatement(landlord.id, landlord.name)" class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2 text-xs transition-colors">
                Download CSV
              </button>
            </div>
          </div>

          <!-- Statements table -->
          <div v-if="landlordStatements[landlord.id]?.length > 0">
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
                    v-for="(s, idx) in landlordStatements[landlord.id]"
                    :key="s.id"
                    :class="['border-b border-[#f3f4f6] dark:border-slate-700 min-h-[52px] transition-colors hover:bg-[#fff7ed] dark:hover:bg-slate-700/50', idx % 2 === 1 ? 'bg-[#f9fafb] dark:bg-slate-800/50' : '']"
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
                    <td class="px-4 py-3 text-sm text-right font-semibold tabular-nums">&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.gross_rent, 0)) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold text-[#dc2626] tabular-nums">-&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.total_charges, 0)) }}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold text-[#15803d] tabular-nums">&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.net_payout, 0)) }}</td>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const { isDark } = useDarkMode()
const { get } = useApi()

const loading = ref(true)
const landlords = ref<any[]>([])
const searchQuery = ref('')
const expandedId = ref<string | null>(null)
const landlordStatements = ref<Record<string, any[]>>({})

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
// If we're past April 5, the current tax year ends next year
const defaultTaxYear = (currentMonth > 4 || (currentMonth === 4 && currentDay > 5)) ? currentYear + 1 : currentYear
const selectedTaxYear = ref(defaultTaxYear)
const taxYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]

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

async function downloadAnnualStatement(landlordId: string, landlordName: string) {
  try {
    const data = await get<any>(`/api/rentgoose/landlord/${landlordId}/annual-statement?tax_year=${selectedTaxYear.value}`)

    // Build CSV
    let csv = `Annual Tax Statement - ${landlordName}\n`
    csv += `Tax Year: ${data.tax_year} (${formatDate(data.period_start)} - ${formatDate(data.period_end)})\n\n`
    csv += `Date,Ref,Gross Rent,Charge Description,Charge Net,Charge VAT,Charge Gross,Net Paid\n`

    for (const item of data.items) {
      if (item.charges.length === 0) {
        csv += `"${formatDate(item.date)}","${item.statement_ref}",${item.gross_rent.toFixed(2)},,,,${item.net_payout.toFixed(2)}\n`
      } else {
        for (let i = 0; i < item.charges.length; i++) {
          const c = item.charges[i]
          if (i === 0) {
            csv += `"${formatDate(item.date)}","${item.statement_ref}",${item.gross_rent.toFixed(2)},"${c.description}",${c.net_amount.toFixed(2)},${c.vat_amount.toFixed(2)},${c.gross_amount.toFixed(2)},${item.net_payout.toFixed(2)}\n`
          } else {
            csv += `,,,,"${c.description}",${c.net_amount.toFixed(2)},${c.vat_amount.toFixed(2)},${c.gross_amount.toFixed(2)},\n`
          }
        }
      }
    }

    csv += `\nTOTALS,,${data.totals.gross_income.toFixed(2)},,${data.totals.charges_net.toFixed(2)},${data.totals.charges_vat.toFixed(2)},${data.totals.charges_gross.toFixed(2)},${data.totals.net_paid.toFixed(2)}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annual-statement-${landlordName.replace(/\s+/g, '-')}-${data.tax_year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download annual statement:', err)
  }
}

async function downloadPdf(storagePath: string, payoutId: string) {
  try {
    const data = await get<any>(`/api/rentgoose/statement/${payoutId}/pdf`)
    if (data.pdf_url) {
      window.open(data.pdf_url, '_blank')
    } else if (data.pdf_path) {
      // Fetch signed URL from Supabase storage
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
