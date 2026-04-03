<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Landlords</h2>
      <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">Financial history, statements &amp; annual tax summaries</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="landlords.length === 0" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No landlords linked to active tenancies yet.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="landlord in landlords"
        :key="landlord.id"
        :class="['rounded-xl border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']"
      >
        <!-- Landlord header -->
        <button
          @click="toggleExpand(landlord.id)"
          class="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div>
            <p class="font-medium">{{ landlord.name }}</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="font-bold text-emerald-500">&pound;{{ formatMoney(landlord.total_paid) }}</p>
              <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">total paid out</p>
            </div>
            <svg :class="['w-5 h-5 transition-transform', expandedId === landlord.id ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        <!-- Expanded content -->
        <div v-if="expandedId === landlord.id" :class="['border-t px-5 py-4', isDark ? 'border-slate-700' : 'border-gray-100']">
          <!-- Annual statement download -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold" :class="isDark ? 'text-slate-300' : 'text-gray-700'">Annual Tax Statement</h3>
            <div class="flex items-center gap-2">
              <select v-model="selectedTaxYear" :class="['text-sm rounded-lg px-3 py-1.5 border', isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200']">
                <option v-for="yr in taxYears" :key="yr" :value="yr">{{ yr - 1 }}/{{ yr }} (Apr 6 – Apr 5)</option>
              </select>
              <button @click="downloadAnnualStatement(landlord.id, landlord.name)" class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-orange-600 rounded-lg transition-colors">
                Download CSV
              </button>
            </div>
          </div>

          <!-- Statements table -->
          <div v-if="landlordStatements[landlord.id]?.length > 0">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="text-left text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Date</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Gross Rent</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Charges</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Net Paid</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Statement</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in landlordStatements[landlord.id]" :key="s.id" :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']">
                  <td class="py-2 text-sm">{{ formatDate(s.paid_at) }}</td>
                  <td class="py-2 text-sm text-right">&pound;{{ formatMoney(s.gross_rent) }}</td>
                  <td class="py-2 text-sm text-right text-red-500">-&pound;{{ formatMoney(s.total_charges) }}</td>
                  <td class="py-2 text-sm text-right font-medium text-emerald-500">&pound;{{ formatMoney(s.net_payout) }}</td>
                  <td class="py-2 text-right">
                    <button v-if="s.statement_pdf_path" @click="downloadPdf(s.statement_pdf_path, s.id)" class="text-xs text-primary hover:underline">Download PDF</button>
                    <span v-else class="text-xs text-gray-400">—</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr :class="['border-t-2 font-medium', isDark ? 'border-slate-600' : 'border-gray-300']">
                  <td class="py-2 text-sm font-semibold">Total</td>
                  <td class="py-2 text-sm text-right font-semibold">&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.gross_rent, 0)) }}</td>
                  <td class="py-2 text-sm text-right font-semibold text-red-500">-&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.total_charges, 0)) }}</td>
                  <td class="py-2 text-sm text-right font-semibold text-emerald-500">&pound;{{ formatMoney(landlordStatements[landlord.id].reduce((s: number, r: any) => s + r.net_payout, 0)) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else :class="['text-sm py-4 text-center', isDark ? 'text-slate-500' : 'text-gray-400']">No payouts recorded yet.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'

const { isDark } = useDarkMode()
const { get } = useApi()

const loading = ref(true)
const landlords = ref<any[]>([])
const expandedId = ref<string | null>(null)
const landlordStatements = ref<Record<string, any[]>>({})

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
