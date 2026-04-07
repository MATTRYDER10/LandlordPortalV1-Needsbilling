<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div class="px-6 py-4">
          <div class="flex items-center justify-between">
            <!-- Title -->
            <div class="flex items-center gap-3">
              <div>
                <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Tenancies</h1>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your property lettings</p>
              </div>
              <!-- Active Filter Badge -->
              <div
                v-if="activeFilter === 'unprotected_deposits'"
                class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
              >
                <Shield class="w-3.5 h-3.5" />
                Unprotected deposits only
                <button
                  @click="clearFilter"
                  class="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
              <!-- Management Type Filter Toggles -->
              <div class="flex items-center gap-1.5">
                <button
                  @click="toggleManagementFilter('managed')"
                  :class="[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors border',
                    managementFilter === 'managed'
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  ]"
                >
                  <Building2 class="w-3.5 h-3.5" />
                  Managed
                </button>
                <button
                  @click="toggleManagementFilter('let_only')"
                  :class="[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors border',
                    managementFilter === 'let_only'
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  ]"
                >
                  <Key class="w-3.5 h-3.5" />
                  Let Only
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2.5">
              <!-- Search -->
              <div class="relative">
                <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  v-model="search"
                  type="text"
                  placeholder="Search tenant, property, or landlord..."
                  class="pl-9 pr-3 py-2 w-72 text-xs bg-slate-100 dark:bg-slate-800 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-primary/30 focus:bg-white dark:focus:bg-slate-700 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <kbd
                  v-if="!search"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
                >
                  /
                </kbd>
              </div>

              <!-- Create Tenancy -->
              <button
                @click="showCreateModal = true"
                class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/25 transition-all hover:shadow-md hover:shadow-primary/30"
              >
                <Plus class="w-3.5 h-3.5" />
                Create Tenancy
              </button>

              <!-- Refresh -->
              <button
                @click="loadTenancies"
                :disabled="loading"
                class="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="px-6 pb-0">
          <div class="flex">
            <!-- Draft Tab -->
            <button
              @click="handleSectionChange('draft')"
              class="relative flex-1 py-3 text-center font-semibold text-xs transition-all"
              :class="activeSection === 'draft'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
            >
              <div class="flex items-center justify-center gap-1.5">
                <FileEdit class="w-3.5 h-3.5" />
                <span>Draft</span>
                <span
                  class="px-1.5 py-0.5 text-[10px] rounded-full font-medium"
                  :class="activeSection === 'draft'
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                >
                  {{ draftTenancies.length }}
                </span>
              </div>
              <!-- Active indicator -->
              <div
                v-if="activeSection === 'draft'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500"
              />
            </button>

            <!-- Divider -->
            <div class="w-px bg-slate-200 dark:bg-slate-700 my-2.5" />

            <!-- Active Tab -->
            <button
              @click="handleSectionChange('active')"
              class="relative flex-1 py-3 text-center font-semibold text-xs transition-all"
              :class="activeSection === 'active'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
            >
              <div class="flex items-center justify-center gap-1.5">
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Active</span>
                <span
                  class="px-1.5 py-0.5 text-[10px] rounded-full font-medium"
                  :class="activeSection === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                >
                  {{ activeTenancies.length }}
                </span>
              </div>
              <!-- Active indicator -->
              <div
                v-if="activeSection === 'active'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500"
              />
            </button>

            <!-- Divider -->
            <div class="w-px bg-slate-200 dark:bg-slate-700 my-2.5" />

            <!-- Notice Served Tab -->
            <button
              @click="handleSectionChange('notice_served')"
              class="relative flex-1 py-3 text-center font-semibold text-xs transition-all"
              :class="activeSection === 'notice_served'
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
            >
              <div class="flex items-center justify-center gap-1.5">
                <AlertTriangle class="w-3.5 h-3.5" />
                <span>Notice Served</span>
                <span
                  v-if="noticeServedTenancies.length > 0"
                  class="px-1.5 py-0.5 text-[10px] rounded-full font-medium"
                  :class="activeSection === 'notice_served'
                    ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                >
                  {{ noticeServedTenancies.length }}
                </span>
              </div>
              <!-- Active indicator -->
              <div
                v-if="activeSection === 'notice_served'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-400 to-red-500"
              />
            </button>

            <!-- Divider -->
            <div class="w-px bg-slate-200 dark:bg-slate-700 my-2.5" />

            <!-- Archived Tab -->
            <button
              @click="handleSectionChange('archived')"
              class="relative flex-1 py-3 text-center font-semibold text-xs transition-all"
              :class="activeSection === 'archived'
                ? 'text-slate-700 dark:text-slate-300'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
            >
              <div class="flex items-center justify-center gap-1.5">
                <Archive class="w-3.5 h-3.5" />
                <span>Archived</span>
                <span
                  v-if="archivedTenancies.length > 0"
                  class="px-1.5 py-0.5 text-[10px] rounded-full font-medium"
                  :class="activeSection === 'archived'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                >
                  {{ archivedTenancies.length }}
                </span>
              </div>
              <!-- Active indicator -->
              <div
                v-if="activeSection === 'archived'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-400 to-slate-500"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="p-6">
          <div class="space-y-2.5">
            <div v-for="i in 5" :key="i" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div class="animate-pulse">
                <div class="flex items-start gap-5">
                  <div class="w-[68px] h-14 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div class="flex-1">
                    <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                    <div class="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3 mb-3" />
                    <div class="flex gap-1.5">
                      <div class="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full" />
                      <div class="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Results (shows both sections when searching) -->
        <div v-else-if="isSearching" class="p-6">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">Search Results</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Found {{ filteredTenancies.length }} {{ filteredTenancies.length === 1 ? 'result' : 'results' }} for "{{ search }}"
              </p>
            </div>
            <button
              @click="search = ''"
              class="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Clear search
            </button>
          </div>

          <div v-if="filteredTenancies.length > 0" class="space-y-2.5">
            <template v-for="tenancy in filteredTenancies" :key="tenancy.id">
              <!-- Archived tenancy (with archive badge) -->
              <div v-if="isArchivedStatus(tenancy.status)" class="relative">
                <div class="absolute -left-1.5 top-2.5 z-10">
                  <span class="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-slate-500 rounded-r-md shadow-sm flex items-center gap-0.5">
                    <Archive class="w-2.5 h-2.5" />
                    {{ tenancy.status === 'ended' ? 'Ended' : tenancy.status === 'terminated' ? 'Terminated' : 'Expired' }}
                  </span>
                </div>
                <div class="opacity-75">
                  <ActiveTenancyRow
                    :tenancy="tenancy"
                    @click="openTenancy"
                    @action="handleTenancyAction"
                    :is-archived="true"
                  />
                </div>
              </div>
              <!-- Draft tenancy -->
              <DraftTenancyRow
                v-else-if="tenancy.status === 'pending'"
                :tenancy="tenancy"
                @click="openTenancy"
              />
              <!-- Active tenancy -->
              <ActiveTenancyRow
                v-else
                :tenancy="tenancy"
                @click="openTenancy"
                @action="handleTenancyAction"
              />
            </template>
          </div>

          <EmptyState v-else variant="search" />
        </div>

        <!-- Draft Section -->
        <div v-else-if="activeSection === 'draft'" class="p-6">
          <div v-if="draftTenancies.length > 0" class="space-y-1.5">
            <template v-for="group in groupedDraftTenancies" :key="`${group.year}-${group.month}`">
              <MonthBanner
                :month="group.month"
                :year="group.year"
                :tenancy-count="group.tenancies.length"
                :is-current-month="isCurrentMonth(group.month, group.year)"
              />
              <div class="space-y-2.5 pl-3">
                <DraftTenancyRow
                  v-for="tenancy in group.tenancies"
                  :key="tenancy.id"
                  :tenancy="tenancy"
                  @click="openTenancy"
                />
              </div>
            </template>
          </div>

          <EmptyState v-else variant="draft" @action="showCreateModal = true" />
        </div>

        <!-- Active Section -->
        <div v-else-if="activeSection === 'active'" class="p-6">
          <div v-if="activeTenancies.length > 0">
            <!-- Select All / Bulk Actions Bar -->
            <div class="flex items-center justify-between mb-3 px-1">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  :checked="selectedTenancyIds.length === activeTenancies.length && activeTenancies.length > 0"
                  :indeterminate="selectedTenancyIds.length > 0 && selectedTenancyIds.length < activeTenancies.length"
                  @change="toggleSelectAll"
                  class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="text-sm text-gray-600 dark:text-slate-400">
                  {{ selectedTenancyIds.length > 0 ? `${selectedTenancyIds.length} selected` : 'Select all' }}
                </span>
              </label>
              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-1"
              >
                <button
                  v-if="selectedTenancyIds.length > 0"
                  @click="openBulkEmail"
                  class="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Mail class="w-4 h-4" />
                  Email {{ selectedTenancyIds.length === activeTenancies.length ? 'All' : selectedTenancyIds.length }} {{ selectedTenancyIds.length === 1 ? 'Tenancy' : 'Tenancies' }}
                </button>
              </Transition>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="tenancy in activeTenancies"
                :key="tenancy.id"
                class="flex items-start gap-3"
              >
                <div class="flex-shrink-0 pt-5">
                  <input
                    type="checkbox"
                    :checked="selectedTenancyIds.includes(tenancy.id)"
                    @change="toggleTenancySelection(tenancy.id)"
                    @click.stop
                    class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <ActiveTenancyRow
                    :tenancy="tenancy"
                    @click="openTenancy"
                    @action="handleTenancyAction"
                  />
                </div>
              </div>
            </div>
          </div>

          <EmptyState v-else variant="active" />
        </div>

        <!-- Notice Served Section -->
        <div v-else-if="activeSection === 'notice_served'" class="p-6">
          <div v-if="noticeServedTenancies.length > 0" class="space-y-2.5">
            <div class="mb-5">
              <div class="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle class="w-4 h-4" />
                <span class="text-sm font-medium">{{ noticeServedTenancies.length }} {{ noticeServedTenancies.length === 1 ? 'tenancy' : 'tenancies' }} with notice served</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Tenancies where a Section 8 notice has been served or end tenancy process initiated</p>
            </div>

            <ActiveTenancyRow
              v-for="tenancy in noticeServedTenancies"
              :key="tenancy.id"
              :tenancy="tenancy"
              :is-notice-served="true"
              @click="openTenancy"
              @action="handleTenancyAction"
            />
          </div>

          <EmptyState v-else variant="notice_served" />
        </div>

        <!-- Archived Section -->
        <div v-else-if="activeSection === 'archived'" class="p-6">
          <!-- Loading -->
          <div v-if="loadingArchived" class="space-y-2.5">
            <div v-for="i in 3" :key="i" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div class="animate-pulse">
                <div class="flex items-start gap-5">
                  <div class="w-[68px] h-14 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div class="flex-1">
                    <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                    <div class="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3 mb-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Archived List -->
          <div v-else-if="archivedTenancies.length > 0" class="space-y-2.5">
            <div class="mb-5">
              <div class="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                <Archive class="w-4 h-4" />
                <span class="text-sm font-medium">{{ archivedTenancies.length }} archived {{ archivedTenancies.length === 1 ? 'tenancy' : 'tenancies' }}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Tenancies that have ended, been terminated, or expired</p>
            </div>

            <div
              v-for="tenancy in archivedTenancies"
              :key="tenancy.id"
              class="relative"
            >
              <!-- Status badge -->
              <div class="absolute -left-2 top-3 z-10">
                <span
                  class="px-2 py-1 text-xs font-semibold text-white rounded-r-lg shadow-sm"
                  :class="{
                    'bg-slate-500': tenancy.status === 'ended',
                    'bg-red-500': tenancy.status === 'terminated',
                    'bg-amber-500': tenancy.status === 'expired',
                    'bg-amber-600': tenancy.status === 'fallen_through'
                  }"
                >
                  {{ tenancy.status === 'ended' ? 'Ended' : tenancy.status === 'terminated' ? 'Terminated' : tenancy.status === 'fallen_through' ? 'Fallen Through' : 'Expired' }}
                </span>
              </div>
              <div class="opacity-80 hover:opacity-100 transition-opacity">
                <ActiveTenancyRow
                  :tenancy="tenancy"
                  @click="openTenancy"
                  :is-archived="true"
                />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-16">
            <Archive class="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No archived tenancies</h3>
            <p class="text-slate-500 dark:text-slate-400">Tenancies that have ended will appear here</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tenancy Detail Drawer -->
    <TenancyDetailDrawer
      v-model:open="drawerOpen"
      :tenancy="selectedTenancy"
      @updated="loadTenancies"
      @action="handleTenancyAction"
    />

    <!-- Create Tenancy Modal -->
    <CreateTenancyModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @created="handleTenancyCreated"
    />

    <!-- Change Rent Due Date Modal -->
    <ChangeRentDueDateModal
      :is-open="showChangeRentDueDateModal"
      :tenancy-id="actionTenancy?.id || ''"
      :current-due-day="actionTenancy?.rent_due_day || 1"
      :monthly-rent="actionTenancy?.rent_amount || actionTenancy?.monthly_rent || 0"
      :property-address="actionTenancy?.property?.address_line1 || 'Unknown Property'"
      @close="showChangeRentDueDateModal = false; actionTenancy = null"
      @success="handleChangeRentDueDateSuccess"
    />

    <!-- End Tenancy Modal -->
    <EndTenancyModal
      :show="showEndTenancyModal"
      :tenancy="actionTenancy"
      @close="showEndTenancyModal = false; actionTenancy = null"
      @ended="handleEndTenancySuccess"
    />

    <!-- Email Tenants Modal (single tenancy) -->
    <EmailTenantsModal
      :is-open="showEmailTenantsModal"
      :tenancy-id="actionTenancy?.id || ''"
      :property-address="actionTenancy?.property?.address_line1 ? `${actionTenancy.property.address_line1}, ${actionTenancy.property.city || ''} ${actionTenancy.property.postcode || ''}` : 'Property'"
      :tenants="actionTenancy?.tenants?.filter((t: any) => t.status === 'active') || []"
      @close="showEmailTenantsModal = false; actionTenancy = null"
      @success="handleEmailSuccess"
    />

    <!-- Bulk Email Modal (multi-tenancy) -->
    <BulkEmailTenantsModal
      :is-open="showBulkEmailModal"
      :tenancy-ids="selectedTenancyIds"
      :tenancy-count="selectedTenancyIds.length"
      :tenant-count="bulkTenantCount"
      @close="showBulkEmailModal = false"
      @success="handleBulkEmailSuccess"
    />

    <!-- Change Tenant Modal -->
    <ChangeTenantModal
      :is-open="showChangeTenantModal"
      :tenancy-id="actionTenancy?.id || ''"
      :property-address="actionTenancy?.property?.address_line1 ? `${actionTenancy.property.address_line1}, ${actionTenancy.property.city || ''} ${actionTenancy.property.postcode || ''}` : 'Property'"
      :tenants="actionTenancy?.tenants || []"
      @close="showChangeTenantModal = false; actionTenancy = null"
      @success="handleChangeTenantSuccess"
    />

    <!-- Rent Increase Notice Modal -->
    <RentIncreaseNoticeModal
      :is-open="showRentIncreaseModal"
      :tenancy-id="actionTenancy?.id || ''"
      :property-address="actionTenancy?.property?.address_line1 ? `${actionTenancy.property.address_line1}, ${actionTenancy.property.city || ''} ${actionTenancy.property.postcode || ''}` : 'Property'"
      :current-rent="actionTenancy?.monthly_rent || actionTenancy?.rent_amount || 0"
      :lead-tenant-email="actionTenancy?.tenants?.find((t: any) => t.is_lead_tenant)?.email || actionTenancy?.tenants?.[0]?.email || null"
      :rent-due-day="actionTenancy?.rent_due_day || 1"
      :tenant-names="actionTenancy?.tenants?.map((t: any) => t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : t.name).filter(Boolean).join(', ') || 'Tenant'"
      :tenancy-start-date="actionTenancy?.start_date || actionTenancy?.tenancy_start_date || actionTenancy?.move_in_date || ''"
      @close="showRentIncreaseModal = false; actionTenancy = null"
      @success="handleRentIncreaseSuccess"
    />

    <!-- Section 8 Notice Generator Modal -->
    <Section8GeneratorModal
      :is-open="showSection8Modal"
      :tenancy-id="actionTenancy?.id || ''"
      :tenancy-data="actionTenancy ? {
        tenantNames: actionTenancy.tenants?.map((t: any) => t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : t.name).filter(Boolean) || [],
        tenantEmail: actionTenancy.tenants?.find((t: any) => t.is_lead_tenant)?.email || actionTenancy.tenants?.[0]?.email || null,
        tenantPhone: actionTenancy.tenants?.find((t: any) => t.is_lead_tenant)?.phone || actionTenancy.tenants?.[0]?.phone || null,
        propertyAddress: actionTenancy.property ? {
          line1: actionTenancy.property.address_line1 || '',
          line2: actionTenancy.property.address_line2 || '',
          town: actionTenancy.property.city || '',
          county: actionTenancy.property.county || '',
          postcode: actionTenancy.property.postcode || ''
        } : undefined,
        tenancyStartDate: actionTenancy.start_date || actionTenancy.tenancy_start_date || '',
        rentAmount: actionTenancy.monthly_rent || actionTenancy.rent_amount || null,
        rentFrequency: 'monthly',
        rentDueDay: actionTenancy.rent_due_day ? `${actionTenancy.rent_due_day}${getOrdinalSuffix(actionTenancy.rent_due_day)} of the month` : ''
      } : undefined"
      @close="showSection8Modal = false; actionTenancy = null"
      @success="handleSection8Success"
      @generated="handleSection8Generated"
    />

    <!-- Section 8 Serve Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showServeConfirmDialog"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleServeConfirm(false)" />
          <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 class="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Notice Generated Successfully</h3>
                <p class="mt-2 text-sm text-gray-600 dark:text-slate-400">
                  Your Section 8 notice has been generated and saved to the Documents tab. Would you like to officially serve it to the tenant(s) now?
                </p>
                <p class="mt-2 text-xs text-gray-500 dark:text-slate-400">
                  Serving will send the notice via email with selected compliance documents.
                </p>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                @click="handleServeConfirm(false)"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Serve Later
              </button>
              <button
                @click="handleServeConfirm(true)"
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Send class="w-4 h-4" />
                Serve Now
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Serve Section 8 Modal -->
    <ServeSection8Modal
      :is-open="showServeSection8Modal"
      :notice-id="section8NoticeIdToServe"
      @close="showServeSection8Modal = false; section8NoticeIdToServe = null"
      @served="handleSection8Served"
    />

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelDelete"
          />
          <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
            <div class="p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Tenancy</h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400">This action cannot be undone</p>
                </div>
              </div>

              <p class="text-gray-600 dark:text-slate-400 mb-4">
                Are you sure you want to delete the tenancy for
                <strong class="text-gray-900 dark:text-white">{{ actionTenancy?.property?.address_line1 || 'this property' }}</strong>?
              </p>

              <div class="flex justify-end gap-3">
                <button
                  @click="cancelDelete"
                  :disabled="isDeleting"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleDeleteTenancy"
                  :disabled="isDeleting"
                  class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete Tenancy' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Revert to Draft Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showRevertConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelRevert"
          />
          <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
            <div class="p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Revert to Draft</h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400">All progress will be reset</p>
                </div>
              </div>

              <p class="text-gray-600 dark:text-slate-400 mb-4">
                Are you sure you want to revert the tenancy for
                <strong class="text-gray-900 dark:text-white">{{ actionTenancy?.property?.address_line1 || 'this property' }}</strong>
                back to draft status?
              </p>

              <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p class="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Warning:</strong> This will clear all tenancy progress including:
                </p>
                <ul class="text-xs text-amber-700 dark:text-amber-400 mt-1 space-y-0.5 ml-4 list-disc">
                  <li>Agreement signing status</li>
                  <li>Compliance pack sent status</li>
                  <li>Initial monies payment status</li>
                  <li>Move-in time confirmation</li>
                </ul>
              </div>

              <div class="flex justify-end gap-3">
                <button
                  @click="cancelRevert"
                  :disabled="isReverting"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleRevertToDraft"
                  :disabled="isReverting"
                  class="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {{ isReverting ? 'Reverting...' : 'Revert to Draft' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Revert to Notice Served Confirmation Modal -->
      <Transition name="modal">
        <div
          v-if="showRevertToNoticeServedConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelRevertToNoticeServed"
          />
          <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
            <div class="p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <svg class="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Revert to Notice Served</h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Move tenancy back to notice given status</p>
                </div>
              </div>

              <p class="text-gray-600 dark:text-slate-400 mb-4">
                Are you sure you want to revert the tenancy for
                <strong class="text-gray-900 dark:text-white">{{ actionTenancy?.property?.address_line1 || 'this property' }}</strong>
                back to Notice Served status?
              </p>

              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">New Move-Out Date</label>
                <input
                  v-model="revertNoticeEndDate"
                  type="date"
                  :min="new Date().toISOString().split('T')[0]"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500 dark:bg-slate-800 dark:text-white"
                />
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Set the new expected move-out date. Rent will be pro-rated accordingly.</p>
              </div>

              <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 mb-4">
                <p class="text-xs text-rose-800 dark:text-rose-300">
                  <strong>Note:</strong> This will move the tenancy from Archived back to Notice Served (notice_given), allowing it to be managed again before final end of tenancy.
                </p>
              </div>

              <div class="flex justify-end gap-3">
                <button
                  @click="cancelRevertToNoticeServed"
                  :disabled="isRevertingToNoticeServed"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleRevertToNoticeServed"
                  :disabled="isRevertingToNoticeServed"
                  class="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {{ isRevertingToNoticeServed ? 'Reverting...' : 'Revert to Notice Served' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import Sidebar from '@/components/Sidebar.vue'
