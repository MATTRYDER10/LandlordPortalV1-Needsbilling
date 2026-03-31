<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Landlords — Financial History</h2>
      <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">View payout history and download statements</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="landlords.length === 0" class="text-center py-12" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
      No landlord payout data yet. Process payouts from the Payouts tab.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="landlord in landlords"
        :key="landlord.id"
        :class="['rounded-xl border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']"
      >
        <button
          @click="toggleExpand(landlord.id)"
          class="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div>
            <p class="font-medium">{{ landlord.name }}</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ landlord.property_count }} propert{{ landlord.property_count === 1 ? 'y' : 'ies' }}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-emerald-500">&pound;{{ formatMoney(landlord.total_paid) }}</p>
            <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">total paid out</p>
          </div>
        </button>

        <div v-if="expandedId === landlord.id" :class="['border-t px-5 py-4', isDark ? 'border-slate-700' : 'border-gray-100']">
          <div v-if="landlordStatements[landlord.id]?.length > 0">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="text-left text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Date</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Gross</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Charges</th>
                  <th class="text-right text-xs uppercase py-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Net</th>
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
                    <button v-if="s.statement_pdf_path" class="text-xs text-primary hover:underline">Download</button>
                    <span v-else class="text-xs text-gray-400">—</span>
                  </td>
                </tr>
              </tbody>
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

async function loadLandlords() {
  loading.value = true
  try {
    // Get landlords from existing endpoint
    const data = await get<any>('/api/landlords')
    const allLandlords = data.landlords || []

    // Get payout records to compute totals
    const payoutData = await get<any>('/api/rentgoose/payouts')
    const payouts = payoutData.payouts || []

    // Group payouts by landlord
    const payoutsByLandlord = new Map<string, number>()
    const propertiesByLandlord = new Map<string, Set<string>>()
    for (const p of payouts) {
      payoutsByLandlord.set(p.landlord_id, (payoutsByLandlord.get(p.landlord_id) || 0) + p.net_payout)
      if (!propertiesByLandlord.has(p.landlord_id)) propertiesByLandlord.set(p.landlord_id, new Set())
      propertiesByLandlord.get(p.landlord_id)!.add(p.property_address)
    }

    landlords.value = allLandlords.map((l: any) => ({
      id: l.id,
      name: l.name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
      property_count: propertiesByLandlord.get(l.id)?.size || l.property_count || 0,
      total_paid: payoutsByLandlord.get(l.id) || 0,
    })).filter((l: any) => l.property_count > 0 || l.total_paid > 0)
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
