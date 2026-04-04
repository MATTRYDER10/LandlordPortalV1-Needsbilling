<template>
  <div>
    <!-- KPI row -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <!-- Pending Payouts = PRIMARY -->
      <div class="bg-[#fff7ed] dark:bg-orange-950/30 border border-gray-200 dark:border-slate-700 border-l-[3px] border-l-[#f97316] rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Pending Payouts</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">{{ landlordPayouts.length }}</p>
      </div>
      <!-- Total Value -->
      <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Total Value</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">&pound;{{ formatMoney(totalPayoutValue) }}</p>
      </div>
      <!-- Contractor Invoices -->
      <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[10px] px-5 py-4">
        <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Contractor Invoices</p>
        <p class="text-[22px] font-bold text-gray-900 dark:text-white mt-1">{{ contractorPayouts.length }}</p>
      </div>
    </div>

    <!-- Sub-tabs + batch button -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-2">
      <button
        v-for="tab in payoutTabs"
        :key="tab.id"
        @click="payoutTab = tab.id"
        :class="[
          'rounded-full text-[13px] px-3.5 py-1 font-medium transition-all',
          payoutTab === tab.id
            ? 'bg-gray-800 text-white'
            : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'bg-gray-100 text-gray-500'
        ]"
      >
        {{ tab.name }}
        <span
          v-if="tab.count > 0"
          :class="['ml-1.5 px-1.5 py-0.5 text-xs rounded-full', payoutTab === tab.id ? 'bg-white/20' : isDark ? 'bg-slate-700' : 'bg-gray-200']"
        >{{ tab.count }}</span>
      </button>
      </div>
      <div class="flex gap-3 items-center">
        <label v-if="payoutTab === 'landlord'" class="flex items-center gap-2">
          <input type="checkbox" v-model="groupByLandlord" class="rounded text-primary" />
          <span class="text-sm">Group by landlord</span>
        </label>
        <button
          v-if="store.payouts.length > 0"
          @click="showBatchModal = true"
          class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors"
        >
          Mark All Paid &amp; Send Statements
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- LANDLORD PAYOUTS -->
    <div v-else-if="payoutTab === 'landlord'" class="space-y-4">
      <div v-if="landlordPayouts.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No landlord payouts ready</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Payouts will appear here once rent has been receipted and charges calculated.</p>
      </div>

      <div
        v-for="payout in landlordPayouts"
        :key="payout.id"
        :class="['rounded-[10px] border overflow-hidden transition-colors', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 hover:border-gray-300']"
      >
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <router-link :to="`/landlords/${payout.landlord_id}`" class="font-medium text-primary hover:underline text-base">
              {{ payout.landlord_name }}
            </router-link>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              <router-link :to="`/properties/${payout.property_id}`" class="hover:underline">{{ payout.property_address }}, {{ payout.property_postcode }}</router-link>
              &middot; {{ formatDate(payout.period_start) }} &ndash; {{ formatDate(payout.period_end) }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Net Payout</p>
            <p class="text-[22px] font-bold text-[#15803d]">&pound;{{ formatMoney(payout.net_payout) }}</p>
          </div>
        </div>

        <div :class="['px-5 py-3 flex gap-6 text-sm border-t', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-[#f3f4f6] bg-[#f9fafb]']">
          <div><span :class="isDark ? 'text-slate-400' : 'text-gray-500'">Income:</span> <span class="font-medium">&pound;{{ formatMoney(payout.gross_rent) }}</span></div>
          <div><span :class="isDark ? 'text-slate-400' : 'text-gray-500'">Charges:</span> <span class="font-medium text-[#dc2626]">-&pound;{{ formatMoney(payout.total_charges) }}</span></div>
          <div><span :class="isDark ? 'text-slate-400' : 'text-gray-500'">Ref:</span> <span class="font-mono text-xs">{{ payout.statement_ref }}</span></div>
        </div>

        <div v-if="expandedId === payout.id" :class="['px-5 py-4 border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Bank Details</p>
              <p class="text-sm">{{ payout.landlord_bank_name || 'Not set' }}</p>
              <p class="text-sm">{{ payout.landlord_bank_sort_code || '---' }} / ****{{ payout.landlord_bank_account_last4 || '---' }}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Charges Breakdown</p>
              <div v-for="c in payout.charges.filter(c => c.included)" :key="c.id" class="text-sm mb-1">
                <div class="flex justify-between">
                  <span>{{ c.description }}</span>
                  <span class="font-medium tabular-nums">&pound;{{ formatMoney(c.gross_amount) }}</span>
                </div>
                <div :class="['text-xs flex justify-end gap-3', isDark ? 'text-slate-500' : 'text-gray-400']">
                  <span>Net: &pound;{{ formatMoney(c.net_amount) }}</span>
                  <span>VAT: &pound;{{ formatMoney(c.vat_amount) }}</span>
                </div>
              </div>
              <div v-if="payout.charges.filter(c => c.included).length > 0" :class="['text-sm font-medium flex justify-between border-t pt-1 mt-1', isDark ? 'border-slate-700' : 'border-gray-200']">
                <span>Total Charges</span>
                <span class="text-[#dc2626] tabular-nums">&pound;{{ formatMoney(payout.total_charges) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div :class="['px-5 py-3 flex items-center justify-between border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <button @click="expandedId = expandedId === payout.id ? null : payout.id" class="text-sm text-primary hover:underline">
            {{ expandedId === payout.id ? 'Hide details' : 'Show details' }}
          </button>
          <div class="flex gap-2">
            <button
              @click="undoReceipt(payout)"
              :disabled="undoingId === payout.schedule_entry_id"
              class="px-3.5 py-2 text-[13px] font-medium text-red-500 border border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {{ undoingId === payout.schedule_entry_id ? 'Undoing...' : 'Undo Receipt' }}
            </button>
            <button
              @click="selectedPayout = payout; showMarkPaidModal = true"
              class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors"
            >
              Mark Paid
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- AGENT PAYOUTS -->
    <div v-else-if="payoutTab === 'agent'" class="space-y-4">
      <div v-if="agentCharges.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No agent fees to pay out</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Agent fees will appear once rent is receipted and management fees are calculated.</p>
      </div>

      <div v-else :class="['rounded-[10px] border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <p class="font-medium text-base">Agency Fees</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ agentCharges.length }} charge{{ agentCharges.length !== 1 ? 's' : '' }} across {{ agentPropertyCount }} propert{{ agentPropertyCount !== 1 ? 'ies' : 'y' }}</p>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Total Agent Payout</p>
            <p class="text-[22px] font-bold text-primary tabular-nums">&pound;{{ formatMoney(agentTotal) }}</p>
          </div>
        </div>

        <div v-if="expandedId === 'agent'" :class="['px-5 py-4 border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div v-for="(charges, address) in agentChargesByProperty" :key="address" class="mb-3">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold mb-1">{{ address }}</p>
            <div v-for="c in charges" :key="c.id" class="text-sm mb-1 pl-3">
              <div class="flex justify-between">
                <span>{{ c.description }}</span>
                <span class="font-medium tabular-nums">&pound;{{ formatMoney(c.gross_amount) }}</span>
              </div>
              <div :class="['text-xs flex justify-end gap-3', isDark ? 'text-slate-500' : 'text-gray-400']">
                <span>Net: &pound;{{ formatMoney(c.net_amount) }}</span>
                <span>VAT: &pound;{{ formatMoney(c.vat_amount) }}</span>
              </div>
            </div>
          </div>
          <div :class="['text-sm font-medium flex justify-between border-t pt-2 mt-2', isDark ? 'border-slate-700' : 'border-gray-200']">
            <span>Total</span>
            <span class="text-primary font-bold tabular-nums">&pound;{{ formatMoney(agentTotal) }}</span>
          </div>
        </div>

        <div :class="['px-5 py-3 flex items-center justify-between border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <button @click="expandedId = expandedId === 'agent' ? null : 'agent'" class="text-sm text-primary hover:underline">
            {{ expandedId === 'agent' ? 'Hide details' : 'Show details' }}
          </button>
        </div>
      </div>
    </div>

    <!-- CONTRACTOR PAYOUTS -->
    <div v-else-if="payoutTab === 'contractor'" class="space-y-4">
      <div v-if="contractorPayouts.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No contractor payouts ready</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Contractor payouts will appear once invoices have been uploaded and charged to landlords.</p>
      </div>

      <div
        v-for="cp in contractorPayouts"
        :key="cp.id"
        :class="['rounded-[10px] border overflow-hidden transition-colors', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 hover:border-gray-300']"
      >
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <p class="font-medium text-base">{{ cp.contractor_name }}</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              {{ cp.property_address }} &middot; Invoice #{{ cp.invoice_number }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Payout to Contractor</p>
            <p class="text-[22px] font-bold text-[#15803d] tabular-nums">&pound;{{ formatMoney(cp.payout_amount) }}</p>
          </div>
        </div>

        <div v-if="expandedId === cp.id" :class="['px-5 py-4 border-t text-sm', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div class="flex justify-between mb-1">
            <span>Invoice Gross</span>
            <span class="tabular-nums">&pound;{{ formatMoney(cp.gross_amount) }}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>Commission ({{ cp.commission_percent }}%)</span>
            <span class="text-[#dc2626] tabular-nums">-&pound;{{ formatMoney(cp.commission_net) }}</span>
          </div>
          <div v-if="cp.commission_vat_amount > 0" class="flex justify-between mb-1">
            <span>Commission VAT</span>
            <span class="text-[#dc2626] tabular-nums">-&pound;{{ formatMoney(cp.commission_vat_amount) }}</span>
          </div>
          <div :class="['flex justify-between font-medium border-t pt-1', isDark ? 'border-slate-700' : 'border-gray-200']">
            <span>Net Payout</span>
            <span class="text-[#15803d] tabular-nums">&pound;{{ formatMoney(cp.payout_amount) }}</span>
          </div>
        </div>

        <div :class="['px-5 py-3 flex items-center justify-between border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <button @click="expandedId = expandedId === cp.id ? null : cp.id" class="text-sm text-primary hover:underline">
            {{ expandedId === cp.id ? 'Hide details' : 'Show details' }}
          </button>
          <button
            @click="markContractorPaid(cp.id)"
            :disabled="payingContractorId === cp.id"
            class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {{ payingContractorId === cp.id ? 'Processing...' : 'Mark Paid' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mark Paid Modal -->
    <MarkPaidModal
      v-if="showMarkPaidModal && selectedPayout"
      :payout="selectedPayout"
      @close="showMarkPaidModal = false"
      @paid="onPaid"
    />

    <!-- Batch Modal -->
    <BatchPayoutModal
      v-if="showBatchModal"
      :payouts="store.payouts"
      @close="showBatchModal = false"
      @completed="onBatchCompleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore, type PayoutItem } from '../../stores/rentgoose'
import { useApi } from '../../composables/useApi'
import MarkPaidModal from './MarkPaidModal.vue'
import BatchPayoutModal from './BatchPayoutModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const { get, post } = useApi()

const payoutTab = ref('landlord')
const undoingId = ref<string | null>(null)
const groupByLandlord = ref(false)
const expandedId = ref<string | null>(null)
const showMarkPaidModal = ref(false)
const showBatchModal = ref(false)
const selectedPayout = ref<PayoutItem | null>(null)
const payingContractorId = ref<string | null>(null)

// Landlord payouts = the main rent payouts
const landlordPayouts = computed(() => store.payouts)

// Total payout value (display-only computed)
const totalPayoutValue = computed(() => landlordPayouts.value.reduce((s, p) => s + (p.net_payout || 0), 0))

// Agent charges = all included charges across all payouts (management fees, ad-hoc agent charges)
const agentCharges = computed(() => {
  const charges: any[] = []
  for (const p of store.payouts) {
    for (const c of (p.charges || [])) {
      if (c.included && c.charge_type !== 'contractor_commission') {
        charges.push({
          ...c,
          property_address: `${p.property_address}, ${p.property_postcode}`,
          property_id: p.property_id,
        })
      }
    }
  }
  return charges
})

const agentChargesByProperty = computed(() => {
  const grouped: Record<string, any[]> = {}
  for (const c of agentCharges.value) {
    if (!grouped[c.property_address]) grouped[c.property_address] = []
    grouped[c.property_address].push(c)
  }
  return grouped
})

const agentPropertyCount = computed(() => Object.keys(agentChargesByProperty.value).length)
const agentTotal = computed(() => agentCharges.value.reduce((s, c) => s + c.gross_amount, 0))

// Contractor payouts = pending contractor invoices
const contractorPayouts = ref<any[]>([])

async function fetchContractorPayouts() {
  try {
    contractorPayouts.value = await get<any[]>('/api/rentgoose/pending-contractor-payouts')
  } catch (err) {
    console.error('Failed to fetch contractor payouts:', err)
  }
}

const payoutTabs = computed(() => [
  { id: 'landlord', name: 'Landlord Payouts', count: landlordPayouts.value.length },
  { id: 'contractor', name: 'Contractor Payouts', count: contractorPayouts.value.length },
  { id: 'agent', name: 'Agent Payouts', count: agentCharges.value.length },
])

function onPaid() {
  showMarkPaidModal.value = false
  store.fetchPayouts()
}

function onBatchCompleted() {
  showBatchModal.value = false
  store.fetchPayouts()
}

async function undoReceipt(payout: PayoutItem) {
  if (!confirm(`Undo receipt for ${payout.property_address}? This will reverse the payment and remove associated charges.`)) return
  undoingId.value = payout.schedule_entry_id
  try {
    await post('/api/rentgoose/undo-receipt', { schedule_entry_id: payout.schedule_entry_id })
    await store.fetchPayouts()
    await store.fetchSchedule()
  } catch (err) {
    console.error('Failed to undo receipt:', err)
    alert('Failed to undo receipt')
  } finally {
    undoingId.value = null
  }
}

async function markContractorPaid(invoiceId: string) {
  if (!confirm('Mark this contractor invoice as paid? A remittance will be generated and emailed.')) return
  payingContractorId.value = invoiceId
  try {
    await post('/api/rentgoose/contractor-payout', { invoice_id: invoiceId })
    await fetchContractorPayouts()
  } catch (err) {
    console.error('Failed to mark contractor paid:', err)
  } finally {
    payingContractorId.value = null
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

onMounted(() => {
  store.fetchPayouts()
  fetchContractorPayouts()
})
</script>