import TenancyDetailDrawer from '@/components/tenancies/TenancyDetailDrawer.vue'
import CreateTenancyModal from '@/components/tenancies/CreateTenancyModal.vue'
import ChangeRentDueDateModal from '@/components/tenancies/ChangeRentDueDateModal.vue'
import EndTenancyModal from '@/components/tenancies/EndTenancyModal.vue'
import EmailTenantsModal from '@/components/tenancies/EmailTenantsModal.vue'
import ChangeTenantModal from '@/components/tenancies/ChangeTenantModal.vue'
import RentIncreaseNoticeModal from '@/components/tenancies/RentIncreaseNoticeModal.vue'
import Section8GeneratorModal from '@/components/tenancies/Section8GeneratorModal.vue'
import ServeSection8Modal from '@/components/tenancies/ServeSection8Modal.vue'
import DraftTenancyRow from '@/components/tenancies/DraftTenancyRow.vue'
import ActiveTenancyRow from '@/components/tenancies/ActiveTenancyRow.vue'
import MonthBanner from '@/components/tenancies/MonthBanner.vue'
import EmptyState from '@/components/tenancies/EmptyState.vue'
import { Search, RefreshCw, Plus, FileEdit, CheckCircle2, Archive, Send, Shield, X, AlertTriangle, Building2, Key, Mail } from 'lucide-vue-next'
import BulkEmailTenantsModal from '@/components/tenancies/BulkEmailTenantsModal.vue'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

