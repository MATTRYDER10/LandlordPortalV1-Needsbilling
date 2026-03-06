<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 bg-black/50 z-40"
        @click="$emit('update:open', false)"
      />
    </Transition>

    <!-- Drawer -->
    <Transition
      enter-active-class="transition-transform duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-300"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="open"
        class="fixed right-0 top-0 h-full w-full max-w-3xl bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ tenancy?.property?.address_line1 || 'Tenancy Details' }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              {{ tenancy?.property?.city }}{{ tenancy?.property?.postcode ? `, ${tenancy.property.postcode}` : '' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="$emit('update:open', false)"
              class="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 border-b border-gray-200 dark:border-slate-700">
          <nav class="flex gap-6 -mb-px">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              @click="activeTab = tab.key"
              class="py-3 px-1 border-b-2 text-sm font-medium transition-colors"
              :class="activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <!-- Status Card with Actions -->
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Status</p>
                  <span
                    class="inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full"
                    :class="statusClass"
                  >
                    {{ statusLabel }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <!-- Pending tenancy actions -->
                  <button
                    v-if="tenancy?.status === 'pending'"
                    @click="confirmDeleteTenancy"
                    :disabled="deletingTenancy"
                    class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 class="w-4 h-4" />
                    {{ deletingTenancy ? 'Deleting...' : 'Delete' }}
                  </button>
                  <button
                    v-if="canActivate"
                    @click="activateTenancy"
                    :disabled="activating"
                    class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    {{ activating ? 'Activating...' : 'Activate Tenancy' }}
                  </button>

                  <!-- Notice Given tenancy actions -->
                  <button
                    v-if="tenancy?.status === 'notice_given'"
                    @click="revertToActive"
                    :disabled="revertingToActive"
                    class="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw class="w-4 h-4" />
                    {{ revertingToActive ? 'Reverting...' : 'Revert to Active' }}
                  </button>
                  <button
                    v-if="tenancy?.status === 'notice_given'"
                    @click="showMoveOutModal = true"
                    class="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Send class="w-4 h-4" />
                    Send Move Out Notice
                  </button>

                  <!-- Active tenancy actions dropdown -->
                  <div v-if="tenancy?.status === 'active'" class="relative">
                    <button
                      @click="showDrawerActions = !showDrawerActions"
                      class="px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Settings class="w-4 h-4" />
                      Actions
                      <ChevronDown class="w-4 h-4" :class="{ 'rotate-180': showDrawerActions }" />
                    </button>

                    <!-- Actions Dropdown Menu -->
                    <Transition
                      enter-active-class="transition-all duration-150 ease-out"
                      enter-from-class="opacity-0 scale-95 -translate-y-1"
                      enter-to-class="opacity-100 scale-100 translate-y-0"
                      leave-active-class="transition-all duration-100 ease-in"
                      leave-from-class="opacity-100 scale-100 translate-y-0"
                      leave-to-class="opacity-0 scale-95 -translate-y-1"
                    >
                      <div
                        v-if="showDrawerActions"
                        class="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50"
                      >
                        <div class="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
                          <p class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Tenancy Actions</p>
                        </div>

                        <button
                          @click="handleDrawerAction('change-rent-date')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <Calendar class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Change Rent Due Date
                        </button>

                        <button
                          @click="handleDrawerAction('change-tenant')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <UserPlus class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Change Tenant
                        </button>

                        <div class="border-t border-gray-100 dark:border-slate-700 my-1" />

                        <button
                          @click="handleDrawerAction('rent-increase')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <TrendingUp class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Serve Rent Increase Notice
                        </button>

                        <button
                          @click="handleDrawerAction('section-8')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <FileWarning class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Serve Section 8 Notice
                        </button>

                        <button
                          @click="handleDrawerAction('section-48')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <Scale class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Issue Section 48 Notice
                        </button>

                        <div class="border-t border-gray-100 dark:border-slate-700 my-1" />

                        <button
                          @click="handleDrawerAction('end-tenancy')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <XCircle class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          End Tenancy
                        </button>

                        <button
                          v-if="tenancy?.status !== 'pending'"
                          @click="handleDrawerAction('revert-to-draft')"
                          class="w-full px-3 py-2.5 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 flex items-center gap-3"
                        >
                          <RotateCcw class="w-4 h-4" />
                          Revert to Draft
                        </button>

                        <button
                          @click="handleDrawerAction('email-tenants')"
                          class="w-full px-3 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <Mail class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          Email All Tenants
                        </button>

                        <div class="border-t border-gray-100 dark:border-slate-700 my-1" />

                        <button
                          @click="handleDrawerAction('delete')"
                          class="w-full px-3 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3"
                        >
                          <Trash2 class="w-4 h-4" />
                          Delete Tenancy
                        </button>
                      </div>
                    </Transition>

                    <!-- Click outside handler -->
                    <div
                      v-if="showDrawerActions"
                      class="fixed inset-0 z-40"
                      @click="showDrawerActions = false"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Active Tenant Change Tracker -->
            <TenantChangeStatusTracker
              v-if="activeTenantChange && tenancy?.status === 'active'"
              :tenant-change="activeTenantChange"
              :tenants="tenants"
              @continue="showTenantChangeModal = true"
            />

            <!-- Pre-Tenancy Actions (for pending tenancies) -->
            <div v-if="tenancy?.status === 'pending'" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">Pre-Tenancy Actions</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <!-- Request Initial Monies -->
                <div class="flex flex-col">
                  <!-- Paid state - static display, no click -->
                  <div
                    v-if="initialMoniesPaid"
                    class="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    <CheckCircle class="w-4 h-4 text-green-600" />
                    <span>Initial Monies Paid</span>
                  </div>
                  <!-- Not paid - clickable button -->
                  <button
                    v-else
                    @click="showInitialMoniesModal = true"
                    :disabled="!hasTenantsWithEmail"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wallet class="w-4 h-4 text-amber-600" />
                    <span v-if="initialMoniesRequested">Resend Request</span>
                    <span v-else>Request Initial Monies</span>
                  </button>
                  <span v-if="initialMoniesPaid" class="text-xs text-green-600 dark:text-green-400 mt-1 text-center">
                    {{ formatDate(tenancy?.initial_monies_paid_at) }}
                  </span>
                  <span v-else-if="tenantConfirmedPayment" class="text-xs text-blue-600 dark:text-blue-400 mt-1 text-center">
                    Tenant confirmed {{ formatDate(tenancy?.initial_monies_tenant_confirmed_at) }}
                    <button @click="confirmInitialMonies" :disabled="confirmingMonies" class="ml-1 underline hover:no-underline">
                      {{ confirmingMonies ? 'Confirming...' : 'Confirm receipt' }}
                    </button>
                  </span>
                  <span v-else-if="initialMoniesRequested" class="text-xs text-gray-500 dark:text-slate-400 mt-1 text-center">
                    Requested {{ formatDate(tenancy?.initial_monies_requested_at) }}
                  </span>
                  <span v-else-if="!hasTenantsWithEmail" class="text-xs text-red-500 dark:text-red-400 mt-1 text-center">
                    No tenant email
                  </span>
                </div>

                <!-- Generate/View Agreement - Context-aware based on signing status -->
                <div class="flex flex-col">
                  <!-- No Agreement: Generate -->
                  <button
                    v-if="!hasAgreement"
                    @click="generateAgreement"
                    :disabled="generatingAgreement"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Loader2 v-if="generatingAgreement" class="w-4 h-4 text-amber-600 animate-spin" />
                    <FileSignature v-else class="w-4 h-4 text-amber-600" />
                    {{ generatingAgreement ? 'Generating...' : 'Generate Agreement' }}
                  </button>

                  <!-- Draft Agreement: View/Edit -->
                  <button
                    v-else-if="agreementData?.signing_status === 'draft'"
                    @click="scrollToAgreementStatus"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <FileSignature class="w-4 h-4 text-amber-600" />
                    View Agreement
                  </button>

                  <!-- Sent/Pending: Check Signing Status -->
                  <button
                    v-else-if="['sent', 'pending_signatures', 'partially_signed'].includes(agreementData?.signing_status)"
                    @click="showSigningStatusModal = true"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <ClipboardCheck class="w-4 h-4 text-blue-600" />
                    Check Signing Status
                  </button>

                  <!-- Fully Signed: Download -->
                  <button
                    v-else-if="agreementData?.signing_status === 'fully_signed'"
                    @click="downloadSignedAgreement"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <Download class="w-4 h-4 text-green-600" />
                    Download Signed Agreement
                  </button>

                  <!-- Executed: View Executed -->
                  <button
                    v-else-if="agreementData?.signing_status === 'executed'"
                    @click="downloadSignedAgreement"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <CheckCircle class="w-4 h-4 text-green-600" />
                    View Executed Agreement
                  </button>

                  <!-- Cancelled: Regenerate -->
                  <button
                    v-else-if="agreementData?.signing_status === 'cancelled'"
                    @click="showAgreementModal = true"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <FileSignature class="w-4 h-4 text-gray-600" />
                    Regenerate Agreement
                  </button>

                  <!-- Status label -->
                  <span v-if="hasAgreement" class="text-xs mt-1 text-center" :class="agreementStatusLabelClass">
                    {{ agreementStatusLabel }}
                  </span>
                </div>

                <!-- Send Move-in Pack -->
                <div class="flex flex-col">
                  <button
                    @click="showMoveInPackModal = true"
                    :disabled="!hasTenantsWithEmail"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send class="w-4 h-4 text-amber-600" />
                    <span v-if="compliancePackSent">Resend Pack</span>
                    <span v-else>Send Move-in Pack</span>
                  </button>
                  <span v-if="compliancePackSent" class="text-xs text-green-600 dark:text-green-400 mt-1 text-center">
                    Sent {{ formatDate(tenancy?.compliance_pack_sent_at) }}
                  </span>
                  <span v-else-if="!hasTenantsWithEmail" class="text-xs text-red-500 dark:text-red-400 mt-1 text-center">
                    No tenant email
                  </span>
                </div>

                <!-- Move-in Time Section -->
                <div class="flex flex-col">
                  <!-- Confirmed State -->
                  <div v-if="moveInTimeConfirmed" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <div class="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-sm">
                      <CheckCircle class="w-4 h-4" />
                      Move-in Confirmed
                    </div>
                    <div class="text-green-800 dark:text-green-200 font-semibold mt-1">
                      {{ tenancy?.move_in_time_confirmed }}
                    </div>
                  </div>

                  <!-- Submitted - Show time slot buttons for confirmation -->
                  <div v-else-if="moveInTimeSubmitted" class="space-y-2">
                    <div class="text-xs text-gray-500 dark:text-slate-400 text-center mb-1">Tenant suggested times:</div>
                    <button
                      @click="confirmMoveInTime(tenancy?.move_in_time_slot_1)"
                      :disabled="!!confirmingMoveInTime"
                      class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium text-green-700 dark:text-green-300 disabled:opacity-50"
                    >
                      <Loader2 v-if="confirmingMoveInTime === tenancy?.move_in_time_slot_1" class="w-4 h-4 animate-spin" />
                      <Clock v-else class="w-4 h-4" />
                      Confirm {{ tenancy?.move_in_time_slot_1 }}
                    </button>
                    <button
                      @click="confirmMoveInTime(tenancy?.move_in_time_slot_2)"
                      :disabled="!!confirmingMoveInTime"
                      class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium text-green-700 dark:text-green-300 disabled:opacity-50"
                    >
                      <Loader2 v-if="confirmingMoveInTime === tenancy?.move_in_time_slot_2" class="w-4 h-4 animate-spin" />
                      <Clock v-else class="w-4 h-4" />
                      Confirm {{ tenancy?.move_in_time_slot_2 }}
                    </button>
                    <div v-if="tenancy?.move_in_time_tenant_notes" class="text-xs text-gray-500 dark:text-slate-400 mt-2 p-2 bg-gray-50 dark:bg-slate-800 rounded">
                      <strong>Tenant note:</strong> {{ tenancy?.move_in_time_tenant_notes }}
                    </div>
                  </div>

                  <!-- Request Button -->
                  <button
                    v-else
                    @click="showMoveInTimeModal = true"
                    :disabled="!hasTenantsWithEmail"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Clock class="w-4 h-4 text-amber-600" />
                    <span v-if="moveInTimeRequested">Resend Request</span>
                    <span v-else>Request Move-in Time</span>
                  </button>
                  <span v-if="moveInTimeRequested && !moveInTimeSubmitted" class="text-xs text-gray-500 dark:text-slate-400 mt-1 text-center">
                    Requested {{ formatDate(tenancy?.move_in_time_requested_at) }}
                  </span>
                  <span v-if="!hasTenantsWithEmail && !moveInTimeSubmitted && !moveInTimeConfirmed" class="text-xs text-red-500 dark:text-red-400 mt-1 text-center">
                    No tenant email
                  </span>
                </div>
              </div>
            </div>

            <!-- Active Tenancy Actions (for active tenancies) -->
            <div v-if="tenancy?.status === 'active' || tenancy?.status === 'notice_given'" class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3">Tenancy Actions</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <!-- Send/Resend Compliance Pack -->
                <div class="flex flex-col">
                  <button
                    @click="showMoveInPackModal = true"
                    :disabled="!hasTenantsWithEmail"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send class="w-4 h-4 text-emerald-600" />
                    <span v-if="compliancePackSent">Resend Compliance Pack</span>
                    <span v-else>Send Compliance Pack</span>
                  </button>
                  <span v-if="compliancePackSent" class="text-xs text-green-600 dark:text-green-400 mt-1 text-center">
                    Last sent {{ formatDate(tenancy?.compliance_pack_sent_at) }}
                  </span>
                  <span v-else-if="!hasTenantsWithEmail" class="text-xs text-red-500 dark:text-red-400 mt-1 text-center">
                    No tenant email
                  </span>
                </div>

                <!-- Email All Tenants -->
                <div class="flex flex-col">
                  <button
                    @click="handleDrawerAction('email-tenants')"
                    :disabled="!hasTenantsWithEmail"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm font-medium text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail class="w-4 h-4 text-emerald-600" />
                    Email Tenants
                  </button>
                  <span v-if="!hasTenantsWithEmail" class="text-xs text-red-500 dark:text-red-400 mt-1 text-center">
                    No tenant email
                  </span>
                </div>

                <!-- View/Download Agreement -->
                <div v-if="hasAgreement" class="flex flex-col">
                  <button
                    @click="downloadSignedAgreement"
                    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm font-medium text-gray-700 dark:text-slate-300"
                  >
                    <Download class="w-4 h-4 text-emerald-600" />
                    Download Agreement
                  </button>
                </div>
              </div>
            </div>

            <!-- Key Details -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Monthly Rent</p>
                <EditableField
                  :model-value="rentAmount"
                  type="number"
                  :can-edit="isDraftTenancy"
                  :min="0"
                  :step="0.01"
                  display-class="mt-1 text-xl font-semibold text-gray-900 dark:text-white"
                  input-class="w-24"
                  @save="(v) => updateTenancyField('monthlyRent', v)"
                >
                  <template #display>
                    <span class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">&pound;{{ rentAmount?.toLocaleString() || '0' }}</span>
                  </template>
                </EditableField>
                <!-- Pending Rent Increase Indicator -->
                <div v-if="pendingRentIncrease" class="mt-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md">
                  <div class="flex items-center gap-1.5">
                    <TrendingUp class="w-3.5 h-3.5 text-amber-600" />
                    <span class="text-xs font-medium text-amber-700 dark:text-amber-300">Rent increase pending</span>
                  </div>
                  <p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    &pound;{{ pendingRentIncrease.newRent?.toLocaleString() }} from {{ formatDate(pendingRentIncrease.effectiveDate) }}
                  </p>
                </div>
              </div>
              <div
                class="rounded-lg p-4"
                :class="depositProtected || tdsRegistration
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'"
              >
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Deposit</p>
                <EditableField
                  :model-value="tenancy?.deposit_amount || 0"
                  type="number"
                  :can-edit="isDraftTenancy"
                  :min="0"
                  :step="0.01"
                  display-class="mt-1 text-xl font-semibold"
                  input-class="w-24"
                  @save="(v) => updateTenancyField('depositAmount', v)"
                >
                  <template #display>
                    <span class="mt-1 text-xl font-semibold" :class="depositProtected || tdsRegistration ? 'text-green-600' : 'text-amber-600'">
                      {{ depositDisplay }}
                    </span>
                  </template>
                </EditableField>

                <!-- TDS Registered State -->
                <div v-if="tdsRegistration" class="mt-2 space-y-1">
                  <p class="text-xs text-gray-500 dark:text-slate-400">
                    Scheme: TDS {{ tdsRegistration.schemeType === 'insured' ? 'Insured' : 'Custodial' }}
                  </p>
                  <p class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" />
                    Registered with TDS
                  </p>
                  <p class="text-xs text-gray-600 dark:text-slate-400">DAN: {{ tdsRegistration.dan }}</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDate(tdsRegistration.registeredAt) }} by {{ tdsRegistration.registeredByName }}</p>
                  <button
                    @click="downloadTDSDPC"
                    :disabled="downloadingDPC"
                    class="mt-1 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <Download class="w-3 h-3" />
                    {{ downloadingDPC ? 'Downloading...' : 'Download DPC Certificate' }}
                  </button>
                </div>

                <!-- TDS Linked but Not Registered -->
                <div v-else-if="hasTDSIntegration && tenancy?.deposit_amount && !depositProtected" class="mt-2 space-y-1">
                  <!-- Show connected scheme info -->
                  <p class="text-xs text-gray-500 dark:text-slate-400">
                    <span v-if="hasTDSCustodial && hasTDSInsured">TDS Custodial & Insured connected</span>
                    <span v-else-if="hasTDSCustodial">TDS Custodial connected</span>
                    <span v-else-if="hasTDSInsured">TDS Insured connected</span>
                  </p>
                  <p class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle class="w-3 h-3" />
                    Not yet registered
                  </p>

                  <!-- Single scheme: Direct button -->
                  <button
                    v-if="hasTDSCustodial && !hasTDSInsured"
                    @click="selectedTDSScheme = 'custodial'; showRegisterWithTDSModal = true"
                    class="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md flex items-center justify-center gap-2"
                  >
                    <Shield class="w-4 h-4" />
                    Register with TDS Custodial
                  </button>

                  <button
                    v-else-if="hasTDSInsured && !hasTDSCustodial"
                    @click="selectedTDSScheme = 'insured'; showRegisterWithTDSModal = true"
                    class="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md flex items-center justify-center gap-2"
                  >
                    <ShieldCheck class="w-4 h-4" />
                    Register with TDS Insured
                  </button>

                  <!-- Both schemes: Dropdown -->
                  <div v-else-if="hasTDSCustodial && hasTDSInsured" class="relative mt-2">
                    <button
                      @click="showTDSSchemeMenu = !showTDSSchemeMenu"
                      class="w-full px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md flex items-center justify-center gap-2"
                    >
                      Register with TDS
                      <ChevronDown class="w-4 h-4" />
                    </button>
                    <div
                      v-if="showTDSSchemeMenu"
                      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-10"
                    >
                      <button
                        @click="selectedTDSScheme = 'custodial'; showRegisterWithTDSModal = true; showTDSSchemeMenu = false"
                        class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Shield class="w-4 h-4 text-primary" />
                        TDS Custodial
                      </button>
                      <button
                        @click="selectedTDSScheme = 'insured'; showRegisterWithTDSModal = true; showTDSSchemeMenu = false"
                        class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 border-t dark:border-slate-700"
                      >
                        <ShieldCheck class="w-4 h-4 text-blue-600" />
                        TDS Insured
                      </button>
                    </div>
                  </div>

                  <button
                    @click="showProtectDepositModal = true"
                    class="block mt-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  >
                    Mark as manually protected
                  </button>
                </div>

                <!-- No TDS Integration -->
                <div v-else-if="tenancy?.deposit_amount && !depositProtected" class="mt-2">
                  <button
                    @click="showProtectDepositModal = true"
                    class="text-xs font-medium text-primary hover:text-primary/80"
                  >
                    Mark as protected
                  </button>
                  <router-link
                    to="/settings/integrations"
                    class="block mt-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  >
                    Link TDS account in Settings
                  </router-link>
                </div>

                <!-- Protected (non-TDS) -->
                <p v-else-if="depositProtected && !tdsRegistration" class="text-xs text-green-600 mt-1">
                  Protected {{ formatDate(tenancy?.deposit_protected_at) }}
                </p>
              </div>
              <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Start Date</p>
                <EditableField
                  :model-value="startDate"
                  type="date"
                  :can-edit="isDraftTenancy"
                  display-class="mt-1 text-lg font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('startDate', v)"
                >
                  <template #display>
                    <span class="mt-1 text-lg font-medium text-gray-900 dark:text-white">{{ formatDate(startDate) }}</span>
                  </template>
                </EditableField>
              </div>
              <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">End Date</p>
                <EditableField
                  :model-value="endDate"
                  type="date"
                  :can-edit="isDraftTenancy"
                  display-class="mt-1 text-lg font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('endDate', v)"
                >
                  <template #display>
                    <span class="mt-1 text-lg font-medium text-gray-900 dark:text-white">{{ endDate ? formatDate(endDate) : 'Periodic' }}</span>
                  </template>
                </EditableField>
              </div>
            </div>

            <!-- Additional Info -->
            <div class="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-200 dark:divide-slate-700">
              <div class="px-4 py-3 flex justify-between items-center">
                <span class="text-sm text-gray-500 dark:text-slate-400">Tenancy Type</span>
                <EditableField
                  :model-value="tenancy?.tenancy_type || 'ast'"
                  type="select"
                  :options="tenancyTypeOptions"
                  :can-edit="isDraftTenancy"
                  display-class="text-sm font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('tenancyType', v)"
                >
                  <template #display>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ tenancyTypeLabel }}</span>
                  </template>
                </EditableField>
              </div>
              <div class="px-4 py-3 flex justify-between items-center">
                <span class="text-sm text-gray-500 dark:text-slate-400">Rent Due Day</span>
                <EditableField
                  :model-value="tenancy?.rent_due_day || 1"
                  type="select"
                  :options="rentDueDayOptions"
                  :can-edit="isDraftTenancy"
                  display-class="text-sm font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('rentDueDay', v)"
                >
                  <template #display>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ ordinal(tenancy?.rent_due_day || 1) }} of month</span>
                  </template>
                </EditableField>
              </div>
              <div class="px-4 py-3 flex justify-between items-center">
                <span class="text-sm text-gray-500 dark:text-slate-400">Bills Included</span>
                <EditableField
                  :model-value="tenancy?.bills_included ?? false"
                  type="boolean"
                  :can-edit="isDraftTenancy"
                  display-class="text-sm font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('billsIncluded', v)"
                >
                  <template #display>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ tenancy?.bills_included ? 'Yes' : 'No' }}</span>
                  </template>
                </EditableField>
              </div>
              <div class="px-4 py-3 flex justify-between items-center">
                <span class="text-sm text-gray-500 dark:text-slate-400">Deposit Scheme</span>
                <EditableField
                  :model-value="tenancy?.deposit_scheme || 'dps'"
                  type="select"
                  :options="depositSchemeOptions"
                  :can-edit="isDraftTenancy"
                  display-class="text-sm font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('depositScheme', v)"
                >
                  <template #display>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ depositSchemeLabel || 'Not set' }}</span>
                  </template>
                </EditableField>
              </div>
              <div class="px-4 py-3 flex justify-between items-center">
                <span class="text-sm text-gray-500 dark:text-slate-400">Management Type</span>
                <EditableField
                  :model-value="tenancy?.management_type || tenancy?.property?.management_type || 'let_only'"
                  type="select"
                  :options="managementTypeOptions"
                  :can-edit="true"
                  display-class="text-sm font-medium text-gray-900 dark:text-white"
                  @save="(v) => updateTenancyField('managementType', v)"
                >
                  <template #display>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ managementTypeLabel }}</span>
                  </template>
                </EditableField>
              </div>
              <div v-if="tenancy?.compliance_pack_sent_at" class="px-4 py-3 flex justify-between">
                <span class="text-sm text-gray-500 dark:text-slate-400">Compliance Pack</span>
                <span class="text-sm font-medium text-green-600">Sent {{ formatDate(tenancy.compliance_pack_sent_at) }}</span>
              </div>
              <div v-if="initialMoniesRequested" class="px-4 py-3 flex justify-between">
                <span class="text-sm text-gray-500 dark:text-slate-400">Initial Monies</span>
                <span class="text-sm font-medium" :class="initialMoniesPaid ? 'text-green-600' : tenantConfirmedPayment ? 'text-blue-600' : 'text-amber-600'">
                  {{ initialMoniesPaid ? 'Paid' : tenantConfirmedPayment ? 'Tenant Confirmed' : 'Requested' }} {{ formatDate(tenancy?.initial_monies_paid_at || tenancy?.initial_monies_tenant_confirmed_at || tenancy?.initial_monies_requested_at) }}
                </span>
              </div>
            </div>

            <!-- Agreement Status Section -->
            <div data-section="agreement-status" class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-4">Agreement Status</h3>
              <TenancyAgreementStatus
                :agreement="agreementData"
                :signatures="agreementSigners"
                :loading="loadingAgreementStatus"
                :sending="sendingForSigning"
                :resending="resendingSignature"
                :recalling="recallingAgreement"
                :executing="executingAgreement"
                @generate="showAgreementModal = true"
                @send="handleSendForSigning"
                @edit="showAgreementModal = true"
                @resend="handleResendSignature"
                @resendAll="handleResendAll"
                @recall="handleRecallAgreement"
                @execute="handleExecuteAgreement"
              />
            </div>

            <!-- Notes -->
            <div v-if="tenancy?.notes" class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
              <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Notes</p>
              <p class="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{{ tenancy.notes }}</p>
            </div>
          </div>

          <!-- Tenants Tab -->
          <div v-if="activeTab === 'tenants'" class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Tenants</h3>
              <button
                v-if="!showAddTenantForm"
                @click="showAddTenantForm = true"
                class="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                <Plus class="w-4 h-4" />
                Add Tenant
              </button>
            </div>

            <!-- Add Tenant Form -->
            <div v-if="showAddTenantForm" class="border border-primary/30 bg-primary/5 dark:bg-primary/10 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Add New Tenant</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                  <input
                    v-model="newTenant.firstName"
                    type="text"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                  <input
                    v-model="newTenant.lastName"
                    type="text"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email</label>
                  <input
                    v-model="newTenant.email"
                    type="email"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
                  <input
                    v-model="newTenant.phone"
                    type="tel"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="07123456789"
                  />
                </div>
              </div>
              <div class="mt-3 flex items-center gap-2">
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                  <input
                    v-model="newTenant.isLeadTenant"
                    type="checkbox"
                    class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  Lead Tenant
                </label>
              </div>
              <div class="mt-4 flex justify-end gap-2">
                <button
                  @click="cancelAddTenant"
                  class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  @click="addTenant"
                  :disabled="!newTenant.firstName || !newTenant.lastName || addingTenant"
                  class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
                >
                  {{ addingTenant ? 'Adding...' : 'Add Tenant' }}
                </button>
              </div>
            </div>

            <EditableTenantCard
              v-for="tenant in tenants"
              :key="tenant.id"
              :tenant="tenant"
              :can-edit-rent-share="isDraftTenancy"
              :monthly-rent="rentAmount"
              :address="tenantAddressMap.get(`${tenant.first_name} ${tenant.last_name}`.toLowerCase())"
              @update="(data) => updateTenant(tenant.id, data)"
              @remove="() => removeTenant(tenant.id)"
            />

            <div v-if="tenants.length === 0 && !showAddTenantForm && pendingTenants.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
              <Users class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
              <p>No tenants recorded</p>
              <button
                @click="showAddTenantForm = true"
                class="mt-2 text-sm text-primary hover:text-primary/80 font-medium"
              >
                Add a tenant
              </button>
            </div>

            <!-- Pending/Future Tenants Section -->
            <div v-if="pendingTenants.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <h4 class="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                <Clock class="w-4 h-4" />
                Future Tenants
              </h4>
              <div class="space-y-2">
                <div
                  v-for="tenant in pendingTenants"
                  :key="tenant.id"
                  class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UserPlus class="w-4 h-4 text-blue-500" />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ tenant.first_name }} {{ tenant.last_name }}
                      </span>
                    </div>
                    <span class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">
                      Pending Move-in
                    </span>
                  </div>
                  <div v-if="tenant.email" class="mt-1 text-xs text-gray-500 dark:text-slate-400 pl-6">
                    {{ tenant.email }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Archived Tenants Section -->
            <div v-if="archivedTenants.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                @click="showArchivedTenants = !showArchivedTenants"
                class="flex items-center justify-between w-full text-left"
              >
                <span class="text-sm font-medium text-gray-500 dark:text-slate-400">
                  Archived Tenants ({{ archivedTenants.length }})
                </span>
                <ChevronDown
                  class="w-4 h-4 text-gray-400 transition-transform"
                  :class="{ 'rotate-180': showArchivedTenants }"
                />
              </button>

              <div v-if="showArchivedTenants" class="mt-3 space-y-2">
                <div
                  v-for="tenant in archivedTenants"
                  :key="tenant.id"
                  class="p-3 bg-gray-100 dark:bg-slate-800/50 rounded-lg opacity-60"
                >
                  <div class="flex items-center gap-2">
                    <UserX class="w-4 h-4 text-gray-400" />
                    <span class="text-sm font-medium text-gray-600 dark:text-slate-400">
                      {{ tenant.first_name }} {{ tenant.last_name }}
                    </span>
                    <span class="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">
                      {{ tenant.status === 'replaced' ? 'Replaced' : 'Removed' }}
                    </span>
                  </div>
                  <div v-if="tenant.email" class="mt-1 text-xs text-gray-400 dark:text-slate-500 pl-6">
                    {{ tenant.email }}
                  </div>
                  <div v-if="tenant.left_date" class="mt-1 text-xs text-gray-400 dark:text-slate-500 pl-6">
                    Left: {{ formatDate(tenant.left_date) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Guarantors Section -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Guarantors</h3>
                <button
                  v-if="!showAddGuarantorForm"
                  @click="showAddGuarantorForm = true"
                  class="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  Add Guarantor
                </button>
              </div>

              <!-- Add Guarantor Form -->
              <div v-if="showAddGuarantorForm" class="border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 mb-4">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Add New Guarantor</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                    <input
                      v-model="newGuarantor.firstName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                    <input
                      v-model="newGuarantor.lastName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email</label>
                    <input
                      v-model="newGuarantor.email"
                      type="email"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
                    <input
                      v-model="newGuarantor.phone"
                      type="tel"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="07123456789"
                    />
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Relationship to Tenant</label>
                    <select
                      v-model="newGuarantor.relationshipToTenant"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="Parent">Parent</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Other Family">Other Family</option>
                      <option value="Friend">Friend</option>
                      <option value="Employer">Employer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                  <button
                    @click="cancelAddGuarantor"
                    class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    @click="addGuarantor"
                    :disabled="!newGuarantor.firstName || !newGuarantor.lastName || addingGuarantor"
                    class="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                  >
                    {{ addingGuarantor ? 'Adding...' : 'Add Guarantor' }}
                  </button>
                </div>
              </div>

              <!-- Existing Guarantors from tenancy_guarantors table -->
              <div class="space-y-3">
                <EditableGuarantorCard
                  v-for="guarantor in tenancyGuarantors"
                  :key="guarantor.id"
                  :guarantor="guarantor"
                  @update="(data) => updateGuarantor(guarantor.id, data)"
                  @remove="() => removeGuarantor(guarantor.id)"
                />
              </div>

              <!-- Guarantors from references (read-only display) -->
              <div v-if="guarantors.length > 0" class="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                <p class="text-xs text-gray-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                  <ShieldCheck class="w-3 h-3" />
                  From References
                </p>
                <div
                  v-for="guarantor in guarantors"
                  :key="'ref-' + guarantor.id"
                  class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-3 bg-gray-50 dark:bg-slate-800"
                >
                  <div class="flex items-center gap-2">
                    <ShieldCheck class="w-4 h-4 text-emerald-500" />
                    <h4 class="font-medium text-gray-900 dark:text-white">
                      {{ guarantor.first_name }} {{ guarantor.last_name }}
                    </h4>
                    <span class="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">
                      Reference
                    </span>
                  </div>
                  <div class="mt-2 space-y-1">
                    <p v-if="guarantor.email" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                      <Mail class="w-3 h-3 text-gray-400 dark:text-slate-500" />
                      <a :href="`mailto:${guarantor.email}`" class="hover:text-primary">{{ guarantor.email }}</a>
                    </p>
                    <p v-if="guarantor.phone" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                      <Phone class="w-3 h-3 text-gray-400 dark:text-slate-500" />
                      <a :href="`tel:${guarantor.phone}`" class="hover:text-primary">{{ guarantor.phone }}</a>
                    </p>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="tenancyGuarantors.length === 0 && guarantors.length === 0 && !showAddGuarantorForm" class="text-center py-6 text-gray-500 dark:text-slate-400">
                <ShieldCheck class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p>No guarantors recorded</p>
                <button
                  @click="showAddGuarantorForm = true"
                  class="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Add a guarantor
                </button>
              </div>
            </div>
          </div>

          <!-- Landlord Tab -->
          <div v-if="activeTab === 'landlord'" class="space-y-6">
            <!-- Linked Landlords -->
            <div v-if="allLandlords.length > 0">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">Linked Landlords</h3>
              <div class="space-y-3">
                <div
                  v-for="landlord in allLandlords"
                  :key="landlord.id"
                  class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="font-medium text-gray-900 dark:text-white">{{ landlord.name || 'Unknown Landlord' }}</h4>
                        <span v-if="landlord.is_primary_contact" class="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">Primary</span>
                        <!-- AML Status Badge -->
                        <span
                          class="px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1"
                          :class="{
                            'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300': landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed',
                            'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300': landlord.aml_status === 'unsatisfactory' || landlord.aml_status === 'failed',
                            'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300': landlord.aml_status === 'requested' || landlord.aml_status === 'pending' || landlord.aml_status === 'submitted',
                            'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300': landlord.aml_status === 'not_requested' || !landlord.aml_status
                          }"
                        >
                          <CheckCircle v-if="landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed'" class="w-3 h-3" />
                          <AlertCircle v-else-if="landlord.aml_status === 'unsatisfactory' || landlord.aml_status === 'failed'" class="w-3 h-3" />
                          <Clock v-else-if="landlord.aml_status === 'requested' || landlord.aml_status === 'pending' || landlord.aml_status === 'submitted'" class="w-3 h-3" />
                          <AlertCircle v-else class="w-3 h-3" />
                          AML: {{ formatAmlStatus(landlord.aml_status) }}
                        </span>
                      </div>
                      <div class="mt-2 space-y-1">
                        <p v-if="landlord.email" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                          <Mail class="w-3 h-3 text-gray-400 dark:text-slate-500" />
                          <a :href="`mailto:${landlord.email}`" class="hover:text-primary">{{ landlord.email }}</a>
                        </p>
                        <p v-if="landlord.phone" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                          <Phone class="w-3 h-3 text-gray-400 dark:text-slate-500" />
                          <a :href="`tel:${landlord.phone}`" class="hover:text-primary">{{ landlord.phone }}</a>
                        </p>
                        <p v-if="landlord.address_line1" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                          <MapPin class="w-3 h-3 text-gray-400 dark:text-slate-500" />
                          {{ [landlord.address_line1, landlord.city, landlord.postcode].filter(Boolean).join(', ') }}
                        </p>
                        <p v-if="landlord.ownership_percentage" class="text-sm text-gray-600 dark:text-slate-400">
                          Ownership: {{ landlord.ownership_percentage }}%
                        </p>
                      </div>
                    </div>
                    <router-link
                      v-if="tenancy?.property_id"
                      :to="`/properties/${tenancy.property_id}?tab=landlords`"
                      class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      View in Property
                      <ExternalLink class="w-3 h-3" />
                    </router-link>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Landlord - Add/Link -->
            <div v-else class="text-center py-8">
              <UserCircle class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
              <p class="text-gray-500 dark:text-slate-400 mb-4">No landlord linked to this property</p>

              <!-- Search & Link Section -->
              <div v-if="showLandlordSearch" class="max-w-md mx-auto text-left">
                <div class="relative mb-3">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input
                    v-model="landlordSearchQuery"
                    @input="searchLandlords"
                    type="text"
                    placeholder="Search landlords by name or email..."
                    class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                <!-- Search Results -->
                <div v-if="searchingLandlords" class="text-center py-4">
                  <Loader2 class="w-5 h-5 animate-spin mx-auto text-gray-400 dark:text-slate-500" />
                </div>
                <div v-else-if="landlordSearchResults.length > 0" class="border border-gray-200 dark:border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                  <button
                    v-for="result in landlordSearchResults"
                    :key="result.id"
                    @click="linkLandlordToProperty(result)"
                    :disabled="linkingLandlord"
                    class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0"
                  >
                    <p class="font-medium text-gray-900 dark:text-white">{{ result.name }}</p>
                    <p class="text-sm text-gray-500 dark:text-slate-400">{{ result.email }}</p>
                  </button>
                </div>
                <div v-else-if="landlordSearchQuery.length > 2" class="text-center py-4 text-gray-500 dark:text-slate-400 text-sm">
                  No landlords found
                </div>

                <div class="mt-4 flex gap-2 justify-center">
                  <button
                    @click="showLandlordSearch = false"
                    class="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <router-link
                    v-if="tenancy?.property_id"
                    :to="`/properties/${tenancy.property_id}?tab=landlords`"
                    class="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg"
                  >
                    Add New Landlord in Property
                  </router-link>
                </div>
              </div>

              <button
                v-else
                @click="showLandlordSearch = true; searchLandlords()"
                class="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
              >
                Add or Link Landlord
              </button>
            </div>
          </div>

          <!-- Property Tab -->
          <div v-if="activeTab === 'property'" class="space-y-6">
            <!-- Property Details -->
            <div class="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
              <div class="px-4 py-3 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building class="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  Property Details
                </h3>
              </div>
              <div class="p-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Address</p>
                    <p class="font-medium text-gray-900 dark:text-white">{{ tenancy?.property?.address_line1 || '-' }}</p>
                    <p v-if="tenancy?.property?.address_line2" class="text-sm text-gray-600 dark:text-slate-400">{{ tenancy.property.address_line2 }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">City</p>
                    <p class="font-medium text-gray-900 dark:text-white">{{ tenancy?.property?.city || '-' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Postcode</p>
                    <p class="font-medium text-gray-900 dark:text-white">{{ tenancy?.property?.postcode || '-' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Status</p>
                    <p class="font-medium text-gray-900 dark:text-white capitalize">{{ tenancy?.property?.status?.replace('_', ' ') || '-' }}</p>
                  </div>
                </div>

                <!-- Additional Property Details -->
                <div v-if="propertyDetails" class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div v-if="propertyDetails.property_type">
                      <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Type</p>
                      <p class="font-medium text-gray-900 dark:text-white capitalize">{{ propertyDetails.property_type?.replace('_', ' ') }}</p>
                    </div>
                    <div v-if="propertyDetails.number_of_bedrooms">
                      <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Bedrooms</p>
                      <p class="font-medium text-gray-900 dark:text-white">{{ propertyDetails.number_of_bedrooms }}</p>
                    </div>
                    <div v-if="propertyDetails.number_of_bathrooms">
                      <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Bathrooms</p>
                      <p class="font-medium text-gray-900 dark:text-white">{{ propertyDetails.number_of_bathrooms }}</p>
                    </div>
                    <div v-if="propertyDetails.furnishing_status">
                      <p class="text-xs text-gray-500 dark:text-slate-400 uppercase">Furnishing</p>
                      <p class="font-medium text-gray-900 dark:text-white capitalize">{{ propertyDetails.furnishing_status?.replace('_', ' ') }}</p>
                    </div>
                  </div>
                </div>

                <!-- Licensing Info -->
                <div v-if="propertyDetails?.is_licensed" class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <h4 class="text-xs text-gray-500 dark:text-slate-400 uppercase mb-2">Licensing</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-if="propertyDetails.license_number">
                      <p class="text-xs text-gray-500 dark:text-slate-400">License Number</p>
                      <p class="font-medium text-gray-900 dark:text-white">{{ propertyDetails.license_number }}</p>
                    </div>
                    <div v-if="propertyDetails.license_expiry_date">
                      <p class="text-xs text-gray-500 dark:text-slate-400">Expiry Date</p>
                      <p class="font-medium text-gray-900 dark:text-white">{{ formatDate(propertyDetails.license_expiry_date) }}</p>
                    </div>
                    <div v-if="propertyDetails.license_authority">
                      <p class="text-xs text-gray-500 dark:text-slate-400">Authority</p>
                      <p class="font-medium text-gray-900 dark:text-white">{{ propertyDetails.license_authority }}</p>
                    </div>
                  </div>
                </div>

                <!-- Link to full property page -->
                <div class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <router-link
                    v-if="tenancy?.property_id"
                    :to="`/properties/${tenancy.property_id}`"
                    class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    View Full Property Details
                    <ExternalLink class="w-3 h-3" />
                  </router-link>
                </div>
              </div>
            </div>

            <!-- Property Notes -->
            <div v-if="propertyDetails?.notes" class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
              <h4 class="text-xs text-gray-500 dark:text-slate-400 uppercase mb-2">Property Notes</h4>
              <p class="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{{ propertyDetails.notes }}</p>
            </div>

            <!-- Special Clauses (from Property) -->
            <div class="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
              <div class="px-4 py-3 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertCircle class="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  Special Clauses
                </h3>
              </div>
              <div v-if="propertySpecialClauses.length > 0" class="divide-y divide-gray-200 dark:divide-slate-700">
                <div
                  v-for="(clause, index) in propertySpecialClauses"
                  :key="index"
                  class="p-4"
                >
                  <p class="text-sm text-gray-700 dark:text-slate-300">{{ clause }}</p>
                </div>
              </div>
              <div v-else class="p-4 text-center">
                <p class="text-sm text-gray-500 dark:text-slate-400">No Special Clauses</p>
                <router-link
                  v-if="tenancy?.property_id"
                  :to="`/properties/${tenancy.property_id}`"
                  class="text-sm text-primary hover:text-primary/80 mt-1 inline-block"
                >
                  Add Clause?
                </router-link>
              </div>
            </div>

            <div v-if="!propertyDetails && propertySpecialClauses.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
              <Building class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
              No additional property details available
            </div>
          </div>

          <!-- Documents Tab -->
          <div v-if="activeTab === 'documents'" class="space-y-6">
            <!-- Upload Section -->
            <div class="border border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-800">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Upload Document</h3>
              </div>
              <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex-1">
                  <input
                    ref="documentInput"
                    type="file"
                    @change="handleDocumentSelect"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    class="hidden"
                  />
                  <button
                    @click="triggerDocumentSelect"
                    class="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-700 dark:text-slate-300"
                  >
                    <Upload class="w-4 h-4" />
                    {{ selectedDocument ? selectedDocument.name : 'Choose file...' }}
                  </button>
                </div>
                <select
                  v-model="documentTag"
                  class="px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-primary focus:border-primary"
                >
                  <option value="other">General</option>
                  <option value="agreement">Agreement</option>
                  <option value="inventory">Inventory</option>
                  <option value="reference">Reference</option>
                </select>
                <button
                  @click="uploadDocument"
                  :disabled="!selectedDocument || uploadingDocument"
                  class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                >
                  <Loader2 v-if="uploadingDocument" class="w-4 h-4 animate-spin" />
                  <Upload v-else class="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>

            <!-- Tenancy Documents -->
            <div v-if="tenancyDocuments.length > 0">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">Tenancy Documents</h3>
              <div class="space-y-2">
                <div
                  v-for="doc in tenancyDocuments"
                  :key="doc.id"
                  class="flex items-center justify-between border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800"
                >
                  <div class="flex items-center gap-3">
                    <FileText class="w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <div>
                      <a
                        :href="getPropertyDocumentDownloadUrl(doc.id)"
                        target="_blank"
                        class="font-medium text-primary hover:text-primary/80"
                      >
                        {{ doc.file_name }}
                      </a>
                      <p class="text-xs text-gray-500 dark:text-slate-400">
                        {{ formatDocumentTag(doc.tag) }} &bull; {{ formatDate(doc.uploaded_at) }}
                      </p>
                    </div>
                  </div>
                  <button
                    @click="deleteDocument(doc.id)"
                    :disabled="deletingDocumentId === doc.id"
                    class="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
                    title="Remove document"
                  >
                    <Trash2 v-if="deletingDocumentId !== doc.id" class="w-4 h-4" />
                    <Loader2 v-else class="w-4 h-4 animate-spin" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Compliance Documents -->
            <div v-if="complianceDocuments.length > 0">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">Compliance Documents</h3>
              <div class="space-y-3">
                <div
                  v-for="doc in complianceDocuments"
                  :key="doc.id"
                  class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <h4 class="font-medium text-gray-900 dark:text-white">
                        {{ formatComplianceType(doc.type) }}
                        <span v-if="doc.customType" class="text-gray-500 dark:text-slate-400">({{ doc.customType }})</span>
                      </h4>
                      <div class="mt-1 text-sm text-gray-500 dark:text-slate-400 space-y-0.5">
                        <p v-if="doc.certificateNumber">Certificate: {{ doc.certificateNumber }}</p>
                        <p v-if="doc.issuerName">Issued by: {{ doc.issuerName }}</p>
                        <p>Issue Date: {{ formatDate(doc.issueDate) }}</p>
                        <p v-if="doc.expiryDate">Expires: {{ formatDate(doc.expiryDate) }}</p>
                      </div>
                    </div>
                    <span
                      class="px-2 py-1 text-xs font-medium rounded-full"
                      :class="{
                        'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300': doc.status === 'valid',
                        'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300': doc.status === 'expiring_soon',
                        'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300': doc.status === 'expired'
                      }"
                    >
                      {{ doc.status === 'valid' ? 'Valid' : doc.status === 'expiring_soon' ? 'Expiring Soon' : 'Expired' }}
                    </span>
                  </div>
                  <!-- Document links - clickable URL hotlinks -->
                  <div v-if="doc.documents && doc.documents.length > 0" class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <p class="text-xs text-gray-500 dark:text-slate-400 mb-2">Attached Files:</p>
                    <div class="space-y-1">
                      <a
                        v-for="file in doc.documents"
                        :key="file.id"
                        :href="getComplianceDocumentUrl(doc.complianceId, file.id)"
                        target="_blank"
                        class="flex items-center gap-2 text-sm text-primary hover:text-primary/80 hover:underline"
                      >
                        <ExternalLink class="w-3 h-3" />
                        {{ file.file_name }}
                      </a>
                    </div>
                  </div>
                  <!-- No attached files - link to property compliance -->
                  <div v-else class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <router-link
                      v-if="tenancy?.property_id"
                      :to="`/properties/${tenancy.property_id}?tab=compliance`"
                      class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      View/Upload in Property
                      <ExternalLink class="w-3 h-3" />
                    </router-link>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="complianceDocuments.length === 0 && tenancyDocuments.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
              <FileText class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
              <p>No documents yet</p>
              <p class="text-sm mt-1">Upload documents above or view compliance in the property</p>
              <router-link
                v-if="tenancy?.property_id"
                :to="`/properties/${tenancy.property_id}?tab=compliance`"
                class="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
              >
                View Property Compliance
                <ExternalLink class="w-3 h-3" />
              </router-link>
            </div>
          </div>

          <!-- Rent Tab -->
          <div v-if="activeTab === 'rent'" class="space-y-6">
            <!-- Current Rent Due Day -->
            <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Current Rent Due Day</p>
                  <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {{ ordinal(tenancy?.rent_due_day || 1) }}
                    <span class="text-base font-normal text-gray-500 dark:text-slate-400">of each month</span>
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Monthly Rent</p>
                  <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">&pound;{{ rentAmount?.toLocaleString() || '0' }}</p>
                </div>
              </div>
            </div>

            <!-- Pending/Recent Rent Due Date Changes -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Rent Due Date Changes</h3>
                <button
                  v-if="tenancy?.status === 'active'"
                  @click="showChangeRentDueDateModal = true"
                  class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  Request Change
                </button>
              </div>

              <!-- Loading State -->
              <div v-if="loadingRentDueDateChanges" class="text-center py-8">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-gray-400" />
              </div>

              <!-- No Changes -->
              <div v-else-if="rentDueDateChanges.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <Calendar class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p>No rent due date changes</p>
                <p class="text-sm mt-1">Use the Actions menu to request a change</p>
              </div>

              <!-- Change Cards -->
              <div v-else class="space-y-4">
                <div
                  v-for="change in rentDueDateChanges"
                  :key="change.id"
                  class="border rounded-lg p-4"
                  :class="{
                    'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20': change.status === 'pending_payment',
                    'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20': change.status === 'payment_confirmed',
                    'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20': change.status === 'activated',
                    'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800': change.status === 'cancelled'
                  }"
                >
                  <!-- Header with Status Badge -->
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="{
                          'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200': change.status === 'pending_payment',
                          'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200': change.status === 'payment_confirmed',
                          'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200': change.status === 'activated',
                          'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300': change.status === 'cancelled'
                        }"
                      >
                        {{ rentDueDateChangeStatusLabel(change.status) }}
                      </span>
                      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Requested {{ formatDate(change.created_at) }}
                      </p>
                    </div>
                  </div>

                  <!-- Change Details -->
                  <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Change</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ ordinal(change.current_due_day) }} &rarr; {{ ordinal(change.new_due_day) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Effective From</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ formatEffectiveDate(change) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Pro-rata Amount</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">&pound;{{ parseFloat(change.pro_rata_amount).toFixed(2) }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Total Due</p>
                      <p class="text-sm font-semibold text-primary">&pound;{{ parseFloat(change.total_amount).toFixed(2) }}</p>
                    </div>
                  </div>

                  <!-- Tenant Confirmed Notice -->
                  <div v-if="change.status === 'payment_confirmed' && change.tenant_confirmed_at" class="mb-4 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-200">
                    <CheckCircle class="w-4 h-4 inline-block mr-1" />
                    Tenant confirmed payment on {{ formatDate(change.tenant_confirmed_at) }}
                  </div>

                  <!-- Activated Info -->
                  <div v-if="change.status === 'activated'" class="mb-4 p-2 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-800 dark:text-green-200">
                    <CheckCircle class="w-4 h-4 inline-block mr-1" />
                    Activated on {{ formatDate(change.activated_at) }}
                  </div>

                  <!-- Cancelled Info -->
                  <div v-if="change.status === 'cancelled'" class="mb-4 p-2 bg-gray-100 dark:bg-slate-700 rounded text-sm text-gray-600 dark:text-slate-300">
                    Cancelled on {{ formatDate(change.cancelled_at) }}
                    <span v-if="change.cancelled_reason"> - {{ change.cancelled_reason }}</span>
                  </div>

                  <!-- Action Buttons -->
                  <div v-if="change.status === 'pending_payment'" class="flex items-center gap-2 pt-3 border-t border-amber-200">
                    <button
                      @click="openReceiptModal(change)"
                      class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1"
                    >
                      <CheckCircle class="w-3.5 h-3.5" />
                      Receipt Payment
                    </button>
                    <button
                      @click="resendRentDueDateEmail(change)"
                      :disabled="resendingRentDueDateEmail === change.id"
                      class="px-3 py-1.5 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Loader2 v-if="resendingRentDueDateEmail === change.id" class="w-3.5 h-3.5 animate-spin" />
                      <Send v-else class="w-3.5 h-3.5" />
                      {{ resendingRentDueDateEmail === change.id ? 'Sending...' : 'Resend Email' }}
                    </button>
                    <button
                      @click="cancelRentDueDateChange(change)"
                      :disabled="cancellingRentDueDateChange === change.id"
                      class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      {{ cancellingRentDueDateChange === change.id ? 'Cancelling...' : 'Cancel' }}
                    </button>
                  </div>

                  <div v-if="change.status === 'payment_confirmed'" class="flex items-center gap-2 pt-3 border-t border-blue-200">
                    <button
                      @click="openReceiptModal(change)"
                      class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1"
                    >
                      <CheckCircle class="w-3.5 h-3.5" />
                      Receipt Payment
                    </button>
                    <button
                      @click="cancelRentDueDateChange(change)"
                      :disabled="cancellingRentDueDateChange === change.id"
                      class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      {{ cancellingRentDueDateChange === change.id ? 'Cancelling...' : 'Cancel' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rent Increase Notices -->
            <div class="mt-6">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Rent Increase Notices</h3>
              </div>

              <!-- Loading State -->
              <div v-if="loadingRentIncreaseNotices" class="text-center py-8">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-gray-400 dark:text-slate-500" />
              </div>

              <!-- No Notices -->
              <div v-else-if="rentIncreaseNotices.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <TrendingUp class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p>No rent increase notices</p>
                <p class="text-sm mt-1">Use the Actions menu to serve a Section 13 notice</p>
              </div>

              <!-- Notice Cards -->
              <div v-else class="space-y-4">
                <div
                  v-for="notice in rentIncreaseNotices"
                  :key="notice.id"
                  class="border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-4"
                >
                  <!-- Header with Status Badge -->
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                        {{ notice.status === 'served' ? 'Served' : notice.status }}
                      </span>
                      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Served {{ formatDate(notice.notice_date) }}
                      </p>
                    </div>
                  </div>

                  <!-- Notice Details -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Rent Change</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        &pound;{{ parseFloat(notice.current_rent).toFixed(2) }} &rarr; &pound;{{ parseFloat(notice.new_rent).toFixed(2) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Effective From</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ formatDate(notice.effective_date) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Increase</p>
                      <p class="text-sm font-medium text-green-600 dark:text-green-400">
                        +&pound;{{ (parseFloat(notice.new_rent) - parseFloat(notice.current_rent)).toFixed(2) }}
                        ({{ (((parseFloat(notice.new_rent) - parseFloat(notice.current_rent)) / parseFloat(notice.current_rent)) * 100).toFixed(1) }}%)
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Delivery</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white capitalize">{{ notice.delivery_method }}</p>
                    </div>
                  </div>

                  <!-- View PDF Button -->
                  <div v-if="notice.document?.file_path || notice.document_id" class="mt-4 pt-3 border-t border-green-200">
                    <a
                      :href="notice.document?.file_path || `${API_URL}/api/tenancies/rent-increase-notices/${notice.id}/pdf`"
                      target="_blank"
                      class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                    >
                      <FileText class="w-4 h-4" />
                      View Section 13 Notice PDF
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Tab -->
          <div v-if="activeTab === 'activity'" class="space-y-6">
            <!-- Add Note Section -->
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">Add Note</h3>
              <div class="flex gap-2">
                <textarea
                  v-model="newNoteContent"
                  placeholder="Add a note about this tenancy..."
                  rows="2"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary resize-none"
                ></textarea>
                <button
                  @click="addNote"
                  :disabled="!newNoteContent.trim() || addingNote"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 self-end"
                >
                  {{ addingNote ? 'Adding...' : 'Add' }}
                </button>
              </div>
            </div>

            <!-- Notes List -->
            <div v-if="tenancyNotes.length > 0">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">Notes</h3>
              <div class="space-y-3">
                <div
                  v-for="note in tenancyNotes"
                  :key="note.id"
                  class="border rounded-lg p-4"
                  :class="note.is_pinned ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ note.content }}</p>
                      <p class="mt-2 text-xs text-gray-500 dark:text-slate-400">
                        {{ note.created_by_name }} · {{ formatActivityDate(note.created_at) }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <button
                        @click="togglePinNote(note)"
                        class="p-1.5 text-gray-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 rounded"
                        :title="note.is_pinned ? 'Unpin note' : 'Pin note'"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" :class="note.is_pinned ? 'text-amber-500' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 2v10M5 12l7 10 7-10"/>
                        </svg>
                      </button>
                      <button
                        @click="deleteNote(note.id)"
                        class="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded"
                        title="Delete note"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Activity Log -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Activity Log</h3>
                <select
                  v-model="activityFilter"
                  @change="loadTenancyActivity"
                  class="text-xs border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded px-2 py-1"
                >
                  <option value="all">All Activity</option>
                  <option value="tenant">Tenants</option>
                  <option value="agreement">Agreement</option>
                  <option value="payment">Payments</option>
                  <option value="notice">Notices</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div v-if="loadingActivity" class="text-center py-8">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-gray-400" />
              </div>

              <div v-else-if="tenancyActivity.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
                <Clock class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p>No activity recorded yet</p>
              </div>

              <div v-else class="relative">
                <!-- Timeline line -->
                <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700"></div>

                <div class="space-y-4">
                  <div
                    v-for="activity in tenancyActivity"
                    :key="activity.id"
                    class="relative pl-10"
                  >
                    <!-- Timeline dot -->
                    <div class="absolute left-2 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center text-xs">
                      {{ getActivityIcon(activity.action) }}
                    </div>

                    <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ activity.title }}</p>
                          <p v-if="activity.description" class="text-sm text-gray-600 dark:text-slate-400 mt-0.5">{{ activity.description }}</p>
                        </div>
                        <span class="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                          {{ formatActivityDate(activity.created_at) }}
                        </span>
                      </div>
                      <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {{ activity.is_system_action ? 'System' : activity.performed_by_name }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between">
          <button
            v-if="tenancy?.status === 'active'"
            @click="showEndTenancyModal = true"
            class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            End Tenancy
          </button>
          <div v-else></div>
          <button
            @click="$emit('update:open', false)"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </Transition>

    <!-- End Tenancy Modal -->
    <EndTenancyModal
      :show="showEndTenancyModal"
      :tenancy="tenancy"
      @close="showEndTenancyModal = false"
      @ended="handleTenancyEnded"
    />

    <!-- Protect Deposit Modal -->
    <ProtectDepositModal
      :show="showProtectDepositModal"
      :tenancy="tenancy"
      @close="showProtectDepositModal = false"
      @saved="handleDepositProtected"
    />

    <!-- Register Deposit with TDS Modal -->
    <RegisterDepositWithTDSModal
      :show="showRegisterWithTDSModal"
      :tenancy="fullTenancyData || tenancy"
      :scheme-type="selectedTDSScheme"
      :landlords="allLandlords"
      @close="showRegisterWithTDSModal = false"
      @registered="handleTDSRegistered"
      @pending="handleTDSPending"
    />

    <!-- Section 48 Notice Generator Modal -->
    <Section48GeneratorModal
      :show="showSection48Modal"
      :tenancy="fullTenancyData || tenancy"
      :landlords="allLandlords"
      @close="showSection48Modal = false"
      @generated="handleSection48Generated"
    />

    <!-- Initial Monies Modal -->
    <InitialMoniesModal
      :show="showInitialMoniesModal"
      :tenancy="tenancy"
      @close="showInitialMoniesModal = false"
      @sent="handleInitialMoniesSent"
    />

    <!-- Agreement Generation Modal -->
    <TenancyAgreementModal
      :show="showAgreementModal"
      :tenancy="fullTenancyData || tenancy"
      :landlords="allLandlords"
      :special-clauses="propertySpecialClauses"
      :tenant-addresses="tenantAddressMap"
      :guarantors-data="guarantors"
      @close="showAgreementModal = false"
      @generated="handleAgreementGenerated"
      @sent="handleAgreementSent"
    />

    <!-- Move-In Pack Modal -->
    <MoveInPackModal
      :open="showMoveInPackModal"
      :tenancy-id="tenancy?.id || ''"
      :property-address="moveInPackPropertyAddress"
      :management-type="moveInPackManagementType"
      :tenants="tenants"
      :compliance-documents="moveInPackComplianceDocs"
      :signed-agreement-url="moveInPackSignedAgreementUrl"
      :landlord-name="moveInPackLandlordName"
      :landlord-phone="moveInPackLandlordPhone"
      :landlord-email="moveInPackLandlordEmail"
      :landlord-bank-details="moveInPackLandlordBankDetails"
      :agent-bank-details="moveInPackAgentBankDetails"
      :management-info="moveInPackManagementInfo"
      @close="showMoveInPackModal = false"
      @sent="handleMoveInPackSent"
    />

    <!-- Signing Status Modal -->
    <div v-if="showSigningStatusModal && agreementData" class="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-[60] flex items-center justify-center">
      <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl mx-4 p-6 w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Signing Status</h3>
          <button @click="showSigningStatusModal = false" class="text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400">
            <X class="h-6 w-6" />
          </button>
        </div>

        <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p class="text-sm text-blue-800 dark:text-blue-200 font-medium">
            {{ tenancy?.property?.address_line1 || 'Property' }}
          </p>
          <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">
            Status: <span class="font-medium">{{ agreementStatusLabel }}</span>
          </p>
        </div>

        <!-- Signatures List -->
        <div v-if="agreementSigners.length > 0" class="space-y-3 mb-6">
          <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">Signatures</h4>
          <div
            v-for="signer in agreementSigners"
            :key="signer.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center"
                :class="(signer.signed_at || signer.status === 'signed') ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'"
              >
                <CheckCircle v-if="signer.signed_at || signer.status === 'signed'" class="w-5 h-5 text-green-600 dark:text-green-400" />
                <Clock v-else class="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ signer.signer_name }}</p>
                <p class="text-xs text-gray-500 dark:text-slate-400">
                  {{ signer.signer_type?.charAt(0).toUpperCase() + signer.signer_type?.slice(1) }}
                  <span v-if="signer.signed_at || signer.status === 'signed'" class="text-green-600 dark:text-green-400 ml-1">
                    • Signed {{ formatDate(signer.signed_at || signer.signedAt) }}
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400 ml-1">
                    • Awaiting signature
                  </span>
                </p>
              </div>
            </div>
            <button
              v-if="!(signer.signed_at || signer.status === 'signed')"
              @click="handleResendSignature(signer)"
              :disabled="resendingSignature === signer.id"
              class="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {{ resendingSignature === signer.id ? 'Sending...' : 'Resend' }}
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="agreementSigners.length > 0" class="mb-6">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
            <span>Signing Progress</span>
            <span>{{ agreementSigners.filter(s => s.signed_at || s.status === 'signed').length }} / {{ agreementSigners.length }} signed</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              class="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${(agreementSigners.filter(s => s.signed_at || s.status === 'signed').length / agreementSigners.length) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-slate-700">
          <div class="flex gap-2">
            <button
              v-if="agreementData.pdf_url || agreementData.signed_pdf_url"
              @click="downloadSignedAgreement"
              class="flex items-center gap-2 px-4 py-2 text-primary font-medium border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
            >
              <Download class="w-4 h-4" />
              View PDF
            </button>
            <button
              v-if="agreementSigners.some(s => !(s.signed_at || s.status === 'signed'))"
              @click="handleResendAll"
              :disabled="resendingSignature === 'all'"
              class="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 disabled:bg-gray-100 dark:disabled:bg-slate-700"
            >
              <Send class="w-4 h-4" />
              {{ resendingSignature === 'all' ? 'Sending...' : 'Resend to All' }}
            </button>
          </div>
          <div class="flex gap-2">
            <!-- Recall Button -->
            <button
              v-if="['sent', 'pending_signatures', 'partially_signed'].includes(agreementData?.signing_status)"
              @click="handleRecallAgreement(); showSigningStatusModal = false"
              :disabled="recallingAgreement"
              class="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 font-medium border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-slate-500"
            >
              <RotateCcw class="w-4 h-4" />
              {{ recallingAgreement ? 'Recalling...' : 'Recall Agreement' }}
            </button>
            <button
              @click="showSigningStatusModal = false"
              class="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Change Rent Due Date Modal -->
  <ChangeRentDueDateModal
    :is-open="showChangeRentDueDateModal"
    :tenancy-id="tenancy?.id || ''"
    :current-due-day="tenancy?.rent_due_day || 1"
    :monthly-rent="tenancy?.monthly_rent || 0"
    :property-address="propertyAddress"
    @close="showChangeRentDueDateModal = false"
    @success="handleRentDueDateChangeSuccess"
  />

  <!-- Request Move-in Time Modal -->
  <RequestMoveInTimeModal
    :is-open="showMoveInTimeModal"
    :tenancy-id="tenancy?.id || ''"
    :property-address="propertyAddress"
    :move-in-date="tenancy?.start_date || tenancy?.tenancy_start_date || ''"
    :tenant-name="leadTenantName"
    :tenant-email="leadTenantEmail"
    @close="showMoveInTimeModal = false"
    @success="handleMoveInTimeRequestSuccess"
  />

  <!-- Receipt Rent Due Date Change Modal -->
  <ReceiptRentDueDateChangeModal
    :show="showReceiptRentDueDateChangeModal"
    :tenancy-id="tenancy?.id || ''"
    :change="selectedRentDueDateChange"
    @close="showReceiptRentDueDateChangeModal = false"
    @confirmed="handleRentDueDateChangeActivated"
  />

  <!-- Tenant Change Modal -->
  <TenantChangeModal
    :is-open="showTenantChangeModal"
    :tenancy-id="tenancy?.id || ''"
    :tenancy="tenancy"
    :existing-tenant-change="activeTenantChange"
    @close="handleTenantChangeClose"
    @updated="handleTenantChangeUpdate"
  />

  <!-- Move Out Notice Modal -->
  <MoveOutNoticeModal
    :is-open="showMoveOutModal"
    :tenancy-id="tenancy?.id || ''"
    @close="showMoveOutModal = false"
    @sent="handleMoveOutNoticeSent"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import {
  X, FileText, Users, Mail, Phone, Building,
  UserCircle, MapPin, AlertCircle, Shield, ShieldCheck, Wallet,
  FileSignature, Send, Loader2, Plus, Search, ExternalLink, Upload, Trash2, Clock,
  ClipboardCheck, CheckCircle, Download, RotateCcw, Calendar,
  UserPlus, TrendingUp, FileWarning, XCircle, Settings, ChevronDown, Scale, UserX
} from 'lucide-vue-next'
import EndTenancyModal from './EndTenancyModal.vue'
import ProtectDepositModal from './ProtectDepositModal.vue'
import InitialMoniesModal from './InitialMoniesModal.vue'
import TenancyAgreementModal from './TenancyAgreementModal.vue'
import TenancyAgreementStatus from './TenancyAgreementStatus.vue'
import MoveInPackModal from './MoveInPackModal.vue'
import EditableTenantCard from './EditableTenantCard.vue'
import EditableGuarantorCard from './EditableGuarantorCard.vue'
import EditableField from './EditableField.vue'
import ChangeRentDueDateModal from './ChangeRentDueDateModal.vue'
import RequestMoveInTimeModal from './RequestMoveInTimeModal.vue'
import ReceiptRentDueDateChangeModal from './ReceiptRentDueDateChangeModal.vue'
import RegisterDepositWithTDSModal from './RegisterDepositWithTDSModal.vue'
import Section48GeneratorModal from './Section48GeneratorModal.vue'
import TenantChangeModal from './TenantChangeModal.vue'
import TenantChangeStatusTracker from './TenantChangeStatusTracker.vue'
import MoveOutNoticeModal from './MoveOutNoticeModal.vue'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  open: boolean
  tenancy: any | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
  action: [action: string, tenancy: any]
}>()

const toast = useToast()
const authStore = useAuthStore()
// State
const activeTab = ref<'overview' | 'tenants' | 'landlord' | 'property' | 'documents' | 'rent' | 'activity'>('overview')
const activating = ref(false)
const deletingTenancy = ref(false)
const showEndTenancyModal = ref(false)
const showProtectDepositModal = ref(false)
const showRegisterWithTDSModal = ref(false)
const showSection48Modal = ref(false)
const showMoveInPackModal = ref(false)
const showInitialMoniesModal = ref(false)
const showAgreementModal = ref(false)
const showSigningStatusModal = ref(false)
const showDrawerActions = ref(false)
const showMoveOutModal = ref(false)
const revertingToActive = ref(false)
const showChangeRentDueDateModal = ref(false)
const showMoveInTimeModal = ref(false)
const showReceiptRentDueDateChangeModal = ref(false)
const selectedRentDueDateChange = ref<any>(null)
const pendingRentDueDateChange = ref<any>(null)
const rentDueDateChanges = ref<any[]>([])
const loadingRentDueDateChanges = ref(false)
const resendingRentDueDateEmail = ref<string | null>(null)
const cancellingRentDueDateChange = ref<string | null>(null)

// Tenant Change state
const showTenantChangeModal = ref(false)
const activeTenantChange = ref<any>(null)
const loadingTenantChange = ref(false)

// Rent increase notices state
const rentIncreaseNotices = ref<any[]>([])
const loadingRentIncreaseNotices = ref(false)

// TDS Integration state
interface TDSConfigStatus {
  custodial: { configured: boolean; environment: string | null }
  insured: { configured: boolean; authorized: boolean; environment: string | null }
}
const tdsConfigStatus = ref<TDSConfigStatus | null>(null)
// TDS integration temporarily disabled for production launch
const hasTDSIntegration = computed(() => {
  return false // TODO: Re-enable when TDS integration is ready
  // if (!tdsConfigStatus.value) return false
  // return tdsConfigStatus.value.custodial.configured ||
  //   (tdsConfigStatus.value.insured.configured && tdsConfigStatus.value.insured.authorized)
})
const hasTDSCustodial = computed(() => tdsConfigStatus.value?.custodial.configured || false)
const hasTDSInsured = computed(() =>
  tdsConfigStatus.value?.insured.configured && tdsConfigStatus.value?.insured.authorized || false
)
const tdsRegistration = ref<any>(null)
const downloadingDPC = ref(false)
const showTDSSchemeMenu = ref(false)
const selectedTDSScheme = ref<'custodial' | 'insured'>('custodial')

// Notes and Activity state
const tenancyNotes = ref<any[]>([])
const tenancyActivity = ref<any[]>([])
const newNoteContent = ref('')
const addingNote = ref(false)
const loadingActivity = ref(false)
const activityFilter = ref<string>('all')

const landlordData = ref<any>(null)
const allLandlords = ref<any[]>([]) // All landlords linked to property
const agentSettings = ref<any>(null) // Company/agent settings including management info
const propertyDetails = ref<any>(null) // Full property details
const specialClauses = ref<string[]>([]) // From agreement (legacy)
const propertySpecialClauses = ref<string[]>([]) // From property
const guarantors = ref<any[]>([]) // From references
const tenancyGuarantors = ref<any[]>([]) // From tenancy_guarantors table
const complianceDocuments = ref<any[]>([])
const tenantAddressMap = ref<Map<string, any>>(new Map()) // Map of tenant name -> address from reference

// Add guarantor form state
const showAddGuarantorForm = ref(false)
const addingGuarantor = ref(false)
const newGuarantor = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  relationshipToTenant: ''
})

// Landlord search/link state
const landlordSearchQuery = ref('')
const landlordSearchResults = ref<any[]>([])
const searchingLandlords = ref(false)
const linkingLandlord = ref(false)
const showLandlordSearch = ref(false)
const fullTenancyData = ref<any>(null)

// Document upload state
const documentInput = ref<HTMLInputElement | null>(null)
const selectedDocument = ref<File | null>(null)
const documentTag = ref('other')
const uploadingDocument = ref(false)
const tenancyDocuments = ref<any[]>([])
const deletingDocumentId = ref<string | null>(null)

// Pre-tenancy action loading states
const confirmingMonies = ref(false)
const generatingAgreement = ref(false)
const confirmingMoveInTime = ref<string | null>(null)

// Agreement status state
const agreementData = ref<any>(null)
const agreementSigners = ref<any[]>([])
const loadingAgreementStatus = ref(false)
const sendingForSigning = ref(false)
const resendingSignature = ref<string | null>(null)
const recallingAgreement = ref(false)
const executingAgreement = ref(false)

// Add tenant state
const showAddTenantForm = ref(false)
const addingTenant = ref(false)
const newTenant = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  isLeadTenant: false
})

// Expose tenancy as a computed that prefers fullTenancyData (fresh API data) over props
// This allows the template to use {{ tenancy?.field }} and get the most up-to-date values
const tenancy = computed(() => fullTenancyData.value || props.tenancy)

// Get tenants - prefer fullTenancyData for most up-to-date values
const allTenants = computed(() => {
  // Always prefer fullTenancyData as it's fetched fresh on drawer open
  if (fullTenancyData.value?.tenants && fullTenancyData.value.tenants.length > 0) {
    return fullTenancyData.value.tenants
  }
  if (props.tenancy?.tenants && props.tenancy.tenants.length > 0) {
    return props.tenancy.tenants
  }
  return []
})

// Active tenants (status === 'active')
const tenants = computed(() => {
  return allTenants.value.filter((t: any) => t.status === 'active')
})

// Pending/future tenants (status === 'pending')
const pendingTenants = computed(() => {
  return allTenants.value.filter((t: any) => t.status === 'pending')
})

// Archived/removed tenants
const archivedTenants = computed(() => {
  return allTenants.value.filter((t: any) => t.status === 'removed' || t.status === 'replaced' || t.status === 'never_moved_in')
})

// State for showing archived tenants
const showArchivedTenants = ref(false)

// Reset tab when drawer opens
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    activeTab.value = 'overview'
    // Reset state
    landlordData.value = null
    propertyDetails.value = null
    specialClauses.value = []
    propertySpecialClauses.value = []
    complianceDocuments.value = []
    tenancyDocuments.value = []
    fullTenancyData.value = null
    // Reset agreement status state
    agreementData.value = null
    agreementSigners.value = []
    // Reset add tenant form
    showAddTenantForm.value = false
    newTenant.value = { firstName: '', lastName: '', email: '', phone: '', isLeadTenant: false }
    // Reset add guarantor form
    showAddGuarantorForm.value = false
    tenancyGuarantors.value = []
    newGuarantor.value = { firstName: '', lastName: '', email: '', phone: '', relationshipToTenant: '' }
    // Reset notes and activity
    tenancyNotes.value = []
    tenancyActivity.value = []
    newNoteContent.value = ''
    activityFilter.value = 'all'
    // Reset document upload state
    selectedDocument.value = null
    documentTag.value = 'other'
    // Reset rent due date changes state
    rentDueDateChanges.value = []
    selectedRentDueDateChange.value = null
    // Reset TDS state
    tdsRegistration.value = null
    tdsConfigStatus.value = null
    showTDSSchemeMenu.value = false
    showReceiptRentDueDateChangeModal.value = false
    // Reset tenant change state
    activeTenantChange.value = null
    showTenantChangeModal.value = false
    // Always load full tenancy data to ensure we have latest info
    await loadFullTenancyData()
    // Load additional data, agreement status, agent settings, guarantors, notes, activity, and rent changes in parallel
    await Promise.all([
      loadAdditionalData(),
      loadAgreementStatus(),
      loadAgentSettings(),
      loadTenancyGuarantors(),
      loadTenancyNotes(),
      loadTenancyActivity(),
      loadRentDueDateChanges(),
      loadRentIncreaseNotices(),
      loadTDSConfigStatus(),
      loadTDSRegistration(),
      loadActiveTenantChange()
    ])
  }
})

