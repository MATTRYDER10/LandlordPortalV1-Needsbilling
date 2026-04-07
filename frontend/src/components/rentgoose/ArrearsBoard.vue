<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold">Arrears</h2>
      <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">{{ store.arrears.length }} active chase{{ store.arrears.length !== 1 ? 's' : '' }}</p>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else :class="['rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-gray-200']">
      <table class="w-full">
        <thead>
          <tr :class="isDark ? 'bg-slate-800' : 'bg-gray-50'">
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="thClass">Property</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" :class="thClass">Tenant</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide hidden md:table-cell" :class="thClass">Due Date</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide" :class="thClass">Outstanding</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide hidden md:table-cell" :class="thClass">Partial</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide" :class="thClass">Days</th>
            <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide" :class="thClass">Chase Status</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide" :class="thClass">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in store.arrears"
            :key="item.id"
            :class="['border-t', isDark ? 'border-slate-700' : 'border-gray-100']"
          >
            <td class="px-4 py-3 text-sm">
              <div class="font-medium">{{ item.property_address }}</div>
              <div :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">{{ item.property_postcode }}</div>
            </td>
            <td class="px-4 py-3 text-sm">
              {{ item.tenant_name }}
              <span v-if="item.has_guarantor" class="ml-1 text-xs text-amber-500">(G)</span>
            </td>
            <td class="px-4 py-3 text-sm hidden md:table-cell">{{ formatDate(item.due_date) }}</td>
            <td class="px-4 py-3 text-sm text-right font-medium text-red-500">&pound;{{ formatMoney(item.amount_outstanding) }}</td>
            <td class="px-4 py-3 text-sm text-right hidden md:table-cell">
              <span v-if="item.partial_paid > 0" class="text-teal-500">&pound;{{ formatMoney(item.partial_paid) }}</span>
              <span v-else :class="isDark ? 'text-slate-500' : 'text-gray-400'">&mdash;</span>
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="['text-sm font-bold', item.days_overdue >= 28 ? 'text-red-500' : item.days_overdue >= 14 ? 'text-amber-500' : 'text-gray-500']">
                {{ item.days_overdue }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-center gap-1">
                <span :class="['w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold', item.day7_sent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400']">7</span>
                <span :class="['w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold', item.day14_sent ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400']">14</span>
                <span :class="['w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold', item.day21_sent ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400']">21</span>
                <span :class="['w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold', item.day28_sent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : isDark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400']">28</span>
              </div>
            </td>
            <td class="px-4 py-3 text-right">
              <button @click="resolve(item.id)" class="text-xs text-emerald-500 hover:underline mr-2">Resolve</button>
            </td>
          </tr>
          <tr v-if="store.arrears.length === 0">
            <td colspan="8" class="px-4 py-12 text-center" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
              No active arrears. All tenants are up to date.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useRentGooseStore } from '../../stores/rentgoose'

const { isDark } = useDarkMode()
const store = useRentGooseStore()

const thClass = computed(() => isDark.value ? 'text-slate-400' : 'text-gray-500')

async function resolve(id: string) {
  if (confirm('Mark this arrears case as resolved?')) {
    await store.resolveArrears(id)
  }
}

function formatMoney(val: number) {
  return (val || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  store.fetchArrears()
})
</script>
