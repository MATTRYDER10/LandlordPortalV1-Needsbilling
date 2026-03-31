<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-[#0891B2]" />
    </div>

    <!-- Not Configured -->
    <div v-else-if="!configured" class="text-center py-12">
      <Zap class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
      <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">Just Move In not configured</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Set up the JMI integration in Settings to notify utility providers of tenant moves.
      </p>
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Zap class="w-4 h-4 text-[#0891B2]" />
          Utilities — Just Move In
        </h3>

        <!-- ============================================================ -->
        <!-- ACTIVE MOVE DISPLAY -->
        <!-- ============================================================ -->
        <div v-if="activeMove" class="space-y-4">
          <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
            <!-- Status Header -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ activeMove.move_type === 'movein' ? 'Move In' : 'Move Out' }} Notification</span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="moveStatusClass(activeMove.status)"
                >
                  {{ activeMove.status }}
                </span>
              </div>
              <span class="text-xs text-gray-400 dark:text-slate-500">
                Submitted {{ formatDate(activeMove.submitted_at) }}
              </span>
            </div>

            <!-- Move Details -->
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div v-if="activeMove.jmi_move_id">
                <p class="text-gray-500 dark:text-slate-400 text-xs">JMI Move ID</p>
                <p class="text-gray-900 dark:text-white font-mono">{{ activeMove.jmi_move_id }}</p>
              </div>
              <div v-if="activeMove.customer_intro_url">
                <p class="text-gray-500 dark:text-slate-400 text-xs">Customer Introduction</p>
                <a
                  :href="activeMove.customer_intro_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[#0891B2] hover:text-[#0E7490] text-sm flex items-center gap-1"
                >
                  Open link
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3 pt-3 border-t dark:border-slate-700">
              <button
                @click="handleRefresh"
                :disabled="refreshing"
                class="px-3 py-1.5 text-sm font-medium text-[#0E7490] dark:text-[#22D3EE] bg-[#0891B2]/10 hover:bg-[#0891B2]/20 rounded-md flex items-center gap-1.5"
              >
                <Loader2 v-if="refreshing" class="w-3.5 h-3.5 animate-spin" />
                <RefreshCw v-else class="w-3.5 h-3.5" />
                Refresh Status
              </button>
              <button
                v-if="activeMove.status !== 'cancelled'"
                @click="showCancelConfirm = true"
                :disabled="cancelling"
                class="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md flex items-center gap-1.5"
              >
                Cancel Move
              </button>
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- UPDATE MOVE OUT DATE (for active moves) -->
          <!-- ============================================================ -->
          <div v-if="activeMove.status !== 'cancelled'" class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar class="w-4 h-4 text-[#0891B2]" />
              Update Move Out Date
            </h4>
            <p class="text-xs text-gray-500 dark:text-slate-400">
              Update the move out date on JMI if the tenancy end date has changed.
            </p>
            <div class="flex items-end gap-3">
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Move Out Date</label>
                <input
                  v-model="updateMoveOutDate"
                  type="date"
                  class="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                />
              </div>
              <button
                @click="handleUpdateDates"
                :disabled="updatingDates || !updateMoveOutDate"
                class="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1.5"
              >
                <Loader2 v-if="updatingDates" class="w-4 h-4 animate-spin" />
                Update
              </button>
            </div>
            <div v-if="updateDatesResult" class="p-2 rounded-md text-xs" :class="updateDatesResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'">
              {{ updateDatesResult.message }}
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- METER READINGS (for active moves) -->
          <!-- ============================================================ -->
          <div v-if="activeMove.status !== 'cancelled'" class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Gauge class="w-4 h-4 text-[#0891B2]" />
                Meter Readings
              </h4>
              <button
                @click="handleFetchMeters"
                :disabled="loadingMeters"
                class="text-xs text-[#0891B2] hover:text-[#0E7490] flex items-center gap-1"
              >
                <Loader2 v-if="loadingMeters" class="w-3 h-3 animate-spin" />
                <RefreshCw v-else class="w-3 h-3" />
                Load Meters
              </button>
            </div>

            <!-- Existing Readings Display -->
            <div v-if="existingReadings" class="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
              <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Current Readings on JMI</p>
              <div v-if="existingReadings.gas && existingReadings.gas.length > 0" class="text-sm">
                <span class="text-gray-500 dark:text-slate-400">Gas:</span>
                <span v-for="r in existingReadings.gas" :key="r.mprn" class="ml-2 text-gray-900 dark:text-white">
                  {{ r.reading }} ({{ r.reading_date }})
                </span>
              </div>
              <div v-if="existingReadings.electricity && existingReadings.electricity.length > 0" class="text-sm">
                <span class="text-gray-500 dark:text-slate-400">Electricity:</span>
                <span v-for="r in existingReadings.electricity" :key="r.mpan" class="ml-2 text-gray-900 dark:text-white">
                  {{ r.reading }} ({{ r.reading_date }})
                </span>
              </div>
              <p v-if="(!existingReadings.gas || existingReadings.gas.length === 0) && (!existingReadings.electricity || existingReadings.electricity.length === 0)" class="text-xs text-gray-400 dark:text-slate-500">
                No readings submitted yet.
              </p>
            </div>

            <!-- Gas Reading Form -->
            <div class="space-y-2">
              <label class="flex items-center gap-2">
                <input v-model="includeGas" type="checkbox" class="h-4 w-4 text-[#0891B2] focus:ring-[#0891B2] border-gray-300 dark:border-slate-600 rounded" />
                <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Gas Reading</span>
              </label>
              <div v-if="includeGas" class="grid grid-cols-3 gap-3 pl-6">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">MPRN</label>
                  <input
                    v-model="gasReading.mprn"
                    type="text"
                    placeholder="e.g. 1234567890"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Reading</label>
                  <input
                    v-model="gasReading.reading"
                    type="text"
                    placeholder="e.g. 12345"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Reading Date</label>
                  <input
                    v-model="gasReading.reading_date"
                    type="date"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
              </div>
            </div>

            <!-- Electricity Reading Form -->
            <div class="space-y-2">
              <label class="flex items-center gap-2">
                <input v-model="includeElec" type="checkbox" class="h-4 w-4 text-[#0891B2] focus:ring-[#0891B2] border-gray-300 dark:border-slate-600 rounded" />
                <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Electricity Reading</span>
              </label>
              <div v-if="includeElec" class="grid grid-cols-3 gap-3 pl-6">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">MPAN</label>
                  <input
                    v-model="elecReading.mpan"
                    type="text"
                    placeholder="e.g. 1234567890123"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Reading</label>
                  <input
                    v-model="elecReading.reading"
                    type="text"
                    placeholder="e.g. 67890"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Reading Date</label>
                  <input
                    v-model="elecReading.reading_date"
                    type="date"
                    class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
                  />
                </div>
              </div>
            </div>

            <!-- Submit Readings -->
            <div class="flex items-center gap-3 pt-2">
              <button
                @click="handleSubmitReadings"
                :disabled="submittingReadings || (!includeGas && !includeElec) || (includeGas && (!gasReading.reading || !gasReading.reading_date)) || (includeElec && (!elecReading.reading || !elecReading.reading_date))"
                class="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
              >
                <Loader2 v-if="submittingReadings" class="w-4 h-4 animate-spin" />
                Submit Readings
              </button>
            </div>
            <div v-if="readingsResult" class="p-2 rounded-md text-xs" :class="readingsResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'">
              {{ readingsResult.message }}
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- VOID SECTION (for ended tenancies) -->
          <!-- ============================================================ -->
          <div v-if="isEndedTenancy && activeMove.status !== 'cancelled'" class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Home class="w-4 h-4 text-purple-500" />
              Void Energy Switch
            </h4>

            <div v-if="activeMove.void_status" class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-slate-400">Status</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  {{ activeMove.void_status.status || 'Active' }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  @click="handleRefreshVoid"
                  :disabled="refreshingVoid"
                  class="px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-md flex items-center gap-1.5"
                >
                  <Loader2 v-if="refreshingVoid" class="w-3.5 h-3.5 animate-spin" />
                  <RefreshCw v-else class="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button
                  @click="handleCancelVoid"
                  :disabled="cancellingVoid"
                  class="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                >
                  Cancel Void
                </button>
              </div>
            </div>

            <div v-else class="space-y-3">
              <p class="text-xs text-gray-500 dark:text-slate-400">
                Request a void energy switch for when the property is empty between tenancies. JMI will manage the utility supply during the void period.
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Move Out Date</label>
                  <input v-model="voidForm.movedate" type="date" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Send Bills To</label>
                  <select v-model="voidForm.send_bills_to" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]">
                    <option value="agency">Agency</option>
                    <option value="landlord">Landlord</option>
                    <option value="property">Property</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Contact Name</label>
                  <input v-model="voidForm.contact_name" type="text" placeholder="Full name" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Contact Email</label>
                  <input v-model="voidForm.contact_email" type="email" placeholder="email@example.com" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Contact Phone</label>
                  <input v-model="voidForm.contact_phone" type="text" placeholder="Phone number" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Contact Title</label>
                  <select v-model="voidForm.contact_title" class="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]">
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                    <option value="Other/Rather Not Say">Other</option>
                  </select>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2">
                  <input v-model="voidForm.switch_gas" type="checkbox" class="h-4 w-4 text-[#0891B2] focus:ring-[#0891B2] border-gray-300 dark:border-slate-600 rounded" />
                  <span class="text-sm text-gray-700 dark:text-slate-300">Switch Gas</span>
                </label>
                <label class="flex items-center gap-2">
                  <input v-model="voidForm.switch_electricity" type="checkbox" class="h-4 w-4 text-[#0891B2] focus:ring-[#0891B2] border-gray-300 dark:border-slate-600 rounded" />
                  <span class="text-sm text-gray-700 dark:text-slate-300">Switch Electricity</span>
                </label>
              </div>
              <button
                @click="handleRequestVoid"
                :disabled="requestingVoid || !voidForm.movedate || !voidForm.contact_name || !voidForm.contact_email || !voidForm.contact_phone || (!voidForm.switch_gas && !voidForm.switch_electricity)"
                class="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1.5"
              >
                <Loader2 v-if="requestingVoid" class="w-3.5 h-3.5 animate-spin" />
                Request Void Energy Switch
              </button>
              <div v-if="voidError" class="p-2 rounded-md text-xs bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                {{ voidError }}
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- NOT SUBMITTED — Pre-filled summary -->
        <!-- ============================================================ -->
        <div v-else class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
          <p class="text-sm text-gray-600 dark:text-slate-400">
            Submit a utility move notification to Just Move In. The following details will be sent:
          </p>

          <!-- Pre-filled Summary -->
          <div class="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-gray-500 dark:text-slate-400 text-xs">Lead Tenant</p>
                <p class="text-gray-900 dark:text-white font-medium">{{ leadTenantName || 'Not available' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-slate-400 text-xs">Email</p>
                <p class="text-gray-900 dark:text-white">{{ leadTenantEmail || 'Not available' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-slate-400 text-xs">Phone</p>
                <p class="text-gray-900 dark:text-white">{{ leadTenantPhone || 'Not provided' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-slate-400 text-xs">Move Type</p>
                <p class="text-gray-900 dark:text-white">{{ autoMoveType === 'movein' ? 'Move In' : 'Move Out' }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-gray-500 dark:text-slate-400 text-xs">Property</p>
                <p class="text-gray-900 dark:text-white">{{ propertyAddress || 'Not available' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-slate-400 text-xs">{{ autoMoveType === 'movein' ? 'Move In Date' : 'Move Out Date' }}</p>
                <p class="text-gray-900 dark:text-white">{{ moveDate || 'Not set' }}</p>
              </div>
            </div>
          </div>

          <!-- Move Out Date override (for active tenancies that may not have end_date set) -->
          <div v-if="autoMoveType === 'moveout' && !tenancy?.end_date">
            <label class="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Move Out Date (required)</label>
            <input
              v-model="manualMoveOutDate"
              type="date"
              class="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-[#0891B2] focus:border-[#0891B2]"
            />
          </div>

          <!-- GDPR Consent -->
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              v-model="gdprConsent"
              type="checkbox"
              class="mt-0.5 h-4 w-4 text-[#0891B2] focus:ring-[#0891B2] border-gray-300 dark:border-slate-600 rounded"
            />
            <span class="text-sm text-gray-600 dark:text-slate-400">
              I confirm the tenant has given consent for their details to be shared with Just Move In for the purpose of utility switching notifications.
            </span>
          </label>

          <!-- Error -->
          <div v-if="submitError" class="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm">
            {{ submitError }}
          </div>

          <!-- Submit Button -->
          <button
            @click="handleSubmit"
            :disabled="submitting || !gdprConsent || !leadTenantEmail || (autoMoveType === 'moveout' && !tenancy?.end_date && !manualMoveOutDate)"
            class="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            <Zap v-else class="w-4 h-4" />
            Submit {{ autoMoveType === 'movein' ? 'Move In' : 'Move Out' }} to JMI
          </button>
        </div>
      </div>
    </div>

    <!-- Cancel Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showCancelConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCancelConfirm = false">
        <div class="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cancel JMI Move</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">
            Are you sure you want to cancel this utility move notification? This will notify Just Move In to cancel the move.
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="showCancelConfirm = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Keep Move
            </button>
            <button
              type="button"
              @click="handleCancel"
              :disabled="cancelling"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
            >
              <Loader2 v-if="cancelling" class="w-4 h-4 animate-spin" />
              Cancel Move
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Zap, ExternalLink, Loader2, RefreshCw, Calendar, Gauge, Home } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  tenancy: any
}>()

const authStore = useAuthStore()

// Core state
const loading = ref(true)
const configured = ref(false)
const moves = ref<any[]>([])

// Submit state
const gdprConsent = ref(false)
const submitting = ref(false)
const submitError = ref('')
const manualMoveOutDate = ref('')

// Move actions state
const cancelling = ref(false)
const refreshing = ref(false)
const showCancelConfirm = ref(false)

// Update dates state
const updateMoveOutDate = ref('')
const updatingDates = ref(false)
const updateDatesResult = ref<{ success: boolean; message: string } | null>(null)

// Meter readings state
const loadingMeters = ref(false)
const existingReadings = ref<any>(null)
const includeGas = ref(false)
const includeElec = ref(false)
const gasReading = ref({ mprn: '', reading: '', reading_date: '' })
const elecReading = ref({ mpan: '', reading: '', reading_date: '' })
const submittingReadings = ref(false)
const readingsResult = ref<{ success: boolean; message: string } | null>(null)

// Void state
const requestingVoid = ref(false)
const refreshingVoid = ref(false)
const cancellingVoid = ref(false)
const voidError = ref('')
const voidForm = ref({
  movedate: '',
  send_bills_to: 'agency' as 'agency' | 'landlord' | 'property',
  contact_title: 'Mr',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  switch_gas: true,
  switch_electricity: true
})

// ============================================================
// COMPUTED
// ============================================================

const activeMove = computed(() => {
  return moves.value.find(m => m.status !== 'cancelled') || null
})

// Active tenancies = moveout, pending = movein, ended = moveout
const autoMoveType = computed(() => {
  const status = props.tenancy?.status
  if (['pending'].includes(status)) return 'movein'
  return 'moveout'
})

const isEndedTenancy = computed(() => {
  return ['ended', 'terminated'].includes(props.tenancy?.status)
})

const leadTenant = computed(() => {
  const tenants = props.tenancy?.tenants || []
  return tenants.find((t: any) => t.is_lead_tenant) || tenants[0] || null
})

const leadTenantName = computed(() => {
  if (!leadTenant.value) return ''
  return `${leadTenant.value.first_name || ''} ${leadTenant.value.last_name || ''}`.trim()
})

const leadTenantEmail = computed(() => leadTenant.value?.email || '')
const leadTenantPhone = computed(() => leadTenant.value?.phone || '')

const propertyAddress = computed(() => {
  const p = props.tenancy?.property
  if (!p) return ''
  return [p.address_line1, p.city, p.postcode].filter(Boolean).join(', ')
})

const moveDate = computed(() => {
  if (autoMoveType.value === 'movein') {
    return formatDate(props.tenancy?.start_date) || 'Not set'
  }
  return formatDate(props.tenancy?.end_date) || 'Not set'
})

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function moveStatusClass(status: string): string {
  const classes: Record<string, string> = {
    submitted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    cancelled: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
    pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
  }
  return classes[status] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
}

function getToken() {
  return authStore.session?.access_token || undefined
}

// ============================================================
// API CALLS
// ============================================================

async function fetchStatus() {
  try {
    const response = await authFetch(`${API_URL}/api/jmi/status/${props.tenancy.id}`, {
      token: getToken()
    })
    if (response.ok) {
      const data = await response.json()
      configured.value = data.configured
      moves.value = data.moves || []
    }
  } catch (err) {
    console.error('[JMI Tab] Error fetching status:', err)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  submitError.value = ''
  submitting.value = true
  try {
    const body: any = {
      moveType: autoMoveType.value,
      gdprConsent: true
    }
    // Pass manual move out date if end_date not set
    if (autoMoveType.value === 'moveout' && !props.tenancy?.end_date && manualMoveOutDate.value) {
      body.moveOutDate = manualMoveOutDate.value
    }

    const response = await authFetch(`${API_URL}/api/jmi/submit/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken(),
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      submitError.value = data.error || 'Failed to submit move'
      return
    }

    await fetchStatus()
    gdprConsent.value = false
  } catch (err) {
    submitError.value = 'Failed to submit move to JMI'
  } finally {
    submitting.value = false
  }
}

async function handleCancel() {
  cancelling.value = true
  try {
    const response = await authFetch(`${API_URL}/api/jmi/cancel/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken(),
      body: JSON.stringify({ moveType: activeMove.value?.move_type || 'moveout' })
    })

    if (response.ok) {
      showCancelConfirm.value = false
      await fetchStatus()
    }
  } catch (err) {
    console.error('[JMI Tab] Error cancelling move:', err)
  } finally {
    cancelling.value = false
  }
}

async function handleRefresh() {
  refreshing.value = true
  try {
    const response = await authFetch(`${API_URL}/api/jmi/refresh/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken()
    })

    if (response.ok) {
      const data = await response.json()
      moves.value = data.moves || moves.value
    }
  } catch (err) {
    console.error('[JMI Tab] Error refreshing:', err)
  } finally {
    refreshing.value = false
  }
}

async function handleUpdateDates() {
  updatingDates.value = true
  updateDatesResult.value = null
  try {
    const response = await authFetch(`${API_URL}/api/jmi/update-dates/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken(),
      body: JSON.stringify({
        moveOutDate: updateMoveOutDate.value
      })
    })

    const data = await response.json()

    if (response.ok) {
      updateDatesResult.value = { success: true, message: 'Move out date updated on JMI' }
      await fetchStatus()
    } else {
      updateDatesResult.value = { success: false, message: data.error || 'Failed to update dates' }
    }
  } catch (err) {
    updateDatesResult.value = { success: false, message: 'Failed to update dates' }
  } finally {
    updatingDates.value = false
  }
}

async function handleFetchMeters() {
  loadingMeters.value = true
  try {
    const response = await authFetch(`${API_URL}/api/jmi/readings/${props.tenancy.id}`, {
      token: getToken()
    })

    if (response.ok) {
      const data = await response.json()
      existingReadings.value = data.data || data
    }
  } catch (err) {
    console.error('[JMI Tab] Error fetching meters:', err)
  } finally {
    loadingMeters.value = false
  }
}

async function handleSubmitReadings() {
  submittingReadings.value = true
  readingsResult.value = null
  try {
    const body: any = {}
    if (includeGas.value && gasReading.value.reading && gasReading.value.reading_date) {
      body.gas = [{
        mprn: gasReading.value.mprn || undefined,
        reading: gasReading.value.reading,
        reading_date: gasReading.value.reading_date
      }]
    }
    if (includeElec.value && elecReading.value.reading && elecReading.value.reading_date) {
      body.electricity = [{
        mpan: elecReading.value.mpan || undefined,
        reading: elecReading.value.reading,
        reading_date: elecReading.value.reading_date
      }]
    }

    const response = await authFetch(`${API_URL}/api/jmi/readings/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken(),
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (response.ok) {
      readingsResult.value = { success: true, message: 'Meter readings submitted successfully' }
      // Clear form
      gasReading.value = { mprn: '', reading: '', reading_date: '' }
      elecReading.value = { mpan: '', reading: '', reading_date: '' }
      // Refresh existing readings
      await handleFetchMeters()
    } else {
      readingsResult.value = { success: false, message: data.error || 'Failed to submit readings' }
    }
  } catch (err) {
    readingsResult.value = { success: false, message: 'Failed to submit readings' }
  } finally {
    submittingReadings.value = false
  }
}

async function handleRequestVoid() {
  requestingVoid.value = true
  voidError.value = ''
  try {
    const nameParts = voidForm.value.contact_name.trim().split(' ')

    const response = await authFetch(`${API_URL}/api/jmi/void/${props.tenancy.id}`, {
      method: 'POST',
      token: getToken(),
      body: JSON.stringify({
        movedate: voidForm.value.movedate,
        movedate_confirmed: true,
        send_bills_to: voidForm.value.send_bills_to,
        switch_gas: voidForm.value.switch_gas,
        switch_electricity: voidForm.value.switch_electricity,
        contact_title: voidForm.value.contact_title,
        contact_firstname: nameParts[0] || '',
        contact_lastname: nameParts.slice(1).join(' ') || '',
        contact_phone: voidForm.value.contact_phone,
        contact_email: voidForm.value.contact_email
      })
    })

    const data = await response.json()

    if (response.ok) {
      await fetchStatus()
    } else {
      voidError.value = data.error || 'Failed to request void'
    }
  } catch (err) {
    voidError.value = 'Failed to request void energy switch'
  } finally {
    requestingVoid.value = false
  }
}

async function handleRefreshVoid() {
  refreshingVoid.value = true
  try {
    const response = await authFetch(`${API_URL}/api/jmi/void/${props.tenancy.id}`, {
      token: getToken()
    })

    if (response.ok) {
      await fetchStatus()
    }
  } catch (err) {
    console.error('[JMI Tab] Error refreshing void:', err)
  } finally {
    refreshingVoid.value = false
  }
}

async function handleCancelVoid() {
  cancellingVoid.value = true
  try {
    const response = await authFetch(`${API_URL}/api/jmi/void/${props.tenancy.id}`, {
      method: 'DELETE',
      token: getToken()
    })

    if (response.ok) {
      await fetchStatus()
    }
  } catch (err) {
    console.error('[JMI Tab] Error cancelling void:', err)
  } finally {
    cancellingVoid.value = false
  }
}

// ============================================================
// INIT
// ============================================================

onMounted(() => {
  // Pre-fill move out date from tenancy end date
  if (props.tenancy?.end_date) {
    updateMoveOutDate.value = props.tenancy.end_date
    voidForm.value.movedate = props.tenancy.end_date
  }
  fetchStatus()
})
</script>
