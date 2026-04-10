<template>
  <div class="space-y-6">
    <!-- Apex27 Branded Header -->
    <div class="rounded-lg border-2 border-[#6B21A8] bg-gradient-to-br from-[#6B21A8]/5 to-[#9333EA]/10 dark:from-[#6B21A8]/10 dark:to-[#9333EA]/20 overflow-hidden">
      <div class="px-6 py-4 bg-white dark:bg-slate-800 border-b border-[#6B21A8]/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#6B21A8]">
            <div class="w-3 h-3 rounded-full bg-white"></div>
          </div>
          <div>
            <h3 class="text-lg font-bold text-[#6B21A8] dark:text-white">Apex27</h3>
            <p class="text-xs text-gray-500 dark:text-slate-400">CRM Integration</p>
          </div>
        </div>
        <a
          href="https://www.apex27.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[#6B21A8] hover:text-[#9333EA] dark:text-slate-300 dark:hover:text-[#9333EA] transition-colors flex items-center gap-1"
        >
          Learn more
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 dark:text-slate-400">
          Connect your Apex27 CRM to sync rental properties, landlords, and push documents between systems.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-[#6B21A8]" />
    </div>

    <!-- Main Panel -->
    <div v-else class="bg-white dark:bg-slate-800 rounded-lg border border-[#6B21A8]/30 shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#6B21A8]/20">
            <Key class="w-4 h-4 text-[#6B21A8] dark:text-[#9333EA]" />
          </div>
          <div>
            <h4 class="text-md font-semibold text-[#6B21A8] dark:text-white">API Connection</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              Enter your Apex27 API key to connect your account.
            </p>
          </div>
        </div>
        <div v-if="status?.configured" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="status.lastTestStatus === 'success'
              ? 'bg-[#6B21A8]/20 text-[#6B21A8] dark:bg-[#9333EA]/30 dark:text-[#9333EA]'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ status.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
      </div>

      <!-- Saved Config Display -->
      <div v-if="status?.configured && !editMode" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white font-mono">{{ status.maskedApiKey || '••••••••••••••••••••' }}</span>
          </div>
        </div>

        <!-- Connection Info -->
        <div v-if="status.lastTestedAt" class="text-xs text-gray-500 dark:text-slate-400">
          Last tested: {{ formatDate(status.lastTestedAt) }}
          <span v-if="status.lastSyncAt"> &middot; Last synced: {{ formatDate(status.lastSyncAt) }}</span>
        </div>

        <!-- Branch Selector -->
        <div v-if="status.lastTestStatus === 'success'" class="mt-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Apex27 Branch</label>
          <div v-if="branches.length > 0" class="flex items-center gap-2">
            <select
              v-model="selectedBranchId"
              @change="handleBranchChange"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#6B21A8] focus:border-[#6B21A8] dark:bg-slate-900 dark:text-white text-sm"
            >
              <option value="">All branches</option>
              <option v-for="branch in branches" :key="branch.id" :value="String(branch.id)">
                {{ branch.name || branch.branchName || `Branch #${branch.id}` }}
              </option>
            </select>
            <span v-if="branchSaved" class="text-green-500 flex-shrink-0" title="Saved">
              <CheckCircle class="w-5 h-5" />
            </span>
          </div>
          <div v-else-if="status.branchId" class="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md flex items-center gap-2">
            <span class="text-gray-900 dark:text-white text-sm">Branch #{{ status.branchId }}</span>
            <Loader2 class="w-3 h-3 animate-spin text-gray-400" />
          </div>
          <div v-else class="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-500 dark:text-slate-400 text-sm">All branches</span>
            <Loader2 v-if="loading" class="w-3 h-3 animate-spin text-gray-400 inline ml-2" />
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Select which branch to sync properties and landlords from.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="button"
              @click="editMode = true"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Edit API Key
            </button>
            <button
              type="button"
              @click="handleTestConnection"
              :disabled="testing"
              class="px-4 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
            >
              <span v-if="testing" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Testing...
              </span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <button
            type="button"
            @click="handleRemove"
            :disabled="removing"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ removing ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>

        <!-- Initial Sync Section -->
        <div v-if="status.lastTestStatus === 'success'" class="mt-6 pt-6 border-t dark:border-slate-700">

          <!-- Initial Sync (when no sync has happened yet or user wants to re-run) -->
          <div v-if="!previewItems">
            <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Initial Sync</h5>
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Pull properties and landlords from Apex27 for review before importing.
            </p>
            <button
              type="button"
              @click="handlePreview"
              :disabled="previewing"
              class="px-4 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
            >
              <span v-if="previewing" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Fetching from Apex27...
              </span>
              <span v-else>Initial Sync</span>
            </button>
          </div>

          <!-- Preview Review Table -->
          <div v-if="previewItems">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h5 class="text-sm font-semibold text-gray-900 dark:text-white">Review Import</h5>
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {{ previewItems.length }} Apex27 listings.
                  <span class="text-green-600 dark:text-green-400">{{ previewItems.filter(i => i.importProperty).length }} new properties</span>,
                  <span class="text-blue-600 dark:text-blue-400">{{ previewItems.filter(i => i.importLandlord).length }} landlord imports</span>,
                  <span class="text-gray-500">{{ previewItems.filter(i => i.matchType !== 'new').length }} matched</span>
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="previewItems = null"
                  class="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- Table -->
            <div class="border dark:border-slate-700 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-slate-900 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400">Address</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400 w-24">Status</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-500 dark:text-slate-400 w-24">Property</th>
                    <th class="px-3 py-2 text-center font-medium text-gray-500 dark:text-slate-400 w-24">Landlord</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400 w-44">Details</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-slate-700">
                  <tr
                    v-for="item in previewItems"
                    :key="item.apex27ListingId"
                    :class="!item.importProperty && !item.importLandlord ? 'bg-gray-50 dark:bg-slate-900 opacity-60' : 'bg-white dark:bg-slate-800'"
                  >
                    <td class="px-3 py-2">
                      <div class="text-gray-900 dark:text-white text-sm">{{ item.apex27Address }}</div>
                      <div class="text-xs text-gray-500 dark:text-slate-400">
                        {{ [item.apex27Bedrooms ? item.apex27Bedrooms + ' bed' : '', item.apex27Rent ? formatCurrency(item.apex27Rent) + '/m' : ''].filter(Boolean).join(' · ') }}
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <span class="text-xs px-2 py-0.5 rounded-full"
                        :class="{
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400': ['available', 'let', 'let_agreed', 'let agreed'].includes((item.apex27Status || '').toLowerCase()),
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': !['available', 'let', 'let_agreed', 'let agreed'].includes((item.apex27Status || '').toLowerCase())
                        }"
                      >
                        {{ formatStatus(item.apex27Status) }}
                      </span>
                    </td>
                    <!-- Import Property toggle -->
                    <td class="px-3 py-2 text-center">
                      <button
                        type="button"
                        @click="item.importProperty = !item.importProperty"
                        class="text-xs font-medium px-2 py-1 rounded"
                        :class="item.importProperty
                          ? (item.matchType === 'new' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')
                          : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'"
                      >
                        {{ item.matchType === 'new' ? (item.importProperty ? 'Yes' : 'No') : (item.importProperty ? 'Link' : 'Skip') }}
                      </button>
                      <div v-if="item.matchType !== 'new'" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate max-w-[90px]" :title="item.matchedPropertyAddress || ''">
                        {{ item.matchedPropertyAddress ? 'Exists' : '' }}
                      </div>
                    </td>
                    <!-- Import Landlord toggle -->
                    <td class="px-3 py-2 text-center">
                      <template v-if="item.landlordContacts.length > 0">
                        <button
                          type="button"
                          @click="item.importLandlord = !item.importLandlord"
                          class="text-xs font-medium px-2 py-1 rounded"
                          :class="item.importLandlord
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'"
                        >
                          {{ item.importLandlord ? 'Yes' : 'No' }}
                        </button>
                        <div v-if="item.hasExistingLandlord && !item.importLandlord" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          Has LL
                        </div>
                      </template>
                      <span v-else class="text-xs text-gray-300 dark:text-slate-600">-</span>
                    </td>
                    <!-- Details -->
                    <td class="px-3 py-2">
                      <div v-if="item.landlordContacts.length > 0 && item.importLandlord">
                        <div v-for="lc in item.landlordContacts" :key="lc.id" class="text-xs flex items-center gap-1">
                          <span class="text-gray-900 dark:text-white">{{ lc.name }}</span>
                          <span v-if="lc.matchedLandlordId" class="text-green-600 dark:text-green-400">(linked)</span>
                          <span v-else class="text-blue-600 dark:text-blue-400">(new)</span>
                          <button
                            type="button"
                            @click="unlinkLandlord(item, lc)"
                            class="ml-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Remove"
                          >
                            <X class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div v-else-if="item.matchType !== 'new'" class="text-xs text-gray-400 dark:text-slate-500">
                        {{ item.hasExistingLandlord ? 'LL already linked' : 'No landlord' }}
                      </div>
                      <span v-else class="text-xs text-gray-400">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Confirm Button -->
            <div class="mt-4 flex items-center justify-between">
              <div class="text-sm text-gray-500 dark:text-slate-400">
                {{ previewItems.filter(i => i.importProperty || i.importLandlord).length }} of {{ previewItems.length }} rows will be processed
              </div>
              <button
                type="button"
                @click="handleConfirmSync"
                :disabled="confirming || previewItems.filter(i => i.importProperty || i.importLandlord).length === 0"
                class="px-6 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
              >
                <span v-if="confirming" class="flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Importing...
                </span>
                <span v-else>Confirm & Import</span>
              </button>
            </div>
          </div>

          <!-- Refresh Section (shown when already synced) -->
          <div v-if="status.lastSyncAt && !previewItems" class="mt-6 pt-4 border-t dark:border-slate-700">
            <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Refresh Data</h5>
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-3">
              Update existing linked properties and landlords with latest Apex27 data.
            </p>
            <div class="flex gap-3">
              <button
                type="button"
                @click="handleSyncProperties"
                :disabled="syncingProperties"
                class="px-4 py-2 text-sm font-medium text-[#6B21A8] bg-white dark:bg-slate-800 border border-[#6B21A8] hover:bg-[#6B21A8]/5 rounded-md disabled:opacity-50"
              >
                <span v-if="syncingProperties" class="flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Refreshing...
                </span>
                <span v-else>Refresh Properties</span>
              </button>
              <button
                type="button"
                @click="handleSyncLandlords"
                :disabled="syncingLandlords"
                class="px-4 py-2 text-sm font-medium text-[#6B21A8] bg-white dark:bg-slate-800 border border-[#6B21A8] hover:bg-[#6B21A8]/5 rounded-md disabled:opacity-50"
              >
                <span v-if="syncingLandlords" class="flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Refreshing...
                </span>
                <span v-else>Refresh Landlords</span>
              </button>
            </div>
          </div>

          <!-- Sync Results -->
          <div v-if="syncResult" class="mt-4 p-4 bg-gray-50 dark:bg-slate-900 rounded-md border dark:border-slate-700">
            <h6 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Results</h6>
            <div class="grid grid-cols-4 gap-4 text-center">
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ syncResult.records_processed }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Processed</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ syncResult.records_created }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Created</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ syncResult.records_updated }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Linked</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-400">{{ syncResult.records_skipped }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Skipped</div>
              </div>
            </div>
            <div v-if="syncResult.errors && syncResult.errors.length > 0" class="mt-3 text-sm text-red-600 dark:text-red-400">
              {{ syncResult.errors.length }} error(s) occurred during sync.
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- TENANCY SYNC SECTION -->
          <!-- ============================================================ -->
          <div v-if="status.lastSyncAt" class="mt-6 pt-6 border-t dark:border-slate-700">
            <div v-if="!tenancyPreviewItems">
              <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Sync Tenancies</h5>
              <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Import active tenancies from Apex27. Properties and landlords will be created if they don't already exist, and all records will be linked.
              </p>
              <button
                type="button"
                @click="handleTenancyPreview"
                :disabled="tenancyPreviewing"
                class="px-4 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
              >
                <span v-if="tenancyPreviewing" class="flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Fetching tenancies...
                </span>
                <span v-else>Sync Tenancies</span>
              </button>
            </div>
          </div>

        </div><!-- close: initial sync (L143 status.lastTestStatus) -->

        <!-- Inline messages for sync actions (visible in configured mode) -->
        <div v-if="errorMsg" class="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ successMsg }}
        </div>

      </div><!-- close: configured && !editMode (L64) -->
    </div><!-- close: Main Panel v-else (L38) -->

      <!-- Tenancy Preview — Full Width Below Settings Panel -->
      <div v-if="tenancyPreviewItems" class="mt-6 bg-white dark:bg-slate-800 rounded-lg shadow border dark:border-slate-700">
        <div class="px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
          <div>
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">Review Tenancy Import</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {{ tenancyPreviewItems.length }} active tenancies found.
              <span class="text-green-600 dark:text-green-400 font-medium">{{ tenancyPreviewItems.filter(i => i.propertyMatchType !== 'new' && !i.alreadyImported).length }} matched</span>,
              <span class="text-blue-600 dark:text-blue-400 font-medium">{{ tenancyPreviewItems.filter(i => i.propertyMatchType === 'new').length }} new properties</span>,
              <span class="text-gray-500">{{ tenancyPreviewItems.filter(i => i.alreadyImported).length }} already imported</span>
            </p>
          </div>
          <button
            type="button"
            @click="tenancyPreviewItems = null"
            class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-md"
          >
            Cancel
          </button>
        </div>

        <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-slate-900 sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-gray-500 dark:text-slate-400">Property</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500 dark:text-slate-400">Landlord</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500 dark:text-slate-400">Tenants</th>
                <th class="px-4 py-3 text-right font-medium text-gray-500 dark:text-slate-400">Rent</th>
                <th class="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400">Start</th>
                <th class="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400">End</th>
                <th class="px-4 py-3 text-right font-medium text-gray-500 dark:text-slate-400">Deposit</th>
                <th class="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400">Management</th>
                <th class="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400">Status</th>
                <th class="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400">Import</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-slate-700">
              <tr
                v-for="item in tenancyPreviewItems"
                :key="item.apex27TenancyId"
                :class="item.alreadyImported ? 'bg-amber-50/30 dark:bg-amber-950/10' : 'bg-white dark:bg-slate-800'"
              >
                <td class="px-4 py-2.5">
                  <div class="text-gray-900 dark:text-white text-sm font-medium">{{ item.apex27Address }}</div>
                  <div class="text-xs text-gray-400">{{ item.apex27Postcode }}</div>
                  <div v-if="item.propertyMatchType === 'new'" class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">+ New property</div>
                </td>
                <td class="px-4 py-2.5">
                  <div v-if="item.landlordContact" class="text-xs">
                    <div class="text-gray-900 dark:text-white font-medium">{{ item.landlordContact.name }}</div>
                    <div class="text-gray-400">{{ item.landlordContact.email }}</div>
                    <span v-if="item.landlordContact.matchedLandlordId" class="text-green-600 dark:text-green-400 text-[10px]">Matched</span>
                    <span v-else-if="item.importLandlord" class="text-blue-600 dark:text-blue-400 text-[10px]">+ New</span>
                  </div>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
                <td class="px-4 py-2.5">
                  <div class="text-gray-900 dark:text-white text-xs">{{ item.tenantNames.join(', ') || '-' }}</div>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-gray-900 dark:text-white text-sm font-medium">{{ formatCurrency(item.monthlyRent) }}</span>
                  <div class="text-[10px] text-gray-400">/month</div>
                </td>
                <td class="px-4 py-2.5 text-center text-xs text-gray-700 dark:text-slate-300">{{ formatDate(item.startDate) }}</td>
                <td class="px-4 py-2.5 text-center text-xs text-gray-700 dark:text-slate-300">{{ item.endDate ? formatDate(item.endDate) : '—' }}</td>
                <td class="px-4 py-2.5 text-right text-xs text-gray-700 dark:text-slate-300">{{ item.depositAmount ? formatCurrency(item.depositAmount) : '—' }}</td>
                <td class="px-4 py-2.5 text-center">
                  <select
                    v-model="item.managementType"
                    class="text-xs rounded border px-1.5 py-1 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white border-gray-200"
                  >
                    <option :value="null">—</option>
                    <option value="managed">Managed</option>
                    <option value="let_only">Let Only</option>
                  </select>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="item.alreadyImported" class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Update</span>
                  <span v-else-if="item.propertyMatchType !== 'new'" class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Matched</span>
                  <span v-else class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">New</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    @click="item.importTenancy = !item.importTenancy"
                    class="text-xs font-medium px-2.5 py-1 rounded"
                    :class="item.importTenancy
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'"
                  >
                    {{ item.importTenancy ? 'Yes' : 'No' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Confirm Bar -->
        <div class="px-6 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900 rounded-b-lg">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-4">
              <span class="text-sm text-gray-600 dark:text-slate-300 font-medium">Import Let Only?</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="importLetOnly = true"
                  :class="['px-3 py-1 text-xs font-medium rounded-full transition-colors', importLetOnly ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400']"
                >Yes</button>
                <button
                  type="button"
                  @click="importLetOnly = false"
                  :class="['px-3 py-1 text-xs font-medium rounded-full transition-colors', !importLetOnly ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400']"
                >No — Managed only</button>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-500 dark:text-slate-400">
              {{ importableCount }} of {{ tenancyPreviewItems.length }} tenancies will be imported / updated
            </div>
            <button
            type="button"
            @click="handleTenancyConfirm"
            :disabled="tenancyConfirming || importableCount === 0"
            class="px-6 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
          >
            <span v-if="tenancyConfirming" class="flex items-center gap-2">
              <Loader2 class="w-4 h-4 animate-spin" />
              Importing...
            </span>
            <span v-else>Confirm &amp; Import</span>
          </button>
        </div>
      </div>

      <!-- Tenancy Sync Results -->
      <div v-if="tenancySyncResult" class="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow border dark:border-slate-700">
        <h6 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Tenancy Import Results</h6>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ tenancySyncResult.records_processed }}</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Processed</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ tenancySyncResult.records_created }}</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Created</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-gray-400">{{ tenancySyncResult.records_skipped }}</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Skipped</div>
          </div>
        </div>
        <div v-if="tenancySyncResult.errors && tenancySyncResult.errors.length > 0" class="mt-3 text-sm text-red-600 dark:text-red-400">
          {{ tenancySyncResult.errors.length }} error(s) occurred during tenancy import.
        </div>

        <!-- RentGoose prompt -->
        <div v-if="tenancySyncResult.records_created > 0" class="mt-4 p-4 bg-[#fff7ed] border border-[#f97316]/20 rounded-lg flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">Set up rent collection</p>
            <p class="text-xs text-gray-500 mt-0.5">Initialise rent schedules for your imported tenancies in RentGoose.</p>
          </div>
          <router-link
            to="/rentgoose"
            class="bg-[#f97316] hover:bg-[#ea6d10] text-white rounded-lg font-semibold px-4 py-2 text-sm transition-colors whitespace-nowrap"
          >
            Go to RentGoose →
          </router-link>
        </div>
      </div>

    </div>

    <!-- Edit Form -->
    <div v-if="!status?.configured || editMode" class="bg-white dark:bg-slate-800 rounded-lg border border-[#6B21A8]/30 shadow p-6">
      <form @submit.prevent="handleSave" class="space-y-4" data-form-type="other">
        <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
        <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

        <div>
          <label for="apex27-api-key" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <input
            id="apex27-api-key"
            v-model="form.apiKey"
            name="apex27-api-key"
            type="password"
            required
            autocomplete="off"
            data-lpignore="true"
            data-1p-ignore
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#6B21A8] focus:border-[#6B21A8] dark:bg-slate-900 dark:text-white"
            placeholder="Enter your Apex27 API key"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Find your API key in Apex27 under Settings > API.
          </p>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            :disabled="saving || !form.apiKey"
            class="px-4 py-2 text-sm font-medium text-white bg-[#6B21A8] hover:bg-[#6B21A8]/90 rounded-md disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save API Key' }}
          </button>
          <button
            v-if="status?.configured"
            type="button"
            @click="editMode = false; form.apiKey = ''"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>

        <div v-if="errorMsg" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ successMsg }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ExternalLink, Key, Loader2, CheckCircle, X } from 'lucide-vue-next'