// Tabs
const tabs = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'tenants' as const, label: 'Tenants' },
  { key: 'landlord' as const, label: 'Landlord' },
  { key: 'property' as const, label: 'Property' },
  { key: 'documents' as const, label: 'Documents' },
  { key: 'rent' as const, label: 'Tenancy Changes' },
  { key: 'activity' as const, label: 'Activity' }
]

// Computed: Use fullTenancyData when available for most up-to-date values
const rentAmount = computed(() => tenancy.value?.monthly_rent || tenancy.value?.rent_amount || 0)
const startDate = computed(() => tenancy.value?.start_date || tenancy.value?.tenancy_start_date || null)
const endDate = computed(() => tenancy.value?.end_date || tenancy.value?.tenancy_end_date || null)

// Computed
const statusClass = computed(() => {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    active: 'bg-green-100 text-green-800',
    notice_given: 'bg-orange-100 text-orange-800',
    ended: 'bg-gray-100 text-gray-800',
    terminated: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600'
  }
  return classes[tenancy.value?.status] || 'bg-gray-100 text-gray-800'
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    notice_given: 'Notice Given',
    ended: 'Ended',
    terminated: 'Terminated',
    expired: 'Expired'
  }
  return labels[tenancy.value?.status] || tenancy.value?.status
})

const tenancyTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    ast: 'Assured Shorthold Tenancy',
    periodic: 'Periodic Tenancy',
    company_let: 'Company Let',
    lodger: 'Lodger Agreement',
    license: 'License to Occupy'
  }
  return labels[tenancy.value?.tenancy_type] || tenancy.value?.tenancy_type || 'AST'
})

const depositSchemeLabel = computed(() => {
  const labels: Record<string, string> = {
    dps: 'DPS',
    dps_custodial: 'DPS Custodial',
    dps_insured: 'DPS Insured',
    mydeposits: 'mydeposits',
    mydeposits_custodial: 'mydeposits Custodial',
    mydeposits_insured: 'mydeposits Insured',
    tds: 'TDS',
    tds_custodial: 'TDS Custodial',
    tds_insured: 'TDS Insured',
    custodial: 'Custodial',
    insured: 'Insured',
    reposit: 'Reposit',
    no_deposit: 'No Deposit'
  }
  const scheme = tenancy.value?.deposit_scheme
  if (!scheme) return 'Not set'
  // Return mapped label or format the raw value nicely
  return labels[scheme] || scheme.replace(/_/g, ' ').toUpperCase()
})

const managementTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    managed: 'Fully Managed',
    let_only: 'Let Only'
  }
  const value = tenancy.value?.management_type || tenancy.value?.property?.management_type
  return labels[value] || 'Not set'
})

