<template>
  <Sidebar>
  <div :class="['min-h-screen transition-colors duration-300', isDark ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900']">
    <!-- Header -->
    <div :class="['border-b px-6 py-4', isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white']">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold flex items-center gap-2">
            <span class="text-primary">RentGoose</span>
          </h1>
          <p :class="['text-sm mt-1', isDark ? 'text-slate-400' : 'text-gray-500']">Rent collection, payouts & client account management</p>
        </div>
        <button
          @click="showRaiseCharge = true"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg transition-colors"
        >
          Raise Invoice / Charge / Credit
        </button>
      </div>

      <!-- Sub-tab navigation -->
      <div class="flex gap-1 mt-4 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="store.activeTab = tab.id"
          :class="[
            'px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
            store.activeTab === tab.id
              ? 'bg-primary text-white shadow-md shadow-primary/30'
              : isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          ]"
        >
          {{ tab.name }}
          <span
            v-if="tab.count !== undefined && tab.count > 0"
            :class="[
              'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
              store.activeTab === tab.id
                ? 'bg-white/20'
                : isDark ? 'bg-slate-700' : 'bg-gray-200'
            ]"
          >{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- Tab content -->
    <div class="p-6">
      <UnifiedPaymentsBoard v-if="store.activeTab === 'collection'" />
      <PayoutsBoard v-else-if="store.activeTab === 'payouts'" />
      <AgentFeesBoard v-else-if="store.activeTab === 'fees'" />
      <LandlordFinancialView v-else-if="store.activeTab === 'landlords'" />
      <ContractorsBoard v-else-if="store.activeTab === 'contractors'" />
      <ClientAccountTracker v-else-if="store.activeTab === 'client-account'" />
    </div>

    <!-- Raise Charge Modal -->
    <RaiseChargeModal
      :show="showRaiseCharge"
      @close="showRaiseCharge = false"
      @saved="showRaiseCharge = false; store.fetchSchedule()"
    />
  </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../composables/useDarkMode'
import { useRentGooseStore } from '../stores/rentgoose'
import Sidebar from '../components/Sidebar.vue'
import UnifiedPaymentsBoard from '../components/rentgoose/UnifiedPaymentsBoard.vue'
import RentCollectionBoard from '../components/rentgoose/RentCollectionBoard.vue'
import PayoutsBoard from '../components/rentgoose/PayoutsBoard.vue'
import AgentFeesBoard from '../components/rentgoose/AgentFeesBoard.vue'
import LandlordFinancialView from '../components/rentgoose/LandlordFinancialView.vue'
import ContractorsBoard from '../components/rentgoose/ContractorsBoard.vue'
import ClientAccountTracker from '../components/rentgoose/ClientAccountTracker.vue'
import RaiseChargeModal from '../components/rentgoose/RaiseChargeModal.vue'

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const showRaiseCharge = ref(false)

const tabs = computed(() => [
  { id: 'collection', name: 'Payments', count: store.categoryCounts.arrears || store.statusCounts.arrears || 0 },
  { id: 'payouts', name: 'Payouts', count: store.payouts.length },
  { id: 'fees', name: 'Fee Ledger' },
  { id: 'landlords', name: 'Landlords' },
  { id: 'contractors', name: 'Contractors' },
  { id: 'client-account', name: 'Client Account' },
])

onMounted(() => {
  store.fetchSchedule()
})
</script>