// Watch for query params
// Active filter state
const activeFilter = ref<string | null>(null)
const managementFilter = ref<'let_only' | 'managed' | null>(null)

watch(() => route.query, (query) => {
  // Handle create=true query param
  if (query.create === 'true') {
    showCreateModal.value = true
    // Clear the query param
    router.replace({ path: route.path, query: {} })
  }
  // Handle search query param
  if (query.search && typeof query.search === 'string') {
    search.value = query.search
  }
  // Handle tab query param (from dashboard)
  if (query.tab && typeof query.tab === 'string') {
    if (query.tab === 'draft') {
      activeSection.value = 'draft'
    } else if (query.tab === 'active') {
      activeSection.value = 'active'
    } else if (query.tab === 'archived') {
      activeSection.value = 'archived'
      loadArchivedTenancies()
    }
    // Clear the tab param after applying
    router.replace({ path: route.path, query: { ...query, tab: undefined } })
  }
  // Handle tenancy query param (from dashboard calendar - open specific tenancy drawer)
  if (query.tenancy && typeof query.tenancy === 'string') {
    const tenancyId = query.tenancy
    // Clear the query param first
    router.replace({ path: route.path, query: {} })
    // Defer to allow function to be defined (hoisting)
    setTimeout(async () => {
      const found = tenancies.value.find((t: any) => t.id === tenancyId)
      if (found) {
        openTenancy(found)
      } else {
        try {
          const token = authStore.session?.access_token
          if (!token) return
          const response = await authFetch(`${API_URL}/api/tenancies/records/${tenancyId}`, { token })
          if (response.ok) {
            const data = await response.json()
            if (data.tenancy) openTenancy(data.tenancy)
          }
        } catch (e) {
          console.error('Failed to open tenancy from calendar:', e)
        }
      }
    }, 500)
  }
  // Handle filter query param (for unprotected deposits, etc.)
  if (query.filter && typeof query.filter === 'string') {
    activeFilter.value = query.filter
  } else {
    activeFilter.value = null
  }
  // Handle month filter query param (from dashboard calendar)
  if (query.month && typeof query.month === 'string') {
    // Switch to draft section and show pending for that month
    activeSection.value = 'draft'
  }
}, { immediate: true })