const depositProtected = computed(() => !!tenancy.value?.deposit_protected_at)

const depositDisplay = computed(() => {
  if (!tenancy.value?.deposit_amount) return 'None'
  return `£${tenancy.value.deposit_amount.toLocaleString()}`
})

const canActivate = computed(() => tenancy.value?.status === 'pending')

// Is draft tenancy - allows inline editing
const isDraftTenancy = computed(() => tenancy.value?.status === 'pending')

// Tenancy type options for dropdown
const tenancyTypeOptions = [
  { value: 'ast', label: 'AST (Assured Shorthold)' },
  { value: 'periodic', label: 'Periodic' },
  { value: 'contractual_periodic', label: 'Contractual Periodic' },
  { value: 'non_housing_act', label: 'Non Housing Act' },
  { value: 'license', label: 'License to Occupy' }
]

// Deposit scheme options for dropdown
const depositSchemeOptions = [
  { value: 'dps', label: 'DPS' },
  { value: 'mydeposits', label: 'mydeposits' },
  { value: 'tds', label: 'TDS' }
]

// Management type options for dropdown
const managementTypeOptions = [
  { value: 'managed', label: 'Fully Managed' },
  { value: 'let_only', label: 'Let Only' }
]

// Helper to format ordinal numbers (1st, 2nd, 3rd, etc.)
const ordinal = (n: number): string => {
  if (n >= 11 && n <= 13) return n + 'th'
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

// Rent due day options (1-28)
const rentDueDayOptions = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: ordinal(i + 1)
}))

