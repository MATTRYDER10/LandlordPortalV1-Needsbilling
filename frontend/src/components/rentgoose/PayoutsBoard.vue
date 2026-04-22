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

    <!-- List container with tabs on top -->
    <div :class="['rounded-[10px] border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <!-- Rectangle tabs bar -->
      <div :class="['flex items-center justify-between border-b', isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200']">
        <div class="flex">
          <button
            v-for="tab in payoutTabs"
            :key="tab.id"
            @click="payoutTab = tab.id"
            :class="[
              'px-5 py-3 text-[13px] font-semibold border-b-2 transition-all',
              payoutTab === tab.id
                ? 'border-[#f97316] text-[#f97316] bg-white dark:bg-slate-900'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            ]"
          >
            {{ tab.name }}
            <span v-if="tab.count > 0" :class="['ml-1.5 px-1.5 py-0.5 text-xs rounded-full', payoutTab === tab.id ? 'bg-[#f97316]/10 text-[#f97316]' : isDark ? 'bg-slate-700' : 'bg-gray-200']">{{ tab.count }}</span>
          </button>
        </div>
        <div class="flex gap-3 items-center pr-4">
          <label v-if="payoutTab === 'landlord'" class="flex items-center gap-2">
            <input type="checkbox" v-model="groupByLandlord" class="rounded text-primary" />
            <span class="text-sm text-gray-500 dark:text-slate-400">Group by landlord</span>
          </label>
          <button
            v-if="store.payouts.length > 0"
            @click="showBatchModal = true"
            class="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white rounded-lg font-semibold px-[18px] py-2 text-sm transition-colors"
          >
            Mark All Paid &amp; Send Statements
          </button>
        </div>
      </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- LANDLORD PAYOUTS -->
    <div v-else-if="payoutTab === 'landlord'">
      <div v-if="landlordPayouts.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No landlord payouts ready</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Payouts will appear here once rent has been receipted and charges calculated.</p>
      </div>

      <div
        v-for="(payout, idx) in landlordPayouts"
        :key="payout.id"
        :class="['border-b last:border-b-0 transition-colors', isDark ? 'border-slate-700' : 'border-gray-100', idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-[#fff8f3]') : (isDark ? 'bg-slate-900' : 'bg-white')]"
      >
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <router-link :to="`/landlords/${payout.landlord_id}`" class="font-medium text-primary hover:underline text-base">
              {{ payout.landlord_name }}
            </router-link>
            <span v-if="payout.ownership_percentage && payout.ownership_percentage < 100" class="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {{ payout.ownership_percentage }}% share
            </span>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              <router-link :to="`/properties/${payout.property_id}`" class="hover:underline">{{ payout.property_address }}, {{ payout.property_postcode }}</router-link>
              &middot; {{ formatDate(payout.period_start) }} &ndash; {{ formatDate(payout.period_end) }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Net Payout</p>
            <p class="text-[22px] font-bold text-[#15803d]">&pound;{{ formatMoney(payout.net_payout + (payout.deposit_amount || 0)) }}</p>
            <p v-if="payout.deposit_amount > 0" class="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">incl. &pound;{{ formatMoney(payout.deposit_amount) }} deposit</p>
          </div>
        </div>

        <!-- Rent hold banner -->
        <div v-if="payout.rent_hold_active" class="px-5 py-2.5 border-t bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>
          <span class="text-xs font-semibold text-amber-700 dark:text-amber-400">RENT ON HOLD</span>
          <span v-if="payout.rent_hold_note" class="text-xs text-amber-600 dark:text-amber-500">— {{ payout.rent_hold_note }}</span>
        </div>

        <div :class="['px-5 py-3 flex flex-wrap gap-4 text-sm border-t', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-[#f3f4f6] bg-[#f9fafb]']">
          <div><span :class="isDark ? 'text-slate-400' : 'text-gray-500'">Rent:</span> <span class="font-medium">&pound;{{ formatMoney(payout.gross_rent) }}</span></div>
          <div><span :class="isDark ? 'text-slate-400' : 'text-gray-500'">Charges:</span> <span class="font-medium text-[#dc2626]">-&pound;{{ formatMoney(payout.total_charges) }}</span></div>
          <div v-if="payout.deposit_amount > 0" class="text-blue-700 dark:text-blue-400"><span class="opacity-70">Deposit:</span> <span class="font-medium">&pound;{{ formatMoney(payout.deposit_amount) }}</span></div>
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
              class="px-3.5 py-2 text-[13px] font-medium text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {{ undoingId === payout.schedule_entry_id ? 'Undoing...' : 'Undo Receipt' }}
            </button>
            <button
              @click="holdPayout(payout)"
              :disabled="holdingId === payout.id"
              class="px-3.5 py-2 text-[13px] font-medium text-gray-900 bg-[#fbbf24] hover:bg-[#f59e0b] rounded-lg transition-colors disabled:opacity-50"
            >
              {{ holdingId === payout.id ? 'Holding...' : 'Hold Monies' }}
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
      <!-- Month-at-a-glance tiles -->
      <div class="grid grid-cols-2 gap-4">
        <div :class="['rounded-[10px] border px-5 py-4', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
          <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Est. Remaining This Month</p>
          <p class="text-[22px] font-bold text-primary tabular-nums mt-1">&pound;{{ formatMoney(agentFeesSummary.estimatedRemainingThisMonth) }}</p>
          <p :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">
            {{ agentFeesSummary.charge_count_remaining }} charge{{ agentFeesSummary.charge_count_remaining !== 1 ? 's' : '' }} due by {{ monthEndLabel }}
          </p>
        </div>
        <div :class="['rounded-[10px] border px-5 py-4', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
          <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Paid This Month</p>
          <p class="text-[22px] font-bold text-[#15803d] tabular-nums mt-1">&pound;{{ formatMoney(agentFeesSummary.paidThisMonth) }}</p>
          <p :class="['text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">
            {{ agentFeesSummary.payout_count_this_month }} payout{{ agentFeesSummary.payout_count_this_month !== 1 ? 's' : '' }} processed
          </p>
        </div>
      </div>

      <!-- Pending agent payout -->
      <div v-if="pendingAgentCharges.length === 0 && agentPayoutHistory.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No agent fees to pay out</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Agent fees will appear once rent is receipted and management fees are calculated.</p>
      </div>

      <div v-if="pendingAgentCharges.length > 0" :class="['rounded-[10px] border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <p class="font-medium text-base dark:text-white">Pending Agent Fees</p>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ pendingAgentCharges.length }} charge{{ pendingAgentCharges.length !== 1 ? 's' : '' }} across {{ pendingAgentPropertyCount }} propert{{ pendingAgentPropertyCount !== 1 ? 'ies' : 'y' }}</p>
          </div>
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Total Agent Payout</p>
            <p class="text-[22px] font-bold text-primary tabular-nums">&pound;{{ formatMoney(pendingAgentTotal) }}</p>
          </div>
        </div>

        <div v-if="expandedId === 'agent'" :class="['px-5 py-4 border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div v-for="(charges, address) in pendingAgentChargesByProperty" :key="address" class="mb-3">
            <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold mb-1">
              <a
                v-if="charges[0]?.property_id"
                :href="`/properties/${charges[0].property_id}`"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline"
              >{{ address }}</a>
              <span v-else>{{ address }}</span>
            </p>
            <div v-for="c in charges" :key="c.id" class="text-sm mb-1 pl-3">
              <div class="flex justify-between">
                <span class="dark:text-slate-200">{{ c.description }}</span>
                <span class="font-medium tabular-nums dark:text-white">&pound;{{ formatMoney(c.gross_amount) }}</span>
              </div>
              <div :class="['text-xs flex justify-end gap-3', isDark ? 'text-slate-500' : 'text-gray-400']">
                <span>Net: &pound;{{ formatMoney(c.net_amount) }}</span>
                <span>VAT: &pound;{{ formatMoney(c.vat_amount) }}</span>
              </div>
            </div>
          </div>
          <div :class="['text-sm font-medium flex justify-between border-t pt-2 mt-2', isDark ? 'border-slate-700' : 'border-gray-200']">
            <span class="dark:text-slate-200">Total</span>
            <span class="text-primary font-bold tabular-nums">&pound;{{ formatMoney(pendingAgentTotal) }}</span>
          </div>
        </div>

        <div :class="['px-5 py-3 flex items-center justify-between border-t', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <button @click="expandedId = expandedId === 'agent' ? null : 'agent'" class="text-sm text-primary hover:underline">
            {{ expandedId === 'agent' ? 'Hide details' : 'Show details' }}
          </button>
          <button
            @click="showAgentPayoutModal = true"
            class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors"
          >
            Process Agent Payout
          </button>
        </div>
      </div>

      <!-- Agent payout history -->
      <div v-if="agentPayoutHistory.length > 0" :class="['rounded-[10px] border overflow-hidden', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200']">
        <div :class="['px-5 py-3 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <p class="font-medium text-sm dark:text-white">Payout History</p>
        </div>
        <div v-for="p in agentPayoutHistory" :key="p.id" :class="['border-b last:border-b-0', isDark ? 'border-slate-700' : 'border-[#f3f4f6]']">
          <div class="px-5 py-3 flex items-center justify-between">
            <div>
              <p :class="['text-sm font-medium', isDark ? 'text-white' : 'text-gray-900']">
                {{ formatPayoutDate(p.created_at) }}
              </p>
              <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">
                {{ p.charge_count }} charge{{ p.charge_count !== 1 ? 's' : '' }} &middot; Net &pound;{{ formatMoney(p.total_net) }} &middot; VAT &pound;{{ formatMoney(p.total_vat) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-base font-bold text-primary tabular-nums">&pound;{{ formatMoney(p.total_gross) }}</span>
              <button @click="viewPayoutDetails(p.id)" class="text-xs text-primary hover:underline">View information</button>
            </div>
          </div>
          <!-- Expanded details -->
          <div v-if="expandedHistoryId === p.id && payoutDetailsCache[p.id]" :class="['px-5 py-3 border-t text-sm', isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200']">
            <div v-for="c in payoutDetailsCache[p.id].charges" :key="c.id" class="flex items-center justify-between py-1">
              <div>
                <a
                  v-if="c.property_id"
                  :href="`/properties/${c.property_id}`"
                  target="_blank"
                  rel="noopener"
                  class="text-primary hover:underline text-xs font-medium"
                >{{ c.property_address }}</a>
                <span v-else class="text-xs font-medium dark:text-slate-300">{{ c.property_address }}</span>
                <span :class="['text-xs ml-2', isDark ? 'text-slate-500' : 'text-gray-500']">{{ c.description }}</span>
              </div>
              <span class="text-xs font-medium tabular-nums dark:text-white">&pound;{{ formatMoney(c.gross_amount) }}</span>
            </div>
          </div>
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
            class="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {{ payingContractorId === cp.id ? 'Processing...' : 'Mark Paid' }}
          </button>
        </div>
      </div>
    </div>

    <!-- HELD RENTS -->
    <div v-else-if="payoutTab === 'held'">
      <div v-if="heldRents.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No held rents</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Rents placed on hold will appear here. You can release them for payout at any time.</p>
      </div>

      <div
        v-for="(held, idx) in heldRents"
        :key="held.id"
        :class="['border-b last:border-b-0 transition-colors', isDark ? 'border-slate-700' : 'border-gray-100', idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-[#fff8f3]') : (isDark ? 'bg-slate-900' : 'bg-white')]"
      >
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <span class="font-medium text-primary text-base">{{ held.landlord_name }}</span>
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              {{ held.property_address }}, {{ held.property_postcode }}
              &middot; {{ formatDate(held.period_start) }} &ndash; {{ formatDate(held.period_end) }}
            </p>
            <p class="text-xs text-amber-600 mt-1">Held since {{ new Date(held.held_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }}</p>
          </div>
          <div class="text-right flex items-center gap-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Held Amount</p>
              <p class="text-[22px] font-bold text-amber-600">&pound;{{ formatMoney(held.net_payout) }}</p>
            </div>
            <button
              @click="releaseHeld(held.id)"
              :disabled="releasingId === held.id"
              class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-[18px] py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              {{ releasingId === held.id ? 'Releasing...' : 'Release & Pay' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- DEPOSITS -->
    <div v-else-if="payoutTab === 'deposits'">
      <div v-if="depositsLoading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
      <div v-else-if="deposits.length === 0" class="flex flex-col items-center justify-center py-16">
        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" /></svg>
        <p class="text-[15px] font-semibold text-gray-700 dark:text-white">No deposits yet</p>
        <p class="text-[13px] text-gray-500 dark:text-slate-400 max-w-[320px] text-center mt-1">Security deposits collected through initial monies will appear here with their scheme registration status.</p>
      </div>

      <div
        v-for="(dep, idx) in deposits"
        :key="dep.id"
        :class="['border-b last:border-b-0 transition-colors', isDark ? 'border-slate-700' : 'border-gray-100', idx % 2 === 1 ? (isDark ? 'bg-slate-800/50' : 'bg-[#fff8f3]') : (isDark ? 'bg-slate-900' : 'bg-white')]"
      >
        <div class="px-5 py-4 flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-primary text-base truncate">{{ dep.tenant_name }}</span>
              <span
                :class="[
                  'px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full',
                  dep.status === 'paid_to_landlord' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  dep.status === 'registered' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  dep.status === 'with_scheme' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                  dep.status === 'in_client_account' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                ]"
              >
                {{ dep.scheme_label }}
              </span>
            </div>
            <p :class="['text-sm mt-0.5', isDark ? 'text-slate-400' : 'text-gray-500']">
              {{ dep.property_address }}{{ dep.property_postcode ? ', ' + dep.property_postcode : '' }}
            </p>
            <p :class="['text-xs mt-1', dep.status === 'awaiting_registration' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400']">
              {{ dep.status_label }}
              <span v-if="dep.registration_ref"> &middot; Ref: {{ dep.registration_ref }}</span>
              <span v-if="dep.registered_at"> &middot; {{ formatDate(dep.registered_at) }}</span>
              <span v-else-if="dep.received_at"> &middot; received {{ formatDate(dep.received_at) }}</span>
            </p>
          </div>
          <div class="text-right flex items-center gap-4">
            <button
              @click="payDepositToScheme(dep)"
              :disabled="payingDepositId === dep.id"
              :class="[
                'rounded-lg font-semibold px-3 py-2 text-xs transition-colors whitespace-nowrap',
                confirmingDepositPayId === dep.id
                  ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/40'
              ]"
            >
              {{ confirmingDepositPayId === dep.id ? 'Confirm Payout' : 'Pay to Scheme' }}
            </button>
            <div>
              <p class="text-[11px] uppercase tracking-[0.06em] text-gray-500 dark:text-slate-400 font-semibold">Deposit</p>
              <p class="text-[22px] font-bold text-blue-600 dark:text-blue-400">&pound;{{ formatMoney(dep.amount) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    </div><!-- close list container -->

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

    <!-- Agent Payout Summary Modal -->
    <AgentPayoutSummaryModal
      v-if="showAgentPayoutModal"
      :charges="pendingAgentCharges"
      @close="showAgentPayoutModal = false"
      @paid="onAgentPayoutComplete"
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
import AgentPayoutSummaryModal from './AgentPayoutSummaryModal.vue'

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
const totalPayoutValue = computed(() => landlordPayouts.value.reduce((s, p) => s + (p.net_payout || 0) + (p.deposit_amount || 0), 0))

// Pending agent charges — fetched from API (charges where landlord has been paid AND agent_paid_at is null)
const pendingAgentCharges = ref<any[]>([])
const agentPayoutHistory = ref<any[]>([])
const agentFeesSummary = ref<{
  estimatedRemainingThisMonth: number
  paidThisMonth: number
  charge_count_remaining: number
  payout_count_this_month: number
}>({ estimatedRemainingThisMonth: 0, paidThisMonth: 0, charge_count_remaining: 0, payout_count_this_month: 0 })
const showAgentPayoutModal = ref(false)
const expandedHistoryId = ref<string | null>(null)
const payoutDetailsCache = ref<Record<string, any>>({})

const monthEndLabel = computed(() => {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
})

async function fetchPendingAgentCharges() {
  try {
    // Backend returns property_address + property_id resolved via the
    // schedule_entry → tenancy → property chain, so we don't need to cross-ref
    // the landlord-payout queue (which is empty once the landlord has been paid).
    const data = await get<any[]>('/api/rentgoose/pending-agent-charges')
    pendingAgentCharges.value = data || []
  } catch (err) {
    console.error('Failed to fetch pending agent charges:', err)
  }
}

async function fetchAgentPayoutHistory() {
  try {
    const data = await get<any>('/api/rentgoose/agent-payouts')
    agentPayoutHistory.value = data.payouts || []
  } catch (err) {
    console.error('Failed to fetch agent payout history:', err)
  }
}

async function fetchAgentFeesSummary() {
  try {
    const data = await get<typeof agentFeesSummary.value>('/api/rentgoose/agent-fees-summary')
    if (data) agentFeesSummary.value = data
  } catch (err) {
    console.error('Failed to fetch agent fees summary:', err)
  }
}

async function viewPayoutDetails(payoutId: string) {
  if (expandedHistoryId.value === payoutId) {
    expandedHistoryId.value = null
    return
  }
  if (!payoutDetailsCache.value[payoutId]) {
    try {
      const data = await get<any>(`/api/rentgoose/agent-payout/${payoutId}`)
      payoutDetailsCache.value[payoutId] = data
    } catch (err) {
      console.error('Failed to fetch agent payout details:', err)
      return
    }
  }
  expandedHistoryId.value = payoutId
}

function formatPayoutDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function onAgentPayoutComplete() {
  showAgentPayoutModal.value = false
  await Promise.all([
    fetchPendingAgentCharges(),
    fetchAgentPayoutHistory(),
    fetchAgentFeesSummary(),
  ])
}

const pendingAgentChargesByProperty = computed(() => {
  const grouped: Record<string, any[]> = {}
  for (const c of pendingAgentCharges.value) {
    if (!grouped[c.property_address]) grouped[c.property_address] = []
    grouped[c.property_address].push(c)
  }
  return grouped
})

const pendingAgentPropertyCount = computed(() => Object.keys(pendingAgentChargesByProperty.value).length)
const pendingAgentTotal = computed(() => pendingAgentCharges.value.reduce((s, c) => s + parseFloat(c.gross_amount || 0), 0))

// Held rents
const heldRents = ref<any[]>([])
const holdingId = ref<string | null>(null)
const releasingId = ref<string | null>(null)

async function fetchHeldRents() {
  try {
    const data = await get<any>('/api/rentgoose/held-rents')
    heldRents.value = data.heldRents || []
  } catch (err) {
    console.error('Failed to fetch held rents:', err)
  }
}

// Deposits — every collected security deposit with its scheme + status
const deposits = ref<any[]>([])
const depositsLoading = ref(false)

async function fetchDeposits() {
  depositsLoading.value = true
  try {
    const data = await get<any>('/api/rentgoose/deposits')
    deposits.value = data.deposits || []
  } catch (err) {
    console.error('Failed to fetch deposits:', err)
  } finally {
    depositsLoading.value = false
  }
}

// Deposit pay to scheme — double-click pattern
const confirmingDepositPayId = ref<string | null>(null)
const payingDepositId = ref<string | null>(null)
let confirmDepositPayTimer: ReturnType<typeof setTimeout> | null = null

async function payDepositToScheme(dep: any) {
  if (confirmingDepositPayId.value === dep.id) {
    // Second click — actually pay out
    confirmingDepositPayId.value = null
    if (confirmDepositPayTimer) { clearTimeout(confirmDepositPayTimer); confirmDepositPayTimer = null }
    payingDepositId.value = dep.id
    try {
      await post(`/api/rentgoose/deposits/${dep.id}/pay-to-scheme`, {})
      await fetchDeposits()
    } catch (err) {
      console.error('Failed to pay deposit to scheme:', err)
    } finally {
      payingDepositId.value = null
    }
  } else {
    // First click — enter confirm state
    confirmingDepositPayId.value = dep.id
    if (confirmDepositPayTimer) clearTimeout(confirmDepositPayTimer)
    confirmDepositPayTimer = setTimeout(() => {
      confirmingDepositPayId.value = null
      confirmDepositPayTimer = null
    }, 3000)
  }
}

async function holdPayout(payout: PayoutItem) {
  holdingId.value = payout.id
  try {
    await post('/api/rentgoose/hold-payout', {
      schedule_entry_id: payout.schedule_entry_id,
      landlord_id: payout.landlord_id || undefined,
    })
    await store.fetchPayouts()
    await fetchHeldRents()
  } catch (err) {
    console.error('Failed to hold payout:', err)
  } finally {
    holdingId.value = null
  }
}

async function releaseHeld(id: string) {
  releasingId.value = id
  try {
    await post('/api/rentgoose/release-held', { payout_record_id: id })
    await fetchHeldRents()
    await store.fetchPayouts()
  } catch (err) {
    console.error('Failed to release held rent:', err)
  } finally {
    releasingId.value = null
  }
}

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
  { id: 'agent', name: 'Agent Payouts', count: pendingAgentCharges.value.length },
  { id: 'held', name: 'Held Rents', count: heldRents.value.length },
  { id: 'deposits', name: 'Deposits', count: deposits.value.length },
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
    store.fetchUnifiedSchedule()
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

onMounted(async () => {
  await store.fetchPayouts()
  await fetchContractorPayouts()
  await fetchHeldRents()
  await fetchPendingAgentCharges()
  await fetchAgentPayoutHistory()
  await fetchAgentFeesSummary()
  await fetchDeposits()
})
</script>
