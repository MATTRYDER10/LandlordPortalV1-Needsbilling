<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <!-- Header -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenant Offers</h1>
              <span class="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full">V2</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage rental property offers and convert to references</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="refreshData"
              :disabled="loading"
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <RefreshCcw :class="{ 'animate-spin': loading }" class="w-4 h-4" />
            </button>
            <button
              @click="showSendModal = true"
              class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Send class="w-4 h-4" />
              Send Offer
            </button>
          </div>
        </div>

        <!-- Stats Cards - Order: Pending, Approved, Marked as Paid, Referencing, Sent, All Offers -->
        <div class="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
          <button
            @click="statusFilter = 'pending'"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === 'pending'
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-yellow-600">{{ statusCounts.pending }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Pending</div>
              </div>
              <div class="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                <Clock class="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </button>

          <button
            @click="statusFilter = 'approved'"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === 'approved'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-blue-600">{{ statusCounts.approved }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Approved</div>
              </div>
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <CheckCircle class="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </button>

          <button
            @click="statusFilter = 'payment_pending'"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === 'payment_pending'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-amber-600">{{ statusCounts.payment_pending }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Marked<br/>as Paid</div>
              </div>
              <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Banknote class="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </button>

          <button
            @click="statusFilter = 'deposit_received'"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === 'deposit_received'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-green-600">{{ statusCounts.deposit_received }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Referencing</div>
              </div>
              <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Send class="w-5 h-5 text-green-600" />
              </div>
            </div>
          </button>

          <button
            @click="statusFilter = 'sent'"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === 'sent'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-purple-600">{{ statusCounts.sent }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">Sent</div>
              </div>
              <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Mail class="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </button>

          <button
            @click="statusFilter = ''"
            class="p-4 rounded-xl border-2 transition-all text-left"
            :class="statusFilter === ''
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ offers.length }}</div>
                <div class="text-xs text-gray-500 dark:text-slate-400">All Offers</div>
              </div>
              <div class="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl flex items-center justify-center">
                <FileText class="w-5 h-5 text-primary" />
              </div>
            </div>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="mt-4 flex gap-3">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by property, tenant name, or email..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <button
            v-if="statusFilter || searchQuery"
            @click="clearFilters"
            class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 5" :key="i" class="bg-white dark:bg-slate-900 rounded-xl p-4 animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
            <div class="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredOffers.length === 0" class="text-center py-12">
          <div class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
            <Send class="w-8 h-8 text-primary" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">No offers found</h3>
          <p class="text-gray-500 dark:text-slate-400 mt-1 mb-4">
            {{ searchQuery || statusFilter ? 'Try adjusting your filters' : 'Send your first offer to get started' }}
          </p>
          <button
            v-if="!searchQuery && !statusFilter"
            @click="showSendModal = true"
            class="px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Send Offer
          </button>
        </div>

        <!-- Multi-select Actions Bar -->
        <div v-if="selectedOfferIds.length > 0 && !showDetailModal" class="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between">
          <span class="text-sm font-medium text-primary">
            {{ selectedOfferIds.length }} offer(s) selected
          </span>
          <div class="flex gap-2">
            <button
              @click="selectedOfferIds = []"
              class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Clear Selection
            </button>
            <button
              @click="openBulkDeclineModal"
              class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1"
            >
              <ThumbsDown class="w-3.5 h-3.5" />
              Decline ({{ selectedOfferIds.length }})
            </button>
            <button
              @click="deleteSelectedOffers"
              :disabled="deletingOffers"
              class="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
            >
              <Loader2 v-if="deletingOffers" class="w-3.5 h-3.5 animate-spin" />
              <Trash2 v-else class="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              @click="openSendToLandlordModal(selectedOfferIds)"
              class="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1"
            >
              <Send class="w-3.5 h-3.5" />
              Send to Landlord
            </button>
          </div>
        </div>

        <!-- Offer List -->
        <div class="space-y-4">
          <div
            v-for="offer in filteredOffers"
            :key="offer.id"
            class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all"
            :class="{ 'border-primary bg-primary/5': selectedOfferIds.includes(offer.id) }"
          >
            <div class="flex items-start gap-3">
              <!-- Checkbox for multi-select -->
              <div class="flex-shrink-0 pt-0.5" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedOfferIds.includes(offer.id)"
                  @change="toggleOfferSelection(offer.id)"
                  class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                />
              </div>
              <div class="flex-1" @click="openOffer(offer)">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-semibold text-gray-900 dark:text-white">
                    {{ offer.property_address || offer.tenant_email }}
                  </h3>
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-full"
                    :class="getStatusClass(offer.status, offer)"
                  >
                    {{ formatStatus(offer.status, offer) }}
                  </span>
                  <!-- Landlord Decision Tag -->
                  <span
                    v-if="offer.landlord_decision === 'approved'"
                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"
                  >
                    <ThumbsUp class="w-3 h-3" />
                    Landlord Approved
                    <span v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'" class="text-green-600/70 dark:text-green-400/70">(tenant not informed yet)</span>
                  </span>
                  <span
                    v-else-if="offer.landlord_decision === 'declined'"
                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"
                    :title="offer.landlord_decision_reason"
                  >
                    <ThumbsDown class="w-3 h-3" />
                    Landlord Declined
                    <span v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'" class="text-red-600/70 dark:text-red-400/70">(tenant not informed yet)</span>
                  </span>
                  <span
                    v-else-if="offer.landlord_sent_at && !offer.landlord_decision"
                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"
                  >
                    <Send class="w-3 h-3" />
                    Sent to Landlord
                  </span>
                </div>
                <!-- Show landlord decline reason -->
                <p v-if="offer.landlord_decision === 'declined' && offer.landlord_decision_reason" class="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                  "{{ offer.landlord_decision_reason }}"
                </p>
                <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  {{ offer.tenant_first_name }} {{ offer.tenant_last_name }}
                  <span v-if="offer.tenant_email" class="text-gray-400"> • {{ offer.tenant_email }}</span>
                </p>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span v-if="offer.offered_rent_amount || offer.rent_amount" class="flex items-center gap-1">
                    <Banknote class="w-3 h-3" />
                    £{{ offer.offered_rent_amount || offer.rent_amount }}/month
                  </span>
                  <span v-if="offer.proposed_move_in_date || offer.move_in_date" class="flex items-center gap-1">
                    <Calendar class="w-3 h-3" />
                    {{ formatDate(offer.proposed_move_in_date || offer.move_in_date) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ formatRelativeDate(offer.created_at) }}
                  </span>
                </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400 flex-shrink-0" @click="openOffer(offer)" />
            </div>

            <!-- Offer details -->
            <div v-if="offer.holding_deposit_amount || offer.offer_deposit_replacement || offer.reference_created || offer.status === 'sent'" class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-2 ml-7">
              <span v-if="offer.holding_deposit_amount" class="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg">
                Holding Deposit: £{{ offer.holding_deposit_amount }}
              </span>
              <span v-if="offer.offer_deposit_replacement" class="px-2 py-1 text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-lg flex items-center gap-1">
                <Sparkles class="w-3 h-3" />
                Deposit Replacement
              </span>
              <span v-if="offer.reference_created" class="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg flex items-center gap-1">
                <CheckCircle class="w-3 h-3" />
                Reference Created
              </span>
              <!-- Resend button for sent offers -->
              <button
                v-if="offer.status === 'sent'"
                @click.stop="resendOffer(offer)"
                :disabled="resendingOfferId === offer.id"
                class="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg flex items-center gap-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
              >
                <RotateCcw v-if="resendingOfferId !== offer.id" class="w-3 h-3" />
                <Loader2 v-else class="w-3 h-3 animate-spin" />
                {{ resendingOfferId === offer.id ? 'Sending...' : 'Resend Email' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Send Offer Modal -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showSendModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white">Send Offer Form</h2>
                  <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Send a property offer to a prospective tenant</p>
                </div>
                <button
                  @click="closeSendModal"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Modal Content -->
            <form @submit.prevent="sendOffer" class="flex-1 overflow-y-auto p-6">
              <div class="space-y-4">
                <!-- Tenant Details -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
                    <input
                      v-model="sendForm.tenant_first_name"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
                    <input
                      v-model="sendForm.tenant_last_name"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    v-model="sendForm.tenant_email"
                    type="email"
                    required
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <!-- Property Details -->
                <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                    <Building2 class="w-4 h-4" />
                    Property
                  </div>

                  <!-- Property Search (when no property selected and not manual entry) -->
                  <div v-if="!isManualEntry && !selectedProperty" class="space-y-3">
                    <div class="relative">
                      <div class="relative">
                        <input
                          v-model="propertySearchQuery"
                          @input="searchPropertiesDebounced(propertySearchQuery)"
                          @focus="showPropertyDropdown = propertySearchResults.length > 0"
                          type="text"
                          placeholder="Search your properties..."
                          class="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Loader2 v-if="searchingProperties" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                      </div>

                      <!-- Search Results Dropdown -->
                      <div
                        v-if="showPropertyDropdown && propertySearchResults.length > 0"
                        class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                      >
                        <button
                          v-for="prop in propertySearchResults"
                          :key="prop.id"
                          @click="selectProperty(prop)"
                          type="button"
                          class="w-full px-3 py-2 text-left hover:bg-primary/5 border-b border-gray-100 dark:border-slate-700 last:border-0"
                        >
                          <p class="font-medium text-gray-900 dark:text-white text-sm">{{ prop.address_line1 }}</p>
                          <p class="text-xs text-gray-500">{{ prop.city }}, {{ prop.postcode }}</p>
                        </button>
                      </div>

                      <!-- No Results -->
                      <div
                        v-if="showPropertyDropdown && propertySearchQuery.length >= 2 && propertySearchResults.length === 0 && !searchingProperties"
                        class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-3"
                      >
                        <p class="text-gray-500 dark:text-slate-400 text-xs mb-2">No properties found</p>
                        <button
                          @click="switchToManualEntry"
                          type="button"
                          class="w-full px-3 py-1.5 bg-gradient-to-r from-primary to-orange-500 text-white rounded text-xs font-medium"
                        >
                          + Add New Property
                        </button>
                      </div>
                    </div>

                    <button
                      @click="switchToManualEntry"
                      type="button"
                      class="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus class="w-4 h-4" />
                      Enter New Property
                    </button>
                  </div>

                  <!-- Selected Property Display -->
                  <div v-if="selectedProperty" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div class="flex items-start justify-between">
                      <div>
                        <p class="font-medium text-green-800 dark:text-green-300 text-sm">{{ selectedProperty.address_line1 }}</p>
                        <p class="text-xs text-green-600 dark:text-green-400">{{ selectedProperty.city }}, {{ selectedProperty.postcode }}</p>
                      </div>
                      <button
                        @click="clearPropertySelection"
                        type="button"
                        class="p-1 text-green-600 hover:text-green-800"
                      >
                        <X class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Manual Entry Form -->
                  <div v-if="isManualEntry" class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-gray-500">New Property</span>
                      <button
                        @click="clearPropertySelection"
                        type="button"
                        class="text-xs text-primary hover:underline"
                      >
                        ← Back to Search
                      </button>
                    </div>
                    <input
                      v-model="sendForm.property_address"
                      type="text"
                      required
                      placeholder="Address Line 1"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    <div class="grid grid-cols-2 gap-3">
                      <input
                        v-model="sendForm.property_city"
                        type="text"
                        placeholder="City"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      />
                      <input
                        v-model="sendForm.property_postcode"
                        type="text"
                        required
                        placeholder="Postcode *"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent (£) *</label>
                    <input
                      v-model.number="sendForm.rent_amount"
                      type="number"
                      required
                      placeholder="1200"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Holding Deposit (£)</label>
                    <input
                      v-model.number="sendForm.holding_deposit_amount"
                      type="number"
                      placeholder="Auto-calculated"
                      :max="maxHoldingDeposit || undefined"
                      :class="[
                        'w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent',
                        sendForm.holding_deposit_amount && maxHoldingDeposit && sendForm.holding_deposit_amount > maxHoldingDeposit
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-slate-600 focus:ring-primary'
                      ]"
                    />
                    <p :class="[
                      'text-xs mt-1',
                      sendForm.holding_deposit_amount && maxHoldingDeposit && sendForm.holding_deposit_amount > maxHoldingDeposit
                        ? 'text-red-500'
                        : 'text-gray-400'
                    ]">
                      Max 1 week rent (£{{ maxHoldingDeposit || 0 }})
                    </p>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Move-in Date</label>

                  <!-- Always-visible calendar -->
                  <div class="border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-4">
                    <!-- Selected date banner -->
                    <div v-if="sendForm.move_in_date" class="flex items-center justify-between mb-3 px-2 py-1.5 bg-primary/10 rounded-lg">
                      <span class="text-sm font-medium text-primary">
                        {{ formatCalendarDisplayDate(sendForm.move_in_date) }}
                      </span>
                      <button
                        type="button"
                        @click="sendForm.move_in_date = ''"
                        class="p-0.5 rounded hover:bg-primary/20 text-primary/60 hover:text-primary"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <!-- Month/Year nav -->
                    <div class="flex items-center justify-between mb-3">
                      <button type="button" @click="calendarPrevMonth" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronLeft class="w-4 h-4 text-gray-600 dark:text-slate-400" />
                      </button>
                      <span class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ calendarMonthNames[calendarViewMonth] }} {{ calendarViewYear }}
                      </span>
                      <button type="button" @click="calendarNextMonth" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronRight class="w-4 h-4 text-gray-600 dark:text-slate-400" />
                      </button>
                    </div>
                    <!-- Day headers -->
                    <div class="grid grid-cols-7 mb-1">
                      <div v-for="d in ['Mo','Tu','We','Th','Fr','Sa','Su']" :key="d" class="text-center text-xs font-medium text-gray-400 dark:text-slate-500 py-1">{{ d }}</div>
                    </div>
                    <!-- Days grid -->
                    <div class="grid grid-cols-7">
                      <div v-for="(day, i) in calendarDays" :key="i" class="flex items-center justify-center">
                        <button
                          v-if="day"
                          type="button"
                          @click="selectMoveInDate(day)"
                          :disabled="day.disabled"
                          class="w-9 h-9 rounded-full text-sm font-medium transition-all"
                          :class="[
                            day.isSelected
                              ? 'bg-primary text-white shadow-sm'
                              : day.isToday
                                ? 'bg-primary/10 text-primary font-bold hover:bg-primary/20'
                                : day.disabled
                                  ? 'text-gray-300 dark:text-slate-700 cursor-not-allowed'
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                          ]"
                        >
                          {{ day.date }}
                        </button>
                        <span v-else class="w-9 h-9"></span>
                      </div>
                    </div>
                  </div>

                  <p class="text-xs text-gray-400 mt-1.5">Propose a move-in date, or leave blank for tenant to select</p>
                </div>

                <!-- Deposit and Options -->
                <div class="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
                  <div class="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deposit (£)</label>
                      <input
                        v-model.number="sendForm.deposit_amount"
                        type="number"
                        placeholder="Auto-calculated"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <p class="text-xs text-gray-400 mt-1">5 weeks rent</p>
                    </div>
                    <label class="flex items-start gap-3 cursor-pointer pb-6">
                      <input
                        v-model="sendForm.offer_deposit_replacement"
                        type="checkbox"
                        class="w-4 h-4 mt-1 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div>
                        <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Offer Reposit</span>
                        <p class="text-xs text-gray-500 mt-1">
                          Reposit is a deposit replacement where tenants pay ~1 week's rent instead of a 5-week deposit.
                          The landlord receives full deposit-equivalent protection.
                        </p>
                        <p class="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          <strong>Important:</strong> The landlord MUST have a professional inventory and check-out report to make claims with Reposit.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </form>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="closeSendModal"
                type="button"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="sendOffer"
                :disabled="sending || !isFormValid"
                class="px-6 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ sending ? 'Sending...' : 'Send Offer' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Offer Detail Modal -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showDetailModal && selectedOffer" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl flex items-center justify-center">
                    <FileText class="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Offer Details</h2>
                    <div class="flex items-center gap-2 flex-wrap mt-1">
                      <span
                        class="px-2 py-0.5 text-xs font-medium rounded-full"
                        :class="getStatusClass(selectedOffer.status, selectedOffer)"
                      >
                        {{ formatStatus(selectedOffer.status, selectedOffer) }}
                      </span>
                      <!-- Landlord Decision Tag -->
                      <span
                        v-if="selectedOffer.landlord_decision === 'approved'"
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"
                      >
                        <ThumbsUp class="w-3 h-3" />
                        Landlord Approved
                        <span v-if="selectedOffer.status === 'pending' || selectedOffer.status === 'accepted_with_changes'" class="text-green-600/70 dark:text-green-400/70">(tenant not informed yet)</span>
                      </span>
                      <span
                        v-else-if="selectedOffer.landlord_decision === 'declined'"
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"
                      >
                        <ThumbsDown class="w-3 h-3" />
                        Landlord Declined
                        <span v-if="selectedOffer.status === 'pending' || selectedOffer.status === 'accepted_with_changes'" class="text-red-600/70 dark:text-red-400/70">(tenant not informed yet)</span>
                      </span>
                      <span
                        v-else-if="selectedOffer.landlord_sent_at && !selectedOffer.landlord_decision"
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"
                      >
                        <Send class="w-3 h-3" />
                        Sent to Landlord
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  @click="closeDetailModal"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Modal Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Property & Tenant Info -->
              <div class="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
                <div class="flex items-start justify-between gap-4">
                  <!-- Property (left) -->
                  <div class="flex items-start gap-3 min-w-0">
                    <MapPin class="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-900 dark:text-white truncate">{{ selectedOffer.property_address }}</p>
                      <p class="text-sm text-gray-500 dark:text-slate-400">
                        {{ selectedOffer.property_city }}<span v-if="selectedOffer.property_postcode">, {{ selectedOffer.property_postcode }}</span>
                      </p>
                    </div>
                  </div>
                  <!-- Tenant (right) -->
                  <div v-if="selectedOffer.tenant_first_name || selectedOffer.tenant_email" class="flex items-center gap-2 shrink-0">
                    <div class="text-right">
                      <p v-if="selectedOffer.tenant_first_name" class="font-medium text-gray-900 dark:text-white text-sm">
                        {{ selectedOffer.tenant_first_name }} {{ selectedOffer.tenant_last_name }}
                      </p>
                      <p v-if="selectedOffer.tenant_email" class="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-end gap-1">
                        {{ selectedOffer.tenant_email }}
                        <button @click="copyToClipboard(selectedOffer.tenant_email)" class="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded">
                          <Copy class="w-3 h-3" />
                        </button>
                      </p>
                    </div>
                    <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User class="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Landlord Decision Info -->
              <div v-if="selectedOffer.landlord_decision" :class="[
                'rounded-xl p-4 border',
                selectedOffer.landlord_decision === 'approved'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              ]">
                <div class="flex items-start gap-3">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    selectedOffer.landlord_decision === 'approved'
                      ? 'bg-green-100 dark:bg-green-900/40'
                      : 'bg-red-100 dark:bg-red-900/40'
                  ]">
                    <ThumbsUp v-if="selectedOffer.landlord_decision === 'approved'" class="w-5 h-5 text-green-600" />
                    <ThumbsDown v-else class="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p :class="[
                      'font-semibold',
                      selectedOffer.landlord_decision === 'approved' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                    ]">
                      Landlord {{ selectedOffer.landlord_decision === 'approved' ? 'Approved' : 'Declined' }}
                    </p>
                    <p v-if="selectedOffer.landlord_decision_at" class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {{ formatDate(selectedOffer.landlord_decision_at) }}
                    </p>
                    <p v-if="selectedOffer.landlord_decision_reason" class="text-sm text-red-700 dark:text-red-400 mt-2 italic">
                      "{{ selectedOffer.landlord_decision_reason }}"
                    </p>
                  </div>
                </div>
              </div>

              <!-- Offer Terms -->
              <div>
                <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Offer Terms</h3>
                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                      <Banknote class="w-3 h-3" />
                      Monthly Rent
                    </div>
                    <p class="text-lg font-bold text-gray-900 dark:text-white">
                      {{ (selectedOffer.offered_rent_amount || selectedOffer.rent_amount) ? `£${selectedOffer.offered_rent_amount || selectedOffer.rent_amount}` : '-' }}
                    </p>
                  </div>
                  <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div class="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs mb-1">
                      <Calendar class="w-3 h-3" />
                      Move-in Date
                    </div>
                    <p class="text-lg font-bold text-gray-900 dark:text-white">
                      {{ (selectedOffer.proposed_move_in_date || selectedOffer.move_in_date) ? formatDate(selectedOffer.proposed_move_in_date || selectedOffer.move_in_date) : 'TBC' }}
                    </p>
                  </div>
                  <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div class="text-gray-500 dark:text-slate-400 text-xs mb-1">Tenancy Length</div>
                    <p class="text-lg font-bold text-gray-900 dark:text-white">
                      {{ selectedOffer.proposed_tenancy_length_months ? `${selectedOffer.proposed_tenancy_length_months} months` : '-' }}
                    </p>
                  </div>
                  <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div class="text-gray-500 dark:text-slate-400 text-xs mb-1">Deposit</div>
                    <p class="text-lg font-bold text-gray-900 dark:text-white">
                      {{ selectedOffer.deposit_amount ? `£${selectedOffer.deposit_amount}` : '-' }}
                    </p>
                    <!-- Reposit Status within deposit box -->
                    <div v-if="selectedOffer.offer_deposit_replacement || selectedOffer.deposit_replacement_requested" class="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <a
                        v-if="selectedOffer.offer_deposit_replacement && !selectedOffer.deposit_replacement_requested"
                        href="https://reposit.co.uk/tenants/"
                        target="_blank"
                        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <span class="font-bold">Rep<span class="text-blue-500">o</span>sit</span> Offered
                      </a>
                      <a
                        v-if="selectedOffer.deposit_replacement_requested"
                        href="https://reposit.co.uk/tenants/"
                        target="_blank"
                        class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <span class="font-bold">Rep<span class="text-blue-500">o</span>sit</span> Selected
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Special Conditions -->
              <div v-if="selectedOffer.special_conditions">
                <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Special Conditions</h3>
                <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p class="text-sm text-amber-800 dark:text-amber-300">{{ selectedOffer.special_conditions }}</p>
                </div>
              </div>

              <!-- Tenants List (for submitted offers) -->
              <div v-if="selectedOffer.tenants && selectedOffer.tenants.length > 0">
                <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Applicants ({{ selectedOffer.tenants.length }})
                </h3>
                <div class="space-y-4">
                  <div
                    v-for="(tenant, index) in selectedOffer.tenants"
                    :key="index"
                    class="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl"
                  >
                    <div class="flex items-start gap-3">
                      <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                        {{ index + 1 }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <p class="font-semibold text-gray-900 dark:text-white">{{ tenant.name }}</p>
                          </div>
                          <div v-if="tenant.annual_income" class="text-right flex-shrink-0">
                            <p class="text-sm font-bold text-green-600 dark:text-green-400">£{{ tenant.annual_income }}</p>
                            <p class="text-xs text-gray-500">per year</p>
                          </div>
                        </div>

                        <!-- Job Title -->
                        <div v-if="tenant.job_title" class="mt-1">
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                            {{ tenant.job_title }}
                          </span>
                        </div>

                        <!-- Contact Details -->
                        <div class="mt-3 grid grid-cols-1 gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                          <div class="flex items-center gap-2">
                            <Mail class="w-3 h-3 flex-shrink-0" />
                            <span class="truncate">{{ tenant.email }}</span>
                            <button @click="copyToClipboard(tenant.email)" class="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded">
                              <Copy class="w-3 h-3" />
                            </button>
                          </div>
                          <div v-if="tenant.phone" class="flex items-center gap-2">
                            <Phone class="w-3 h-3 flex-shrink-0" />
                            <span>{{ tenant.phone }}</span>
                          </div>
                          <div v-if="tenant.address" class="flex items-center gap-2">
                            <MapPin class="w-3 h-3 flex-shrink-0" />
                            <span>{{ tenant.address }}</span>
                          </div>
                        </div>

                        <!-- Confirmations -->
                        <div v-if="tenant.no_ccj_bankruptcy_iva" class="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                          <div class="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle class="w-3.5 h-3.5" />
                            <span>Confirmed no CCJs, bankruptcies or IVAs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Holding Deposit Agreement & Signatures -->
              <div>
                <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Holding Deposit Agreement</h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Terms -->
                  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2 text-sm text-gray-700 dark:text-slate-300">
                    <div class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p><strong>Deposit:</strong> One week's rent, deducted from tenancy deposit.</p>
                    </div>
                    <div class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p><strong>Privacy:</strong> Agreed to privacy policy.</p>
                    </div>
                    <div class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p><strong>Non-Refundable if:</strong></p>
                        <ol class="list-decimal list-inside mt-1 text-xs space-y-0.5 text-gray-600 dark:text-slate-400">
                          <li>False/misleading information</li>
                          <li>Voluntary withdrawal</li>
                          <li>No Right to Rent docs</li>
                          <li>Failure to communicate</li>
                        </ol>
                      </div>
                    </div>
                    <div class="flex items-start gap-2">
                      <CheckCircle class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p><strong>Refund:</strong> If agent/landlord withdraws.</p>
                    </div>
                  </div>

                  <!-- Signature (Lead Tenant only) -->
                  <div v-if="leadTenantSignature" class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                    <p class="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Signature</p>
                    <div>
                      <div class="flex items-start gap-3">
                        <div class="flex-1">
                          <div class="bg-white border border-gray-200 dark:border-slate-600 rounded-lg p-2 mb-1">
                            <img
                              v-if="leadTenantSignature.signature?.startsWith('data:image')"
                              :src="leadTenantSignature.signature"
                              :alt="leadTenantSignature.name + ' signature'"
                              class="max-h-12 w-auto"
                            />
                            <div v-else class="text-xs text-gray-400 italic py-2">
                              Signature data unavailable
                            </div>
                          </div>
                          <p class="text-xs text-gray-600 dark:text-slate-400">
                            <span class="font-medium">{{ leadTenantSignature.signature_name || leadTenantSignature.name }}</span>
                            <span class="text-gray-400 ml-1">(Lead Tenant)</span>
                            <span v-if="leadTenantSignature.signed_at" class="text-gray-400 ml-1">{{ formatDate(leadTenantSignature.signed_at) }}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Timeline -->
              <div>
                <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                    <Clock class="w-4 h-4" />
                    <span>Created {{ formatRelativeDate(selectedOffer.created_at) }}</span>
                    <span class="text-gray-400">•</span>
                    <span>{{ formatDate(selectedOffer.created_at) }}</span>
                  </div>
                  <div v-if="selectedOffer.sent_at" class="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                    <Send class="w-4 h-4" />
                    <span>Sent {{ formatDate(selectedOffer.sent_at) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between gap-3">
              <div class="flex gap-2">
                <button
                  @click="closeDetailModal"
                  class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  @click="openSendToLandlordModal([selectedOffer.id])"
                  class="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-2"
                >
                  <Send class="w-4 h-4" />
                  Send to Landlord
                </button>
              </div>
              <!-- Pending Actions -->
              <div v-if="selectedOffer.status === 'pending'" class="flex gap-2">
                <button
                  @click="approveOffer"
                  :disabled="processingAction"
                  class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Loader2 v-if="processingAction" class="w-4 h-4 animate-spin" />
                  <span v-else>Approve</span>
                </button>
                <button
                  @click="openAcceptChangesModal"
                  :disabled="processingAction"
                  class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Accept with Changes
                </button>
                <button
                  @click="openDeclineModal"
                  :disabled="processingAction"
                  class="px-4 py-2 bg-red-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Decline
                </button>
              </div>

              <!-- Approved - Ready for Referencing (with or without tenant confirmation) -->
              <div v-else-if="selectedOffer.status === 'approved' && !selectedOffer.reference_id" class="flex flex-col gap-3">
                <div class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Clock class="w-4 h-4" />
                  <span v-if="selectedOffer.tenant_payment_confirmed_at">Tenant marked as paid</span>
                  <span v-else>Awaiting holding deposit payment</span>
                </div>
                <button
                  @click="openReceiptModal"
                  :disabled="processingAction"
                  class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Loader2 v-if="processingAction" class="w-4 h-4 animate-spin" />
                  <template v-else>
                    <Send class="w-4 h-4" />
                    Receipt &amp; Send to Referencing
                  </template>
                </button>
              </div>

              <!-- Already converted -->
              <div v-else-if="selectedOffer.reference_id" class="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle class="w-4 h-4" />
                Sent to referencing
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Decline Modal -->
      <Transition name="modal">
        <div v-if="showDeclineModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl">
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ bulkDeclineIds.length > 1 ? `Decline ${bulkDeclineIds.length} Offers` : 'Decline Offer' }}
              </h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Select a reason or provide a custom message</p>
            </div>
            <div class="p-6 space-y-4">
              <div v-for="preset in declinePresets" :key="preset" class="flex items-center">
                <input
                  type="radio"
                  :id="'reason-' + preset"
                  :value="preset"
                  v-model="declineForm.reason"
                  class="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <label :for="'reason-' + preset" class="ml-3 text-sm text-gray-700 dark:text-slate-300">
                  {{ preset === 'custom' ? 'Other (custom message)' : preset }}
                </label>
              </div>
              <div v-if="declineForm.reason === 'custom'" class="mt-3">
                <textarea
                  v-model="declineForm.customReason"
                  rows="3"
                  placeholder="Enter your reason..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="closeDeclineModal"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="submitDecline"
                :disabled="processingAction || (!declineForm.reason || (declineForm.reason === 'custom' && !declineForm.customReason))"
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="processingAction" class="w-4 h-4 animate-spin" />
                <span>{{ bulkDeclineIds.length > 1 ? `Decline ${bulkDeclineIds.length} Offers` : 'Decline Offer' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Accept with Changes Modal -->
      <Transition name="modal">
        <div v-if="showAcceptChangesModal && selectedOffer" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl">
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Accept with Changes</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Modify the offer terms before approving</p>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent (£)</label>
                <input
                  v-model.number="changesForm.offered_rent_amount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Move-in Date</label>
                <div class="relative cursor-pointer" @click="($refs.changesDateInput as HTMLInputElement)?.showPicker?.()">
                  <input
                    ref="changesDateInput"
                    v-model="changesForm.proposed_move_in_date"
                    type="date"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white cursor-pointer"
                  />
                  <Calendar class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy Length (months)</label>
                <input
                  v-model.number="changesForm.proposed_tenancy_length_months"
                  type="number"
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deposit Amount (£)</label>
                <input
                  v-model.number="changesForm.deposit_amount"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="closeAcceptChangesModal"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="submitAcceptWithChanges"
                :disabled="processingAction"
                class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="processingAction" class="w-4 h-4 animate-spin" />
                <span>Accept & Send to Tenant</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Send to Landlord Modal -->
      <Transition name="modal">
        <div v-if="showSendToLandlordModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl">
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Send Offer to Landlord</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {{ selectedOfferIds.length === 1 ? 'Send this offer' : `Send ${selectedOfferIds.length} offers` }} summary to the landlord
              </p>
            </div>

            <div class="p-6">
              <!-- Success State -->
              <div v-if="sendToLandlordSuccess" class="text-center py-6">
                <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle class="w-8 h-8 text-green-600" />
                </div>
                <p class="text-green-600 font-medium">Offer summary sent successfully!</p>
              </div>

              <!-- Form -->
              <div v-else class="space-y-4">
                <p class="text-sm text-gray-600 dark:text-slate-400">
                  Send a summary of the offer(s) to the landlord. Contact details will be excluded for privacy.
                </p>

                <!-- Landlord Email -->
                <div v-if="landlordEmailInfo.hasLandlord" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p class="text-sm text-green-700 dark:text-green-400">
                    <strong>Linked landlord:</strong> {{ landlordEmailInfo.name }}
                  </p>
                  <p class="text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
                    <Mail class="w-4 h-4" />
                    {{ landlordEmailInfo.email }}
                  </p>
                </div>

                <div v-else>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Landlord Email
                  </label>
                  <input
                    v-model="manualLandlordEmail"
                    type="email"
                    placeholder="Enter landlord email address"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    No landlord linked to this property. Enter email manually.
                  </p>
                </div>

                <!-- Error Message -->
                <div v-if="sendToLandlordError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p class="text-sm text-red-600 dark:text-red-400">{{ sendToLandlordError }}</p>
                </div>
              </div>
            </div>

            <div v-if="!sendToLandlordSuccess" class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="showSendToLandlordModal = false; selectedOfferIds = []"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="sendOffersToLandlord"
                :disabled="sendingToLandlord || (!landlordEmailInfo.email && !manualLandlordEmail)"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Loader2 v-if="sendingToLandlord" class="w-4 h-4 animate-spin" />
                <span v-else class="flex items-center gap-2">
                  <Send class="w-4 h-4" />
                  Send
                </span>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Receipt Holding Deposit Modal -->
      <Transition name="modal">
        <div v-if="showReceiptModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl">
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Receipt & Send to Referencing</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Confirm the holding deposit and review tenants before sending to referencing.
              </p>
            </div>

            <div class="p-6 space-y-5">
              <!-- Holding Deposit -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Holding Deposit Received (£)
                </label>
                <input
                  v-model.number="receiptAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg font-semibold"
                />
                <p v-if="calculatedHoldingDeposit" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Expected: £{{ calculatedHoldingDeposit.toFixed(2) }} (1 week's rent)
                </p>
              </div>

              <!-- Tenants List -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Tenants to Reference ({{ receiptTenants.length }})
                  </label>
                </div>

                <!-- Existing tenants from offer -->
                <div class="space-y-2 mb-3">
                  <div v-for="(tenant, idx) in receiptTenants" :key="idx"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                  >
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ tenant.first_name }} {{ tenant.last_name }}</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">{{ tenant.email }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span v-if="tenant.rent_share" class="text-xs text-gray-500">£{{ tenant.rent_share }}/mo</span>
                      <button v-if="idx >= originalTenantCount" @click="receiptTenants.splice(idx, 1)" class="text-red-400 hover:text-red-600">
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Add tenant form -->
                <div v-if="showAddTenantForm" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="newTenant.first_name" type="text" placeholder="First name *"
                      class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                    <input v-model="newTenant.last_name" type="text" placeholder="Last name *"
                      class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                  </div>
                  <input v-model="newTenant.email" type="email" placeholder="Email address *"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="newTenant.phone" type="tel" placeholder="Phone (optional)"
                      class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                    <input v-model.number="newTenant.rent_share" type="number" placeholder="Rent share £/mo"
                      class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                  </div>
                  <div class="flex gap-2">
                    <button @click="addTenantToReceipt"
                      :disabled="!newTenant.first_name || !newTenant.last_name || !newTenant.email"
                      class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                      <Plus class="w-3.5 h-3.5" /> Add
                    </button>
                    <button @click="showAddTenantForm = false"
                      class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
                <button v-else @click="showAddTenantForm = true"
                  class="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1.5"
                >
                  <Plus class="w-4 h-4" />
                  Add Another Tenant
                </button>
              </div>
            </div>

            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                @click="showReceiptModal = false; showAddTenantForm = false"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="confirmReceiptAndSendToReferencing"
                :disabled="!receiptAmount || receiptAmount <= 0 || processingAction || receiptTenants.length === 0"
                class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Loader2 v-if="processingAction" class="w-4 h-4 animate-spin" />
                <template v-else>
                  <Send class="w-4 h-4" />
                  Receipt &amp; Send {{ receiptTenants.length }} Reference{{ receiptTenants.length > 1 ? 's' : '' }}
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import Sidebar from '@/components/Sidebar.vue'
import {
  Search,
  Send,
  RefreshCcw,
  FileText,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle,
  Mail,
  Banknote,
  Calendar,
  X,
  Building2,
  Loader2,
  Plus,
  User,
  MapPin,
  Phone,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Trash2,
  Sparkles
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const sending = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const offers = ref<any[]>([])
const showSendModal = ref(false)
const showDetailModal = ref(false)
const showDeclineModal = ref(false)
const showAcceptChangesModal = ref(false)
const selectedOffer = ref<any>(null)
const leadTenantSignature = computed(() => {
  const tenants = selectedOffer.value?.tenants || []
  return tenants.find((t: any) => t.signature) || tenants[0] || null
})
const processingAction = ref(false)

// Receipt modal state
const showReceiptModal = ref(false)
const receiptAmount = ref<number | null>(null)
const calculatedHoldingDeposit = computed(() => {
  if (!selectedOffer.value?.offered_rent_amount) return null
  return Math.floor((selectedOffer.value.offered_rent_amount * 12) / 52)
})

// Add tenant to receipt state
const showAddTenantForm = ref(false)
const receiptTenants = ref<Array<{ first_name: string; last_name: string; email: string; phone: string; rent_share: number | null }>>([])
const originalTenantCount = ref(0)
const newTenant = ref({ first_name: '', last_name: '', email: '', phone: '', rent_share: null as number | null })

// Send to Landlord state
const showSendToLandlordModal = ref(false)
const sendingToLandlord = ref(false)
const landlordEmailInfo = ref<{ hasLandlord: boolean; email: string | null; name: string | null }>({ hasLandlord: false, email: null, name: null })
const manualLandlordEmail = ref('')
const sendToLandlordSuccess = ref(false)
const sendToLandlordError = ref('')
const selectedOfferIds = ref<string[]>([])

// Resend offer state
const resendingOfferId = ref<string | null>(null)

// Delete state
const deletingOffers = ref(false)

// Decline form
const bulkDeclineIds = ref<string[]>([])
const declineForm = ref({
  reason: '',
  customReason: ''
})

const declinePresets = [
  'Landlord has gone with another application',
  'Property is no longer available',
  'Not met affordability criteria',
  'custom'
]

// Accept with changes form
const changesForm = ref({
  offered_rent_amount: null as number | null,
  proposed_move_in_date: '',
  proposed_tenancy_length_months: null as number | null,
  deposit_amount: null as number | null
})

const sendForm = ref({
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  linked_property_id: null as string | null,
  rent_amount: null as number | null,
  holding_deposit_amount: null as number | null,
  deposit_amount: null as number | null,
  move_in_date: '',
  offer_deposit_replacement: false
})

// Move-in date calendar
const showMoveInCalendar = ref(false)
const calendarViewMonth = ref(new Date().getMonth())
const calendarViewYear = ref(new Date().getFullYear())
const calendarMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

const calendarPrevMonth = () => {
  if (calendarViewMonth.value === 0) {
    calendarViewMonth.value = 11
    calendarViewYear.value--
  } else {
    calendarViewMonth.value--
  }
}

const calendarNextMonth = () => {
  if (calendarViewMonth.value === 11) {
    calendarViewMonth.value = 0
    calendarViewYear.value++
  } else {
    calendarViewMonth.value++
  }
}

const calendarDays = computed(() => {
  const year = calendarViewYear.value
  const month = calendarViewMonth.value
  const firstDay = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const selectedStr = sendForm.value.move_in_date // yyyy-mm-dd format

  const days: (null | { date: number; disabled: boolean; isToday: boolean; isSelected: boolean })[] = []

  // Leading blanks
  for (let i = 0; i < startDay; i++) days.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(year, month, d)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      date: d,
      disabled: thisDate < today,
      isToday: thisDate.getTime() === today.getTime(),
      isSelected: dateStr === selectedStr
    })
  }
  return days
})