// Update a tenancy field
const updateTenancyField = async (field: string, value: any) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: value })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update')
    }

    toast.success('Updated successfully')
    await loadFullTenancyData()
    emit('updated')
  } catch (error: any) {
    console.error('Error updating tenancy field:', error)
    toast.error(error.message || 'Failed to update')
  }
}

// Pre-tenancy action computed properties
const hasTenantsWithEmail = computed(() => {
  const tenantsList = tenants.value || []
  return tenantsList.some((t: any) => t.email && t.status === 'active')
})

const leadTenant = computed(() => {
  const tenantsList = tenants.value || []
  // Find lead tenant or first tenant with email
  return tenantsList.find((t: any) => t.is_lead_tenant && t.email && t.status === 'active')
    || tenantsList.find((t: any) => t.email && t.status === 'active')
})

const leadTenantName = computed(() => {
  const tenant = leadTenant.value
  if (!tenant) return ''
  return `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim()
})

const leadTenantEmail = computed(() => {
  return leadTenant.value?.email || ''
})

const initialMoniesRequested = computed(() => !!tenancy.value?.initial_monies_requested_at)
const tenantConfirmedPayment = computed(() => !!tenancy.value?.initial_monies_tenant_confirmed_at && !tenancy.value?.initial_monies_paid_at)
const initialMoniesPaid = computed(() => !!tenancy.value?.initial_monies_paid_at)

const hasAgreement = computed(() => !!tenancy.value?.agreement_id)

// Property address computed
const propertyAddress = computed(() => {
  const prop = fullTenancyData.value?.property || props.tenancy?.property
  if (!prop) return ''
  return [prop.address_line1, prop.city, prop.postcode].filter(Boolean).join(', ')
})

// Move-in pack modal computed properties
const moveInPackPropertyAddress = computed(() => {
  const prop = fullTenancyData.value?.property || props.tenancy?.property
  if (!prop) return ''
  return [prop.address_line1, prop.city, prop.postcode].filter(Boolean).join(', ')
})

const moveInPackManagementType = computed(() => {
  return propertyDetails.value?.management_type || fullTenancyData.value?.property?.management_type || null
})

const moveInPackComplianceDocs = computed(() => {
  return complianceDocuments.value.map(doc => ({
    id: doc.id,
    type: doc.type,
    file_url: doc.documents?.[0]?.file_path || null,
    expiry_date: doc.expiryDate
  })).filter(doc => doc.file_url)
})

const moveInPackSignedAgreementUrl = computed(() => {
  // Show signed agreement for both fully_signed and executed statuses
  // signed_pdf_url is set when status becomes 'fully_signed'
  const status = agreementData.value?.signing_status
  if (status === 'fully_signed' || status === 'executed') {
    return agreementData.value.signed_pdf_url || agreementData.value.pdf_url || null
  }
  return null
})

const moveInPackLandlordName = computed(() => landlordData.value?.name || 'Landlord')
const moveInPackLandlordPhone = computed(() => landlordData.value?.phone || null)
const moveInPackLandlordEmail = computed(() => landlordData.value?.email || null)

const moveInPackLandlordBankDetails = computed(() => {
  const landlord = allLandlords.value.find((l: any) => l.is_primary_contact) || allLandlords.value[0]
  return {
    accountName: landlord?.bank_account_name || '',
    sortCode: landlord?.bank_sort_code || '',
    accountNumber: landlord?.bank_account_number || ''
  }
})

const moveInPackAgentBankDetails = computed(() => ({
  accountName: agentSettings.value?.bank_account_name || '',
  sortCode: agentSettings.value?.bank_sort_code || '',
  accountNumber: agentSettings.value?.bank_account_number || ''
}))

const moveInPackManagementInfo = computed(() => agentSettings.value?.management_info || null)

// Agreement status label for Quick Actions button
const agreementStatusLabel = computed(() => {
  if (!agreementData.value) return 'Agreement created'
  switch (agreementData.value.signing_status) {
    case 'draft':
      return 'Ready to send'
    case 'sent':
    case 'pending_signatures':
      return 'Sent for signing'
    case 'partially_signed':
      return 'Partially signed'
    case 'fully_signed':
      return 'Fully signed'
    case 'executed':
      return 'Executed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Agreement created'
  }
})

const agreementStatusLabelClass = computed(() => {
  if (!agreementData.value) return 'text-green-600'
  switch (agreementData.value.signing_status) {
    case 'draft':
      return 'text-gray-600'
    case 'sent':
    case 'pending_signatures':
      return 'text-blue-600'
    case 'partially_signed':
      return 'text-amber-600'
    case 'fully_signed':
    case 'executed':
      return 'text-green-600'
    case 'cancelled':
      return 'text-red-600'
    default:
      return 'text-green-600'
  }
})

const compliancePackSent = computed(() => !!tenancy.value?.compliance_pack_sent_at)

const moveInTimeRequested = computed(() => !!tenancy.value?.move_in_time_requested_at)
const moveInTimeSubmitted = computed(() => !!tenancy.value?.move_in_time_submitted_at)
const moveInTimeConfirmed = computed(() => !!tenancy.value?.move_in_time_confirmed)

// Methods

// Always load full tenancy data from API to ensure we have the latest
const loadFullTenancyData = async () => {
  if (!props.tenancy?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const tenancyResponse = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (tenancyResponse.ok) {
      const data = await tenancyResponse.json()
      if (data.tenancy) {
        fullTenancyData.value = data.tenancy
        console.log('[TenancyDrawer] Loaded full tenancy data:', {
          id: data.tenancy.id,
          property_id: data.tenancy.property_id,
          tenants_count: data.tenancy.tenants?.length || 0,
          start_date: data.tenancy.start_date,
          end_date: data.tenancy.end_date
        })
      }
    } else {
      console.error('[TenancyDrawer] Failed to load tenancy:', tenancyResponse.status)
    }
  } catch (error) {
    console.error('[TenancyDrawer] Error loading full tenancy data:', error)
  }
}

// Load agent/company settings (for move-in pack management info)
const loadAgentSettings = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/company/settings`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      agentSettings.value = data.company || data
    }
  } catch (error) {
    console.error('[TenancyDrawer] Error loading agent settings:', error)
  }
}