// State
const loading = ref(false)
const tenancies = ref<any[]>([])
const archivedTenanciesData = ref<any[]>([])
const search = ref('')
const activeSection = ref<'draft' | 'active' | 'notice_served' | 'archived'>('draft')
const drawerOpen = ref(false)
const selectedTenancy = ref<any | null>(null)
const showCreateModal = ref(false)
const loadingArchived = ref(false)

// Action modals state
const actionTenancy = ref<any | null>(null)
const showChangeRentDueDateModal = ref(false)
const showEndTenancyModal = ref(false)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
const showRevertConfirm = ref(false)
const isReverting = ref(false)
const showRevertToNoticeServedConfirm = ref(false)
const isRevertingToNoticeServed = ref(false)
const revertNoticeEndDate = ref('')
const showEmailTenantsModal = ref(false)
const showBulkEmailModal = ref(false)
const selectedTenancyIds = ref<string[]>([])
const showChangeTenantModal = ref(false)
const showRentIncreaseModal = ref(false)
const showSection8Modal = ref(false)
const showServeSection8Modal = ref(false)
const section8NoticeIdToServe = ref<string | null>(null)
const showServeConfirmDialog = ref(false)

// Computed: Is searching
const isSearching = computed(() => search.value.trim().length > 0)

// Computed: All tenancies including archived for search
const allTenanciesForSearch = computed(() => {
  return [...tenancies.value, ...archivedTenanciesData.value]
})