import { authFetch } from '@/lib/authFetch'
import { useAuthStore } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const syncingProperties = ref(false)
const syncingLandlords = ref(false)
const previewing = ref(false)
const confirming = ref(false)
const previewItems = ref<any[] | null>(null)
const tenancyPreviewing = ref(false)
const tenancyConfirming = ref(false)
const tenancyPreviewItems = ref<any[] | null>(null)
const importLetOnly = ref(false)

const importableCount = computed(() => {
  if (!tenancyPreviewItems.value) return 0
  return tenancyPreviewItems.value.filter(i => {
    if (!i.importTenancy) return false
    if (!importLetOnly.value && i.managementType === 'let_only') return false
    return true
  }).length
})
const tenancySyncResult = ref<{
  records_processed: number
  records_created: number
  records_skipped: number
  errors?: any[]
} | null>(null)

const editMode = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const status = ref<{
  configured: boolean
  maskedApiKey: string | null
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastSyncAt: string | null
  syncEnabled: boolean
  branchId: string | null
} | null>(null)

const branches = ref<any[]>([])
const selectedBranchId = ref('')
const branchSaved = ref(false)

const syncResult = ref<{
  records_processed: number
  records_created: number
  records_updated: number
  records_skipped: number
  errors?: any[]
} | null>(null)