// Load TDS integration status
const loadTDSConfigStatus = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(
      `${API_URL}/api/tds/config-status`,
      { headers }
    )

    if (response.ok) {
      const data = await response.json()
      tdsConfigStatus.value = {
        custodial: data.custodial || { configured: false, environment: null },
        insured: data.insured || { configured: false, authorized: false, environment: null }
      }
    }
  } catch (error) {
    console.error('[TenancyDrawer] Error loading TDS config status:', error)
  }
}

// Load TDS registration for this tenancy
const loadTDSRegistration = async () => {
  if (!props.tenancy?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(
      `${API_URL}/api/tds/registration/${props.tenancy.id}`,
      { headers }
    )

    if (response.ok) {
      const data = await response.json()
      tdsRegistration.value = data.registration
    }
  } catch (error) {
    console.error('[TenancyDrawer] Error loading TDS registration:', error)
  }
}

// Download TDS certificate (DPC for Custodial, Certificate for Insured)
const downloadTDSDPC = async () => {
  if (!tdsRegistration.value?.dan) return

  downloadingDPC.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Use unified certificate endpoint that auto-detects scheme
    const response = await fetch(
      `${API_URL}/api/tds/certificate/${tdsRegistration.value.dan}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (!response.ok) {
      throw new Error('Failed to download certificate')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const schemeType = tdsRegistration.value.schemeType || 'custodial'
    a.download = `${schemeType === 'insured' ? 'Certificate' : 'DPC'}-${tdsRegistration.value.dan}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Certificate downloaded')
  } catch (error: any) {
    console.error('[TenancyDrawer] Error downloading DPC:', error)
    toast.error(error.message || 'Failed to download certificate')
  } finally {
    downloadingDPC.value = false
  }
}

// Handle TDS registration completed
const handleTDSRegistered = async (_dan: string) => {
  showRegisterWithTDSModal.value = false
  await loadTDSRegistration()
  await loadFullTenancyData()
  emit('updated')
}

const handleTDSPending = async (_batchId: string) => {
  showRegisterWithTDSModal.value = false
  // Reload to show pending status
  await loadTDSRegistration()
  emit('updated')
}

// Handle Section 48 notice generated
const handleSection48Generated = async (_noticeId: string) => {
  showSection48Modal.value = false
  // Reload activity log to show the new entry
  await loadTenancyActivity()
  emit('updated')
}

const loadAdditionalData = async () => {
  // Use property_id from fullTenancyData or props.tenancy
  const propertyId = fullTenancyData.value?.property_id || props.tenancy?.property_id
  if (!propertyId) {
    console.warn('[TenancyDrawer] No property_id found, skipping additional data load')
    return
  }

  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Load property data (includes landlords, compliance, special clauses)
    const propertyResponse = await fetch(
      `${API_URL}/api/properties/${propertyId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (propertyResponse.ok) {
      const data = await propertyResponse.json()
      const landlords = data.landlords || []
      const compliance = data.compliance || []

      console.log('[TenancyDrawer] Loaded property data:', {
        landlords_count: landlords.length,
        compliance_count: compliance.length
      })

      // Store full property details for the Property tab
      propertyDetails.value = data.property || null

      // Store special clauses from property
      propertySpecialClauses.value = data.property?.special_clauses || []

      // Store all landlords for the Landlord tab
      allLandlords.value = landlords

      // Extract primary landlord data for quick reference
      if (landlords.length > 0) {
        const primaryLandlord = landlords.find((l: any) => l.is_primary_contact) || landlords[0]
        landlordData.value = {
          name: primaryLandlord.name || 'Unknown',
          email: primaryLandlord.email,
          phone: primaryLandlord.phone,
          address: [
            primaryLandlord.address_line1,
            primaryLandlord.city,
            primaryLandlord.postcode
          ].filter(Boolean).join(', ') || null,
          ownershipPercentage: primaryLandlord.ownership_percentage
        }
      }

      // Extract compliance documents for the Documents tab
      complianceDocuments.value = compliance.map((c: any) => ({
        id: c.id,
        complianceId: c.id, // For document URL generation
        type: c.compliance_type,
        customType: c.custom_type_name,
        issueDate: c.issue_date,
        expiryDate: c.expiry_date,
        status: c.status,
        certificateNumber: c.certificate_number,
        issuerName: c.issuer_name,
        documents: c.documents || []
      }))

      // Load tenancy-specific documents
      await loadTenancyDocuments()
    }

    // Load special clauses from agreement if there's an agreement_id
    const agreementId = fullTenancyData.value?.agreement_id || props.tenancy?.agreement_id
    if (agreementId) {
      try {
        const agreementResponse = await fetch(
          `${API_URL}/api/agreements/${agreementId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (agreementResponse.ok) {
          const data = await agreementResponse.json()
          const agreement = data.agreement
          if (agreement?.special_clauses) {
            if (Array.isArray(agreement.special_clauses)) {
              specialClauses.value = agreement.special_clauses
            } else if (typeof agreement.special_clauses === 'string') {
              specialClauses.value = agreement.special_clauses.split('\n').filter(Boolean)
            }
          }
        }
      } catch (err) {
        console.error('Error loading agreement:', err)
      }
    } else {
      specialClauses.value = []
    }

    // Load guarantors and tenant addresses from reference data
    const referenceId = fullTenancyData.value?.primary_reference_id || props.tenancy?.primary_reference_id
    console.log('[TenancyDrawer] Looking for reference ID:', referenceId, 'from fullTenancyData:', fullTenancyData.value?.primary_reference_id, 'or props:', props.tenancy?.primary_reference_id)
    if (referenceId) {
      try {
        const refResponse = await fetch(
          `${API_URL}/api/references/${referenceId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (refResponse.ok) {
          const refData = await refResponse.json()

          // Extract tenant addresses from reference data
          const addressMap = new Map<string, any>()

          // Helper to extract address from a reference
          const extractAddress = (ref: any) => ({
            line1: ref.current_address_line1 || '',
            line2: ref.current_address_line2 || '',
            city: ref.current_city || '',
            postcode: ref.current_postcode || ''
          })

          // Main reference tenant address
          if (refData.reference) {
            const ref = refData.reference
            const name = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim()
            console.log('[TenancyDrawer] Main ref tenant:', name, 'address:', ref.current_address_line1, ref.current_city, ref.current_postcode)
            if (name && (ref.current_address_line1 || ref.current_city || ref.current_postcode)) {
              addressMap.set(name.toLowerCase(), extractAddress(ref))
            }
          }

          // Child references (multi-tenant)
          if (refData.childReferences && refData.childReferences.length > 0) {
            refData.childReferences.forEach((child: any) => {
              if (!child.is_guarantor) {
                const name = `${child.tenant_first_name || ''} ${child.tenant_last_name || ''}`.trim()
                if (name && (child.current_address_line1 || child.current_city || child.current_postcode)) {
                  addressMap.set(name.toLowerCase(), extractAddress(child))
                }
              }
            })
          }

          tenantAddressMap.value = addressMap
          console.log('[TenancyDrawer] Loaded tenant addresses from reference:', addressMap.size)

          // Guarantors can come from multiple places:
          // 1. guarantorReferences array (new system - for standalone references)
          // 2. childReferences with is_guarantor=true (group tenancies)
          // 3. Each child reference's guarantors array

          const allGuarantors: any[] = []

          // Check guarantorReferences (new system)
          if (refData.guarantorReferences && refData.guarantorReferences.length > 0) {
            refData.guarantorReferences.forEach((g: any) => {
              const guarantorEmail = g.email || g.tenant_email || g.guarantor_email || ''
              console.log('[TenancyDrawer] Guarantor data:', {
                id: g.id,
                first_name: g.first_name || g.tenant_first_name,
                last_name: g.last_name || g.tenant_last_name,
                email: guarantorEmail,
                raw_email_fields: { email: g.email, tenant_email: g.tenant_email, guarantor_email: g.guarantor_email }
              })
              allGuarantors.push({
                id: g.id,
                first_name: g.first_name || g.tenant_first_name || '',
                last_name: g.last_name || g.tenant_last_name || '',
                email: guarantorEmail,
                phone: g.contact_number || g.tenant_phone || '',
                relationship: g.relationship_to_tenant || '',
                guarantor_for_reference_id: g.guarantor_for_reference_id,
                // Include address for guarantors too
                current_address_line1: g.current_address_line1 || '',
                current_address_line2: g.current_address_line2 || '',
                current_city: g.current_city || '',
                current_postcode: g.current_postcode || ''
              })
            })
          }

          // Check childReferences for guarantors (group tenancies)
          if (refData.childReferences && refData.childReferences.length > 0) {
            refData.childReferences.forEach((child: any) => {
              // Child might have a guarantors array
              if (child.guarantors && child.guarantors.length > 0) {
                child.guarantors.forEach((g: any) => {
                  const guarantorEmail = g.email || g.tenant_email || g.guarantor_email || ''
                  console.log('[TenancyDrawer] Guarantor from child ref:', {
                    id: g.id,
                    child_id: child.id,
                    first_name: g.first_name || g.tenant_first_name,
                    last_name: g.last_name || g.tenant_last_name,
                    email: guarantorEmail,
                    raw_email_fields: { email: g.email, tenant_email: g.tenant_email, guarantor_email: g.guarantor_email }
                  })
                  allGuarantors.push({
                    id: g.id,
                    first_name: g.first_name || g.tenant_first_name || '',
                    last_name: g.last_name || g.tenant_last_name || '',
                    email: guarantorEmail,
                    phone: g.contact_number || g.tenant_phone || '',
                    relationship: g.relationship_to_tenant || '',
                    guarantor_for_reference_id: g.guarantor_for_reference_id || child.id,
                    // Include address for guarantors too
                    current_address_line1: g.current_address_line1 || '',
                    current_address_line2: g.current_address_line2 || '',
                    current_city: g.current_city || '',
                    current_postcode: g.current_postcode || ''
                  })
                })
              }
            })
          }

          guarantors.value = allGuarantors
          console.log('[TenancyDrawer] Loaded guarantors:', allGuarantors.length, 'with emails:', allGuarantors.map(g => ({ name: `${g.first_name} ${g.last_name}`, email: g.email || 'MISSING' })))
        }
      } catch (err) {
        console.error('[TenancyDrawer] Error loading reference data:', err)
      }
    } else {
      // No primary_reference_id - try to fetch addresses from individual tenant reference_ids
      const tenants = fullTenancyData.value?.tenants || []
      const addressMap = new Map<string, any>()
      const allGuarantors: any[] = []

      for (const tenant of tenants) {
        if (tenant.reference_id) {
          try {
            const refResponse = await fetch(
              `${API_URL}/api/references/${tenant.reference_id}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            )
            if (refResponse.ok) {
              const refData = await refResponse.json()
              if (refData.reference) {
                const ref = refData.reference
                const name = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim()
                console.log('[TenancyDrawer] Tenant ref:', name, 'address:', ref.current_address_line1, ref.current_city, ref.current_postcode)
                if (name && (ref.current_address_line1 || ref.current_city || ref.current_postcode)) {
                  addressMap.set(name.toLowerCase(), {
                    line1: ref.current_address_line1 || '',
                    line2: ref.current_address_line2 || '',
                    city: ref.current_city || '',
                    postcode: ref.current_postcode || ''
                  })
                }
                // Also check for guarantors on this reference
                if (refData.guarantorReferences && refData.guarantorReferences.length > 0) {
                  refData.guarantorReferences.forEach((g: any) => {
                    const guarantorEmail = g.email || g.tenant_email || g.guarantor_email || ''
                    console.log('[TenancyDrawer] Guarantor from individual ref:', {
                      id: g.id,
                      first_name: g.tenant_first_name,
                      last_name: g.tenant_last_name,
                      email: guarantorEmail,
                      raw_email_fields: { email: g.email, tenant_email: g.tenant_email, guarantor_email: g.guarantor_email }
                    })
                    allGuarantors.push({
                      id: g.id,
                      first_name: g.tenant_first_name || '',
                      last_name: g.tenant_last_name || '',
                      email: guarantorEmail,
                      current_address_line1: g.current_address_line1 || '',
                      current_city: g.current_city || '',
                      current_postcode: g.current_postcode || ''
                    })
                  })
                }
              }
            }
          } catch (err) {
            console.error('[TenancyDrawer] Error loading tenant reference:', tenant.reference_id, err)
          }
        }
      }

      tenantAddressMap.value = addressMap
      guarantors.value = allGuarantors
      console.log('[TenancyDrawer] Loaded tenant addresses from individual refs:', addressMap.size)
    }
  } catch (error) {
    console.error('Error loading additional data:', error)
  }
}