// Computed: Filter tenancies (searches both active and archived)
const filteredTenancies = computed(() => {
  if (!isSearching.value) return tenancies.value

  const query = search.value.toLowerCase().trim()
  let results = allTenanciesForSearch.value.filter(t => {
    const address = (t.property?.address_line1 || '').toLowerCase()
    const city = (t.property?.city || '').toLowerCase()
    const postcode = (t.property?.postcode || '').toLowerCase()
    const landlordName = (t.landlord_name || '').toLowerCase()
    const tenantMatch = t.tenants?.some((tenant: any) =>
      `${tenant.first_name} ${tenant.last_name}`.toLowerCase().includes(query)
    )

    return address.includes(query) ||
           city.includes(query)
           postcode.includes(query) ||
           landlordName.includes(query)
           tenantMatch
  })
  if (managementFilter.value) {
    results = results.filter(matchesManagementType)
  }
  return results
})

// Computed: Split by status
// Helper: Check if tenancy needs deposit protection
const needsDepositProtection = (t: any): boolean => {
  return t.deposit_amount && t.deposit_amount > 0 && !t.deposit_protected_at
}

const matchesManagementType = (t: any): boolean => {
  if (!managementFilter.value) return true
  const type = t.management_type || t.property?.management_type
  return type === managementFilter.value
}