const form = ref({
  apiKey: ''
})

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function apiFetch(url: string, options: RequestInit = {}) {
  return authFetch(url, { ...options, token: authStore.session?.access_token } as any)
}

function clearMessages() {
  errorMsg.value = ''
  successMsg.value = ''
}

async function loadStatus() {
  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27`)
    if (response.ok) {
      status.value = await response.json()
      if (status.value?.branchId) {
        selectedBranchId.value = status.value.branchId
      }
      // Auto-load branches when already connected so the selector persists
      if (status.value?.configured && status.value?.lastTestStatus === 'success' && branches.value.length === 0) {
        loadBranches()
      }
    }
  } catch (err) {
    console.error('Failed to load Apex27 status:', err)
  } finally {
    loading.value = false
  }
}

async function loadBranches() {
  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27/branches`)
    if (response.ok) {
      const data = await response.json()
      if (data.branches) {
        branches.value = data.branches
      }
    }
  } catch {
    // Silently fail — branches just won't show
  }
}

async function handleBranchChange() {
  clearMessages()
  branchSaved.value = false
  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: selectedBranchId.value || null })
    })

    if (response.ok) {
      const selectedBranch = branches.value.find(b => String(b.id) === selectedBranchId.value)
      const branchName = selectedBranch ? (selectedBranch.name || selectedBranch.branchName || `Branch #${selectedBranch.id}`) : 'All branches'
      successMsg.value = `Syncing from: ${branchName}`
      branchSaved.value = true
      await loadStatus()
      // Auto-clear the tick after 3 seconds
      setTimeout(() => { branchSaved.value = false }, 3000)
    }
  } catch {
    errorMsg.value = 'Failed to save branch selection'
  }
}