// Load agreement status and signatures
const loadAgreementStatus = async () => {
  const agreementId = fullTenancyData.value?.agreement_id || props.tenancy?.agreement_id
  if (!agreementId) {
    agreementData.value = null
    agreementSigners.value = []
    return
  }

  loadingAgreementStatus.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Fetch agreement details
    const agreementResponse = await fetch(
      `${API_URL}/api/agreements/${agreementId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (agreementResponse.ok) {
      const data = await agreementResponse.json()
      agreementData.value = data.agreement
    }

    // Fetch signing status if agreement exists and not in draft
    if (agreementData.value?.signing_status && agreementData.value.signing_status !== 'draft') {
      const signingResponse = await fetch(
        `${API_URL}/api/signing/agreements/${agreementId}/signing-status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if (signingResponse.ok) {
        const signingData = await signingResponse.json()
        // Map signedAt to signed_at for consistency
        agreementSigners.value = (signingData.signers || []).map((s: any) => ({
          ...s,
          signed_at: s.signedAt || s.signed_at
        }))
      }
    } else {
      agreementSigners.value = []
    }
  } catch (err) {
    console.error('[TenancyDrawer] Error loading agreement status:', err)
  } finally {
    loadingAgreementStatus.value = false
  }
}

// Agreement action handlers
const handleSendForSigning = async () => {
  const agreementId = agreementData.value?.id
  if (!agreementId) return

  sendingForSigning.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/agreements/${agreementId}/send-for-signing`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send for signing')
    }

    toast.success('Agreement sent for signing')
    await loadAgreementStatus()
    emit('updated')
  } catch (error: any) {
    console.error('Error sending for signing:', error)
    toast.error(error.message || 'Failed to send for signing')
  } finally {
    sendingForSigning.value = false
  }
}

const handleResendSignature = async (signature: any) => {
  const agreementId = agreementData.value?.id
  if (!agreementId || !signature?.id) return

  resendingSignature.value = signature.id
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/signing/agreements/${agreementId}/send-reminder/${signature.id}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resend')
    }

    toast.success(`Reminder sent to ${signature.signer_name}`)
    // Refresh status to show updated sent times
    await loadAgreementStatus()
  } catch (error: any) {
    console.error('Error resending signature:', error)
    toast.error(error.message || 'Failed to resend')
  } finally {
    resendingSignature.value = null
  }
}

const handleResendAll = async () => {
  const agreementId = agreementData.value?.id
  if (!agreementId) return

  resendingSignature.value = 'all'
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/signing/agreements/${agreementId}/resend-all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resend')
    }

    toast.success('Reminders sent to all unsigned parties')
    // Refresh status to show updated sent times
    await loadAgreementStatus()
  } catch (error: any) {
    console.error('Error resending all:', error)
    toast.error(error.message || 'Failed to resend')
  } finally {
    resendingSignature.value = null
  }
}

const handleRecallAgreement = async () => {
  const agreementId = agreementData.value?.id
  if (!agreementId) return

  recallingAgreement.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/signing/agreements/${agreementId}/cancel-signing?revertToDraft=true`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to recall')
    }

    toast.success('Agreement recalled - opening editor')
    await loadAgreementStatus()
    emit('updated')
    // Open the edit modal so user can modify and regenerate
    showAgreementModal.value = true
  } catch (error: any) {
    console.error('Error recalling agreement:', error)
    toast.error(error.message || 'Failed to recall agreement')
  } finally {
    recallingAgreement.value = false
  }
}

const handleExecuteAgreement = async () => {
  const agreementId = agreementData.value?.id
  if (!agreementId) return

  executingAgreement.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/agreements/${agreementId}/execute`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to execute')
    }

    toast.success('Agreement executed successfully')
    await loadAgreementStatus()
    emit('updated')
  } catch (error: any) {
    console.error('Error executing agreement:', error)
    toast.error(error.message || 'Failed to execute agreement')
  } finally {
    executingAgreement.value = false
  }
}

// Drawer actions handler for active tenancies
const handleDrawerAction = (action: string) => {
  showDrawerActions.value = false
  const toast = useToast()

  switch (action) {
    case 'change-rent-date':
      showChangeRentDueDateModal.value = true
      break
    case 'change-tenant':
      showTenantChangeModal.value = true
      break
    case 'rent-increase':
      emit('action', 'rent-increase', tenancy.value)
      break
    case 'section-8':
      emit('action', 'section-8', tenancy.value)
      break
    case 'section-48':
      showSection48Modal.value = true
      showDrawerActions.value = false
      break
    case 'end-tenancy':
      emit('action', 'end-tenancy', tenancy.value)
      break
    case 'email-tenants':
      emit('action', 'email-tenants', tenancy.value)
      break
    case 'revert-to-draft':
      emit('action', 'revert-to-draft', tenancy.value)
      break
    case 'delete':
      // Only allow deleting draft tenancies
      if (tenancy.value?.status !== 'pending') {
        toast.error('Only draft tenancies can be deleted. End the tenancy first.')
        return
      }
      confirmDeleteTenancy()
      break
  }
}

// Handle successful rent due date change initiation
const handleRentDueDateChangeSuccess = (change: any) => {
  const toast = useToast()
  toast.success('Payment request sent to lead tenant')
  pendingRentDueDateChange.value = change

  // Refresh changes list
  loadRentDueDateChanges()
  // Refresh activity
  loadTenancyActivity()
  emit('updated')
}

// Load rent due date changes for this tenancy
const loadRentDueDateChanges = async () => {
  // Use props.tenancy.id as fallback in case computed tenancy isn't ready yet
  const tenancyId = tenancy.value?.id || props.tenancy?.id
  if (!tenancyId) {
    console.warn('[loadRentDueDateChanges] No tenancy ID available')
    return
  }

  loadingRentDueDateChanges.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      console.warn('[loadRentDueDateChanges] No auth token')
      return
    }

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancyId}/rent-due-date-changes`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      console.log('[loadRentDueDateChanges] Loaded changes:', data.changes?.length || 0)
      rentDueDateChanges.value = data.changes || []
    } else {
      console.error('[loadRentDueDateChanges] API error:', response.status)
    }
  } catch (error) {
    console.error('Error loading rent due date changes:', error)
  } finally {
    loadingRentDueDateChanges.value = false
  }
}

// Pending rent increase info
const pendingRentIncrease = ref<{
  noticeId: string
  newRent: number
  effectiveDate: string
  currentRent: number
} | null>(null)

// Load active tenant change for this tenancy
const loadActiveTenantChange = async () => {
  const tenancyId = tenancy.value?.id || props.tenancy?.id
  if (!tenancyId) return

  loadingTenantChange.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenant-change/tenancy/${tenancyId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      activeTenantChange.value = data.tenantChange || null
    } else if (response.status === 404) {
      // No active tenant change - this is normal
      activeTenantChange.value = null
    }
  } catch (error) {
    console.error('Error loading active tenant change:', error)
    activeTenantChange.value = null
  } finally {
    loadingTenantChange.value = false
  }
}

// Handle tenant change modal close
const handleTenantChangeClose = () => {
  showTenantChangeModal.value = false
}

// Handle tenant change complete/updated
const handleTenantChangeUpdate = () => {
  // Reload tenancy data and tenant change status
  loadFullTenancyData()
  loadActiveTenantChange()
  loadTenancyActivity()
  emit('updated')
}

// Load rent increase notices
const loadRentIncreaseNotices = async () => {
  const tenancyId = tenancy.value?.id || props.tenancy?.id
  if (!tenancyId) return

  loadingRentIncreaseNotices.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancyId}/rent-increase-notices`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      rentIncreaseNotices.value = data.notices || []
      pendingRentIncrease.value = data.pendingIncrease || null
    }
  } catch (error) {
    console.error('Error loading rent increase notices:', error)
  } finally {
    loadingRentIncreaseNotices.value = false
  }
}

// Resend rent due date change email
const resendRentDueDateEmail = async (change: any) => {
  resendingRentDueDateEmail.value = change.id
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/rent-due-date-change/${change.id}/resend`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to resend')
    }

    toast.success('Payment request email resent')
    loadRentDueDateChanges()
  } catch (error: any) {
    console.error('Error resending email:', error)
    toast.error(error.message || 'Failed to resend email')
  } finally {
    resendingRentDueDateEmail.value = null
  }
}

// Cancel rent due date change
const cancelRentDueDateChange = async (change: any) => {
  if (!confirm('Are you sure you want to cancel this rent due date change request?')) return

  cancellingRentDueDateChange.value = change.id
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/rent-due-date-change/${change.id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Cancelled by agent' })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to cancel')
    }

    toast.success('Change request cancelled')
    loadRentDueDateChanges()
    loadTenancyActivity()
  } catch (error: any) {
    console.error('Error cancelling change:', error)
    toast.error(error.message || 'Failed to cancel')
  } finally {
    cancellingRentDueDateChange.value = null
  }
}

// Open receipt modal
const openReceiptModal = (change: any) => {
  selectedRentDueDateChange.value = change
  showReceiptRentDueDateChangeModal.value = true
}

// Handle rent due date change activated (after receipting payment)
const handleRentDueDateChangeActivated = async () => {
  // Refresh all data
  await loadFullTenancyData()
  loadRentDueDateChanges()
  loadTenancyActivity()
  emit('updated')
}

// Status label helper
const rentDueDateChangeStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending_payment: 'Awaiting Payment',
    payment_confirmed: 'Payment Confirmed',
    activated: 'Completed',
    cancelled: 'Cancelled'
  }
  return labels[status] || status
}

// Format effective date helper
const formatEffectiveDate = (change: any): string => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${ordinal(change.new_due_day)} ${monthNames[change.effective_month - 1]} ${change.effective_year}`
}

const handleMoveInTimeRequestSuccess = async () => {
  // Reload tenancy data to show updated state
  await loadFullTenancyData()
  emit('updated')
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const formatAmlStatus = (status: string | null | undefined): string => {
  const statusMap: Record<string, string> = {
    'satisfactory': 'Verified',
    'passed': 'Verified',
    'unsatisfactory': 'Failed',
    'failed': 'Failed',
    'requested': 'Requested',
    'pending': 'Pending',
    'submitted': 'Submitted',
    'not_requested': 'Not Requested'
  }
  return statusMap[status || ''] || 'Not Requested'
}

const formatComplianceType = (type: string): string => {
  const labels: Record<string, string> = {
    gas_safety: 'Gas Safety Certificate',
    epc: 'Energy Performance Certificate',
    eicr: 'EICR (Electrical Safety)',
    fire_safety: 'Fire Safety',
    legionella: 'Legionella Risk Assessment',
    smoke_alarm: 'Smoke & CO Alarms',
    pat_testing: 'PAT Testing',
    hmo_license: 'HMO License',
    selective_license: 'Selective Licensing',
    right_to_rent: 'Right to Rent Check',
    inventory: 'Inventory',
    deposit_protection: 'Deposit Protection',
    how_to_rent: 'How to Rent Guide',
    other: 'Other'
  }
  return labels[type] || type
}

// Landlord search function - searches ALL pages
const searchLandlords = async () => {
  const query = landlordSearchQuery.value.trim()
  if (query.length < 2 && query.length > 0) return

  searchingLandlords.value = true
  landlordSearchResults.value = []

  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Fetch all landlords (paginate through all pages)
    let allResults: any[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const response = await fetch(
        `${API_URL}/api/landlords?page=${page}&limit=${limit}${query ? `&search=${encodeURIComponent(query)}` : ''}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        const landlords = data.landlords || []
        allResults = [...allResults, ...landlords]
        hasMore = landlords.length === limit
        page++
      } else {
        hasMore = false
      }
    }

    landlordSearchResults.value = allResults
  } catch (err) {
    console.error('[TenancyDrawer] Error searching landlords:', err)
  } finally {
    searchingLandlords.value = false
  }
}