const draftTenancies = computed(() => {
  let filtered = tenancies.value.filter(t => t.status === 'pending')
  if (activeFilter.value === 'unprotected_deposits') {
    filtered = filtered.filter(needsDepositProtection)
  }
  if (managementFilter.value) {
    filtered = filtered.filter(matchesManagementType)
  }
  return filtered
})

const activeTenancies = computed(() => {
  let filtered = tenancies.value.filter(t => t.status === 'active')
  if (activeFilter.value === 'unprotected_deposits') {
    filtered = filtered.filter(needsDepositProtection)
  }
  if (managementFilter.value) {
    filtered = filtered.filter(matchesManagementType)
  }
  return filtered
})

const noticeServedTenancies = computed(() => {
  let filtered = tenancies.value
    .filter(t => t.status === 'notice_given')
  if (managementFilter.value) {
    filtered = filtered.filter(matchesManagementType)
  }
  return filtered.sort((a, b) => {
      // Sort by end date (ascending - soonest end date first)
      const aEnd = a.tenancy_end_date || a.end_date || ''
      const bEnd = b.tenancy_end_date || b.end_date || ''
      return aEnd.localeCompare(bEnd)
    })
})

const archivedTenancies = computed(() => archivedTenanciesData.value)

// Helper: Check if tenancy is archived/expired
const isArchivedStatus = (status: string) => {
  return ['ended', 'terminated', 'expired', 'fallen_through'].includes(status)
}

