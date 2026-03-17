<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50" @click="$emit('update:open', false)">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/30"></div>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-300 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="open && person"
        class="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col transition-colors duration-300"
        @click.stop
      >
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 transition-colors duration-300">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-3">
                <span
                  class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                  :class="person.role === 'GUARANTOR' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'"
                >
                  {{ person.role === 'GUARANTOR' ? 'G' : 'T' }}
                </span>
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ person.name }}</h2>
                  <p class="text-sm text-gray-500 dark:text-slate-400">
                    {{ person.role === 'GUARANTOR' ? 'Guarantor' : 'Tenant' }}
                    <span v-if="person.rentShare"> · {{ formatCurrency(person.rentShare) }}/mo</span>
                  </p>
                </div>
              </div>
              <div class="mt-2">
                <StatusPill :verificationState="person.verificationState" />
              </div>
            </div>
            <button
              @click="$emit('update:open', false)"
              class="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Quick Actions -->
          <div class="mt-4 flex items-center gap-2 flex-wrap">
            <button
              @click="handleResend"
              :disabled="resendingForm"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="resendingForm" class="flex items-center gap-1">
                <Loader2 class="animate-spin h-4 w-4" />
                Sending...
              </span>
              <span v-else>Resend Form</span>
            </button>
            <button
              @click="handleViewCertificate"
              v-if="hasCertificate"
              :disabled="loadingCertificate"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              <span v-if="loadingCertificate" class="flex items-center gap-1">
                <Loader2 class="animate-spin h-4 w-4" />
                Loading...
              </span>
              <span v-else>View Certificate</span>
            </button>
            <button
              v-if="hasLinkedOffer"
              @click="showOfferModal = true"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-1"
            >
              <Eye class="w-4 h-4" />
              See Offer
            </button>
            <button
              v-if="canAddGuarantor"
              @click="handleAddGuarantor"
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
            >
              + Add Guarantor
            </button>
            <button
              v-if="canDelete"
              @click="handleDelete"
              class="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-700 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-1"
            >
              <Trash2 class="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <!-- Toast Notification -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-4"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-4"
        >
          <div
            v-if="toastMessage"
            class="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg shadow-lg"
            :class="toastType === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'"
          >
            {{ toastMessage }}
          </div>
        </Transition>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
          <!-- Loading State -->
          <div v-if="loadingDetails" class="p-6 flex justify-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <template v-else>
            <!-- Action Required Banner - Always show when status is ACTION_REQUIRED -->
            <div v-if="person.verificationState === 'ACTION_REQUIRED'" class="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <h3 class="text-sm font-semibold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
                <AlertTriangle class="w-5 h-5" />
                Action Required
              </h3>

              <!-- Use enriched data from API if available -->
              <div v-if="actionRequiredDetails?.sections?.length" class="space-y-3">
                <div
                  v-for="section in actionRequiredDetails.sections"
                  :key="section.sectionType"
                  class="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ getSectionLabel(section.sectionType as SectionType) }}</p>
                      <p class="text-sm font-semibold text-red-700 dark:text-red-400 mt-1">{{ section.reasonLabel || formatReasonCode(section.reasonCode) }}</p>
                      <p v-if="section.agentMessage" class="text-sm text-gray-600 dark:text-slate-400 mt-1">{{ section.agentMessage }}</p>
                      <p v-if="section.correctionCycle > 0" class="text-xs text-gray-500 dark:text-slate-500 mt-1">Correction cycle: {{ section.correctionCycle }}</p>
                    </div>
                  </div>
                </div>
                <!-- Helpful guidance message -->
                <p class="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  Please verify the contact details are correct and update if needed, or provide alternative referee details.
                </p>
              </div>

              <!-- Fallback to person.actionRequiredTasks if available -->
              <div v-else-if="person.actionRequiredTasks.length > 0" class="space-y-3">
                <div
                  v-for="task in person.actionRequiredTasks"
                  :key="task.sectionType"
                  class="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div class="flex items-start gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formatSectionType(task.sectionType) }}</p>
                      <p class="text-sm font-semibold text-red-700 dark:text-red-400 mt-1">{{ task.reasonLabel || 'Action needed' }}</p>
                      <p v-if="task.staffNote" class="text-sm text-gray-600 dark:text-slate-400 mt-1">{{ task.staffNote }}</p>
                    </div>
                  </div>
                </div>
                <!-- Helpful guidance message -->
                <p class="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  Please verify the contact details are correct and update if needed, or provide alternative referee details.
                </p>
              </div>

              <!-- Generic message when no specific reason is available -->
              <div v-else class="p-3 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
                <p class="text-sm text-gray-700 dark:text-slate-300">This reference requires action. Please review the documents and information below, then either:</p>
                <ul class="mt-2 text-sm text-gray-600 dark:text-slate-400 list-disc list-inside space-y-1">
                  <li>Upload new/updated documents</li>
                  <li>Update referee contact details</li>
                  <li>Or click "Resend Form" to have the tenant update their submission</li>
                </ul>
              </div>

            </div>

            <!-- Edit Actions Section - Shows for all non-finalized references -->
            <div v-if="canEdit" class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <p class="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase mb-3">Agent Actions</p>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="showUploadModal = true"
                  class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md flex items-center gap-1"
                >
                  <Upload class="w-4 h-4" />
                  Upload Documents
                </button>
                <button
                  @click="showRefereeModal = true"
                  class="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-md flex items-center gap-1"
                >
                  <Mail class="w-4 h-4" />
                  Update Referee Email
                </button>
                <button
                  @click="openEditNameModal"
                  class="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-md flex items-center gap-1"
                >
                  <Pencil class="w-4 h-4" />
                  Edit Name
                </button>
                <button
                  @click="openEditEmailModal"
                  class="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-md flex items-center gap-1"
                >
                  <Mail class="w-4 h-4" />
                  Edit Email
                </button>
                <button
                  @click="refreshReferenceStatus"
                  :disabled="refreshingStatus"
                  class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 rounded-md flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RefreshCw class="w-4 h-4" />
                  {{ refreshingStatus ? 'Refreshing...' : 'Refresh Status' }}
                </button>
              </div>
            </div>

            <!-- Assessment Result Section (for completed/rejected references) -->
            <div v-if="isVerified && (finalDecision || score?.final_remarks)" class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText class="w-5 h-5" />
                Assessment Result
              </h3>
              <div class="space-y-3">
                <div v-if="finalDecision" class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-600 dark:text-slate-400">Final Decision:</span>
                  <span
                    class="px-2.5 py-0.5 text-xs font-medium rounded-full"
                    :class="{
                      'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100': finalDecision === 'PASS' || finalDecision === 'VERIFIED_PASS',
                      'bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100': finalDecision === 'PASS_WITH_CONDITION' || finalDecision === 'VERIFIED_CONDITIONAL',
                      'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100': finalDecision === 'FAIL' || finalDecision === 'VERIFIED_FAIL',
                      'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200': !['PASS', 'VERIFIED_PASS', 'PASS_WITH_CONDITION', 'VERIFIED_CONDITIONAL', 'FAIL', 'VERIFIED_FAIL'].includes(finalDecision)
                    }"
                  >
                    {{ finalDecision.replace(/_/g, ' ') }}
                  </span>
                </div>
                <div v-if="score?.final_remarks" class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p class="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{{ score.final_remarks }}</p>
                </div>
              </div>
            </div>

            <!-- Section Status Overview -->
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Verification Sections</h3>
              <div v-if="person.sectionStatuses && person.sectionStatuses.length > 0" class="grid grid-cols-2 gap-2">
                <div
                  v-for="section in person.sectionStatuses"
                  :key="section.type"
                  class="p-3 rounded-lg border"
                  :class="getSectionBorderClass(section.decision)"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getSectionLabel(section.type) }}</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded"
                      :class="getSectionBadgeClass(section.decision)"
                    >
                      {{ getSectionDecisionLabel(section.decision) }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Show verified status for legacy verifications that don't have section data -->
              <div v-else-if="isVerified" class="text-center py-4">
                <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span class="text-sm font-medium text-green-800 dark:text-green-300">Verification Complete</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-slate-400 mt-2">Verified before section-based tracking was implemented</p>
              </div>
              <div v-else class="text-center py-4">
                <p class="text-sm text-gray-500 dark:text-slate-400">Not yet reviewed by verification team</p>
              </div>
            </div>

            <!-- Personal Details -->
            <CollapsibleSection title="Personal Details" :defaultOpen="true">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Full Name</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ getFullName() }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Date of Birth</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails?.date_of_birth ? formatDate(fullDetails.date_of_birth) : 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Email</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails?.tenant_email || person.email }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Phone</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails?.tenant_phone || fullDetails?.contact_number || person.phone || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Nationality</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails?.nationality || 'Not provided' }}</p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Property Information -->
            <CollapsibleSection title="Property Information" v-if="fullDetails?.property_address">
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Property Address</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.property_address }}</p>
                  <p v-if="fullDetails.property_city || fullDetails.property_postcode" class="text-sm text-gray-900 dark:text-white">
                    {{ fullDetails.property_city }}<span v-if="fullDetails.property_city && fullDetails.property_postcode">, </span>{{ fullDetails.property_postcode }}
                  </p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div v-if="fullDetails.monthly_rent">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Monthly Rent</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.monthly_rent)) }}</p>
                  </div>
                  <div v-if="fullDetails.move_in_date">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Move-in Date</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.move_in_date) }}</p>
                  </div>
                  <div v-if="fullDetails.holding_deposit_amount">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Holding Deposit</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.holding_deposit_amount)) }}</p>
                  </div>
                  <div v-if="fullDetails.term_months || fullDetails.term_years">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Tenancy Term</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">
                      <span v-if="fullDetails.term_years">{{ fullDetails.term_years }} year<span v-if="fullDetails.term_years > 1">s</span></span>
                      <span v-if="fullDetails.term_years && fullDetails.term_months"> </span>
                      <span v-if="fullDetails.term_months">{{ fullDetails.term_months }} month<span v-if="fullDetails.term_months > 1">s</span></span>
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <!-- About the Tenant (Tenant Only) -->
            <CollapsibleSection v-if="person.role === 'TENANT' && hasAboutTenantData" title="About the Tenant">
              <div class="grid grid-cols-2 gap-4">
                <div v-if="fullDetails?.is_smoker !== null && fullDetails?.is_smoker !== undefined">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Smoker</label>
                  <p class="mt-1">
                    <span :class="fullDetails.is_smoker ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {{ fullDetails.is_smoker ? 'Yes' : 'No' }}
                    </span>
                  </p>
                </div>
                <div v-if="fullDetails?.has_pets !== null && fullDetails?.has_pets !== undefined">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Has Pets</label>
                  <p class="mt-1">
                    <span :class="fullDetails.has_pets ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {{ fullDetails.has_pets ? 'Yes' : 'No' }}
                    </span>
                  </p>
                </div>
                <div v-if="fullDetails?.pet_details" class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Pet Details</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.pet_details }}</p>
                </div>
                <div v-if="fullDetails?.marital_status">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Marital Status</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ fullDetails.marital_status.replace(/_/g, ' ') }}</p>
                </div>
                <div v-if="fullDetails?.num_dependants !== null && fullDetails?.num_dependants !== undefined">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Dependants</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.num_dependants }}</p>
                </div>
                <div v-if="fullDetails?.dependants_details" class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Dependants Details</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.dependants_details }}</p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Consent Declaration -->
            <CollapsibleSection v-if="fullDetails?.consent_agreed_at" title="Consent Declaration">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Agreed On</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDateTime(fullDetails.consent_agreed_at) }}</p>
                </div>
                <div v-if="fullDetails?.consent_printed_name">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Signed Name</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.consent_printed_name }}</p>
                </div>
              </div>
              <div v-if="fullDetails?.consent_pdf_path" class="mt-3">
                <button
                  @click="viewDocument(fullDetails.consent_pdf_path)"
                  class="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                >
                  <FileText class="w-4 h-4" />
                  View Signed Consent
                </button>
              </div>
            </CollapsibleSection>

            <!-- Current Address -->
            <CollapsibleSection title="Current Address" v-if="fullDetails?.current_address_line1">
              <div class="space-y-1">
                <p class="text-sm text-gray-900 dark:text-white">{{ fullDetails.current_address_line1 }}</p>
                <p v-if="fullDetails.current_address_line2" class="text-sm text-gray-900 dark:text-white">{{ fullDetails.current_address_line2 }}</p>
                <p class="text-sm text-gray-900 dark:text-white">{{ fullDetails.current_city }}, {{ fullDetails.current_postcode }}</p>
                <p v-if="fullDetails.current_country" class="text-sm text-gray-500 dark:text-slate-400">{{ fullDetails.current_country }}</p>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-4">
                <div v-if="fullDetails.current_address_moved_in">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Moved In</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.current_address_moved_in) }}</p>
                </div>
                <div v-if="fullDetails.time_at_address_years !== null || fullDetails.time_at_address_months !== null">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Time at Address</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatTimeAtAddress(fullDetails.time_at_address_years, fullDetails.time_at_address_months) }}</p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Address History (3 Years) -->
            <CollapsibleSection
              v-if="fullDetails?.previousAddresses && fullDetails.previousAddresses.length > 0"
              title="Address History"
              :badge="fullDetails.previousAddresses.length.toString()"
            >
              <div class="space-y-3">
                <div
                  v-for="(addr, index) in fullDetails.previousAddresses"
                  :key="index"
                  class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border-l-2 border-gray-300"
                >
                  <div class="flex items-start justify-between">
                    <div class="space-y-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ addr.line1 }}</p>
                      <p v-if="addr.line2" class="text-sm text-gray-700 dark:text-slate-300">{{ addr.line2 }}</p>
                      <p class="text-sm text-gray-700 dark:text-slate-300">{{ addr.city }}, {{ addr.postcode }}</p>
                      <p v-if="addr.country" class="text-xs text-gray-500 dark:text-slate-400">{{ addr.country }}</p>
                    </div>
                    <span class="text-xs text-gray-500 font-medium">#{{ index + 1 }}</span>
                  </div>
                  <p v-if="addr.moved_in" class="mt-2 text-xs text-gray-500">
                    Moved in: {{ formatDate(addr.moved_in) }}
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Right to Rent (Tenants only) -->
            <CollapsibleSection
              v-if="person.role === 'TENANT'"
              title="Right to Rent"
              :status="getRTRStatus()"
            >
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">British Citizen</label>
                  <p class="mt-1">
                    <span v-if="fullDetails?.is_british_citizen === true" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Yes
                    </span>
                    <span v-else-if="fullDetails?.is_british_citizen === false" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      No - RTR Check Required
                    </span>
                    <span v-else class="text-sm text-gray-500 dark:text-slate-400">Not provided</span>
                  </p>
                </div>
                <div v-if="fullDetails?.is_british_citizen === false">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">RTR Verified</label>
                  <p class="mt-1">
                    <span v-if="fullDetails?.rtr_verified" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Verified
                    </span>
                    <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  </p>
                </div>
              </div>

              <!-- RTR Verification Details -->
              <div v-if="fullDetails?.rtr_verified && fullDetails?.rtr_verification_data" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Share Code</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white font-mono">{{ fullDetails.rtr_share_code || 'N/A' }}</p>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Verification Date</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.rtr_verification_date ? formatDate(fullDetails.rtr_verification_date) : 'N/A' }}</p>
                  </div>
                  <div v-if="fullDetails.rtr_verification_data?.immigrationStatus" class="col-span-2">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Immigration Status</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.rtr_verification_data.immigrationStatus }}</p>
                  </div>
                  <div v-if="fullDetails.rtr_verification_data?.expiryDate">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Expiry Date</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.rtr_verification_data.expiryDate) }}</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Employment & Income -->
            <CollapsibleSection
              title="Employment & Income"
              :status="getEmploymentStatus()"
            >
              <div v-if="hasEmploymentData" class="space-y-4">
                <!-- Income Sources Badges -->
                <div class="flex flex-wrap gap-2 pb-3 border-b border-gray-200 dark:border-slate-700">
                  <span v-if="fullDetails?.employment_status === 'employed' || fullDetails?.employment_status === 'contractor'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                    Employed
                  </span>
                  <span v-if="fullDetails?.employment_status === 'self_employed' || fullDetails?.employment_status === 'director'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                    Self-Employed
                  </span>
                  <span v-if="fullDetails?.income_landlord_rental" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                    Landlord Income
                  </span>
                  <span v-if="fullDetails?.income_pension" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                    Pension
                  </span>
                  <span v-if="fullDetails?.employment_status === 'unemployed'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200">
                    Unemployed
                  </span>
                  <span v-if="fullDetails?.employment_status === 'student'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                    Student
                  </span>
                  <span v-if="fullDetails?.employment_status === 'retired'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                    Retired
                  </span>
                  <span v-if="fullDetails?.savings_amount" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                    Savings
                  </span>
                  <span v-if="fullDetails?.additional_income_source" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Additional Income
                  </span>
                  <span v-if="fullDetails?.receives_benefits" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Benefits
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Employment Status</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ formatEmploymentStatus(fullDetails?.employment_status) }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_company_name">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Company</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.employment_company_name }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_job_title">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Job Title</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.employment_job_title }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_salary_amount">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Annual Salary</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.employment_salary_amount)) }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_start_date">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Start Date</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.employment_start_date) }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_end_date">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">End Date</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.employment_end_date) }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_type">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Employment Type</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ fullDetails.employment_type.replace(/_/g, ' ') }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_contract_type">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Contract Type</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ formatContractType(fullDetails.employment_contract_type) }}</p>
                  </div>
                  <div v-if="fullDetails?.employment_salary_frequency">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Pay Frequency</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ formatPayFrequency(fullDetails.employment_salary_frequency) }}</p>
                  </div>
                  <div v-if="fullDetails?.compensation_type">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Pay Type</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ fullDetails.compensation_type }}</p>
                  </div>
                  <div v-if="fullDetails?.hourly_rate">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Hourly Rate</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.hourly_rate)) }}</p>
                  </div>
                  <div v-if="fullDetails?.hours_per_month">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Hours/Month</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.hours_per_month }}</p>
                  </div>
                </div>

                <!-- Landlord/Rental Income -->
                <div v-if="fullDetails?.income_landlord_rental" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Landlord Rental Income</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Monthly Amount</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-white">
                        {{ landlordRentalMonthlyAmount !== null ? formatCurrency(landlordRentalMonthlyAmount) : 'Not provided' }}
                      </p>
                    </div>
                    <div v-if="fullDetails.landlord_rental_bank_statement_path">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Bank Statement</label>
                      <button
                        type="button"
                        class="mt-1 text-sm text-primary hover:text-primary/80"
                        @click="viewDocument(fullDetails.landlord_rental_bank_statement_path)"
                      >
                        View document
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Pension Income -->
                <div v-if="fullDetails?.income_pension" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Pension Income</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Monthly Amount</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-white">
                        {{ pensionMonthlyAmount !== null ? formatCurrency(pensionMonthlyAmount) : 'Not provided' }}
                      </p>
                    </div>
                    <div v-if="fullDetails.pension_provider">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Provider</label>
                      <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.pension_provider }}</p>
                    </div>
                    <div v-if="fullDetails.pension_statement_path">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Pension Statement</label>
                      <button
                        type="button"
                        class="mt-1 text-sm text-primary hover:text-primary/80"
                        @click="viewDocument(fullDetails.pension_statement_path)"
                      >
                        View document
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Company Address -->
                <div v-if="fullDetails?.company_address_line_1" class="pt-3 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Company Address</label>
                  <div class="text-sm text-gray-900 dark:text-white space-y-0.5">
                    <p>{{ fullDetails.company_address_line_1 }}</p>
                    <p v-if="fullDetails.company_address_line_2">{{ fullDetails.company_address_line_2 }}</p>
                    <p v-if="fullDetails.company_city || fullDetails.company_postcode">
                      {{ fullDetails.company_city }}<span v-if="fullDetails.company_city && fullDetails.company_postcode">, </span>{{ fullDetails.company_postcode }}
                    </p>
                    <p v-if="fullDetails.company_country" class="text-gray-500 dark:text-slate-400">{{ fullDetails.company_country }}</p>
                  </div>
                </div>

                <!-- Self-Employment Details -->
                <div v-if="fullDetails?.employment_status === 'self_employed' || fullDetails?.employment_status === 'director'" class="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700">
                  <div v-if="fullDetails.self_employed_business_name">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Business Name</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.self_employed_business_name }}</p>
                  </div>
                  <div v-if="fullDetails.self_employed_annual_income">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Annual Income</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.self_employed_annual_income)) }}</p>
                  </div>
                  <div v-if="fullDetails.self_employed_nature_of_business">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Nature of Business</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.self_employed_nature_of_business }}</p>
                  </div>
                  <div v-if="fullDetails.self_employed_start_date">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Started Self-Employment</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(fullDetails.self_employed_start_date) }}</p>
                  </div>
                </div>

                <!-- Savings -->
                <div v-if="fullDetails?.savings_amount" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Savings</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.savings_amount)) }}</p>
                </div>

                <!-- Benefits -->
                <div v-if="fullDetails?.receives_benefits || fullDetails?.benefits_monthly_amount || fullDetails?.benefits_annual_amount" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Benefits</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-if="fullDetails?.benefits_monthly_amount">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Monthly Amount</label>
                      <p class="text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.benefits_monthly_amount)) }}</p>
                    </div>
                    <div v-if="fullDetails?.benefits_annual_amount">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Annual Amount</label>
                      <p class="text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.benefits_annual_amount)) }}</p>
                    </div>
                  </div>
                </div>

                <!-- Additional Income -->
                <div v-if="fullDetails?.additional_income_source" class="pt-3 border-t border-gray-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Additional Income Source</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ fullDetails.additional_income_source }}</p>
                  </div>
                  <div v-if="fullDetails?.additional_income_amount">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Additional Income Amount</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.additional_income_amount)) }}</p>
                  </div>
                  <div v-if="fullDetails?.additional_income_frequency">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Frequency</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white capitalize">{{ formatPayFrequency(fullDetails.additional_income_frequency) }}</p>
                  </div>
                </div>

                <!-- Employer Reference Request (what tenant provided) -->
                <div v-if="fullDetails?.employer_ref_email" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Employer Reference Request Sent To</p>
                    <div class="flex items-center gap-2">
                      <button
                        v-if="!employerRef?.submitted_at"
                        @click="handleResendEmployerRef"
                        :disabled="resendingEmployerRef"
                        class="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {{ resendingEmployerRef ? 'Sending...' : 'Resend' }}
                      </button>
                      <span
                        v-if="!employerRef?.submitted_at"
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                      >
                        Awaiting Response
                      </span>
                      <span
                        v-else
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                      >
                        Received
                      </span>
                    </div>
                  </div>
                  <div class="text-sm text-gray-700 dark:text-slate-300 space-y-1">
                    <p v-if="fullDetails.employer_ref_name">{{ fullDetails.employer_ref_name }}</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.employer_ref_email }}</p>
                    <p v-if="fullDetails.employer_ref_phone" class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.employer_ref_phone }}</p>
                  </div>
                  <!-- Response details when received -->
                  <div v-if="employerRef?.submitted_at" class="mt-3 pt-3 border-t border-blue-200 text-xs text-gray-600 dark:text-slate-400 space-y-1">
                    <p v-if="employerRef.annual_salary || (employerRef.is_hourly && employerRef.hourly_rate && employerRef.hours_per_week)">
                      Annual Income: {{ formatEmployerIncome(employerRef) }}
                    </p>
                    <p v-if="employerRef.employee_position">Confirmed Title: {{ employerRef.employee_position }}</p>
                    <p v-if="employerRef.start_date">Employment Start: {{ formatDate(employerRef.start_date) }}</p>
                    <p v-if="employerRef.performance_satisfactory !== undefined">Performance Satisfactory: {{ employerRef.performance_satisfactory ? 'Yes' : 'No' }}</p>
                    <p v-if="employerRef.would_reemploy !== undefined">Would Re-employ: {{ employerRef.would_reemploy ? 'Yes' : 'No' }}</p>
                  </div>
                </div>

                <!-- Accountant Reference Request (what tenant provided) -->
                <div v-if="fullDetails?.accountant_email" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Accountant Reference Request Sent To</p>
                    <div class="flex items-center gap-2">
                      <button
                        v-if="!accountantRef?.submitted_at"
                        @click="handleResendAccountantRef"
                        :disabled="resendingAccountantRef"
                        class="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {{ resendingAccountantRef ? 'Sending...' : 'Resend' }}
                      </button>
                      <span
                        v-if="!accountantRef?.submitted_at"
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                      >
                        Awaiting Response
                      </span>
                      <span
                        v-else
                        class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                      >
                        Received
                      </span>
                    </div>
                  </div>
                  <div class="text-sm text-gray-700 dark:text-slate-300 space-y-1">
                    <p v-if="fullDetails.accountant_name">{{ fullDetails.accountant_name }}</p>
                    <p v-if="fullDetails.accountant_contact_name" class="text-xs text-gray-600 dark:text-slate-400">Contact: {{ fullDetails.accountant_contact_name }}</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.accountant_email }}</p>
                    <p v-if="fullDetails.accountant_phone" class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.accountant_phone }}</p>
                  </div>
                </div>

                <!-- Accountant Reference Response -->
                <div v-if="accountantRef" class="mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Accountant Reference Response</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="accountantRef.submitted_at ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'"
                    >
                      {{ accountantRef.submitted_at ? 'Received' : 'Pending' }}
                    </span>
                  </div>
                  <p v-if="accountantRef.firm_name" class="text-sm text-gray-700 dark:text-slate-300 mt-1">{{ accountantRef.firm_name }}</p>
                  <p v-if="accountantRef.accountant_name" class="text-xs text-gray-600 dark:text-slate-400">Contact: {{ accountantRef.accountant_name }}</p>
                  <p v-if="accountantRef.accountant_email" class="text-xs text-gray-500 dark:text-slate-400">{{ accountantRef.accountant_email }}</p>
                  <p v-if="accountantRef.accountant_phone" class="text-xs text-gray-500 dark:text-slate-400">{{ accountantRef.accountant_phone }}</p>
                  <div v-if="accountantRef.submitted_at" class="mt-2 text-xs text-gray-600 dark:text-slate-400">
                    <p v-if="accountantRef.annual_profit || accountantRef.annual_turnover || accountantRef.estimated_monthly_income">
                      Annual Income: {{ formatAccountantIncome(accountantRef) }}
                    </p>
                    <p v-if="accountantRef.years_trading">Years Trading: {{ accountantRef.years_trading }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-500 dark:text-slate-400">Employment details not yet provided</p>
            </CollapsibleSection>

            <!-- Residential History (Tenants only) -->
            <CollapsibleSection
              v-if="person.role === 'TENANT'"
              title="Residential Reference"
              :status="getResidentialStatus()"
            >
              <div v-if="hasResidentialData" class="space-y-4">
                <!-- Verified Residential Status (if confirmed by staff) -->
                <div v-if="fullDetails?.confirmed_residential_status" class="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                  <div class="flex items-center gap-2">
                    <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span class="text-sm font-medium text-green-800 dark:text-green-200">Verified: {{ formatResidentialStatus(fullDetails.confirmed_residential_status) }}</span>
                  </div>
                </div>

                <!-- Living with Family (no landlord reference required) -->
                <div v-if="fullDetails?.reference_type === 'living_with_family'" class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase mb-2">Residential Situation</p>
                  <p class="text-sm text-gray-700 dark:text-slate-300">Living with family (no previous landlord)</p>
                </div>

                <!-- Previous Rental Details (what tenant provided) -->
                <div v-else-if="fullDetails?.previous_rental_address_line1 || fullDetails?.previous_landlord_name || fullDetails?.previous_landlord_email" class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase mb-2">Previous Rental (Tenant Provided)</p>
                  <div class="text-sm text-gray-700 dark:text-slate-300 space-y-1">
                    <p v-if="fullDetails.previous_rental_address_line1">
                      {{ fullDetails.previous_rental_address_line1 }}
                      <span v-if="fullDetails.previous_rental_address_line2">, {{ fullDetails.previous_rental_address_line2 }}</span>
                    </p>
                    <p v-if="fullDetails.previous_rental_city || fullDetails.previous_rental_postcode">
                      {{ fullDetails.previous_rental_city }}<span v-if="fullDetails.previous_rental_city && fullDetails.previous_rental_postcode">, </span>{{ fullDetails.previous_rental_postcode }}
                    </p>
                    <p v-if="fullDetails.previous_monthly_rent" class="text-xs text-gray-500 dark:text-slate-400">Rent: {{ formatCurrency(Number(fullDetails.previous_monthly_rent)) }}/mo</p>
                  </div>
                  <div v-if="fullDetails.previous_landlord_name || fullDetails.previous_landlord_email" class="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <div class="flex items-center justify-between mb-1">
                      <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Reference Request Sent To</p>
                      <div class="flex items-center gap-2">
                        <button
                          v-if="!landlordRef?.submitted_at && !agentRef?.submitted_at"
                          @click="handleResendLandlordRef"
                          :disabled="resendingLandlordRef"
                          class="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {{ resendingLandlordRef ? 'Sending...' : 'Resend' }}
                        </button>
                        <span
                          v-if="!landlordRef?.submitted_at && !agentRef?.submitted_at"
                          class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200"
                        >
                          Awaiting Response
                        </span>
                        <span
                          v-else
                          class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                        >
                          Received
                        </span>
                      </div>
                    </div>
                    <p v-if="fullDetails.previous_landlord_name" class="text-sm text-gray-700 dark:text-slate-300">{{ fullDetails.previous_landlord_name }}</p>
                    <p v-if="fullDetails.previous_landlord_email" class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.previous_landlord_email }}</p>
                    <p v-if="fullDetails.previous_landlord_phone" class="text-xs text-gray-500 dark:text-slate-400">{{ fullDetails.previous_landlord_phone }}</p>
                    <p v-if="fullDetails.previous_agency_name" class="text-xs text-gray-500 dark:text-slate-400">Agency: {{ fullDetails.previous_agency_name }}</p>
                  </div>
                </div>

                <!-- Reference Type indicator if not living_with_family but no address -->
                <div v-else-if="fullDetails?.reference_type && fullDetails.reference_type !== 'living_with_family'" class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase mb-2">Reference Type</p>
                  <p class="text-sm text-gray-700 dark:text-slate-300">{{ fullDetails.reference_type === 'agent' ? 'Letting Agent Reference' : 'Landlord Reference' }}</p>
                </div>

                <!-- Landlord Reference Response - only show if confirmed (received and filled) -->
                <div v-if="landlordRef && landlordRef.confirmed_at" class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Landlord Reference Response</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="landlordRef.confirmed_at ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'"
                    >
                      {{ landlordRef.confirmed_at ? 'Received' : 'Pending' }}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                    <p v-if="landlordRef.landlord_name">{{ landlordRef.landlord_name }}</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ landlordRef.landlord_email }}</p>
                    <p v-if="landlordRef.property_address">{{ landlordRef.property_address }}<span v-if="landlordRef.property_city">, {{ landlordRef.property_city }}</span><span v-if="landlordRef.property_postcode"> {{ landlordRef.property_postcode }}</span></p>
                    <p v-if="landlordRef.monthly_rent" class="text-xs">Rent: {{ formatCurrency(Number(landlordRef.monthly_rent)) }}/mo</p>
                  </div>
                  <div v-if="landlordRef.confirmed_at" class="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400">
                    <p v-if="landlordRef.tenancy_start_date">Tenancy Start: {{ formatDate(landlordRef.tenancy_start_date) }}</p>
                    <p v-if="landlordRef.tenancy_end_date">Tenancy End: {{ formatDate(landlordRef.tenancy_end_date) }}</p>
                    <p v-if="landlordRef.rent_paid_on_time !== undefined">Rent Paid On Time: {{ landlordRef.rent_paid_on_time ? 'Yes' : 'No' }}</p>
                    <p v-if="landlordRef.property_condition !== undefined">Property Kept in Good Condition: {{ landlordRef.property_condition ? 'Yes' : 'No' }}</p>
                    <p v-if="landlordRef.would_rent_again !== undefined">Would Rent Again: {{ landlordRef.would_rent_again ? 'Yes' : 'No' }}</p>
                    <p v-if="landlordRef.additional_comments" class="mt-1">Comments: {{ landlordRef.additional_comments }}</p>
                  </div>
                </div>

                <!-- Agent Reference Response - only show if confirmed (received and filled) -->
                <div v-if="agentRef && agentRef.confirmed_at" class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Agent Reference Response</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="agentRef.confirmed_at ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'"
                    >
                      {{ agentRef.confirmed_at ? 'Received' : 'Pending' }}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                    <p v-if="agentRef.agent_name">{{ agentRef.agent_name }}</p>
                    <p v-if="agentRef.agency_name" class="text-xs">{{ agentRef.agency_name }}</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ agentRef.agent_email }}</p>
                    <p v-if="agentRef.property_address">{{ agentRef.property_address }}<span v-if="agentRef.property_city">, {{ agentRef.property_city }}</span><span v-if="agentRef.property_postcode"> {{ agentRef.property_postcode }}</span></p>
                    <p v-if="agentRef.monthly_rent" class="text-xs">Rent: {{ formatCurrency(Number(agentRef.monthly_rent)) }}/mo</p>
                  </div>
                  <div v-if="agentRef.confirmed_at" class="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400">
                    <p v-if="agentRef.tenancy_start_date">Tenancy Start: {{ formatDate(agentRef.tenancy_start_date) }}</p>
                    <p v-if="agentRef.tenancy_end_date">Tenancy End: {{ formatDate(agentRef.tenancy_end_date) }}</p>
                    <p v-if="agentRef.rent_paid_on_time !== undefined">Rent Paid On Time: {{ agentRef.rent_paid_on_time ? 'Yes' : 'No' }}</p>
                    <p v-if="agentRef.property_condition !== undefined">Property Kept in Good Condition: {{ agentRef.property_condition ? 'Yes' : 'No' }}</p>
                    <p v-if="agentRef.would_rent_again !== undefined">Would Rent Again: {{ agentRef.would_rent_again ? 'Yes' : 'No' }}</p>
                    <p v-if="agentRef.additional_comments" class="mt-1">Comments: {{ agentRef.additional_comments }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-500 dark:text-slate-400">Residential references not yet provided</p>
            </CollapsibleSection>

            <!-- Adverse Credit Disclosure -->
            <CollapsibleSection
              v-if="fullDetails?.adverse_credit || fullDetails?.adverse_credit_details"
              title="Adverse Credit Disclosure"
              :status="fullDetails?.adverse_credit ? 'fail' : undefined"
            >
              <div v-if="fullDetails?.adverse_credit" class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div class="flex items-start gap-2">
                  <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="text-sm font-medium text-amber-800">Applicant has disclosed adverse credit history</p>
                    <p v-if="fullDetails.adverse_credit_details" class="mt-2 text-sm text-amber-700 whitespace-pre-wrap">{{ fullDetails.adverse_credit_details }}</p>
                  </div>
                </div>
              </div>
              <div v-else class="p-3 bg-green-50 rounded-lg">
                <div class="flex items-center gap-2">
                  <CheckCircle class="w-5 h-5 text-green-600" />
                  <p class="text-sm text-green-800">No adverse credit history disclosed</p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Guarantor Financial Position (Guarantors only) -->
            <CollapsibleSection
              v-if="person.role === 'GUARANTOR' && hasGuarantorFinancialData"
              title="Guarantor Financial Position"
            >
              <div class="space-y-4">
                <!-- Home Ownership -->
                <div class="grid grid-cols-2 gap-4">
                  <div v-if="fullDetails?.guarantorData?.home_ownership_status">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Home Ownership</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatHomeOwnership(fullDetails.guarantorData.home_ownership_status) }}</p>
                  </div>
                  <div v-if="fullDetails?.guarantorData?.property_value">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Property Value</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.guarantorData.property_value)) }}</p>
                  </div>
                  <div v-if="fullDetails?.guarantorData?.monthly_mortgage_rent">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Monthly Mortgage/Rent</label>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.guarantorData.monthly_mortgage_rent)) }}</p>
                  </div>
                </div>

                <!-- Pension & Income -->
                <div v-if="fullDetails?.guarantorData?.pension_amount" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Pension Income</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Amount</label>
                      <p class="text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.guarantorData.pension_amount)) }}</p>
                    </div>
                    <div v-if="fullDetails?.guarantorData?.pension_frequency">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Frequency</label>
                      <p class="text-sm text-gray-900 dark:text-white capitalize">{{ fullDetails.guarantorData.pension_frequency }}</p>
                    </div>
                  </div>
                </div>

                <!-- Monthly Commitments -->
                <div v-if="fullDetails?.guarantorData?.other_monthly_commitments || fullDetails?.guarantorData?.total_monthly_expenditure" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Monthly Expenditure</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div v-if="fullDetails?.guarantorData?.other_monthly_commitments">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Other Commitments</label>
                      <p class="text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.guarantorData.other_monthly_commitments)) }}</p>
                    </div>
                    <div v-if="fullDetails?.guarantorData?.total_monthly_expenditure">
                      <label class="block text-xs font-medium text-gray-400 dark:text-slate-500">Total Expenditure</label>
                      <p class="text-sm text-gray-900 dark:text-white">{{ formatCurrency(Number(fullDetails.guarantorData.total_monthly_expenditure)) }}</p>
                    </div>
                  </div>
                </div>

                <!-- Guarantor Obligations -->
                <div class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Guarantor Obligations</label>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-if="fullDetails?.guarantorData?.understands_obligations !== undefined"
                      :class="fullDetails.guarantorData.understands_obligations ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ fullDetails.guarantorData.understands_obligations ? 'Understands Obligations' : 'Does Not Understand' }}
                    </span>
                    <span
                      v-if="fullDetails?.guarantorData?.willing_to_pay_rent !== undefined"
                      :class="fullDetails.guarantorData.willing_to_pay_rent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ fullDetails.guarantorData.willing_to_pay_rent ? 'Willing to Pay Rent' : 'Not Willing to Pay Rent' }}
                    </span>
                    <span
                      v-if="fullDetails?.guarantorData?.willing_to_pay_damages !== undefined"
                      :class="fullDetails.guarantorData.willing_to_pay_damages ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ fullDetails.guarantorData.willing_to_pay_damages ? 'Willing to Pay Damages' : 'Not Willing to Pay Damages' }}
                    </span>
                    <span
                      v-if="fullDetails?.guarantorData?.previously_acted_as_guarantor"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      Previously Acted as Guarantor
                    </span>
                  </div>
                </div>

                <!-- Guarantor Adverse Credit -->
                <div v-if="fullDetails?.guarantorData?.adverse_credit" class="pt-3 border-t border-gray-200 dark:border-slate-700">
                  <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div class="flex items-start gap-2">
                      <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p class="text-sm font-medium text-amber-800">Guarantor has disclosed adverse credit</p>
                        <p v-if="fullDetails.guarantorData.adverse_credit_details" class="mt-2 text-sm text-amber-700 whitespace-pre-wrap">{{ fullDetails.guarantorData.adverse_credit_details }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Documents -->
            <CollapsibleSection title="Documents" :badge="totalDocumentCount > 0 ? totalDocumentCount.toString() : undefined">
              <div v-if="referenceDocuments.length > 0" class="space-y-2">
                <div
                  v-for="doc in referenceDocuments"
                  :key="doc.type"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div class="flex items-center gap-3">
                    <File class="w-5 h-5 text-gray-400" />
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ doc.label }}</p>
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="doc.path ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ doc.path ? 'Uploaded' : 'Not uploaded' }}
                      </span>
                    </div>
                  </div>
                  <button
                    v-if="doc.path"
                    @click="viewDocumentByPath(doc.type, doc.path)"
                    class="px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded"
                  >
                    View
                  </button>
                </div>
              </div>

              <!-- Additional Uploaded Documents (from reference_documents table) -->
              <div v-if="fullDetails?.documents?.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <p class="text-xs font-medium text-gray-500 uppercase mb-2">Additional Evidence</p>
                <div class="space-y-2">
                  <div
                    v-for="doc in fullDetails.documents"
                    :key="doc.id"
                    class="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                  >
                    <div class="flex items-center gap-3">
                      <File class="w-5 h-5 text-blue-400" />
                      <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ doc.file_name }}</p>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Uploaded {{ formatDateTime(doc.created_at) }}
                        </span>
                      </div>
                    </div>
                    <button
                      v-if="doc.file_url"
                      @click="viewDocument(doc.file_url)"
                      class="px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="referenceDocuments.length === 0 && (!fullDetails?.documents || fullDetails.documents.length === 0)" class="text-center py-4">
                <FileText class="mx-auto h-8 w-8 text-gray-300" />
                <p class="mt-2 text-sm text-gray-500">No documents uploaded</p>
              </div>
            </CollapsibleSection>

            <!-- Credit & AML -->
            <CollapsibleSection
              title="Credit & AML"
              :status="getCreditStatus()"
            >
              <div v-if="creditsafeVerification || sanctionsScreening || score" class="space-y-4">
                <!-- Credit Check -->
                <div v-if="creditsafeVerification" class="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Credit Check</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="getCreditCheckBadgeClass(creditsafeVerification.verification_status)"
                    >
                      {{ formatCreditCheckStatus(creditsafeVerification.verification_status) }}
                    </span>
                  </div>
                  <div v-if="creditsafeVerification.verifyMatch" class="text-xs text-gray-600 dark:text-slate-400 space-y-1">
                    <p v-if="creditsafeVerification.verifyMatch.name">Name Match: {{ creditsafeVerification.verifyMatch.name }}</p>
                    <p v-if="creditsafeVerification.verifyMatch.address">Address Match: {{ creditsafeVerification.verifyMatch.address }}</p>
                    <p v-if="creditsafeVerification.verifyMatch.dob">DOB Match: {{ creditsafeVerification.verifyMatch.dob }}</p>
                  </div>
                </div>

                <!-- TAS Score from score table -->
                <div v-if="score" class="grid grid-cols-2 gap-4">
                  <div v-if="score.tas_score">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">TAS Score</label>
                    <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ score.tas_score }}</p>
                  </div>
                  <div v-if="score.decision">
                    <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Decision</label>
                    <p class="mt-1">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="getScoreDecisionBadgeClass(score.decision)"
                    >
                      {{ formatScoreDecision(score.decision) }}
                    </span>
                    </p>
                  </div>
                </div>

                <!-- Sanctions/AML Check -->
                <div v-if="sanctionsScreening" class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Sanctions / AML Check</span>
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="getSanctionsBadgeClass(sanctionsScreening.risk_level)"
                    >
                      {{ formatSanctionsStatus(sanctionsScreening.risk_level) }}
                    </span>
                  </div>
                  <div v-if="sanctionsScreening.screened_at" class="text-xs text-gray-500 dark:text-slate-400">
                    Screened: {{ formatDate(sanctionsScreening.screened_at) }}
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-500 dark:text-slate-400">Credit and AML checks not yet completed</p>
            </CollapsibleSection>

            <!-- Notes -->
            <CollapsibleSection v-if="fullDetails?.notes || fullDetails?.internal_notes || fullDetails?.verification_notes" title="Notes" :defaultOpen="false">
              <div class="space-y-4">
                <div v-if="fullDetails?.notes">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Reference Notes</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ fullDetails.notes }}</p>
                </div>
                <div v-if="fullDetails?.internal_notes">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Internal Notes</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ fullDetails.internal_notes }}</p>
                </div>
                <div v-if="fullDetails?.verification_notes">
                  <label class="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Verification Notes</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ fullDetails.verification_notes }}</p>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Timeline -->
            <CollapsibleSection title="Timeline" :defaultOpen="false">
              <div class="space-y-3">
                <div v-if="fullDetails?.created_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-gray-400"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Reference Created</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(fullDetails.created_at) }}</p>
                  </div>
                </div>
                <div v-if="fullDetails?.submitted_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Form Submitted by {{ person.role === 'TENANT' ? 'Tenant' : 'Guarantor' }}</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(fullDetails.submitted_at) }}</p>
                  </div>
                </div>
                <div v-if="employerRef?.submitted_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Employer Reference Submitted</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(employerRef.submitted_at) }}</p>
                  </div>
                </div>
                <div v-if="landlordRef?.submitted_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Landlord Reference Submitted</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(landlordRef.submitted_at) }}</p>
                  </div>
                </div>
                <div v-if="agentRef?.submitted_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Agent Reference Submitted</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(agentRef.submitted_at) }}</p>
                  </div>
                </div>
                <div v-if="accountantRef?.submitted_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Accountant Reference Submitted</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(accountantRef.submitted_at) }}</p>
                  </div>
                </div>
                <div v-if="fullDetails?.verified_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-green-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Verification Completed</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(fullDetails.verified_at) }}</p>
                  </div>
                </div>
                <div v-if="fullDetails?.rejected_at" class="flex items-center gap-3">
                  <div class="flex-shrink-0 w-2 h-2 rounded-full bg-red-500"></div>
                  <div class="flex-1">
                    <p class="text-sm text-gray-900 dark:text-white">Reference Rejected</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatDateTime(fullDetails.rejected_at) }}</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <!-- Audit Log -->
            <CollapsibleSection title="Activity Log" :defaultOpen="false">
              <ReferenceAuditLog v-if="person.id" :referenceId="person.id" />
            </CollapsibleSection>
          </template>
        </div>

        <!-- Footer Actions -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div class="flex items-center justify-between">
            <button
              @click="$emit('update:open', false)"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
            >
              Close
            </button>
            <button
              v-if="canSubmitForReReferencing"
              @click="handleSubmitForReReferencing"
              :disabled="submittingForReRef"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submittingForReRef" class="flex items-center gap-2">
                <Loader2 class="animate-spin h-4 w-4" />
                Submitting...
              </span>
              <span v-else>Submit for Re-referencing</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Upload Document Modal -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showUploadModal" class="fixed inset-0 z-[60] flex items-center justify-center" @click="showUploadModal = false">
        <div class="absolute inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-slate-700" @click.stop>
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Upload Documents</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Upload new or replacement documents for this reference</p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Document Type</label>
              <select v-model="uploadDocType" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                <option value="">Select document type...</option>
                <option value="id_document">ID Document</option>
                <option value="selfie">Selfie</option>
                <option value="rtr_alternative_document">Right to Rent (Document or Share Code)</option>
                <option value="payslips">Payslips</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="proof_of_address">Proof of Address</option>
                <option value="tax_return">Tax Return / Accounts</option>
                <option value="tenancy_agreement">Tenancy Agreement</option>
                <option value="proof_of_additional_income">Proof of Additional Income</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Select File(s)</label>
              <input
                type="file"
                ref="fileInput"
                :multiple="uploadDocType === 'payslips'"
                @change="handleFileSelect"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Accepted: PDF, JPG, PNG{{ uploadDocType === 'payslips' ? ' (multiple files allowed)' : '' }}</p>
            </div>
            <div v-if="uploadDocType === 'rtr_alternative_document'">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Right to Rent Share Code (optional)</label>
              <input
                v-model="rtrShareCode"
                type="text"
                placeholder="e.g. ABCD-1234-5678"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Provide a share code or upload a document. Either one is enough.</p>
            </div>
            <div v-if="selectedFiles.length > 0" class="bg-gray-50 dark:bg-slate-800 rounded-md p-3">
              <p class="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Selected files:</p>
              <ul class="text-sm text-gray-600 dark:text-slate-400 space-y-1">
                <li v-for="(file, index) in selectedFiles" :key="index" class="flex items-center gap-2">
                  <File class="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  {{ file.name }}
                </li>
              </ul>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700 flex justify-end gap-3">
            <button
              @click="showUploadModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleUploadDocument"
              :disabled="!canUploadDocument || uploadingDoc"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="uploadingDoc" class="animate-spin h-4 w-4" />
              {{ uploadingDoc ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Update Referee Email Modal -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showRefereeModal" class="fixed inset-0 z-[60] flex items-center justify-center" @click="showRefereeModal = false">
        <div class="absolute inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-slate-700" @click.stop>
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Update Referee Email</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Change the email for a referee and send a new reference request</p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Referee Type</label>
              <select v-model="refereeType" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                <option value="">Select referee type...</option>
                <option value="employer">Employer</option>
                <option value="landlord">Landlord</option>
                <option value="agent">Letting Agent</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">New Email Address</label>
              <input
                v-model="newRefereeEmail"
                type="email"
                placeholder="new.referee@example.com"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Referee Name (optional)</label>
              <input
                v-model="newRefereeName"
                type="text"
                placeholder="John Smith"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md p-3">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This will send a new reference request email to the updated address.
              </p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700 flex justify-end gap-3">
            <button
              @click="showRefereeModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleUpdateRefereeEmail"
              :disabled="!refereeType || !newRefereeEmail || updatingReferee"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="updatingReferee" class="animate-spin h-4 w-4" />
              {{ updatingReferee ? 'Updating...' : 'Update & Send Request' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Edit Name Modal -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showEditNameModal" class="fixed inset-0 z-[60] flex items-center justify-center" @click="showEditNameModal = false">
        <div class="absolute inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-slate-700" @click.stop>
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit Tenant Name</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Update the tenant's name for this reference</p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">First Name</label>
              <input
                v-model="editFirstName"
                type="text"
                placeholder="First name"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Last Name</label>
              <input
                v-model="editLastName"
                type="text"
                placeholder="Last name"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md p-3">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This will update the name on guarantor forms and future emails. Already-sent emails will retain the old name.
              </p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 dark:border-slate-700 flex justify-end gap-3">
            <button
              @click="showEditNameModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleUpdateName"
              :disabled="!editFirstName || !editLastName || updatingName"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="updatingName" class="animate-spin h-4 w-4" />
              {{ updatingName ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Edit Email Modal -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showEditEmailModal" class="fixed inset-0 z-[60] flex items-center justify-center" @click="showEditEmailModal = false">
        <div class="absolute inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-slate-700" @click.stop>
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit Tenant Email</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Update the tenant's email address for this reference</p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email Address</label>
              <input
                v-model="editEmail"
                type="email"
                placeholder="tenant@example.com"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md p-3">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This will update the email address used for future reference form emails. You may want to resend the form after updating.
              </p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
            <button
              @click="showEditEmailModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleUpdateEmail"
              :disabled="!editEmail || updatingEmail"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="updatingEmail" class="animate-spin h-4 w-4" />
              {{ updatingEmail ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- View Offer Modal -->
    <ViewOfferModal
      :show="showOfferModal"
      :reference-id="person?.id || ''"
      @close="showOfferModal = false"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TenancyPerson, Tenancy, SectionDecision, SectionType, ActionRequiredDetails } from '@/composables/useTenancies'
import { useTenancies } from '@/composables/useTenancies'
import { useAuthStore } from '@/stores/auth'
import { useDownload } from '@/composables/useDownload'
import StatusPill from './StatusPill.vue'
import ReferenceAuditLog from '@/components/ReferenceAuditLog.vue'
import CollapsibleSection from './CollapsibleSection.vue'
import ViewOfferModal from './ViewOfferModal.vue'
import { X, AlertTriangle, Upload, Mail, Pencil, Loader2, CheckCircle, FileText, File, Trash2, Eye, RefreshCw } from 'lucide-vue-next'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Use tenancies composable for API actions
const { getActionRequiredDetails, uploadDocument, updateRefereeEmail, resendForm, submitForReReferencing, loadTenancies } = useTenancies()

const props = defineProps<{
  open: boolean
  person: TenancyPerson | null
  tenancy: Tenancy | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': []
  'addGuarantor': [tenantId: string]
  'deleteReference': [person: { id: string, name: string }]
}>()

const authStore = useAuthStore()
const { openInNewTab } = useDownload()

// Full reference details
const loadingDetails = ref(false)
const fullDetails = ref<any>(null)
const employerRef = ref<any>(null)
const landlordRef = ref<any>(null)
const agentRef = ref<any>(null)
const accountantRef = ref<any>(null)
const creditsafeVerification = ref<any>(null)
const sanctionsScreening = ref<any>(null)
const score = ref<any>(null)
const tenantOffer = ref<{ id: string; holding_deposit_amount_paid: number; holding_deposit_received_at: string } | null>(null)

// Action Required details (enriched from API)
const actionRequiredDetails = ref<ActionRequiredDetails | null>(null)

// Modal states for editing
const showUploadModal = ref(false)
const showRefereeModal = ref(false)
const showOfferModal = ref(false)

// Upload modal state
const uploadDocType = ref('')
const selectedFiles = ref<File[]>([])
const uploadingDoc = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const rtrShareCode = ref('')

// Referee modal state
const refereeType = ref<'employer' | 'landlord' | 'accountant' | ''>('')
const newRefereeEmail = ref('')
const newRefereeName = ref('')
const updatingReferee = ref(false)

// Edit name modal state
const showEditNameModal = ref(false)
const editFirstName = ref('')
const editLastName = ref('')
const updatingName = ref(false)

// Edit email modal state
const showEditEmailModal = ref(false)
const editEmail = ref('')
const updatingEmail = ref(false)

// Loading states for actions
const resendingForm = ref(false)
const refreshingStatus = ref(false)
const submittingForReRef = ref(false)
const loadingCertificate = ref(false)
const resendingEmployerRef = ref(false)
const resendingLandlordRef = ref(false)
const resendingAccountantRef = ref(false)

// Toast messages
const toastMessage = ref<string | null>(null)
const toastType = ref<'success' | 'error'>('success')

// Watch for person changes to load details
watch(() => [props.open, props.person?.id], async ([isOpen, personId]) => {
  if (isOpen && personId) {
    await loadFullDetails(personId as string)
    // Also load action required details if verification state is ACTION_REQUIRED
    if (props.person?.verificationState === 'ACTION_REQUIRED') {
      actionRequiredDetails.value = await getActionRequiredDetails(personId as string)
    }
  } else {
    fullDetails.value = null
    employerRef.value = null
    landlordRef.value = null
    agentRef.value = null
    accountantRef.value = null
    creditsafeVerification.value = null
    sanctionsScreening.value = null
    score.value = null
    tenantOffer.value = null
    actionRequiredDetails.value = null
  }
}, { immediate: true })

watch(uploadDocType, (newType) => {
  if (newType !== 'rtr_alternative_document') {
    rtrShareCode.value = ''
  }
})

async function loadFullDetails(referenceId: string) {
  loadingDetails.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load reference details')
    }

    const data = await response.json()
    fullDetails.value = data.reference
    employerRef.value = data.employerReference || null
    landlordRef.value = data.landlordReference || null
    agentRef.value = data.agentReference || null
    accountantRef.value = data.accountantReference || null
    creditsafeVerification.value = data.creditsafeVerification || null
    sanctionsScreening.value = data.sanctionsScreening || null
    score.value = data.score || null
    tenantOffer.value = data.tenantOffer || null
  } catch (error) {
    console.error('Error loading full details:', error)
  } finally {
    loadingDetails.value = false
  }
}

const hasCertificate = computed(() => {
  return props.person?.verificationState === 'COMPLETED'
})

// Check if person is verified (has completed verification)
const isVerified = computed(() => {
  return props.person?.verificationState === 'COMPLETED'
         props.person?.verificationState === 'REJECTED'
})

// Final decision: use staff's verification_decision (from reference) with fallback to auto-computed score.decision
const finalDecision = computed(() => {
  return fullDetails.value?.verification_decision || score.value?.decision
})

const canSubmitForReReferencing = computed(() => {
  return props.person?.verificationState === 'ACTION_REQUIRED'
})

// Allow editing until a final decision is made
const canEdit = computed(() => {
  const state = props.person?.verificationState
  if (!state) return false

  const finalStatuses = ['COMPLETED', 'REJECTED', 'CANCELLED']
  return !finalStatuses.includes(state)
})

// Check if this reference was created from an offer
const hasLinkedOffer = computed(() => {
  return tenantOffer.value?.id != null
})

// Check if this tenant already has a guarantor
const hasGuarantor = computed(() => {
  if (!props.person || !props.tenancy) return false
  // Check if any person in the tenancy is a guarantor for this tenant
  return props.tenancy.people.some(p =>
    p.role === 'GUARANTOR' && p.guarantorForTenantId === props.person?.id
  )
})

// Show Add Guarantor button:
// - Person is a tenant (not a guarantor)
// - Doesn't already have a guarantor
// - Available for ALL reference statuses (agent can add guarantor any time)
const canAddGuarantor = computed(() => {
  if (!props.person) return false
  if (props.person.role !== 'TENANT') return false
  if (hasGuarantor.value) return false

  // Show for all statuses - agent can add guarantor at any time
  return true
})

// Show Delete Reference button for all statuses except completed and rejected
const canDelete = computed(() => {
  if (!props.person) return false

  // Allow deletion for all statuses except COMPLETED and REJECTED
  const nonDeletableStates = ['COMPLETED', 'REJECTED']
  return !nonDeletableStates.includes(props.person.verificationState)
})

// Check if we have any "About the Tenant" data to display
// Only show if form has been submitted (submitted_at is set) to avoid showing database default values
const hasAboutTenantData = computed(() => {
  if (!fullDetails.value?.submitted_at) return false
  return fullDetails.value?.is_smoker !== null ||
         fullDetails.value?.has_pets !== null ||
         fullDetails.value?.marital_status ||
         fullDetails.value?.num_dependants !== null
})

const landlordRentalMonthlyAmount = computed(() => {
  return parseCurrencyValue(fullDetails.value?.landlord_rental_monthly_amount)
})

const pensionMonthlyAmount = computed(() => {
  return parseCurrencyValue(fullDetails.value?.pension_monthly_amount)
})

// Extract documents from the reference record
const referenceDocuments = computed(() => {
  if (!fullDetails.value) return []

  const docs: Array<{ type: string; label: string; path: string | null }> = []

  // ID Document
  docs.push({
    type: 'id_document',
    label: fullDetails.value.id_document_type ? `ID Document (${fullDetails.value.id_document_type})` : 'ID Document',
    path: fullDetails.value.id_document_path || null
  })

  // Selfie
  docs.push({
    type: 'selfie',
    label: 'Selfie',
    path: fullDetails.value.selfie_path || null
  })

  // Proof of Address
  docs.push({
    type: 'proof_of_address',
    label: 'Proof of Address',
    path: fullDetails.value.proof_of_address_path || null
  })

  // Payslips / Employment docs (only for employed/relevant statuses)
  if (fullDetails.value.employment_status === 'employed' || fullDetails.value.employment_status === 'contractor') {
    const payslipFiles = fullDetails.value.payslip_files || []
    docs.push({
      type: 'payslips',
      label: 'Payslips / Proof of Income',
      path: payslipFiles.length > 0 ? payslipFiles[0] : null
    })
  }

  // Self-employed docs
  if (fullDetails.value.employment_status === 'self_employed' || fullDetails.value.employment_status === 'director') {
    docs.push({
      type: 'tax_return',
      label: 'Tax Return / Accounts',
      path: fullDetails.value.tax_return_path || null
    })
  }

  // Additional income proof
  if (fullDetails.value.additional_income_source) {
    docs.push({
      type: 'proof_of_additional_income',
      label: 'Proof of Additional Income',
      path: fullDetails.value.proof_of_additional_income_path || null
    })
  }

  // Landlord rental income proof
  if (fullDetails.value.income_landlord_rental) {
    docs.push({
      type: 'landlord_rental_bank_statement',
      label: 'Landlord Rental Bank Statement',
      path: fullDetails.value.landlord_rental_bank_statement_path || null
    })
  }

  // Pension statement
  if (fullDetails.value.income_pension) {
    docs.push({
      type: 'pension_statement',
      label: 'Pension Statement',
      path: fullDetails.value.pension_statement_path || null
    })
  }

  // RTR Alternative Document (for non-British citizens)
  if (fullDetails.value.is_british_citizen === false) {
    docs.push({
      type: 'rtr_alternative_document',
      label: capitalizeFirstLetter(fullDetails.value.rtr_alternative_document_type) || 'RTR Document',
      path: fullDetails.value.rtr_alternative_document_path || null
    })
  }

  // Consent PDF
  if (fullDetails.value.consent_pdf_path) {
    docs.push({
      type: 'consent_pdf',
      label: 'Signed Consent Form',
      path: fullDetails.value.consent_pdf_path
    })
  }

  return docs
})

// Total document count including reference_documents
const totalDocumentCount = computed(() => {
  const refDocs = referenceDocuments.value.length
  const additionalDocs = fullDetails.value?.documents?.length || 0
  return refDocs + additionalDocs
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function formatEmployerIncome(employerRef: any): string {
  // If hourly employment, calculate annual income
  if (employerRef.is_hourly && employerRef.hourly_rate && employerRef.hours_per_week) {
    const weeklyIncome = Number(employerRef.hourly_rate) * Number(employerRef.hours_per_week)
    const annualIncome = weeklyIncome * 52
    return `${formatCurrency(annualIncome)}/year (£${employerRef.hourly_rate}/hr × ${employerRef.hours_per_week} hrs/wk)`
  }

  // If annual salary provided
  if (employerRef.annual_salary && Number(employerRef.annual_salary) > 0) {
    return `${formatCurrency(Number(employerRef.annual_salary))}/year`
  }

  return 'Not specified'
}

function formatAccountantIncome(accountantRef: any): string {
  // Check for annual profit (most accurate for businesses)
  if (accountantRef.annual_profit && Number(accountantRef.annual_profit) > 0) {
    return `${formatCurrency(Number(accountantRef.annual_profit))}/year`
  }

  // Fallback to annual turnover
  if (accountantRef.annual_turnover && Number(accountantRef.annual_turnover) > 0) {
    return `${formatCurrency(Number(accountantRef.annual_turnover))}/year`
  }

  // Calculate from estimated monthly income
  if (accountantRef.estimated_monthly_income && Number(accountantRef.estimated_monthly_income) > 0) {
    const annual = Number(accountantRef.estimated_monthly_income) * 12
    return `${formatCurrency(annual)}/year`
  }

  return '£0/year'
}

function parseCurrencyValue(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value
  const numeric = typeof normalized === 'number' ? normalized : Number(normalized)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric
}

function capitalizeFirstLetter(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getFullName(): string {
  if (!fullDetails.value) return props.person?.name || 'Not provided'

  const firstName = fullDetails.value.tenant_first_name || fullDetails.value.first_name || ''
  const middleName = fullDetails.value.middle_name || ''
  const lastName = fullDetails.value.tenant_last_name || fullDetails.value.last_name || ''

  const parts = [firstName, middleName, lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : props.person?.name || 'Not provided'
}

// Check if we have employment data
const hasEmploymentData = computed(() => {
  if (!fullDetails.value) return false
  return fullDetails.value.employment_status ||
         fullDetails.value.employment_company_name ||
         fullDetails.value.employment_salary_amount ||
         fullDetails.value.employment_job_title ||
         fullDetails.value.self_employed_business_name ||
         fullDetails.value.self_employed_annual_income ||
         fullDetails.value.income_pension ||
         fullDetails.value.pension_monthly_amount ||
         fullDetails.value.pension_statement_path ||
         fullDetails.value.savings_amount ||
         fullDetails.value.additional_income_source ||
         fullDetails.value.employer_ref_email ||
         fullDetails.value.income_landlord_rental ||
         fullDetails.value.landlord_rental_monthly_amount ||
         fullDetails.value.landlord_rental_bank_statement_path ||
         employerRef.value
})

// Check if we have residential data
const hasResidentialData = computed(() => {
  if (!fullDetails.value) return false
  return fullDetails.value.previous_rental_address_line1 ||
         fullDetails.value.previous_landlord_name ||
         fullDetails.value.previous_landlord_email ||
         fullDetails.value.reference_type ||
         fullDetails.value.confirmed_residential_status ||
         landlordRef.value ||
         agentRef.value
})

// Check if we have guarantor financial data
const hasGuarantorFinancialData = computed(() => {
  if (!fullDetails.value?.guarantorData) return false
  return fullDetails.value.guarantorData.home_ownership_status
         fullDetails.value.guarantorData.property_value
         fullDetails.value.guarantorData.monthly_mortgage_rent
         fullDetails.value.guarantorData.pension_amount
         fullDetails.value.guarantorData.other_monthly_commitments
         fullDetails.value.guarantorData.total_monthly_expenditure
         fullDetails.value.guarantorData.understands_obligations !== undefined
         fullDetails.value.guarantorData.willing_to_pay_rent !== undefined
         fullDetails.value.guarantorData.willing_to_pay_damages !== undefined
})

function formatTimeAtAddress(years: number | null | undefined, months: number | null | undefined): string {
  const parts = []
  if (years && years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  }
  if (months && months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'Not specified'
}

function formatContractType(type: string | null | undefined): string {
  if (!type) return 'Not specified'
  const typeMap: Record<string, string> = {
    'permanent': 'Permanent',
    'fixed_term': 'Fixed Term',
    'temporary': 'Temporary',
    'zero_hours': 'Zero Hours',
    'casual': 'Casual'
  }
  return typeMap[type] || type.replace(/_/g, ' ')
}

function formatPayFrequency(frequency: string | null | undefined): string {
  if (!frequency) return 'Not specified'
  const freqMap: Record<string, string> = {
    'weekly': 'Weekly',
    'fortnightly': 'Fortnightly',
    'monthly': 'Monthly',
    'annually': 'Annually',
    'four_weekly': 'Four Weekly'
  }
  return freqMap[frequency] || frequency.replace(/_/g, ' ')
}

function formatHomeOwnership(status: string | null | undefined): string {
  if (!status) return 'Not specified'
  const statusMap: Record<string, string> = {
    'owner_no_mortgage': 'Owner (No Mortgage)',
    'owner_with_mortgage': 'Owner (With Mortgage)',
    'renting': 'Renting',
    'living_with_family': 'Living with Family',
    'council_tenant': 'Council Tenant',
    'housing_association': 'Housing Association'
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

function formatEmploymentStatus(status: string | null | undefined): string {
  if (!status) return 'Not provided'
  const statusMap: Record<string, string> = {
    'employed': 'Employed',
    'self_employed': 'Self-Employed',
    'landlord_rental': 'Landlord Rental Income',
    'pension': 'Pension',
    'unemployed': 'Unemployed',
    'retired': 'Retired',
    'student': 'Student',
    'benefits': 'Receiving Benefits',
    'contractor': 'Contractor',
    'director': 'Company Director'
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function viewDocument(path: string) {
  if (!path) return
  try {
    const referenceId = fullDetails.value?.id || props.person?.id
    if (!referenceId) return
    const token = authStore.session?.access_token
    if (!token) return

    let downloadUrl = ''
    if (path.startsWith('consent-pdfs/')) {
      const parts = path.split('/')
      const filename = parts.slice(2).join('/')
      downloadUrl = `${API_BASE}/api/references/download/consent-pdfs/${referenceId}/${filename}`
    } else {
      const parts = path.split('/')
      if (parts.length >= 3 && parts[0] === referenceId) {
        const folder = parts[1]
        const filename = parts.slice(2).join('/')
        downloadUrl = `${API_BASE}/api/references/download/${referenceId}/${folder}/${filename}`
      }
    }

    if (downloadUrl) {
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('Failed to download document')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (error) {
    console.error('Error getting signed URL:', error)
  }
}

function formatResidentialStatus(status: string | null | undefined): string {
  if (!status) return 'Pending'
  const statusMap: Record<string, string> = {
    'VERIFIED': 'Landlord Reference Verified',
    'LIVING_WITH_FAMILY': 'Living with Family',
    'OWNER_OCCUPIER': 'Owner Occupier'
  }
  return statusMap[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function getSectionLabel(type: SectionType): string {
  const labels: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID & Selfie',
    'RTR': 'Right to Rent',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential',
    'CREDIT': 'Credit',
    'AML': 'AML'
  }
  return labels[type] || type
}

// Format section type for action required tasks (handles both section types and dependency types)
function formatSectionType(type: string): string {
  const labels: Record<string, string> = {
    'IDENTITY_SELFIE': 'ID & Selfie',
    'RTR': 'Right to Rent',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential',
    'CREDIT': 'Credit',
    'AML': 'AML',
    // Dependency types
    'TENANT_FORM': 'Tenant Form',
    'GUARANTOR_FORM': 'Guarantor Form',
    'EMPLOYER_REF': 'Employer Reference',
    'RESIDENTIAL_REF': 'Landlord Reference',
    'ACCOUNTANT_REF': 'Accountant Reference'
  }
  return labels[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Format reason code for display (handles codes without database labels)
function formatReasonCode(code: string | null | undefined): string {
  if (!code) return 'Action needed'
  const labels: Record<string, string> = {
    'STAFF_ESCALATION': 'Staff Escalation',
    'INVALID_EMAIL': 'Invalid Email Address',
    'NO_RESPONSE': 'No Response',
    'DOCUMENT_UNCLEAR': 'Document Unclear',
    'INFORMATION_MISMATCH': 'Information Mismatch'
  }
  return labels[code] || code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function getSectionDecisionLabel(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS': return 'Passed'
    case 'PASS_WITH_CONDITION': return 'Conditional'
    case 'ACTION_REQUIRED': return 'Action Required'
    case 'FAIL': return 'Failed'
    case 'NOT_REVIEWED': return 'Pending'
    default: return decision
  }
}

function getSectionBorderClass(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS':
    case 'PASS_WITH_CONDITION':
      return 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30'
    case 'ACTION_REQUIRED':
      return 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30'
    case 'FAIL':
      return 'border-red-300 dark:border-red-600 bg-red-100 dark:bg-red-900/40'
    default:
      return 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800'
  }
}

function getSectionBadgeClass(decision: SectionDecision): string {
  switch (decision) {
    case 'PASS':
    case 'PASS_WITH_CONDITION':
      return 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100'
    case 'ACTION_REQUIRED':
      return 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100'
    case 'FAIL':
      return 'bg-red-200 dark:bg-red-700 text-red-900 dark:text-red-100'
    default:
      return 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
  }
}

// Status helpers for section headers
function getRTRStatus(): 'pass' | 'pending' | 'fail' | undefined {
  if (fullDetails.value?.is_british_citizen === true) return 'pass'
  if (fullDetails.value?.rtr_verified) return 'pass'
  if (fullDetails.value?.is_british_citizen === false) return 'pending'
  return undefined
}

function getEmploymentStatus(): 'pass' | 'pending' | 'fail' | undefined {
  if (employerRef.value?.confirmed_at) return 'pass'
  if (employerRef.value) return 'pending'
  if (fullDetails.value?.income_landlord_rental &&
      (fullDetails.value?.landlord_rental_bank_statement_path || fullDetails.value?.landlord_rental_monthly_amount)) {
    return 'pass'
  }
  if (fullDetails.value?.income_pension &&
      (fullDetails.value?.pension_statement_path || fullDetails.value?.pension_monthly_amount)) {
    return 'pass'
  }
  // Show pending if tenant has provided employment details or employer reference email
  if (fullDetails.value?.employment_status ||
      fullDetails.value?.employer_ref_email ||
      fullDetails.value?.income_landlord_rental ||
      fullDetails.value?.landlord_rental_monthly_amount ||
      fullDetails.value?.landlord_rental_bank_statement_path) {
    return 'pending'
  }
  return undefined
}

function getResidentialStatus(): 'pass' | 'pending' | 'fail' | undefined {
  // Check if staff has confirmed the residential status
  if (fullDetails.value?.confirmed_residential_status) return 'pass'
  // Check if landlord/agent has responded
  if (landlordRef.value?.confirmed_at || agentRef.value?.confirmed_at) return 'pass'
  // Living with family doesn't need a landlord reference
  if (fullDetails.value?.reference_type === 'living_with_family') return 'pass'
  if (landlordRef.value || agentRef.value) return 'pending'
  // Show pending if tenant has provided previous landlord details (reference request sent)
  if (fullDetails.value?.previous_landlord_email || fullDetails.value?.previous_landlord_name) return 'pending'
  // Show pending if there's a reference_type set
  if (fullDetails.value?.reference_type) return 'pending'
  return undefined
}

function getCreditStatus(): 'pass' | 'pending' | 'fail' | undefined {
  // Check score decision first
  if (score.value?.decision === 'PASS') return 'pass'
  if (score.value?.decision === 'FAIL') return 'fail'
  if (score.value?.decision === 'REVIEW') return 'pending'
  // Check creditsafe verification status
  if (creditsafeVerification.value?.verification_status === 'VERIFIED') return 'pass'
  if (creditsafeVerification.value?.verification_status === 'FAILED') return 'fail'
  if (creditsafeVerification.value?.verification_status === 'PENDING') return 'pending'
  // Check sanctions status
  if (sanctionsScreening.value?.risk_level === 'clear' || sanctionsScreening.value?.risk_level === 'low') return 'pass'
  if (sanctionsScreening.value?.risk_level === 'high') return 'fail'
  if (sanctionsScreening.value?.risk_level === 'medium') return 'pending'
  return undefined
}

// Credit & AML formatting helpers
function formatCreditCheckStatus(status: string | null | undefined): string {
  if (!status) return 'Pending'
  const statusLower = status.toLowerCase()
  if (statusLower === 'passed' || statusLower === 'verified') return 'Passed'
  if (statusLower === 'failed') return 'Failed'
  if (statusLower === 'pending') return 'Pending'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function getCreditCheckBadgeClass(status: string | null | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-600'
  const statusLower = status.toLowerCase()
  if (statusLower === 'passed' || statusLower === 'verified') return 'bg-green-100 text-green-800'
  if (statusLower === 'failed') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-800'
}

function formatDecision(decision: string | null | undefined): string {
  if (!decision) return 'Pending'
  const decisionMap: Record<string, string> = {
    'PASS': 'Pass',
    'PASS_WITH_GUARANTOR': 'Pass (with Guarantor)',
    'PASS_WITH_CONDITION': 'Pass (Conditional)',
    'FAIL': 'Fail',
    'REVIEW': 'Review Required',
    'REFER': 'Refer'
  }
  return decisionMap[decision] || decision.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function getDecisionBadgeClass(decision: string | null | undefined): string {
  if (!decision) return 'bg-gray-100 text-gray-600'
  if (decision.startsWith('PASS')) return 'bg-green-100 text-green-800'
  if (decision === 'FAIL') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-800'
}

function formatScoreDecision(decision: string | null | undefined): string {
  if (!decision) return 'Pending'
  if (!isVerified.value && decision.startsWith('PASS')) return 'Pending'
  return formatDecision(decision)
}

function getScoreDecisionBadgeClass(decision: string | null | undefined): string {
  if (!decision) return 'bg-gray-100 text-gray-600'
  if (!isVerified.value && decision.startsWith('PASS')) return 'bg-gray-100 text-gray-600'
  return getDecisionBadgeClass(decision)
}

function formatSanctionsStatus(riskLevel: string | null | undefined): string {
  if (!riskLevel) return 'Pending'
  const statusMap: Record<string, string> = {
    'clear': 'Clear',
    'low': 'Low Risk',
    'medium': 'Medium Risk',
    'high': 'High Risk'
  }
  return statusMap[riskLevel.toLowerCase()] || riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)
}

function getSanctionsBadgeClass(riskLevel: string | null | undefined): string {
  if (!riskLevel) return 'bg-gray-100 text-gray-600'
  const level = riskLevel.toLowerCase()
  if (level === 'clear' || level === 'low') return 'bg-green-100 text-green-800'
  if (level === 'high') return 'bg-red-100 text-red-800'
  if (level === 'medium') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-600'
}

async function handleResend() {
  if (!props.person?.id) return

  resendingForm.value = true
  try {
    const result = await resendForm(props.person.id)
    if (result) {
      showToast(`Form resent to ${result.email}`, 'success')
    }
  } catch (error: any) {
    showToast(error.message || 'Failed to resend form', 'error')
  } finally {
    resendingForm.value = false
  }
}

async function refreshReferenceStatus() {
  if (!props.person?.id) return

  refreshingStatus.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/refresh-status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to refresh status')
    }

    const result = await response.json()
    await loadFullDetails(props.person.id)
    await loadTenancies()
    showToast(`Status refreshed${result.newState ? `: ${result.newState}` : ''}`, 'success')
  } catch (error: any) {
    showToast(error.message || 'Failed to refresh status', 'error')
  } finally {
    refreshingStatus.value = false
  }
}

async function handleResendEmployerRef() {
  if (!props.person?.id) return

  resendingEmployerRef.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/resend-employer-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resend employer reference email')
    }

    showToast('Employer reference email resent successfully', 'success')
  } catch (error: any) {
    showToast(error.message || 'Failed to resend employer reference email', 'error')
  } finally {
    resendingEmployerRef.value = false
  }
}

async function handleResendLandlordRef() {
  if (!props.person?.id) return

  resendingLandlordRef.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/resend-landlord-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resend landlord reference email')
    }

    showToast('Landlord reference email resent successfully', 'success')
  } catch (error: any) {
    showToast(error.message || 'Failed to resend landlord reference email', 'error')
  } finally {
    resendingLandlordRef.value = false
  }
}

async function handleResendAccountantRef() {
  if (!props.person?.id) return

  resendingAccountantRef.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/resend-accountant-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to resend accountant reference email')
    }

    showToast('Accountant reference email resent successfully', 'success')
  } catch (error: any) {
    showToast(error.message || 'Failed to resend accountant reference email', 'error')
  } finally {
    resendingAccountantRef.value = false
  }
}

function handleAddGuarantor() {
  if (!props.person?.id) return
  emit('addGuarantor', props.person.id)
  emit('update:open', false) // Close the drawer
}

function handleDelete() {
  if (!props.person?.id || !props.person?.name) return
  emit('deleteReference', { id: props.person.id, name: props.person.name })
  emit('update:open', false) // Close the drawer
}

function showToast(message: string, type: 'success' | 'error') {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = null
  }, 3000)
}

function handleViewCertificate() {
  if (!props.person?.id) return

  loadingCertificate.value = true
  try {
    // Use Safari-safe direct URL navigation
    openInNewTab(`/api/references/${props.person.id}/report`)
  } catch (error) {
    console.error('Error viewing certificate:', error)
    showToast('Failed to load certificate', 'error')
  } finally {
    loadingCertificate.value = false
  }
}

async function handleSubmitForReReferencing() {
  if (!props.person?.id) return

  submittingForReRef.value = true
  try {
    const result = await submitForReReferencing(props.person.id)
    if (result) {
      showToast(`Reference submitted for re-referencing. New status: ${result.newStatus.replace(/_/g, ' ')}`, 'success')
      // Refresh the tenancies list
      await loadTenancies()
      emit('updated')
      // Close drawer after short delay
      setTimeout(() => {
        emit('update:open', false)
      }, 1500)
    }
  } catch (error: any) {
    showToast(error.message || 'Failed to submit for re-referencing', 'error')
  } finally {
    submittingForReRef.value = false
  }
}

function viewDocumentByPath(docType: string, storagePath: string) {
  if (!storagePath || !props.person?.id) return

  // Storage path format: {referenceId}/{folder}/{filename}
  // e.g., "abc123/id_document/1234567890_xyz.pdf"
  const parts = storagePath.split('/')
  let apiPath = ''

  if (parts.length >= 3) {
    const referenceId = parts[0]
    const folder = parts[1]
    const filename = parts.slice(2).join('/') // In case filename has slashes
    apiPath = `/api/references/download/${referenceId}/${folder}/${filename}`
  } else if (parts.length === 2 && docType === 'consent_pdf') {
    // Some paths might be simpler: consent-pdfs/{referenceId}/{filename}
    const referenceId = props.person.id
    const filename = parts[parts.length - 1]
    apiPath = `/api/references/download/consent-pdfs/${referenceId}/${filename}`
  }

  if (!apiPath) return

  try {
    // Use Safari-safe direct URL navigation
    openInNewTab(apiPath)
  } catch (error) {
    console.error('Error viewing document:', error)
  }
}

// Handle file selection for upload
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    selectedFiles.value = Array.from(input.files)
  }
}

const canUploadDocument = computed(() => {
  if (!uploadDocType.value) return false
  if (uploadDocType.value === 'rtr_alternative_document') {
    return selectedFiles.value.length > 0 || rtrShareCode.value.trim().length > 0
  }
  return selectedFiles.value.length > 0
})

// Handle document upload
async function handleUploadDocument() {
  if (!props.person?.id || !uploadDocType.value) return

  uploadingDoc.value = true
  try {
    // Build the files object for the upload
    const files: Record<string, File | File[]> = {}
    if (uploadDocType.value === 'payslips' && selectedFiles.value.length > 1) {
      files[uploadDocType.value] = selectedFiles.value
    } else if (selectedFiles.value[0]) {
      files[uploadDocType.value] = selectedFiles.value[0]
    }

    const fields: Record<string, string> = {}
    if (uploadDocType.value === 'rtr_alternative_document' && rtrShareCode.value.trim()) {
      fields.rtr_share_code = rtrShareCode.value.trim()
    }

    const result = await uploadDocument(props.person.id, files, fields)
    if (result) {
      showToast(`Document(s) uploaded successfully`, 'success')
      // Reset modal state
      showUploadModal.value = false
      uploadDocType.value = ''
      selectedFiles.value = []
      rtrShareCode.value = ''
      if (fileInput.value) {
        fileInput.value.value = ''
      }
      // Reload the reference details to show the new document
      await loadFullDetails(props.person.id)
      emit('updated')
    }
  } catch (error: any) {
    showToast(error.message || 'Failed to upload document', 'error')
  } finally {
    uploadingDoc.value = false
  }
}

// Handle referee email update
async function handleUpdateRefereeEmail() {
  if (!props.person?.id || !refereeType.value || !newRefereeEmail.value) return

  updatingReferee.value = true
  try {
    const result = await updateRefereeEmail(
      props.person.id,
      refereeType.value,
      newRefereeEmail.value,
      newRefereeName.value || undefined
    )
    if (result) {
      showToast(`Referee updated. Email sent to ${newRefereeEmail.value}`, 'success')
      // Reset modal state
      showRefereeModal.value = false
      refereeType.value = ''
      newRefereeEmail.value = ''
      newRefereeName.value = ''
      // Reload the reference details
      await loadFullDetails(props.person.id)
      emit('updated')
    }
  } catch (error: any) {
    showToast(error.message || 'Failed to update referee', 'error')
  } finally {
    updatingReferee.value = false
  }
}

function openEditNameModal() {
  // Populate the edit fields with current values
  editFirstName.value = fullDetails.value?.tenant_first_name || ''
  editLastName.value = fullDetails.value?.tenant_last_name || ''
  showEditNameModal.value = true
}

async function handleUpdateName() {
  if (!props.person?.id || !editFirstName.value || !editLastName.value) return

  updatingName.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/tenant-name`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: editFirstName.value,
        last_name: editLastName.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update name')
    }

    showToast('Tenant name updated successfully', 'success')
    // Reset modal state
    showEditNameModal.value = false
    editFirstName.value = ''
    editLastName.value = ''
    // Reload the reference details
    await loadFullDetails(props.person.id)
    emit('updated')
  } catch (error: any) {
    showToast(error.message || 'Failed to update name', 'error')
  } finally {
    updatingName.value = false
  }
}

function openEditEmailModal() {
  editEmail.value = fullDetails.value?.tenant_email || person.value?.email || ''
  showEditEmailModal.value = true
}

async function handleUpdateEmail() {
  if (!props.person?.id || !editEmail.value) return

  updatingEmail.value = true
  try {
    const response = await fetch(`${API_BASE}/api/references/${props.person.id}/tenant-email`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: editEmail.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update email')
    }

    showToast('Tenant email updated successfully', 'success')
    showEditEmailModal.value = false
    editEmail.value = ''
    await loadFullDetails(props.person.id)
    emit('updated')
  } catch (error: any) {
    showToast(error.message || 'Failed to update email', 'error')
  } finally {
    updatingEmail.value = false
  }
}
</script>