async function handleSave() {
  clearMessages()
  saving.value = true

  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: form.value.apiKey })
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Failed to save API key'
      return
    }

    successMsg.value = 'API key saved successfully. Test the connection to verify.'
    form.value.apiKey = ''
    editMode.value = false
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Failed to save API key'
  } finally {
    saving.value = false
  }
}

async function handleTestConnection() {
  clearMessages()
  testing.value = true
  branches.value = []

  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27/test`, {
      method: 'POST'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Connection test failed'
      return
    }

    successMsg.value = data.message || 'Connection successful'
    if (data.branches) {
      branches.value = data.branches
      // Pre-select saved branch if we have one
      if (status.value?.branchId) {
        selectedBranchId.value = status.value.branchId
      }
    }
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Failed to test connection'
  } finally {
    testing.value = false
  }
}

async function handleRemove() {
  if (!confirm('Are you sure you want to remove the Apex27 integration? This will not delete any synced data.')) {
    return
  }

  clearMessages()
  removing.value = true

  try {
    const response = await apiFetch(`${API_URL}/api/settings/apex27`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Failed to remove integration'
      return
    }

    successMsg.value = 'Apex27 integration removed'
    branches.value = []
    syncResult.value = null
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Failed to remove integration'
  } finally {
    removing.value = false
  }
}

function formatStatus(status: string): string {
  if (!status) return ''
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

function unlinkLandlord(item: any, lc: any) {
  const idx = item.landlordContacts.indexOf(lc)
  if (idx >= 0) {
    item.landlordContacts.splice(idx, 1)
  }
}

function toggleAllPreview(include: boolean) {
  if (previewItems.value) {
    previewItems.value.forEach(item => {
      item.importProperty = include
      item.importLandlord = include && item.landlordContacts.length > 0
    })
  }
}

async function handlePreview() {
  clearMessages()
  previewing.value = true

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/preview`, {
      method: 'POST'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Failed to fetch preview'
      return
    }

    previewItems.value = data.items || []
    if (previewItems.value!.length === 0) {
      successMsg.value = 'No properties found to sync from Apex27.'
      previewItems.value = null
    }
  } catch (err) {
    errorMsg.value = 'Failed to fetch preview from Apex27'
  } finally {
    previewing.value = false
  }
}