// Computed: Group drafts by month
interface MonthGroup {
  month: number
  year: number
  tenancies: any[]
}

const groupedDraftTenancies = computed<MonthGroup[]>(() => {
  const groups: Map<string, MonthGroup> = new Map()

  // Sort drafts by move-in date
  const sorted = [...draftTenancies.value].sort((a, b) => {
    const dateA = new Date(a.tenancy_start_date || a.start_date || 0)
    const dateB = new Date(b.tenancy_start_date || b.start_date || 0)
    return dateA.getTime() - dateB.getTime()
  })

  for (const tenancy of sorted) {
    const dateStr = tenancy.tenancy_start_date || tenancy.start_date
    if (!dateStr) continue

    const date = new Date(dateStr)
    const month = date.getMonth()
    const year = date.getFullYear()
    const key = `${year}-${month}`

    if (!groups.has(key)) {
      groups.set(key, { month, year, tenancies: [] })
    }
    groups.get(key)!.tenancies.push(tenancy)
  }

  return Array.from(groups.values())
})

// Helper: Check if month is current
const isCurrentMonth = (month: number, year: number): boolean => {
  const now = new Date()
  return now.getMonth() === month && now.getFullYear() === year
}

// Methods
const loadTenancies = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Not authenticated')
      return
    }

    const response = await authFetch(`${API_URL}/api/tenancies/records/active`, {
      token
    })

    if (!response.ok) {
      throw new Error('Failed to load tenancies')
    }

    const data = await response.json()
    tenancies.value = data.tenancies || []
  } catch (error: any) {
    console.error('Error loading tenancies:', error)
    toast.error(error.message || 'Failed to load tenancies')
  } finally {
    loading.value = false
  }
}

const loadArchivedTenancies = async () => {
  if (archivedTenanciesData.value.length > 0) return // Already loaded

  loadingArchived.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenancies/records/archived`, {
      token
    })

    if (!response.ok) {
      throw new Error('Failed to load archived tenancies')
    }

    const data = await response.json()
    archivedTenanciesData.value = data.tenancies || []
  } catch (error: any) {
    console.error('Error loading archived tenancies:', error)
    toast.error(error.message || 'Failed to load archived tenancies')
  } finally {
    loadingArchived.value = false
  }
}

const handleSectionChange = (section: 'draft' | 'active' | 'notice_served' | 'archived') => {
  activeSection.value = section
  if (section === 'archived') {
    loadArchivedTenancies()
  }
}

const clearFilter = () => {
  activeFilter.value = null
  router.replace({ path: route.path, query: {} })
}

const toggleManagementFilter = (type: 'let_only' | 'managed') => {
  managementFilter.value = managementFilter.value === type ? null : type
}

const openTenancy = (tenancy: any) => {
  selectedTenancy.value = tenancy
  drawerOpen.value = true
}

const handleTenancyCreated = () => {
  showCreateModal.value = false
  loadTenancies()
}

const handleTenancyAction = (action: string, tenancy: any) => {
  console.log('Action:', action, 'Tenancy:', tenancy.id)
  actionTenancy.value = tenancy

  switch (action) {
    case 'change-rent-due':
      showChangeRentDueDateModal.value = true
      break
    case 'end-tenancy':
      showEndTenancyModal.value = true
      break
    case 'delete':
      // Only allow deleting draft tenancies
      if (tenancy.status !== 'pending') {
        toast.error('Only draft tenancies can be deleted. End the tenancy first.')
        return
      }
      showDeleteConfirm.value = true
      break
    case 'email-tenants':
      showEmailTenantsModal.value = true
      break
    case 'change-tenant':
      showChangeTenantModal.value = true
      break
    case 'rent-increase':
      showRentIncreaseModal.value = true
      break
    case 'section-8':
      showSection8Modal.value = true
      break
    case 'revert-to-draft':
      // Only allow reverting active/ended tenancies back to draft
      if (tenancy.status === 'pending') {
        toast.error('This tenancy is already a draft.')
        return
      }
      showRevertConfirm.value = true
      break
    case 'revert-to-notice-served':
      if (tenancy.status !== 'archived') {
        toast.error('Only archived tenancies can be reverted to Notice Served.')
        return
      }
      showRevertToNoticeServedConfirm.value = true
      break
    default:
      toast.info(`${action} feature coming soon`)
  }
}

// Handle change rent due date success
const handleChangeRentDueDateSuccess = (_change: any) => {
  showChangeRentDueDateModal.value = false
  actionTenancy.value = null
  toast.success('Rent due date change request sent')
  loadTenancies()
}

// Handle end tenancy success
const handleEndTenancySuccess = () => {
  showEndTenancyModal.value = false
  actionTenancy.value = null
  loadTenancies()
  // Reload archived too since tenancy moved there
  archivedTenanciesData.value = []
  if (activeSection.value === 'archived') {
    loadArchivedTenancies()
  }
}

// Handle email sent success
const handleEmailSuccess = () => {
  showEmailTenantsModal.value = false
  actionTenancy.value = null
}

// Bulk email selection
const bulkTenantCount = computed(() => {
  return activeTenancies.value
    .filter(t => selectedTenancyIds.value.includes(t.id))
    .reduce((sum, t) => sum + (t.tenants?.filter((tt: any) => tt.status === 'active')?.length || 0), 0)
})

function toggleSelectAll() {
  if (selectedTenancyIds.value.length === activeTenancies.value.length) {
    selectedTenancyIds.value = []
  } else {
    selectedTenancyIds.value = activeTenancies.value.map(t => t.id)
  }
}

function toggleTenancySelection(id: string) {
  const idx = selectedTenancyIds.value.indexOf(id)
  if (idx >= 0) {
    selectedTenancyIds.value.splice(idx, 1)
  } else {
    selectedTenancyIds.value.push(id)
  }
}

function openBulkEmail() {
  showBulkEmailModal.value = true
}

const handleBulkEmailSuccess = () => {
  showBulkEmailModal.value = false
  selectedTenancyIds.value = []
}

// Handle change tenant success
const handleChangeTenantSuccess = () => {
  showChangeTenantModal.value = false
  actionTenancy.value = null
  loadTenancies()
}

// Handle rent increase notice success
const handleRentIncreaseSuccess = () => {
  showRentIncreaseModal.value = false
  actionTenancy.value = null
  loadTenancies()
}

// Handle Section 8 notice success
const handleSection8Success = () => {
  showSection8Modal.value = false
  actionTenancy.value = null
  loadTenancies()
}

// Handle Section 8 notice generated - offer to serve
const handleSection8Generated = (noticeId: string) => {
  section8NoticeIdToServe.value = noticeId
  // Show confirmation dialog
  showServeConfirmDialog.value = true
}

// Handle serve confirmation response
const handleServeConfirm = (confirmed: boolean) => {
  showServeConfirmDialog.value = false
  if (confirmed) {
    showServeSection8Modal.value = true
  } else {
    section8NoticeIdToServe.value = null
  }
}

// Handle Section 8 notice served
const handleSection8Served = () => {
  showServeSection8Modal.value = false
  section8NoticeIdToServe.value = null
  loadTenancies()
  toast.success('Section 8 notice has been served')
}

// Helper to get ordinal suffix for day numbers
const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// Handle delete tenancy
const handleDeleteTenancy = async () => {
  if (!actionTenancy.value) return

  isDeleting.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/${actionTenancy.value.id}`, {
      method: 'DELETE',
      token
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to delete tenancy')
    }

    toast.success('Tenancy deleted')
    showDeleteConfirm.value = false
    actionTenancy.value = null
    loadTenancies()
  } catch (error: any) {
    console.error('Error deleting tenancy:', error)
    toast.error(error.message || 'Failed to delete tenancy')
  } finally {
    isDeleting.value = false
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  actionTenancy.value = null
}