// Link a landlord to the property
const linkLandlordToProperty = async (landlord: any) => {
  if (!tenancy.value?.property_id) return

  linkingLandlord.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Add landlord to property
    const response = await fetch(
      `${API_URL}/api/properties/${tenancy.value.property_id}/landlords`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          landlords: [...allLandlords.value, {
            ...landlord,
            is_primary_contact: allLandlords.value.length === 0
          }]
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to link landlord')
    }

    // Reload additional data to refresh landlords
    await loadAdditionalData()
    showLandlordSearch.value = false
    landlordSearchQuery.value = ''
    landlordSearchResults.value = []
  } catch (err: any) {
    console.error('[TenancyDrawer] Error linking landlord:', err)
    alert(err.message || 'Failed to link landlord')
  } finally {
    linkingLandlord.value = false
  }
}

// Document handling
const triggerDocumentSelect = () => {
  documentInput.value?.click()
}

const handleDocumentSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedDocument.value = file
  }
}

const uploadDocument = async () => {
  if (!selectedDocument.value || !tenancy.value?.property_id) return

  uploadingDocument.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const formData = new FormData()
    formData.append('document', selectedDocument.value)
    formData.append('tag', documentTag.value)
    formData.append('source_type', 'tenancy')
    formData.append('source_id', tenancy.value.id)

    const response = await fetch(
      `${API_URL}/api/properties/${tenancy.value.property_id}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to upload document')
    }

    toast.success('Document uploaded successfully')
    selectedDocument.value = null
    documentTag.value = 'other'
    // Reload documents
    await loadTenancyDocuments()
  } catch (err: any) {
    console.error('[TenancyDrawer] Error uploading document:', err)
    toast.error(err.message || 'Failed to upload document')
  } finally {
    uploadingDocument.value = false
  }
}

const deleteDocument = async (documentId: string) => {
  if (!tenancy.value?.property_id) return

  deletingDocumentId.value = documentId
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/properties/${tenancy.value.property_id}/documents/${documentId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to delete document')
    }

    toast.success('Document removed')
    // Reload documents
    await loadTenancyDocuments()
  } catch (err: any) {
    console.error('[TenancyDrawer] Error deleting document:', err)
    toast.error(err.message || 'Failed to delete document')
  } finally {
    deletingDocumentId.value = null
  }
}

const loadTenancyDocuments = async () => {
  const propertyId = fullTenancyData.value?.property_id || props.tenancy?.property_id
  if (!propertyId) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Get all property documents
    const response = await fetch(
      `${API_URL}/api/properties/${propertyId}/documents`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      const tenancyId = fullTenancyData.value?.id || props.tenancy?.id
      // Filter to only show documents linked to this tenancy
      tenancyDocuments.value = (data.documents || []).filter((doc: any) =>
        doc.source_type === 'tenancy' && doc.source_id === tenancyId
      )
    }
  } catch (err) {
    console.error('[TenancyDrawer] Error loading tenancy documents:', err)
  }
}

const getPropertyDocumentDownloadUrl = (documentId: string): string => {
  const propertyId = tenancy.value?.property_id
  if (!propertyId) return '#'
  const token = authStore.session?.access_token
  const baseUrl = `${API_URL}/api/properties/${propertyId}/documents/${documentId}/download`
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
}

const getComplianceDocumentUrl = (complianceId: string, documentId: string): string => {
  const propertyId = tenancy.value?.property_id
  if (!propertyId) return '#'
  const token = authStore.session?.access_token
  const baseUrl = `${API_URL}/api/properties/${propertyId}/compliance/${complianceId}/document/${documentId}`
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
}

const formatDocumentTag = (tag: string): string => {
  const labels: Record<string, string> = {
    agreement: 'Agreement',
    inventory: 'Inventory',
    reference: 'Reference',
    gas: 'Gas Safety',
    epc: 'EPC',
    rent_notice: 'Rent Notice',
    other: 'General'
  }
  return labels[tag] || tag
}

const activateTenancy = async () => {
  if (!tenancy.value?.id) return

  activating.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/activate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to activate tenancy')
    }

    toast.success('Tenancy activated successfully')
    emit('updated')
    emit('update:open', false)
  } catch (error: any) {
    console.error('Error activating tenancy:', error)
    toast.error(error.message || 'Failed to activate tenancy')
  } finally {
    activating.value = false
  }
}

// Revert notice_given tenancy to active
const revertToActive = async () => {
  if (!tenancy.value?.id) return

  const confirmed = window.confirm(
    'Are you sure you want to cancel the notice and revert this tenancy to active status?'
  )
  if (!confirmed) return

  revertingToActive.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/revert-to-active`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to revert tenancy')
    }

    toast.success('Tenancy reverted to active status')
    emit('updated')
  } catch (error: any) {
    console.error('Error reverting tenancy:', error)
    toast.error(error.message || 'Failed to revert tenancy')
  } finally {
    revertingToActive.value = false
  }
}

// Handle move-out notice sent
const handleMoveOutNoticeSent = (result: any) => {
  const count = result.emailsSent?.length || 0
  toast.success(`Move-out notice sent to ${count} tenant(s)`)
  emit('updated')
}

// Delete pending tenancy
const confirmDeleteTenancy = async () => {
  if (!tenancy.value?.id) return

  const confirmed = window.confirm(
    'Are you sure you want to delete this pending tenancy? This action cannot be undone.'
  )
  if (!confirmed) return

  deletingTenancy.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete tenancy')
    }

    toast.success('Tenancy deleted successfully')
    emit('updated')
    emit('update:open', false)
  } catch (error: any) {
    console.error('Error deleting tenancy:', error)
    toast.error(error.message || 'Failed to delete tenancy')
  } finally {
    deletingTenancy.value = false
  }
}

const confirmInitialMonies = async () => {
  if (!tenancy.value?.id) return

  confirmingMonies.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/confirm-initial-monies`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to confirm payment')
    }

    toast.success('Payment confirmed')
    emit('updated')
  } catch (error: any) {
    console.error('Error confirming initial monies:', error)
    toast.error(error.message || 'Failed to confirm payment')
  } finally {
    confirmingMonies.value = false
  }
}

const generateAgreement = () => {
  const currentData = tenancy.value
  if (!currentData) return

  // Open the agreement modal
  showAgreementModal.value = true
}

// Scroll to the Agreement Status section in the drawer
const scrollToAgreementStatus = () => {
  // Switch to overview tab first if not already there
  activeTab.value = 'overview'
  // Give Vue time to render the tab, then scroll
  setTimeout(() => {
    const agreementSection = document.querySelector('[data-section="agreement-status"]')
    if (agreementSection) {
      agreementSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, 100)
}

// Download the signed agreement PDF
const downloadSignedAgreement = () => {
  if (!agreementData.value) return

  const status = agreementData.value.signing_status
  const signedPdfUrl = agreementData.value.signed_pdf_url
  const unsignedPdfUrl = agreementData.value.pdf_url

  // For fully_signed or executed agreements, we should have a signed PDF
  if (status === 'fully_signed' || status === 'executed') {
    if (signedPdfUrl) {
      window.open(signedPdfUrl, '_blank')
    } else if (unsignedPdfUrl) {
      // Fallback to unsigned PDF with warning
      console.warn('[Agreement] Signed PDF not available for executed agreement, falling back to unsigned PDF')
      toast.info('Signed PDF not available, downloading unsigned version')
      window.open(unsignedPdfUrl, '_blank')
    } else {
      toast.error('No PDF available for download')
    }
  } else {
    // For draft/sent/pending states, use the unsigned PDF
    if (unsignedPdfUrl) {
      window.open(unsignedPdfUrl, '_blank')
    } else {
      toast.error('No PDF available for download')
    }
  }
}

// Handle agreement generated event
const handleAgreementGenerated = async (_agreement: any) => {
  // Refresh tenancy data to get the linked agreement
  await loadFullTenancyData()
  // Load the agreement status to show the new agreement
  await loadAgreementStatus()
  emit('updated')
}

// Handle agreement sent for signing
const handleAgreementSent = async () => {
  // Refresh tenancy data
  await loadFullTenancyData()
  // Refresh agreement status to show updated signing state
  await loadAgreementStatus()
  emit('updated')
}

// Handle move-in pack sent event
const handleMoveInPackSent = async () => {
  // Refresh tenancy data to update compliance_pack_sent_at
  await loadFullTenancyData()
  emit('updated')
}

const confirmMoveInTime = async (timeSlot: string) => {
  if (!tenancy.value?.id || !timeSlot) return

  confirmingMoveInTime.value = timeSlot
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/confirm-move-in-time`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmedTime: timeSlot })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to confirm move-in time')
    }

    toast.success(`Move-in time confirmed for ${timeSlot}. Calendar invite sent!`)
    // Reload tenancy data to update the UI
    await loadFullTenancyData()
  } catch (error: any) {
    console.error('Error confirming move-in time:', error)
    toast.error(error.message || 'Failed to confirm move-in time')
  } finally {
    confirmingMoveInTime.value = null
  }
}

// Add tenant methods
const cancelAddTenant = () => {
  showAddTenantForm.value = false
  newTenant.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isLeadTenant: false
  }
}

const addTenant = async () => {
  if (!tenancy.value?.id || !newTenant.value.firstName || !newTenant.value.lastName) return

  addingTenant.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/tenants`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: newTenant.value.firstName,
          lastName: newTenant.value.lastName,
          email: newTenant.value.email || undefined,
          phone: newTenant.value.phone || undefined,
          isLeadTenant: newTenant.value.isLeadTenant
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add tenant')
    }

    toast.success('Tenant added successfully')
    cancelAddTenant()
    // Reload tenancy data to show new tenant
    await loadFullTenancyData()
    emit('updated')
  } catch (error: any) {
    console.error('Error adding tenant:', error)
    toast.error(error.message || 'Failed to add tenant')
  } finally {
    addingTenant.value = false
  }
}

const updateTenant = async (tenantId: string, data: any) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/tenants/${tenantId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update tenant')
    }

    toast.success('Tenant updated successfully')
    await loadFullTenancyData()
    emit('updated')
  } catch (error: any) {
    console.error('Error updating tenant:', error)
    toast.error(error.message || 'Failed to update tenant')
  }
}

const removeTenant = async (tenantId: string) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/tenants/${tenantId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leftDate: new Date().toISOString().split('T')[0]
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove tenant')
    }

    toast.success('Tenant removed successfully')
    await loadFullTenancyData()
    emit('updated')
  } catch (error: any) {
    console.error('Error removing tenant:', error)
    toast.error(error.message || 'Failed to remove tenant')
  }
}

// Guarantor methods
const loadTenancyGuarantors = async () => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/guarantors`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (response.ok) {
      const data = await response.json()
      tenancyGuarantors.value = data.guarantors || []
    }
  } catch (error) {
    console.error('Error loading guarantors:', error)
  }
}

const addGuarantor = async () => {
  if (!tenancy.value?.id || !newGuarantor.value.firstName || !newGuarantor.value.lastName) return

  addingGuarantor.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/guarantors`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: newGuarantor.value.firstName,
          lastName: newGuarantor.value.lastName,
          email: newGuarantor.value.email || undefined,
          phone: newGuarantor.value.phone || undefined,
          relationshipToTenant: newGuarantor.value.relationshipToTenant || undefined
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add guarantor')
    }

    toast.success('Guarantor added successfully')
    cancelAddGuarantor()
    await loadTenancyGuarantors()
    emit('updated')
  } catch (error: any) {
    console.error('Error adding guarantor:', error)
    toast.error(error.message || 'Failed to add guarantor')
  } finally {
    addingGuarantor.value = false
  }
}

const cancelAddGuarantor = () => {
  showAddGuarantorForm.value = false
  newGuarantor.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    relationshipToTenant: ''
  }
}

const updateGuarantor = async (guarantorId: string, data: any) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/guarantors/${guarantorId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update guarantor')
    }

    toast.success('Guarantor updated successfully')
    await loadTenancyGuarantors()
    emit('updated')
  } catch (error: any) {
    console.error('Error updating guarantor:', error)
    toast.error(error.message || 'Failed to update guarantor')
  }
}

const removeGuarantor = async (guarantorId: string) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/guarantors/${guarantorId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove guarantor')
    }

    toast.success('Guarantor removed successfully')
    await loadTenancyGuarantors()
    emit('updated')
  } catch (error: any) {
    console.error('Error removing guarantor:', error)
    toast.error(error.message || 'Failed to remove guarantor')
  }
}

// ============================================================================
// NOTES & ACTIVITY
// ============================================================================

const loadTenancyNotes = async () => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/notes`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      tenancyNotes.value = data.notes || []
    }
  } catch (error) {
    console.error('Error loading tenancy notes:', error)
  }
}

const loadTenancyActivity = async () => {
  if (!tenancy.value?.id) return

  loadingActivity.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const categoryParam = activityFilter.value !== 'all' ? `&category=${activityFilter.value}` : ''
    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/activity?limit=100${categoryParam}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      tenancyActivity.value = data.activities || []
    }
  } catch (error) {
    console.error('Error loading tenancy activity:', error)
  } finally {
    loadingActivity.value = false
  }
}

const addNote = async () => {
  if (!tenancy.value?.id || !newNoteContent.value.trim()) return

  addingNote.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newNoteContent.value.trim() })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add note')
    }

    toast.success('Note added')
    newNoteContent.value = ''
    await Promise.all([loadTenancyNotes(), loadTenancyActivity()])
  } catch (error: any) {
    console.error('Error adding note:', error)
    toast.error(error.message || 'Failed to add note')
  } finally {
    addingNote.value = false
  }
}

const deleteNote = async (noteId: string) => {
  if (!tenancy.value?.id || !confirm('Delete this note?')) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/notes/${noteId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete note')
    }

    toast.success('Note deleted')
    await loadTenancyNotes()
  } catch (error: any) {
    console.error('Error deleting note:', error)
    toast.error(error.message || 'Failed to delete note')
  }
}

const togglePinNote = async (note: any) => {
  if (!tenancy.value?.id) return

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${tenancy.value.id}/notes/${note.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPinned: !note.is_pinned })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update note')
    }

    await loadTenancyNotes()
  } catch (error: any) {
    console.error('Error updating note:', error)
    toast.error(error.message || 'Failed to update note')
  }
}

const formatActivityDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

const getActivityIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'TENANT_ADDED': '👤',
    'TENANT_REMOVED': '👤',
    'TENANT_UPDATED': '👤',
    'GUARANTOR_ADDED': '🛡️',
    'GUARANTOR_REMOVED': '🛡️',
    'AGREEMENT_GENERATED': '📄',
    'AGREEMENT_SIGNED': '✍️',
    'AGREEMENT_SENT': '📤',
    'DEPOSIT_PROTECTED': '🔒',
    'RENT_UPDATED': '💷',
    'STATUS_CHANGED': '🔄',
    'NOTE_ADDED': '📝',
    'MOVE_IN_PACK_SENT': '📦',
    'INITIAL_MONIES_PAID': '💰'
  }
  return icons[action] || '📌'
}

const handleTenancyEnded = () => {
  showEndTenancyModal.value = false
  emit('updated')
  // Prompt to send move-out notice after ending tenancy
  showMoveOutModal.value = true
}

const handleDepositProtected = () => {
  showProtectDepositModal.value = false
  emit('updated')
}

const handleInitialMoniesSent = async () => {
  showInitialMoniesModal.value = false
  // Reload tenancy data to reflect the update
  await loadFullTenancyData()
  emit('updated')
}
</script>