async function handleConfirmSync() {
  if (!previewItems.value) return

  clearMessages()
  confirming.value = true
  syncResult.value = null

  const approvedItems = previewItems.value
    .filter(item => item.importProperty || item.importLandlord)
    .map(item => ({
      apex27ListingId: item.apex27ListingId,
      matchedPropertyId: item.matchedPropertyId,
      importProperty: item.importProperty,
      importLandlord: item.importLandlord,
      landlordContacts: item.landlordContacts
    }))

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: approvedItems })
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Sync failed'
      return
    }

    syncResult.value = data
    successMsg.value = `Import complete: ${data.records_created} created, ${data.records_updated} linked. A confirmation email has been sent.`
    previewItems.value = null
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Import failed'
  } finally {
    confirming.value = false
  }
}

async function handleSyncProperties() {
  clearMessages()
  syncingProperties.value = true
  syncResult.value = null

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/properties`, {
      method: 'POST'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Property sync failed'
      return
    }

    syncResult.value = data
    successMsg.value = `Property sync complete: ${data.records_created} created, ${data.records_updated} updated`
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Property sync failed'
  } finally {
    syncingProperties.value = false
  }
}

async function handleSyncLandlords() {
  clearMessages()
  syncingLandlords.value = true
  syncResult.value = null

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/landlords`, {
      method: 'POST'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Landlord sync failed'
      return
    }

    syncResult.value = data
    successMsg.value = `Landlord sync complete: ${data.records_created} created, ${data.records_updated} updated`
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Landlord sync failed'
  } finally {
    syncingLandlords.value = false
  }
}