// Handle revert to draft
const handleRevertToDraft = async () => {
  if (!actionTenancy.value) return

  isReverting.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/${actionTenancy.value.id}/revert-to-draft`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to revert tenancy')
    }

    toast.success('Tenancy reverted to draft. All progress has been reset.')
    showRevertConfirm.value = false
    actionTenancy.value = null
    loadTenancies()
    // Also reload archived in case it was ended
    archivedTenanciesData.value = []
    if (activeSection.value === 'archived') {
      loadArchivedTenancies()
    }
  } catch (error: any) {
    console.error('Error reverting tenancy:', error)
    toast.error(error.message || 'Failed to revert tenancy')
  } finally {
    isReverting.value = false
  }
}

const cancelRevert = () => {
  showRevertConfirm.value = false
  actionTenancy.value = null
}

// Handle revert to notice served
const handleRevertToNoticeServed = async () => {
  if (!actionTenancy.value) return

  isRevertingToNoticeServed.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/${actionTenancy.value.id}/revert-to-notice-served`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actual_end_date: revertNoticeEndDate.value || undefined
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to revert tenancy')
    }

    toast.success('Tenancy reverted to Notice Served.')
    showRevertToNoticeServedConfirm.value = false
    actionTenancy.value = null
    loadTenancies()
    archivedTenanciesData.value = []
    if (activeSection.value === 'archived') {
      loadArchivedTenancies()
    }
  } catch (error: any) {
    console.error('Error reverting tenancy to notice served:', error)
    toast.error(error.message || 'Failed to revert tenancy')
  } finally {
    isRevertingToNoticeServed.value = false
  }
}

const cancelRevertToNoticeServed = () => {
  showRevertToNoticeServedConfirm.value = false
  revertNoticeEndDate.value = ''
  actionTenancy.value = null
}

// Keyboard shortcut for search
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
    e.preventDefault()
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    searchInput?.focus()
  }
}

onMounted(() => {
  loadTenancies()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(10px);
}
</style>