const selectMoveInDate = (day: { date: number; disabled: boolean }) => {
  if (day.disabled) return
  const y = calendarViewYear.value
  const m = String(calendarViewMonth.value + 1).padStart(2, '0')
  const d = String(day.date).padStart(2, '0')
  sendForm.value.move_in_date = `${y}-${m}-${d}`
}

const formatCalendarDisplayDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Property search state
interface PropertySearchResult {
  id: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string
  formatted_address: string
}

const propertySearchQuery = ref('')
const propertySearchResults = ref<PropertySearchResult[]>([])
const searchingProperties = ref(false)
const showPropertyDropdown = ref(false)
const selectedProperty = ref<PropertySearchResult | null>(null)
const isManualEntry = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Property search functions
async function searchPropertiesDebounced(query: string) {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  if (!query || query.length < 2) {
    propertySearchResults.value = []
    showPropertyDropdown.value = false
    return
  }

  searchDebounceTimer = setTimeout(async () => {
    await searchProperties(query)
  }, 300)
}

async function searchProperties(query: string) {
  searchingProperties.value = true
  try {
    const response = await fetch(`${API_URL}/api/properties/search?q=${encodeURIComponent(query)}&limit=10`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    if (response.ok) {
      const data = await response.json()
      propertySearchResults.value = data.properties || []
      showPropertyDropdown.value = true
    }
  } catch (error) {
    console.error('Error searching properties:', error)
    propertySearchResults.value = []
  } finally {
    searchingProperties.value = false
  }
}

function selectProperty(property: PropertySearchResult) {
  selectedProperty.value = property
  sendForm.value.property_address = property.address_line1 || ''
  sendForm.value.property_city = property.city || ''
  sendForm.value.property_postcode = property.postcode || ''
  sendForm.value.linked_property_id = property.id
  propertySearchQuery.value = property.formatted_address
  showPropertyDropdown.value = false
  isManualEntry.value = false
}

function switchToManualEntry() {
  isManualEntry.value = true
  selectedProperty.value = null
  sendForm.value.linked_property_id = null
  propertySearchQuery.value = ''
  showPropertyDropdown.value = false
}

function clearPropertySelection() {
  selectedProperty.value = null
  sendForm.value.property_address = ''
  sendForm.value.property_city = ''
  sendForm.value.property_postcode = ''
  sendForm.value.linked_property_id = null
  propertySearchQuery.value = ''
  isManualEntry.value = false
}

// Max holding deposit = 1 week rent (legal maximum)
const maxHoldingDeposit = computed(() => {
  if (sendForm.value.rent_amount && sendForm.value.rent_amount > 0) {
    return Math.floor((sendForm.value.rent_amount * 12) / 52)
  }
  return null
})

// Auto-calculate deposits when rent changes
// Holding Deposit = 1 week rent = (rent * 12 / 52), rounded down to nearest £1
// Deposit = 5 weeks rent = (rent * 12 / 52) * 5, rounded down to nearest £1
watch(() => sendForm.value.rent_amount, (newRent) => {
  if (newRent && newRent > 0) {
    const weeklyRent = (newRent * 12) / 52
    sendForm.value.holding_deposit_amount = Math.floor(weeklyRent) // 1 week
    sendForm.value.deposit_amount = Math.floor(weeklyRent * 5) // 5 weeks
  } else {
    sendForm.value.holding_deposit_amount = null
    sendForm.value.deposit_amount = null
  }
})

const statusCounts = computed(() => ({
  sent: offers.value.filter(o => o.status === 'sent').length,
  pending: offers.value.filter(o => o.status === 'pending').length,
  approved: offers.value.filter(o => o.status === 'approved' && !o.tenant_payment_confirmed_at).length,
  payment_pending: offers.value.filter(o => o.status === 'approved' && o.tenant_payment_confirmed_at && !o.reference_id).length,
  deposit_received: offers.value.filter(o => o.status === 'deposit_received' || o.status === 'holding_deposit_received' || (o.status === 'approved' && o.reference_id)).length
}))

const filteredOffers = computed(() => {
  let result = offers.value

  if (statusFilter.value) {
    if (statusFilter.value === 'deposit_received') {
      result = result.filter(o => o.status === 'deposit_received' || o.status === 'holding_deposit_received' || (o.status === 'approved' && o.reference_id))
    } else if (statusFilter.value === 'approved') {
      result = result.filter(o => o.status === 'approved' && !o.tenant_payment_confirmed_at)
    } else if (statusFilter.value === 'payment_pending') {
      result = result.filter(o => o.status === 'approved' && o.tenant_payment_confirmed_at && !o.reference_id)
    } else {
      result = result.filter(o => o.status === statusFilter.value)
    }
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(o =>
      o.property_address?.toLowerCase().includes(query) ||
      o.tenant_first_name?.toLowerCase().includes(query) ||
      o.tenant_last_name?.toLowerCase().includes(query) ||
      o.tenant_email?.toLowerCase().includes(query)
    )
  }

  return result
})

const isFormValid = computed(() => {
  const hasProperty = selectedProperty.value !== null || (
    isManualEntry.value &&
    sendForm.value.property_address &&
    sendForm.value.property_postcode
  )
  // Check holding deposit doesn't exceed max (1 week rent)
  const holdingDepositValid = !sendForm.value.holding_deposit_amount ||
    !maxHoldingDeposit.value ||
    sendForm.value.holding_deposit_amount <= maxHoldingDeposit.value

  return sendForm.value.tenant_first_name &&
         sendForm.value.tenant_last_name &&
         sendForm.value.tenant_email &&
         hasProperty &&
         sendForm.value.rent_amount &&
         holdingDepositValid
})

function formatStatus(status: string, offer?: any) {
  // Check for tenant marked as paid state
  if (status === 'approved' && offer?.tenant_payment_confirmed_at && !offer?.reference_id) {
    return 'Tenant Marked as Paid'
  }
  if (status === 'approved' && offer?.reference_id) {
    return 'Sent to Referencing'
  }
  const labels: Record<string, string> = {
    sent: 'Sent',
    pending: 'Pending Review',
    approved: 'Awaiting Payment',
    declined: 'Declined',
    holding_deposit_received: 'Sent to Referencing',
    deposit_received: 'Sent to Referencing',
    accepted_with_changes: 'Accepted (Changes)'
  }
  return labels[status] || status
}

function getStatusClass(status: string, offer?: any) {
  // Check for payment pending state
  if (status === 'approved' && offer?.tenant_payment_confirmed_at && !offer?.reference_id) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  if (status === 'approved' && offer?.reference_id) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (status === 'approved') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (status === 'pending') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  if (status === 'declined') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (status === 'sent') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (status === 'holding_deposit_received' || status === 'deposit_received') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelativeDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function clearFilters() {
  statusFilter.value = ''
  searchQuery.value = ''
}

function openOffer(offer: any) {
  selectedOffer.value = offer
  showDetailModal.value = true
}

function closeDetailModal() {
  showDetailModal.value = false
  selectedOffer.value = null
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function toggleOfferSelection(offerId: string) {
  const index = selectedOfferIds.value.indexOf(offerId)
  if (index === -1) {
    selectedOfferIds.value.push(offerId)
  } else {
    selectedOfferIds.value.splice(index, 1)
  }
}

// ============================================================================
// DECLINE MODAL
// ============================================================================

function openDeclineModal() {
  // Single offer decline from detail modal
  if (selectedOffer.value) {
    bulkDeclineIds.value = [selectedOffer.value.id]
  }
  declineForm.value = { reason: '', customReason: '' }
  showDeclineModal.value = true
}

function openBulkDeclineModal() {
  // Multi-select decline
  bulkDeclineIds.value = [...selectedOfferIds.value]
  declineForm.value = { reason: '', customReason: '' }
  showDeclineModal.value = true
}

function closeDeclineModal() {
  showDeclineModal.value = false
  bulkDeclineIds.value = []
  declineForm.value = { reason: '', customReason: '' }
}

async function submitDecline() {
  if (bulkDeclineIds.value.length === 0) return

  const reason = declineForm.value.reason === 'custom'
    ? declineForm.value.customReason
    : declineForm.value.reason

  if (!reason) return

  processingAction.value = true
  let successCount = 0
  let errorCount = 0

  try {
    for (const offerId of bulkDeclineIds.value) {
      try {
        const response = await fetch(`${API_URL}/api/tenant-offers/${offerId}/decline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`,
            'Content-Type': 'application/json',
            'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
          },
          body: JSON.stringify({ reason })
        })
        if (response.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} offer(s) declined`)
      selectedOfferIds.value = []
      closeDeclineModal()
      closeDetailModal()
      refreshData()
    }
    if (errorCount > 0) {
      toast.error(`Failed to decline ${errorCount} offer(s)`)
    }
  } catch (error) {
    console.error('Error declining offers:', error)
    toast.error('Failed to decline offers')
  } finally {
    processingAction.value = false
  }
}

// ============================================================================
// ACCEPT WITH CHANGES MODAL
// ============================================================================

function openAcceptChangesModal() {
  if (!selectedOffer.value) return
  // Pre-fill with current offer values
  changesForm.value = {
    offered_rent_amount: selectedOffer.value.offered_rent_amount || selectedOffer.value.rent_amount || null,
    proposed_move_in_date: selectedOffer.value.proposed_move_in_date || selectedOffer.value.move_in_date || '',
    proposed_tenancy_length_months: selectedOffer.value.proposed_tenancy_length_months || 12,
    deposit_amount: selectedOffer.value.deposit_amount || null
  }
  showAcceptChangesModal.value = true
}

function closeAcceptChangesModal() {
  showAcceptChangesModal.value = false
}

async function submitAcceptWithChanges() {
  if (!selectedOffer.value) return

  processingAction.value = true
  try {
    // First update the offer with changes, then approve
    // We'll call approve with the changes included
    const response = await fetch(`${API_URL}/api/tenant-offers/${selectedOffer.value.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify({
        accept_with_changes: true,
        changes: {
          offered_rent_amount: changesForm.value.offered_rent_amount,
          proposed_move_in_date: changesForm.value.proposed_move_in_date,
          proposed_tenancy_length_months: changesForm.value.proposed_tenancy_length_months,
          deposit_amount: changesForm.value.deposit_amount
        }
      })
    })

    if (response.ok) {
      closeAcceptChangesModal()
      closeDetailModal()
      refreshData()
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to accept offer with changes')
    }
  } catch (error) {
    console.error('Error accepting offer:', error)
    toast.error('Failed to accept offer')
  } finally {
    processingAction.value = false
  }
}

// ============================================================================
// APPROVE OFFER
// ============================================================================

async function approveOffer() {
  if (!selectedOffer.value) return

  processingAction.value = true
  try {
    const response = await fetch(`${API_URL}/api/tenant-offers/${selectedOffer.value.id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    if (response.ok) {
      closeDetailModal()
      refreshData()
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to approve offer')
    }
  } catch (error) {
    console.error('Error approving offer:', error)
    toast.error('Failed to approve offer')
  } finally {
    processingAction.value = false
  }
}

// ============================================================================
// SEND TO REFERENCING (V2) - Also receipts payment in one step
// ============================================================================

function openReceiptModal() {
  receiptAmount.value = calculatedHoldingDeposit.value || null
  showAddTenantForm.value = false
  newTenant.value = { first_name: '', last_name: '', email: '', phone: '', rent_share: null }

  // Populate tenants from the offer
  const offerTenants = (selectedOffer.value?.tenants || []).map((t: any) => ({
    first_name: t.name?.split(' ')[0] || t.first_name || '',
    last_name: t.name?.split(' ').slice(1).join(' ') || t.last_name || '',
    email: t.email || '',
    phone: t.phone || '',
    rent_share: t.rent_share || null
  }))

  // Fallback to main tenant fields if no tenants array
  if (offerTenants.length === 0 && selectedOffer.value) {
    offerTenants.push({
      first_name: selectedOffer.value.tenant_first_name || '',
      last_name: selectedOffer.value.tenant_last_name || '',
      email: selectedOffer.value.tenant_email || '',
      phone: '',
      rent_share: null
    })
  }

  receiptTenants.value = offerTenants
  originalTenantCount.value = offerTenants.length
  showReceiptModal.value = true
}

function addTenantToReceipt() {
  if (!newTenant.value.first_name || !newTenant.value.last_name || !newTenant.value.email) return
  receiptTenants.value.push({ ...newTenant.value })
  newTenant.value = { first_name: '', last_name: '', email: '', phone: '', rent_share: null }
  showAddTenantForm.value = false
}

async function confirmReceiptAndSendToReferencing() {
  showReceiptModal.value = false
  await sendToReferencing()
}

async function sendToReferencing() {
  if (!selectedOffer.value) return

  processingAction.value = true
  try {
    // Use tenants from receipt modal (includes any added tenants)
    const tenants = receiptTenants.value

    const payload = {
      property_address: selectedOffer.value.property_address,
      property_city: selectedOffer.value.property_city || '',
      property_postcode: selectedOffer.value.property_postcode || '',
      monthly_rent: selectedOffer.value.offered_rent_amount || selectedOffer.value.rent_amount,
      move_in_date: selectedOffer.value.proposed_move_in_date || selectedOffer.value.move_in_date,
      linkedPropertyId: selectedOffer.value.linked_property_id,
      termMonths: selectedOffer.value.proposed_tenancy_length_months || 12,
      billsIncluded: selectedOffer.value.bills_included || false,
      tenants,
      holding_deposit_amount: receiptAmount.value || null,
      offer_id: selectedOffer.value.id
    }

    const response = await fetch(`${API_URL}/api/v2/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      const data = await response.json()
      // Update offer status to holding_deposit_received
      if (data.references && data.references.length > 0) {
        const markRes = await fetch(`${API_URL}/api/tenant-offers/${selectedOffer.value.id}/mark-referencing`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`,
            'Content-Type': 'application/json',
            'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
          },
          body: JSON.stringify({ reference_id: data.references[0].id })
        })
        if (!markRes.ok) {
          console.error('[V2 Offers] Failed to mark offer as referencing:', await markRes.text())
        } else {
          console.log('[V2 Offers] Offer marked as referencing successfully')
        }
      } else {
        console.warn('[V2 Offers] No references returned, cannot mark offer as referencing')
      }
      closeDetailModal()
      await refreshData()
      toast.success(`${data.count} reference(s) created and sent to tenant(s)`)
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to create references')
    }
  } catch (error) {
    console.error('Error sending to referencing:', error)
    toast.error('Failed to send to referencing')
  } finally {
    processingAction.value = false
  }
}

// ============================================================================
// SEND TO LANDLORD
// ============================================================================

async function fetchLandlordEmail(offerIds: string[]) {
  try {
    const response = await fetch(`${API_URL}/api/v2/offers/landlord-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify({ offerIds })
    })
    if (response.ok) {
      landlordEmailInfo.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching landlord email:', error)
  }
}

async function openSendToLandlordModal(offerIds?: string[]) {
  sendToLandlordSuccess.value = false
  sendToLandlordError.value = ''
  manualLandlordEmail.value = ''

  // If no specific IDs provided, use currently selected offer
  if (offerIds && offerIds.length > 0) {
    selectedOfferIds.value = offerIds
  } else if (selectedOffer.value) {
    selectedOfferIds.value = [selectedOffer.value.id]
  } else {
    sendToLandlordError.value = 'No offer selected'
    return
  }

  await fetchLandlordEmail(selectedOfferIds.value)
  showSendToLandlordModal.value = true
}

async function sendOffersToLandlord() {
  sendingToLandlord.value = true
  sendToLandlordError.value = ''
  sendToLandlordSuccess.value = false

  try {
    const emailToUse = landlordEmailInfo.value.email || manualLandlordEmail.value
    if (!emailToUse) {
      sendToLandlordError.value = 'Please enter a landlord email address'
      return
    }

    const response = await fetch(`${API_URL}/api/v2/offers/send-to-landlord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify({
        offerIds: selectedOfferIds.value,
        landlordEmail: landlordEmailInfo.value.email ? null : manualLandlordEmail.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      sendToLandlordError.value = data.error || 'Failed to send to landlord'
      return
    }

    sendToLandlordSuccess.value = true
    // Refresh offers list to show "Sent to Landlord" tag
    await fetchOffers()
    setTimeout(() => {
      showSendToLandlordModal.value = false
      selectedOfferIds.value = []
    }, 2000)
  } catch (error: any) {
    console.error('Error sending to landlord:', error)
    sendToLandlordError.value = error.message || 'Failed to send to landlord'
  } finally {
    sendingToLandlord.value = false
  }
}

function closeSendModal() {
  showSendModal.value = false
  sendForm.value = {
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    linked_property_id: null,
    rent_amount: null,
    holding_deposit_amount: null,
    deposit_amount: null,
    move_in_date: '',
    offer_deposit_replacement: false
  }
  // Reset calendar state
  showMoveInCalendar.value = false
  calendarViewMonth.value = new Date().getMonth()
  calendarViewYear.value = new Date().getFullYear()
  // Reset property search state
  propertySearchQuery.value = ''
  propertySearchResults.value = []
  selectedProperty.value = null
  isManualEntry.value = false
  showPropertyDropdown.value = false
}

async function sendOffer() {
  if (!isFormValid.value) return

  sending.value = true
  try {
    // Backend expects these fields for /send-link
    const payload: Record<string, any> = {
      tenant_email: sendForm.value.tenant_email,
      tenant_first_name: sendForm.value.tenant_first_name,
      tenant_last_name: sendForm.value.tenant_last_name,
      property_address: sendForm.value.property_address,
      property_city: sendForm.value.property_city,
      property_postcode: sendForm.value.property_postcode,
      rent_amount: sendForm.value.rent_amount,
      holding_deposit_amount: sendForm.value.holding_deposit_amount,
      deposit_amount: sendForm.value.deposit_amount,
      move_in_date: sendForm.value.move_in_date || null,
      offer_deposit_replacement: sendForm.value.offer_deposit_replacement
    }

    // Include linked property ID if a property was selected
    if (sendForm.value.linked_property_id) {
      payload.linked_property_id = sendForm.value.linked_property_id
    }

    const response = await fetch(`${API_URL}/api/v2/offers/send-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      closeSendModal()
      refreshData()
      toast.success('Offer sent successfully!')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to send offer')
    }
  } catch (error) {
    console.error('Error sending offer:', error)
    toast.error('Failed to send offer')
  } finally {
    sending.value = false
  }
}

async function resendOffer(offer: any) {
  if (resendingOfferId.value) return

  resendingOfferId.value = offer.id

  try {
    const response = await fetch(`${API_URL}/api/v2/offers/resend/${offer.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    if (response.ok) {
      toast.success('Offer email resent successfully!')
    } else {
      const error = await response.json()
      toast.error(error.error || 'Failed to resend offer')
    }
  } catch (error) {
    console.error('Error resending offer:', error)
    toast.error('Failed to resend offer')
  } finally {
    resendingOfferId.value = null
  }
}

async function deleteSelectedOffers() {
  if (selectedOfferIds.value.length === 0) return

  const count = selectedOfferIds.value.length
  if (!confirm(`Are you sure you want to delete ${count} offer(s)? This cannot be undone.`)) {
    return
  }

  deletingOffers.value = true
  let successCount = 0
  let errorCount = 0

  try {
    // Delete offers one by one (both sent forms and received offers)
    for (const offerId of selectedOfferIds.value) {
      const offer = offers.value.find(o => o.id === offerId)
      try {
        // Determine if it's a sent form or a received offer based on status
        const endpoint = offer?.status === 'sent'
          ? `${API_URL}/api/v2/offers/sent/${offerId}`
          : `${API_URL}/api/v2/offers/${offerId}`

        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`,
            'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
          }
        })

        if (response.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        console.error(`Error deleting offer ${offerId}:`, error)
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} offer(s) deleted successfully`)
      selectedOfferIds.value = []
      refreshData()
    }
    if (errorCount > 0) {
      toast.error(`Failed to delete ${errorCount} offer(s)`)
    }
  } catch (error) {
    console.error('Error deleting offers:', error)
    toast.error('Failed to delete offers')
  } finally {
    deletingOffers.value = false
  }
}

async function fetchOffers() {
  loading.value = true
  try {
    // Fetch both sent forms and received offers (V2 endpoints)
    const [formsResponse, offersResponse] = await Promise.all([
      fetch(`${API_URL}/api/v2/offers/sent`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
        }
      }),
      fetch(`${API_URL}/api/v2/offers`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
        }
      })
    ])

    const allOffers: any[] = []

    if (formsResponse.ok) {
      const formsData = await formsResponse.json()
      console.log('[V2 Offers] Sent forms received:', formsData.sentForms?.length || 0)
      // Mark sent forms with status 'sent'
      const sentForms = (formsData.sentForms || []).map((f: any) => ({
        ...f,
        status: 'sent',
        tenant_first_name: f.tenant_first_name || '',
        tenant_last_name: f.tenant_last_name || ''
      }))
      allOffers.push(...sentForms)
    } else {
      console.error('[V2 Offers] Sent forms fetch failed:', formsResponse.status, await formsResponse.text().catch(() => ''))
    }

    if (offersResponse.ok) {
      const offersData = await offersResponse.json()
      // Extract lead tenant name from tenants array
      const offersWithNames = (offersData.offers || []).map((o: any) => {
        if (!o.tenant_first_name && o.tenants?.length > 0) {
          const leadTenant = o.tenants[0]
          const nameParts = (leadTenant.name || '').split(' ')
          o.tenant_first_name = nameParts[0] || ''
          o.tenant_last_name = nameParts.slice(1).join(' ') || ''
        }
        return o
      })
      allOffers.push(...offersWithNames)
    }

    // Sort by created_at descending
    offers.value = allOffers.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  } catch (error) {
    console.error('Error fetching offers:', error)
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await fetchOffers()
}

onMounted(() => {
  fetchOffers()
})
</script>
