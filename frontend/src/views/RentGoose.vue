<template>
  <Sidebar>
    <div class="p-6 sm:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">RentGoose</h2>
            <p class="mt-1 text-gray-500 dark:text-slate-400">Rent Conciliation &amp; Arrears management</p>
          </div>
          <div class="flex items-center gap-4">
            <!-- Auto Chase Toggle -->
            <div class="flex items-center gap-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2">
              <span class="text-xs font-medium text-gray-600 dark:text-slate-400 whitespace-nowrap">Auto Chase Emails</span>
              <button
                @click="toggleAutoChase"
                :disabled="autoChaseLoading"
                :class="[
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                  autoChaseEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-600'
                ]"
              >
                <span :class="[
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm',
                  autoChaseEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                ]" />
              </button>
              <span v-if="autoChaseEnabled" class="text-[10px] text-green-600 font-medium">ON</span>
              <span v-else class="text-[10px] text-gray-400 font-medium">OFF</span>
            </div>

            <!-- Filters -->
            <select v-model="selectedProperty" class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white">
              <option value="">All Properties</option>
              <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.address }}</option>
            </select>
            <select v-if="activeTab !== 'rent'" v-model="selectedYear" class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white">
              <option v-for="y in years" :key="y" :value="y">{{ taxYearLabel(y) }}</option>
            </select>
          </div>
        </div>

        <!-- Auto Chase Info Banner -->
        <div v-if="autoChaseEnabled" class="mb-6 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Mail class="w-4 h-4 text-primary flex-shrink-0" />
          <p class="text-xs text-gray-600 dark:text-slate-400">
            Automated chase emails will be sent at <strong>7, 14, 21 &amp; 28 days</strong> overdue for all tenancies. Tenants receive PG-branded reminders with your bank details.
          </p>
          <button @click="toggleAutoChase" class="text-xs text-gray-400 hover:text-red-500 ml-auto whitespace-nowrap">Turn off</button>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-6 border-b border-gray-200 dark:border-slate-700">
          <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
            :class="['px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400']">
            {{ t.label }}
          </button>
        </div>

        <!-- ═══ RENT TAB ═══ -->
        <div v-if="activeTab === 'rent'" class="space-y-6">
          <!-- Summary Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Total Due</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ fmt(summary.totalDue) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Received</p>
              <p class="text-2xl font-bold text-green-600 mt-1">{{ fmt(summary.totalReceived) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Outstanding</p>
              <p class="text-2xl font-bold text-amber-600 mt-1">{{ fmt(summary.totalDue - summary.totalReceived) }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
              <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Net (after expenses)</p>
              <p class="text-2xl font-bold" :class="summary.net >= 0 ? 'text-green-600' : 'text-red-600'">{{ fmt(summary.net) }}</p>
            </div>
          </div>

          <!-- Add Rent Entry -->
          <button @click="showAddRent = true" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">
            Add Rent Entry
          </button>

          <!-- Month-Grouped Rent Entries -->
          <div v-if="groupedByMonth.length > 0" class="space-y-6">
            <div v-for="(group, gi) in groupedByMonth" :key="gi">
              <!-- Month Header -->
              <div class="flex items-center gap-3 mb-3">
                <h3 class="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                  Month {{ gi + 1 }} — {{ group.monthName }}
                </h3>
                <div class="flex-1 border-t border-gray-200 dark:border-slate-700"></div>
              </div>

              <!-- Entries Table -->
              <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-x-auto">
                <table class="w-full text-sm min-w-[640px]">
                  <thead class="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Due Date</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase hidden sm:table-cell">Property</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Tenant</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Amount</th>
                      <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Status</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                    <tr v-for="entry in group.entries" :key="entry.id" class="hover:bg-gray-50 dark:hover:bg-slate-750">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-1.5">
                          <span class="text-gray-900 dark:text-white">{{ formatDate(entry.due_date) }}</span>
                          <span v-if="entry.auto_created" class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-medium">Auto</span>
                        </div>
                        <p v-if="daysOverdue(entry) > 0 && entry.status !== 'received'" class="text-[11px] text-red-500 mt-0.5">
                          {{ daysOverdue(entry) }} days overdue
                        </p>
                      </td>
                      <td class="px-4 py-3 text-xs">
                        <router-link v-if="entry.tenancy_id" :to="{ path: '/tenancies', query: { tenancy: entry.tenancy_id } }" class="text-primary hover:underline">
                          {{ entry.property_address || '—' }}
                        </router-link>
                        <span v-else class="text-gray-600 dark:text-slate-400">{{ entry.property_address || '—' }}</span>
                      </td>
                      <td class="px-4 py-3 text-gray-600 dark:text-slate-400">{{ entry.tenant_name || '—' }}</td>
                      <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{{ fmt(entry.amount) }}</td>
                      <td class="px-4 py-3 text-center">
                        <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                          :class="{
                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300': entry.status === 'received',
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300': entry.status === 'pending',
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300': entry.status === 'overdue',
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300': entry.status === 'partial',
                          }">
                          {{ entry.status }}
                        </span>
                        <!-- Chase history badge -->
                        <span v-if="entry.chase_history?.length" class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300 font-medium">
                          {{ entry.chase_history.length }} chased
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <button v-if="entry.status !== 'received'" @click="receiptEntry = entry; showReceipt = true"
                            class="text-xs text-green-600 hover:text-green-800 font-medium">Receipt</button>
                          <button v-if="entry.status !== 'received' && daysOverdue(entry) > 0" @click="sendQuickChase(entry.id)"
                            :disabled="saving"
                            class="text-xs text-orange-500 hover:text-orange-700 font-medium">Quick Chase</button>
                          <button v-if="entry.status !== 'received'" @click="arrearsEntry = entry; showArrears = true"
                            class="text-xs text-red-500 hover:text-red-700 font-medium">Formal Chase</button>
                          <button @click="deleteRent(entry.id)" class="text-xs text-gray-400 hover:text-red-500">
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-12 text-center">
            <p class="text-gray-400 dark:text-slate-500">No rent entries yet. Activate a tenancy or add a rent entry manually.</p>
          </div>
        </div>

        <!-- ═══ EXPENSES TAB ═══ -->
        <div v-else-if="activeTab === 'expenses'" class="space-y-6">
          <button @click="showAddExpense = true" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">
            Add Invoice / Expense
          </button>

          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-x-auto">
            <table class="w-full text-sm min-w-[640px]">
              <thead class="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contractor</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount (inc. VAT)</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                <tr v-for="exp in filteredExpenses" :key="exp.id" class="hover:bg-gray-50 dark:hover:bg-slate-750">
                  <td class="px-4 py-3 text-gray-900 dark:text-white">{{ formatDate(exp.invoice_date) }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-slate-300">{{ exp.contractor_name }}</td>
                  <td class="px-4 py-3 text-gray-500 dark:text-slate-400">{{ exp.description || '—' }}</td>
                  <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{{ fmt(exp.amount_inc_vat) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a v-if="exp.invoice_pdf_path" :href="exp.invoice_pdf_path" target="_blank" class="text-xs text-primary hover:underline">View PDF</a>
                    <span v-else class="text-xs text-gray-400">—</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button @click="deleteExpense(exp.id)" class="text-gray-400 hover:text-red-500"><Trash2 class="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
                <tr v-if="filteredExpenses.length === 0">
                  <td colspan="6" class="px-4 py-8 text-center text-gray-400">No expenses recorded</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-500 dark:text-slate-400">Total expenses: <strong class="text-gray-900 dark:text-white">{{ fmt(totalExpenses) }}</strong></p>
          </div>
        </div>

        <!-- ═══ STATEMENTS TAB ═══ -->
        <div v-else-if="activeTab === 'statements'" class="space-y-6">
          <div v-if="statementLoading" class="text-center py-12">
            <Loader2 class="w-8 h-8 animate-spin text-primary mx-auto" />
          </div>
          <div v-else-if="statement" class="space-y-6">
            <!-- Annual Summary -->
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Tax Year {{ taxYearLabel(selectedYear) }}</h3>
              <p class="text-xs text-gray-500 dark:text-slate-400 mb-4">{{ taxYearRange(selectedYear) }}</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p class="text-xs text-gray-500 uppercase">Rent Due</p><p class="text-xl font-bold text-gray-900 dark:text-white">{{ fmt(statement.totalRentDue) }}</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Rent Received</p><p class="text-xl font-bold text-green-600">{{ fmt(statement.totalRentReceived) }}</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Expenses</p><p class="text-xl font-bold text-red-500">{{ fmt(statement.totalExpenses) }}</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Net Income</p><p class="text-xl font-bold" :class="statement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'">{{ fmt(statement.netIncome) }}</p></div>
              </div>
            </div>

            <!-- By Property -->
            <div v-if="Object.keys(statement.byProperty).length > 0" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">By Property</h3>
              </div>
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Property</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Income</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Expenses</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  <tr v-for="(data, pid) in statement.byProperty" :key="pid">
                    <td class="px-4 py-2 text-gray-900 dark:text-white">{{ data.address }}</td>
                    <td class="px-4 py-2 text-right text-green-600">{{ fmt(data.income) }}</td>
                    <td class="px-4 py-2 text-right text-red-500">{{ fmt(data.expenses) }}</td>
                    <td class="px-4 py-2 text-right font-semibold" :class="data.net >= 0 ? 'text-green-600' : 'text-red-600'">{{ fmt(data.net) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Monthly Breakdown -->
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Monthly Breakdown</h3>
              </div>
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">In</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Out</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                  <tr v-for="m in statement.monthly" :key="m.month">
                    <td class="px-4 py-2 text-gray-900 dark:text-white">{{ monthName(m.month) }}</td>
                    <td class="px-4 py-2 text-right text-green-600">{{ fmt(m.income) }}</td>
                    <td class="px-4 py-2 text-right text-red-500">{{ fmt(m.expenses) }}</td>
                    <td class="px-4 py-2 text-right font-semibold" :class="m.net >= 0 ? 'text-green-600' : 'text-red-600'">{{ fmt(m.net) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Detailed Print View (shown on screen too, collapsed by default) -->
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden print:block">
              <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Detailed Transactions</h3>
                <button @click="showDetailedTransactions = !showDetailedTransactions" class="text-xs text-primary hover:underline print:hidden">
                  {{ showDetailedTransactions ? 'Hide' : 'Show' }}
                </button>
              </div>
              <div v-show="showDetailedTransactions" class="divide-y divide-gray-100 dark:divide-slate-700">
                <!-- Rent Payments -->
                <div class="p-4">
                  <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Inbound Payments (Rent Received)</h4>
                  <table class="w-full text-sm">
                    <thead>
                      <tr>
                        <th class="text-left text-xs text-gray-500 pb-1">Date Received</th>
                        <th class="text-left text-xs text-gray-500 pb-1">Property</th>
                        <th class="text-left text-xs text-gray-500 pb-1">Tenant</th>
                        <th class="text-right text-xs text-gray-500 pb-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="entry in receivedRentForYear" :key="entry.id">
                        <td class="py-1 text-gray-900 dark:text-white">{{ formatDate(entry.received_date || entry.due_date) }}</td>
                        <td class="py-1 text-gray-600 dark:text-slate-400 text-xs">{{ entry.property_address || '—' }}</td>
                        <td class="py-1 text-gray-600 dark:text-slate-400">{{ entry.tenant_name || '—' }}</td>
                        <td class="py-1 text-right text-green-600 font-medium">{{ fmt(entry.received_amount || entry.amount) }}</td>
                      </tr>
                      <tr v-if="receivedRentForYear.length === 0">
                        <td colspan="4" class="py-2 text-center text-gray-400 text-xs">No payments received</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <!-- Expenses -->
                <div class="p-4">
                  <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Expenditure</h4>
                  <table class="w-full text-sm">
                    <thead>
                      <tr>
                        <th class="text-left text-xs text-gray-500 pb-1">Invoice Date</th>
                        <th class="text-left text-xs text-gray-500 pb-1">Contractor</th>
                        <th class="text-left text-xs text-gray-500 pb-1">Description</th>
                        <th class="text-right text-xs text-gray-500 pb-1">Amount (inc. VAT)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="exp in expensesForYear" :key="exp.id">
                        <td class="py-1 text-gray-900 dark:text-white">{{ formatDate(exp.invoice_date) }}</td>
                        <td class="py-1 text-gray-600 dark:text-slate-400">{{ exp.contractor_name }}</td>
                        <td class="py-1 text-gray-500 dark:text-slate-400 text-xs">{{ exp.description || '—' }}</td>
                        <td class="py-1 text-right text-red-500 font-medium">{{ fmt(exp.amount_inc_vat) }}</td>
                      </tr>
                      <tr v-if="expensesForYear.length === 0">
                        <td colspan="4" class="py-2 text-center text-gray-400 text-xs">No expenses</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Print -->
            <div class="flex gap-3 justify-end print:hidden">
              <button @click="printStatement" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50">
                Print Statement
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ MODALS ═══ -->

      <!-- Add Rent Modal -->
      <div v-if="showAddRent" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showAddRent = false">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Rent Entry</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property</label>
              <select v-model="rentForm.property_id" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white">
                <option value="">Select property...</option>
                <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.address }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenant Name</label>
              <input v-model="rentForm.tenant_name" type="text" placeholder="Tenant name" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Due Date *</label>
                <input v-model="rentForm.due_date" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Amount *</label>
                <input v-model="rentForm.amount" type="number" step="0.01" required placeholder="850.00" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              </div>
            </div>
            <!-- Auto-Populate Toggle -->
            <div class="flex items-center gap-2 pt-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2.5">
              <input v-model="rentForm.auto_populate" type="checkbox" id="autoPopulate"
                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <label for="autoPopulate" class="text-sm font-medium text-gray-700 dark:text-slate-300">
                Auto-populate monthly rents
              </label>
              <span class="text-[11px] text-gray-400 ml-auto">(Next month auto-created when due date passes)</span>
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showAddRent = false" class="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm">Cancel</button>
            <button @click="createRent" :disabled="saving" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">{{ saving ? 'Saving...' : 'Add Entry' }}</button>
          </div>
        </div>
      </div>

      <!-- Receipt Modal -->
      <div v-if="showReceipt && receiptEntry" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showReceipt = false">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Receipt Rent</h3>
          <p class="text-sm text-gray-500">{{ receiptEntry.tenant_name }} — due {{ fmt(receiptEntry.amount) }}</p>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Amount Received</label>
            <input v-model="receiptAmount" type="number" step="0.01" :placeholder="receiptEntry.amount" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showReceipt = false" class="px-4 py-2 text-gray-700 rounded-lg text-sm">Cancel</button>
            <button @click="receiptRent" :disabled="saving" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{{ saving ? 'Saving...' : 'Confirm Receipt' }}</button>
          </div>
        </div>
      </div>

      <!-- Arrears / Formal Chase Modal -->
      <div v-if="showArrears && arrearsEntry" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showArrears = false">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Send Formal Arrears Letter</h3>
          <p class="text-sm text-gray-500">{{ arrearsEntry.tenant_name }} — {{ fmt(arrearsEntry.amount) }} overdue</p>
          <div v-if="arrearsEntry.chase_history?.length" class="text-xs text-gray-400">
            Previously chased: {{ arrearsEntry.chase_history.map((l: any) => (l.type || l.letter_type || l) + '-day' + (l.automated ? ' (auto)' : '')).join(', ') }}
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="d in [7,14,21,28]" :key="d" @click="sendArrearsLetter(d)" :disabled="saving"
              class="px-3 py-2 text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50">
              {{ d }}-Day Letter
            </button>
          </div>
          <button @click="showArrears = false" class="w-full px-4 py-2 text-gray-500 text-sm">Close</button>
        </div>
      </div>

      <!-- Add Expense Modal -->
      <div v-if="showAddExpense" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showAddExpense = false">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Invoice / Expense</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property</label>
              <select v-model="expenseForm.property_id" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white">
                <option value="">General (no property)</option>
                <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.address }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Contractor Name *</label>
              <input v-model="expenseForm.contractor_name" type="text" required placeholder="e.g. ABC Plumbing" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
              <input v-model="expenseForm.description" type="text" placeholder="e.g. Boiler repair" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Amount (inc. VAT) *</label>
                <input v-model="expenseForm.amount_inc_vat" type="number" step="0.01" required placeholder="150.00" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Invoice Date *</label>
                <input v-model="expenseForm.invoice_date" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Invoice PDF</label>
              <input ref="pdfInput" type="file" accept=".pdf,image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white cursor-pointer" />
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showAddExpense = false" class="px-4 py-2 text-gray-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
            <button @click="createExpense" :disabled="saving" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">{{ saving ? 'Saving...' : 'Add Expense' }}</button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from 'vue-toastification'
import axios from 'axios'
import Sidebar from '../components/Sidebar.vue'
import { Trash2, Loader2, Mail } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL
const authStore = useAuthStore()
const toast = useToast()
const headers = computed(() => ({ Authorization: `Bearer ${authStore.session?.access_token}` }))

const activeTab = ref('rent')
const tabs = [
  { id: 'rent', label: 'Rent Schedule' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'statements', label: 'Statements' },
]

// Tax years: Apr 6 to Apr 5 — labelled as "2025/26", "2024/25", etc.
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const currentDay = new Date().getDate()
// If before Apr 6, we're still in the previous tax year
const currentTaxYearStart = (currentMonth < 4 || (currentMonth === 4 && currentDay < 6))
  ? currentYear - 1
  : currentYear
const taxYears = Array.from({ length: 5 }, (_, i) => currentTaxYearStart - i)
const selectedYear = ref(currentTaxYearStart)
const years = taxYears
const selectedProperty = ref('')

const rentEntries = ref<any[]>([])
const expenses = ref<any[]>([])
const properties = ref<any[]>([])
const statement = ref<any>(null)
const statementLoading = ref(false)
const saving = ref(false)
const showDetailedTransactions = ref(false)

// Auto chase settings
const autoChaseEnabled = ref(false)
const autoChaseLoading = ref(false)

// Modals
const showAddRent = ref(false)
const showReceipt = ref(false)
const showArrears = ref(false)
const showAddExpense = ref(false)
const receiptEntry = ref<any>(null)
const arrearsEntry = ref<any>(null)
const receiptAmount = ref<number | null>(null)
const pdfInput = ref<HTMLInputElement | null>(null)

const rentForm = ref({ property_id: '', tenant_name: '', due_date: '', amount: '', auto_populate: true })
const expenseForm = ref({ property_id: '', contractor_name: '', description: '', amount_inc_vat: '', invoice_date: '' })

// Filtered entries
const filteredRent = computed(() => {
  let list = rentEntries.value
  if (selectedProperty.value) list = list.filter(e => e.property_id === selectedProperty.value)
  return list
})

const filteredExpenses = computed(() => {
  let list = expenses.value
  if (selectedProperty.value) list = list.filter(e => e.property_id === selectedProperty.value)
  return list
})

const totalExpenses = computed(() => filteredExpenses.value.reduce((sum, e) => sum + parseFloat(e.amount_inc_vat), 0))

// Group rent entries by month — max 2 months
const groupedByMonth = computed(() => {
  const groups: Record<string, { monthName: string, entries: any[] }> = {}
  for (const entry of filteredRent.value) {
    const d = new Date(entry.due_date + 'T00:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) {
      groups[key] = {
        monthName: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        entries: []
      }
    }
    groups[key].entries.push(entry)
  }
  // Sort by key (YYYY-MM) and take max 2
  return Object.keys(groups)
    .sort()
    .slice(0, 2)
    .map(k => groups[k])
})

// Detailed data for print/statement view — rent received and expenses within selected tax year
const receivedRentForYear = computed(() => {
  return rentEntries.value.filter(e => e.status === 'received' || e.status === 'partial')
})

const expensesForYear = computed(() => {
  return expenses.value
})

const summary = computed(() => {
  const due = filteredRent.value.reduce((s, e) => s + parseFloat(e.amount), 0)
  const received = filteredRent.value.reduce((s, e) => s + (parseFloat(e.received_amount) || 0), 0)
  const exp = totalExpenses.value
  return { totalDue: due, totalReceived: received, net: received - exp }
})

// Helpers
function fmt(n: number) { return `£${(n || 0).toFixed(2)}` }
function formatDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—' }
function monthName(m: string) {
  const [y, mo] = m.split('-')
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function printStatement() { window.print() }
function taxYearLabel(startYear: number) { return `${startYear}/${(startYear + 1).toString().slice(-2)}` }
function taxYearRange(startYear: number) { return `6 April ${startYear} — 5 April ${startYear + 1}` }

function daysOverdue(entry: any): number {
  if (entry.status === 'received') return 0
  const due = new Date(entry.due_date + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

// Data loading
async function loadData() {
  try {
    const params: any = activeTab.value === 'rent'
      ? { month_window: true }
      : { year: selectedYear.value, tax_year: true }

    const [rentRes, expRes] = await Promise.all([
      axios.get(`${API_URL}/api/landlord-portal/rentgoose/rent`, { headers: headers.value, params }),
      axios.get(`${API_URL}/api/landlord-portal/rentgoose/expenses`, { headers: headers.value, params: { year: selectedYear.value, tax_year: true } }),
    ])
    rentEntries.value = rentRes.data.entries || []
    expenses.value = expRes.data.expenses || []
  } catch (err) {
    console.error('RentGoose load error:', err)
  }
}

async function loadProperties() {
  try {
    const res = await axios.get(`${API_URL}/api/properties`, { headers: headers.value })
    properties.value = (res.data.properties || res.data || []).map((p: any) => ({
      id: p.id,
      address: p.address?.formatted || p.address?.line1 || p.postcode || p.id
    }))
  } catch {
    try {
      const res = await axios.get(`${API_URL}/api/landlord-portal/properties`, { headers: headers.value })
      properties.value = (res.data || []).map((p: any) => ({ id: p.id, address: p.postcode || p.id }))
    } catch {}
  }
}

async function loadRentGooseSettings() {
  try {
    const res = await axios.get(`${API_URL}/api/landlord-portal/rentgoose/settings`, { headers: headers.value })
    autoChaseEnabled.value = res.data.auto_chase_enabled ?? false
  } catch {
    autoChaseEnabled.value = false
  }
}

async function toggleAutoChase() {
  autoChaseLoading.value = true
  try {
    const res = await axios.put(`${API_URL}/api/landlord-portal/rentgoose/settings`, {
      auto_chase_enabled: !autoChaseEnabled.value
    }, { headers: headers.value })
    autoChaseEnabled.value = res.data.auto_chase_enabled
    toast.success(autoChaseEnabled.value ? 'Auto chase emails enabled' : 'Auto chase emails disabled')
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to update settings')
  } finally {
    autoChaseLoading.value = false
  }
}

async function loadStatement() {
  statementLoading.value = true
  showDetailedTransactions.value = false
  try {
    // Pass tax year start — backend should use Apr 6 to Apr 5 range
    const res = await axios.get(`${API_URL}/api/landlord-portal/rentgoose/statement/${selectedYear.value}`, {
      headers: headers.value,
      params: { tax_year: true }
    })
    statement.value = res.data
  } catch (err) {
    console.error('Statement error:', err)
  } finally {
    statementLoading.value = false
  }
}

watch(selectedYear, () => { loadData(); if (activeTab.value === 'statements') loadStatement() })
watch(activeTab, (tab) => {
  if (tab === 'statements') loadStatement()
  loadData() // Reload with correct params (month_window vs year)
})

onMounted(() => { loadData(); loadProperties(); loadRentGooseSettings() })

// Rent CRUD
async function createRent() {
  saving.value = true
  try {
    await axios.post(`${API_URL}/api/landlord-portal/rentgoose/rent`, rentForm.value, { headers: headers.value })
    showAddRent.value = false
    rentForm.value = { property_id: '', tenant_name: '', due_date: '', amount: '', auto_populate: true }
    toast.success('Rent entry added')
    await loadData()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to add rent entry')
  } finally { saving.value = false }
}

async function receiptRent() {
  if (!receiptEntry.value) return
  saving.value = true
  try {
    await axios.put(`${API_URL}/api/landlord-portal/rentgoose/rent/${receiptEntry.value.id}/receipt`, {
      received_amount: receiptAmount.value || receiptEntry.value.amount
    }, { headers: headers.value })
    showReceipt.value = false
    receiptEntry.value = null
    receiptAmount.value = null
    toast.success('Rent receipted')
    await loadData()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to receipt')
  } finally { saving.value = false }
}

async function sendQuickChase(entryId: string) {
  saving.value = true
  try {
    await axios.post(`${API_URL}/api/landlord-portal/rentgoose/rent/${entryId}/quick-chase`, {}, { headers: headers.value })
    toast.success('Chase reminder sent to tenant')
    await loadData()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to send chase')
  } finally { saving.value = false }
}

async function sendArrearsLetter(days: number) {
  if (!arrearsEntry.value) return
  saving.value = true
  try {
    await axios.post(`${API_URL}/api/landlord-portal/rentgoose/rent/${arrearsEntry.value.id}/arrears-letter`, {
      letter_type: days
    }, { headers: headers.value })
    showArrears.value = false
    toast.success(`${days}-day arrears letter sent`)
    await loadData()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to send letter')
  } finally { saving.value = false }
}

async function deleteRent(id: string) {
  if (!confirm('Delete this rent entry?')) return
  try {
    await axios.delete(`${API_URL}/api/landlord-portal/rentgoose/rent/${id}`, { headers: headers.value })
    toast.success('Rent entry deleted')
    await loadData()
  } catch {}
}

// Expense CRUD
async function createExpense() {
  saving.value = true
  try {
    const formData = new FormData()
    Object.entries(expenseForm.value).forEach(([k, v]) => { if (v) formData.append(k, v as string) })
    if (pdfInput.value?.files?.[0]) formData.append('invoice_pdf', pdfInput.value.files[0])

    await axios.post(`${API_URL}/api/landlord-portal/rentgoose/expenses`, formData, {
      headers: { ...headers.value, 'Content-Type': 'multipart/form-data' }
    })
    showAddExpense.value = false
    expenseForm.value = { property_id: '', contractor_name: '', description: '', amount_inc_vat: '', invoice_date: '' }
    toast.success('Expense added')
    await loadData()
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Failed to add expense')
  } finally { saving.value = false }
}

async function deleteExpense(id: string) {
  if (!confirm('Delete this expense?')) return
  try {
    await axios.delete(`${API_URL}/api/landlord-portal/rentgoose/expenses/${id}`, { headers: headers.value })
    toast.success('Expense deleted')
    await loadData()
  } catch {}
}
</script>

<style scoped>
@media print {
  /* Hide sidebar, header controls, tabs, and non-statement content */
  :deep(nav), :deep(aside),
  .print\\:hidden { display: none !important; }
  .print\\:block { display: block !important; }

  /* Show detailed transactions expanded when printing */
  [v-show] { display: block !important; }
}
</style>