async function handleTenancyPreview() {
  clearMessages()
  tenancyPreviewing.value = true
  tenancySyncResult.value = null

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/tenancies/preview`, {
      method: 'POST'
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Failed to fetch tenancy preview'
      return
    }

    tenancyPreviewItems.value = data.items || []
    if (tenancyPreviewItems.value!.length === 0) {
      successMsg.value = 'No active tenancies found in Apex27.'
      tenancyPreviewItems.value = null
    }
  } catch (err) {
    errorMsg.value = 'Failed to fetch tenancy preview from Apex27'
  } finally {
    tenancyPreviewing.value = false
  }
}

async function handleTenancyConfirm() {
  if (!tenancyPreviewItems.value) return

  clearMessages()
  tenancyConfirming.value = true
  tenancySyncResult.value = null

  const approvedItems = tenancyPreviewItems.value.filter(item => {
    if (!item.importTenancy) return false
    if (!importLetOnly.value && item.managementType === 'let_only') return false
    return true
  })

  try {
    const response = await apiFetch(`${API_URL}/api/apex27/tenancies/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: approvedItems })
    })

    const data = await response.json()

    if (!response.ok) {
      errorMsg.value = data.error || 'Tenancy import failed'
      return
    }

    tenancySyncResult.value = data
    successMsg.value = `Tenancy import complete: ${data.records_created} created, ${data.records_skipped} skipped.`
    tenancyPreviewItems.value = null
    await loadStatus()
  } catch (err) {
    errorMsg.value = 'Tenancy import failed'
  } finally {
    tenancyConfirming.value = false
  }
}

onMounted(() => {
  loadStatus()
})
</script>
