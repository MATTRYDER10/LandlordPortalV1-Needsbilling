<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div v-if="open" class="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary/5 to-orange-500/5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ refData?.tenant_first_name }} {{ refData?.tenant_last_name }}
            </h2>
            <p v-if="refData?.reference_number" class="text-xs font-mono text-gray-400 dark:text-slate-500 mt-0.5">
              {{ refData.reference_number }}
            </p>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {{ refData?.property_address }}, {{ refData?.property_city }}
            </p>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Status Badge -->
        <div class="mt-3 flex items-center gap-2">
          <span
            class="px-3 py-1 text-sm font-medium rounded-full"
            :class="getStatusClass(refData?.status)"
          >
            {{ formatStatus(refData?.status) }}
          </span>
          <span v-if="refData?.offer_unihomes" class="px-3 py-1 text-sm font-medium rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <Zap class="w-3.5 h-3.5" />
            UniHomes{{ refData?.unihomes_interested ? ' (Interested)' : '' }}
          </span>
          <span class="text-sm text-gray-500">
            £{{ refData?.monthly_rent }}/month
          </span>
        </div>

        <!-- Report actions - Only show when reference is accepted -->
        <div v-if="hasFinalReport" class="mt-3 space-y-2">
          <a
            v-if="refData?.report_pdf_url"
            :href="refData.report_pdf_url"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <FileText class="w-4 h-4" />
            View Report
          </a>
          <button
            @click="openSendToLandlordModal"
            class="w-full px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Send class="w-4 h-4" />
            Send Report to Landlord
          </button>
          <a
            v-if="refData?.group_report_pdf_url || fullReference?.reference?.group_report_pdf_url"
            :href="refData?.group_report_pdf_url || fullReference?.reference?.group_report_pdf_url"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
          >
            <Users class="w-4 h-4" />
            Download Group Report
          </a>
          <button
            v-if="apex27Connected"
            @click="pushReportToApex27"
            :disabled="pushingToApex27"
            class="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-[#6B21A8] dark:border-[#9333EA] text-[#6B21A8] dark:text-[#9333EA] rounded-lg hover:bg-[#6B21A8]/5 dark:hover:bg-[#9333EA]/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="pushingToApex27" class="w-4 h-4 animate-spin" />
            <Upload v-else class="w-4 h-4" />
            {{ pushingToApex27 ? 'Pushing...' : 'Push to Apex27' }}
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Reference Details -->
        <div class="space-y-6">
          <!-- Sections -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Verification Sections</h3>
            <div class="space-y-3">
              <!-- Loading skeleton -->
              <div v-if="loading" class="space-y-3">
                <div v-for="i in 5" :key="i" class="animate-pulse border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div>
                </div>
              </div>

              <template v-else>
              <div
                v-for="section in displaySections"
                :key="section.section_type"
                class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
              >
                <!-- Section Header (clickable) -->
                <div
                  @click="toggleSection(section.section_type)"
                  class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <component
                      :is="getSectionIcon(section)"
                      class="w-4 h-4"
                      :class="getSectionIconClass(section)"
                    />
                    <span class="font-medium text-gray-900 dark:text-white">
                      {{ getSectionLabel(section.section_type) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <!-- Issue indicator -->
                    <AlertTriangle
                      v-if="getSectionIssueStatus(section) === 'OPEN' || getSectionIssueStatus(section) === 'RESPONSE_PENDING_REVIEW'"
                      class="w-4 h-4 text-amber-500"
                      :title="getSectionIssueStatus(section) === 'RESPONSE_PENDING_REVIEW' ? 'Tenant has responded' : 'Issue reported'"
                    />
                    <CheckCircle2
                      v-else-if="getSectionIssueStatus(section) === 'RESOLVED'"
                      class="w-4 h-4 text-green-500"
                      title="Issue resolved"
                    />
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-full"
                      :class="getSectionBadgeClass(section)"
                    >
                      {{ getSectionStatusLabel(section) }}
                    </span>
                    <ChevronDown
                      class="w-4 h-4 text-gray-400 transition-transform"
                      :class="{ 'rotate-180': expandedSections.has(section.section_type) }"
                    />
                  </div>
                </div>

                <!-- Section Content (expandable) -->
                <Transition
                  enter-active-class="transition-all duration-200 ease-out"
                  enter-from-class="max-h-0 opacity-0"
                  enter-to-class="max-h-[500px] opacity-100"
                  leave-active-class="transition-all duration-150 ease-in"
                  leave-from-class="max-h-[500px] opacity-100"
                  leave-to-class="max-h-0 opacity-0"
                >
                  <div v-if="expandedSections.has(section.section_type)" class="border-t border-gray-200 dark:border-slate-700">
                    <div class="p-4 bg-gray-50 dark:bg-slate-800/30 space-y-3">
                      <!-- Section Notes -->
                      <p v-if="section.notes" class="text-sm text-gray-600 dark:text-slate-400 italic">
                        {{ section.notes }}
                      </p>

                      <!-- Condition Text (PASS_WITH_CONDITION) -->
                      <div v-if="section.decision === 'PASS_WITH_CONDITION' && section.condition_text" class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-300 dark:border-amber-700">
                        <p class="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">Condition</p>
                        <p class="text-sm text-amber-700 dark:text-amber-400">{{ section.condition_text }}</p>
                      </div>

                      <!-- RTR Expiry Date (from checklist results) -->
                      <div v-if="section.section_type === 'RTR' && section.section_data?.checklist_results?.rtr_expiry_date" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div class="flex justify-between text-sm">
                          <span class="text-gray-500">RTR Type</span>
                          <span class="text-gray-900 dark:text-white font-medium">{{ formatFieldValue(section.section_data.checklist_results.rtr_type) }}</span>
                        </div>
                        <div class="flex justify-between text-sm mt-1">
                          <span class="text-gray-500">Expiry Date</span>
                          <span class="text-gray-900 dark:text-white font-medium">{{ section.section_data.checklist_results.rtr_expiry_date }}</span>
                        </div>
                      </div>

                      <!-- Issue Status -->
                      <div v-if="getSectionIssueStatus(section) === 'OPEN'" class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Issue reported: {{ section.section_data?.issue_type }}</p>
                        <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">{{ section.section_data?.issue_notes }}</p>
                      </div>
                      <div v-else-if="getSectionIssueStatus(section) === 'RESPONSE_PENDING_REVIEW'" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p class="text-sm font-medium text-blue-800 dark:text-blue-300">Tenant has responded — pending staff review</p>
                      </div>

                      <!-- Agent Upload Button -->
                      <div v-if="getSectionIssueStatus(section) === 'OPEN'" class="mt-2">
                        <label
                          class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer"
                        >
                          <Upload class="w-4 h-4" />
                          Upload Document
                          <input type="file" class="hidden" @change="(e: Event) => handleSectionUpload(e, section)" />
                        </label>
                      </div>

                      <!-- Section Data -->
                      <div v-if="getSectionFormData(section.section_type)" class="space-y-2">
                        <div
                          v-for="(value, key) in getFilteredSectionFormData(section.section_type)"
                          :key="key"
                          class="flex justify-between text-sm"
                        >
                          <span class="text-gray-500 dark:text-slate-400">{{ formatFieldLabel(key as string) }}</span>
                          <a
                            v-if="isUrlField(key as string, value)"
                            :href="value"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary hover:text-primary/80 underline text-right"
                          >
                            View Document
                          </a>
                          <span v-else class="text-gray-900 dark:text-white text-right max-w-[60%]">{{ formatDisplayValue(key as string, value) }}</span>
                        </div>
                      </div>

                      <!-- No Data Message -->
                      <p v-else class="text-sm text-gray-400 dark:text-slate-500 italic">
                        {{ getNoDataMessage(section.section_type) }}
                      </p>
                    </div>
                  </div>
                </Transition>
              </div>

              <div v-if="displaySections.length === 0" class="text-center py-8 text-gray-500">
                <FileText class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No sections available yet</p>
              </div>
              </template>
            </div>
          </div>

          <!-- Tenant Info (Editable) -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Tenant Information</h3>
            <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl space-y-2">
              <EditableField label="First Name" :value="refData?.tenant_first_name" field="tenant_first_name" :reference-id="refData?.id" @saved="onFieldSaved" />
              <EditableField label="Last Name" :value="refData?.tenant_last_name" field="tenant_last_name" :reference-id="refData?.id" @saved="onFieldSaved" />
              <EditableField label="Email" :value="refData?.tenant_email" field="tenant_email" :reference-id="refData?.id" @saved="onFieldSaved" />
              <EditableField label="Phone" :value="refData?.tenant_phone" field="tenant_phone" :reference-id="refData?.id" @saved="onFieldSaved" />
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Rent Share</span>
                <span class="text-gray-900 dark:text-white">£{{ refData?.rent_share || refData?.monthly_rent }}/month</span>
              </div>
            </div>
          </div>

          <!-- Referee Info (Editable) -->
          <div v-if="hasRefereeFields">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Referee Details</h3>
            <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl space-y-2">
              <template v-if="refData?.employer_ref_name">
                <p class="text-xs font-medium text-gray-400 uppercase mb-1">Employer Reference</p>
                <EditableField label="Name" :value="refData?.employer_ref_name" field="employer_ref_name" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="refData?.employer_ref_email" field="employer_ref_email" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="refData?.employer_ref_phone" field="employer_ref_phone" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
              </template>
              <template v-if="refData?.previous_landlord_name">
                <p class="text-xs font-medium text-gray-400 uppercase mb-1 mt-3">Previous Landlord</p>
                <EditableField label="Name" :value="refData?.previous_landlord_name" field="previous_landlord_name" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="refData?.previous_landlord_email" field="previous_landlord_email" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="refData?.previous_landlord_phone" field="previous_landlord_phone" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
              </template>
              <template v-if="refData?.accountant_name">
                <p class="text-xs font-medium text-gray-400 uppercase mb-1 mt-3">Accountant</p>
                <EditableField label="Name" :value="refData?.accountant_name" field="accountant_name" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Email" :value="refData?.accountant_email" field="accountant_email" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
                <EditableField label="Phone" :value="refData?.accountant_phone" field="accountant_phone" :reference-id="refData?.id" @saved="onRefereeFieldSaved" />
              </template>
            </div>
          </div>

          <!-- Activity Log -->
          <div>
            <button
              @click="showActivityLog = !showActivityLog"
              class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 hover:text-primary"
            >
              <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showActivityLog }" />
              Activity Log
              <span v-if="activityLog.length" class="text-xs text-gray-400">({{ activityLog.length }})</span>
            </button>
            <div v-if="showActivityLog" class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div v-if="loadingActivity" class="p-4 text-center text-gray-400 text-sm">Loading...</div>
              <div v-else-if="activityLog.length === 0" class="p-4 text-center text-gray-400 text-sm">No activity yet</div>
              <div v-else class="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                <div v-for="entry in activityLog" :key="entry.id" class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full" :class="getActivityDotClass(entry.action)"></div>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatActivityAction(entry.action) }}</span>
                    <span class="text-xs text-gray-400">{{ formatActivityTime(entry.performed_at) }}</span>
                  </div>
                  <p v-if="entry.field_name" class="text-xs text-gray-500 mt-1">
                    Changed {{ entry.field_name }} from "{{ entry.old_value }}" to "{{ entry.new_value }}"
                  </p>
                  <p v-if="entry.notes" class="text-xs text-gray-500 mt-1">{{ entry.notes }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">by {{ entry.performed_by_type }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Property Info -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Property</h3>
            <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
              <p class="font-medium text-gray-900 dark:text-white">{{ refData?.property_address }}</p>
              <p class="text-sm text-gray-500">{{ refData?.property_city }}, {{ refData?.property_postcode }}</p>
              <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span v-if="refData?.move_in_date">
                  Move in: {{ formatDate(refData.move_in_date) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div class="flex flex-wrap gap-3">
          <button
            v-if="!fullReference?.reference?.is_guarantor && !fullReference?.reference?.guarantor_reference_id"
            @click="showAddGuarantorModal = true"
            class="px-4 py-2 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
          >
            <UserPlus class="w-4 h-4" />
            + Guarantor
          </button>
          <button
            @click="showDeleteConfirm = true"
            class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
          >
            <Trash2 class="w-4 h-4" />
            Delete
          </button>
          <button
            v-if="canResendEmail"
            @click="resendReferenceEmail"
            :disabled="resendingEmail"
            class="px-4 py-2 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="resendingEmail" class="w-4 h-4 animate-spin" />
            <RefreshCw v-else class="w-4 h-4" />
            {{ resendingEmail ? 'Sending...' : 'Resend Email' }}
          </button>
          <button
            v-if="canConvertToTenancy"
            @click="showConversionModal = true"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <ArrowRightCircle class="w-4 h-4" />
            Convert to Tenancy
          </button>
        </div>
      </div>

      <!-- Add Guarantor Modal -->
      <Transition name="modal">
        <div v-if="showAddGuarantorModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl">
            <div class="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">Add Guarantor</h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">A guarantor form will be sent to their email</p>
            </div>
            <div class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input v-model="guarantorForm.firstName" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input v-model="guarantorForm.lastName" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
                <input v-model="guarantorForm.email" type="email" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
                <input v-model="guarantorForm.phone" type="tel" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Relationship *</label>
                <select v-model="guarantorForm.relationship" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm">
                  <option value="">Select...</option>
                  <option value="parent">Parent</option>
                  <option value="family">Family Member</option>
                  <option value="friend">Friend</option>
                  <option value="employer">Employer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <p v-if="addGuarantorError" class="text-sm text-red-600">{{ addGuarantorError }}</p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button @click="showAddGuarantorModal = false" class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-sm">Cancel</button>
              <button
                @click="submitAddGuarantor"
                :disabled="addingGuarantor || !guarantorForm.firstName || !guarantorForm.lastName || !guarantorForm.email || !guarantorForm.relationship"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                <Loader2 v-if="addingGuarantor" class="w-4 h-4 animate-spin" />
                Send Guarantor Form
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- V2 Conversion Modal -->
      <ConversionModalV2
        :show="showConversionModal"
        :reference="refData"
        @close="showConversionModal = false"
        @converted="onConverted"
      />
    </div>
  </Transition>

  <!-- Delete Confirmation Modal -->
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" @click="showDeleteConfirm = false"></div>
      <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Reference</h3>
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Are you sure you want to delete this reference for <strong>{{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}</strong>?
        </p>

        <!-- Credit refund info -->
        <div v-if="!formSubmitted" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p class="text-sm text-green-700 dark:text-green-400">
            <strong>Credit will be refunded</strong> - the tenant has not yet submitted their form.
          </p>
        </div>
        <div v-else class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p class="text-sm text-amber-700 dark:text-amber-400">
            <strong>No credit refund</strong> - the tenant has already submitted their form and checks have been performed.
          </p>
        </div>

        <div class="flex gap-3">
          <button
            @click="showDeleteConfirm = false"
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            @click="deleteReference"
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="deleting" class="w-4 h-4 animate-spin" />
            {{ deleting ? 'Deleting...' : 'Delete Reference' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Send to Landlord Modal -->
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showSendToLandlordModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" @click="showSendToLandlordModal = false"></div>
      <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Send Reference to Landlord</h3>

        <!-- Success State -->
        <div v-if="sendToLandlordSuccess" class="text-center py-6">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check class="w-8 h-8 text-green-600" />
          </div>
          <p class="text-green-600 font-medium">Reference summary sent successfully!</p>
        </div>

        <!-- Form -->
        <div v-else>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Send a summary of this reference to the landlord. Contact details will be excluded for privacy.
          </p>

          <!-- Landlord Email -->
          <div v-if="landlordEmailInfo.hasLandlord" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-sm text-green-700 dark:text-green-400">
              <strong>Linked landlord:</strong> {{ landlordEmailInfo.name }}
            </p>
            <p class="text-sm text-green-600 dark:text-green-500 flex items-center gap-1">
              <Mail class="w-4 h-4" />
              {{ landlordEmailInfo.email }}
            </p>
          </div>

          <div v-else class="mb-4">
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
          <div v-if="sendToLandlordError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400">{{ sendToLandlordError }}</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              @click="showSendToLandlordModal = false"
              class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="sendToLandlord"
              :disabled="sendingToLandlord || (!landlordEmailInfo.email && !manualLandlordEmail)"
              class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="sendingToLandlord">Sending...</span>
              <span v-else class="flex items-center gap-2">
                <Send class="w-4 h-4" />
                Send
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      @click="$emit('close')"
      class="fixed inset-0 bg-black/30 z-40"
    />
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, Check, Clock, AlertCircle, XCircle, FileText, Send, Mail, RefreshCw, Loader2, ChevronDown, Trash2, AlertTriangle, CheckCircle2, Pencil, Upload, ArrowRightCircle, Users, UserPlus, Zap } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import EditableField from './EditableField.vue'
import ConversionModalV2 from './references/ConversionModalV2.vue'

const props = defineProps<{
  reference: any
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(true)
const fullReference = ref<any>(null)
const showDecisionModal = ref(false)
const resendingEmail = ref(false)
const showSendToLandlordModal = ref(false)
const sendingToLandlord = ref(false)
const apex27Connected = ref(false)
const pushingToApex27 = ref(false)
const landlordEmailInfo = ref<{ hasLandlord: boolean; email: string | null; name: string | null }>({ hasLandlord: false, email: null, name: null })
const manualLandlordEmail = ref('')
const sendToLandlordSuccess = ref(false)
const sendToLandlordError = ref('')
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const showConversionModal = ref(false)

// Add Guarantor
const showAddGuarantorModal = ref(false)
const addingGuarantor = ref(false)
const addGuarantorError = ref('')
const guarantorForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  relationship: ''
})
const expandedSections = ref<Set<string>>(new Set())
const showActivityLog = ref(false)
const loadingActivity = ref(false)
const activityLog = ref<any[]>([])
const showChasePrompt = ref(false)
const pendingChaseField = ref<{ refereeType: string; sectionType: string } | null>(null)

// Best available reference data — fullReference (from API) takes priority over props (from list)
const refData = computed(() => fullReference.value?.reference || props.reference)

// Check if form has been submitted (for credit refund logic)
const formSubmitted = computed(() => {
  return !!(fullReference.value?.reference?.form_submitted_at || props.reference?.form_submitted_at)
})

// Default section types in display order (excluding CONSENT which is just signatures)
const DEFAULT_SECTION_TYPES = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'GUARANTOR', 'CREDIT', 'AML'] as const

// Generate displayable sections by merging database sections with form_data
const displaySections = computed(() => {
  const dbSections = fullReference.value?.sections || []
  const formData = fullReference.value?.reference?.form_data
  const isGuarantor = fullReference.value?.reference?.is_guarantor || false

  // Create a map of database sections by type for quick lookup
  const dbSectionMap = new Map<string, any>()
  dbSections.forEach((s: any) => dbSectionMap.set(s.section_type, s))

  // Build sections list by going through each default type
  const sections = DEFAULT_SECTION_TYPES.map(sectionType => {
    // Use database section if it exists
    const dbSection = dbSectionMap.get(sectionType)
    if (dbSection) {
      return {
        ...dbSection,
        _isVirtual: false,
        _hasData: true
      }
    }

    // Otherwise generate virtual section from form_data
    const key = getSectionFormDataKey(sectionType)
    const sectionData = formData?.[key]
    const hasData = sectionData && typeof sectionData === 'object' && Object.keys(sectionData).length > 0

    return {
      section_type: sectionType,
      status: hasData ? 'COLLECTING' : 'PENDING',
      decision: null,
      is_ready_for_review: false,
      notes: null,
      _isVirtual: true,
      _hasData: hasData
    }
  })

  // Filter sections based on context:
  // - CREDIT and AML always shown (auto-triggered on form submission)
  // - GUARANTOR only shown for tenant references when guarantor info provided
  // - For guarantor references: hide GUARANTOR and RESIDENTIAL sections
  return sections.filter(s => {
    // Guarantor references don't have GUARANTOR, RESIDENTIAL or RTR sections
    if (isGuarantor && (s.section_type === 'GUARANTOR' || s.section_type === 'RESIDENTIAL' || s.section_type === 'RTR')) {
      return false
    }

    // GUARANTOR section for tenants - only show if guarantor info provided
    if (s.section_type === 'GUARANTOR') {
      return s._hasData
    }

    // All other sections always shown (IDENTITY, RTR, INCOME, RESIDENTIAL, CREDIT, AML)
    return true
  })
})

// Toggle section expansion
function toggleSection(sectionType: string) {
  if (expandedSections.value.has(sectionType)) {
    expandedSections.value.delete(sectionType)
  } else {
    expandedSections.value.add(sectionType)
  }
  expandedSections.value = new Set(expandedSections.value) // Trigger reactivity
}

// Map section type to form_data key
function getSectionFormDataKey(sectionType: string): string {
  const keyMap: Record<string, string> = {
    'IDENTITY': 'identity',
    'RTR': 'rtr',
    'INCOME': 'income',
    'RESIDENTIAL': 'residential',
    'GUARANTOR': 'guarantor',
    'CREDIT': 'credit',
    'AML': 'aml'
  }
  return keyMap[sectionType] || sectionType.toLowerCase()
}

// Flatten nested objects for display
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    // Skip internal fields
    if (key.startsWith('_')) continue

    // Skip null/undefined/empty values
    if (value === null || value === undefined || value === '') continue

    // Handle arrays (like previousAddresses)
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // Flatten array of objects
          const flattened = flattenObject(item, `${newKey}[${index + 1}]`)
          Object.assign(result, flattened)
        } else {
          result[`${newKey}[${index + 1}]`] = item
        }
      })
    }
    // Handle nested objects (but not document URLs)
    else if (typeof value === 'object' && value !== null) {
      const flattened = flattenObject(value, newKey)
      Object.assign(result, flattened)
    }
    // Primitive values
    else {
      result[newKey] = value
    }
  }

  return result
}

// Get form data for a section
function getSectionFormData(sectionType: string): Record<string, any> | null {
  // Get section decision info (assessor notes, decision time) from DB sections
  const dbSections = fullReference.value?.sections || []
  const dbSection = dbSections.find((s: any) => s.section_type === sectionType)
  const sectionDecisionInfo: Record<string, any> = {}
  if (dbSection?.decision) {
    sectionDecisionInfo['Decision'] = dbSection.decision
    if (dbSection.assessor_notes) sectionDecisionInfo['Assessor Notes'] = dbSection.assessor_notes
    if (dbSection.completed_at) sectionDecisionInfo['Verified At'] = formatDate(dbSection.completed_at)
  }

  // Special handling for CREDIT section
  if (sectionType === 'CREDIT') {
    const creditCheck = fullReference.value?.creditCheck
    if (!creditCheck) {
      // Show section_data from the section itself (stored when check ran)
      if (dbSection?.section_data) {
        const sd = dbSection.section_data
        const score = sd.riskScore || 0
        const riskLabel = score >= 80 ? 'Low' : score >= 60 ? 'Medium/Low' : score >= 40 ? 'Medium' : 'High'
        return {
          'Risk Level': riskLabel,
          'Electoral Roll': sd.electoralRegisterMatch ? 'Pass' : 'Not Found',
          'CCJ Check': sd.ccjMatch ? `Fail (${sd.ccjCount || 0} found)` : 'Pass',
          'Insolvency Check': sd.insolvencyMatch ? `Fail (${sd.insolvencyCount || 0} found)` : 'Pass',
          'Checked At': sd.checkedAt ? formatDate(sd.checkedAt) : 'Unknown',
          ...sectionDecisionInfo
        }
      }
      return null
    }

    // Parse response data if available
    let responseData: any = null
    if (creditCheck.response_data_encrypted) {
      try {
        responseData = typeof creditCheck.response_data_encrypted === 'string'
          ? JSON.parse(creditCheck.response_data_encrypted)
          : creditCheck.response_data_encrypted
      } catch {}
    }

    const score = creditCheck.risk_score || 0
    const riskLabel = score >= 80 ? 'Low' : score >= 60 ? 'Medium/Low' : score >= 40 ? 'Medium' : 'High'
    const ccjCount = responseData?.countyCourtJudgments?.length || 0
    const insolvencyCount = responseData?.insolvencies?.length || 0

    return {
      'Creditsafe Risk Level': riskLabel,
      'Electoral Roll': responseData?.electoralRegisterMatch ? 'Pass' : 'Not Found',
      'CCJ Check': responseData?.ccjMatch ? `Fail (${ccjCount} found)` : 'Pass',
      ...(ccjCount > 0 ? { 'CCJ Count': ccjCount } : {}),
      'Insolvency Check': responseData?.insolvencyMatch ? `Fail (${insolvencyCount} found)` : 'Pass',
      ...(insolvencyCount > 0 ? { 'Insolvency Count': insolvencyCount } : {}),
      'Checked At': creditCheck.created_at ? formatDate(creditCheck.created_at) : 'Unknown',
      ...sectionDecisionInfo
    }
  }

  // Special handling for AML section
  if (sectionType === 'AML') {
    const amlCheck = fullReference.value?.amlCheck
    if (!amlCheck) {
      if (dbSection?.section_data) {
        const sd = dbSection.section_data
        return {
          'Risk Level': sd.riskLevel || 'Unknown',
          'Sanctions Matches': sd.sanctionsMatches || 0,
          'Donation Matches': sd.donationMatches || 0,
          'Summary': sd.summary || 'No issues found',
          'Checked At': sd.checkedAt ? formatDate(sd.checkedAt) : 'Unknown',
          ...sectionDecisionInfo
        }
      }
      return null
    }

    return {
      'Risk Level': amlCheck.risk_level === 'clear' ? 'Clear' : (amlCheck.risk_level || 'Pending'),
      'Sanctions Matches': amlCheck.sanctions_matches || 0,
      'Donation Matches': amlCheck.donation_matches || 0,
      'Summary': amlCheck.summary || 'No issues found',
      'Checked At': amlCheck.created_at ? formatDate(amlCheck.created_at) : 'Unknown',
      ...sectionDecisionInfo
    }
  }

  const formData = fullReference.value?.reference?.form_data
  if (!formData) {
    // Also add section decision info even without form data
    if (Object.keys(sectionDecisionInfo).length > 0) return sectionDecisionInfo
    return null
  }

  const key = getSectionFormDataKey(sectionType)
  const sectionData = formData[key]

  if (!sectionData || typeof sectionData !== 'object') {
    if (Object.keys(sectionDecisionInfo).length > 0) return sectionDecisionInfo
    return null
  }

  // Flatten nested objects for display
  const flattened = flattenObject(sectionData)

  if (Object.keys(flattened).length === 0 && Object.keys(sectionDecisionInfo).length === 0) return null
  return { ...flattened, ...sectionDecisionInfo }
}

// Filter out WillEmail fields that are false and Url fields that are empty strings
function getFilteredSectionFormData(sectionType: string): Record<string, any> | null {
  const data = getSectionFormData(sectionType)
  if (!data) return null

  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    const lastKey = key.includes('.') ? key.split('.').pop()! : key
    // Hide WillEmail fields when false (only show when true as "Will email separately")
    if (lastKey.endsWith('WillEmail') && value === false) continue
    // Hide Url fields with empty string values
    if (lastKey.endsWith('Url') && value === '') continue
    filtered[key] = value
  }

  return Object.keys(filtered).length > 0 ? filtered : null
}

// Label mapping for known field keys
const labelMap: Record<string, string> = {
  // Identity
  'firstName': 'First Name',
  'lastName': 'Last Name',
  'phone': 'Phone Number',
  'dateOfBirth': 'Date of Birth',
  'selfieUrl': 'Identity Photo',
  'idDocumentUrl': 'ID Document',
  'documentType': 'Document Type',

  // Right to Rent
  'citizenshipStatus': 'Citizenship Status',
  'noPassport': 'No Passport Available',
  'passportDocUrl': 'Passport Document',
  'shareCode': 'Share Code',
  'shareCodeExpiry': 'Share Code Expiry',
  'alternativeDocType': 'Alternative ID Type',
  'alternativeDocUrl': 'Alternative Document',
  'supportingDocType': 'Supporting Document Type',
  'supportingDocUrl': 'Supporting Document',

  // Income
  'sources': 'Income Sources',
  'jobTitle': 'Job Title',
  'annualSalary': 'Annual Salary',
  'employerName': 'Employer Name',
  'employerAddress': 'Employer Address',
  'employerRefName': 'Employer Reference Name',
  'employerRefEmail': 'Employer Reference Email',
  'employerRefPhone': 'Employer Reference Phone',
  'employmentStartDate': 'Employment Start Date',
  'payslipsUrl': 'Payslips',
  'selfEmployedBusinessName': 'Business Name',
  'selfEmployedStartDate': 'Business Start Date',
  'selfEmployedNature': 'Nature of Business',
  'selfEmployedAnnualIncome': 'Annual Income (Self-Employed)',
  'businessName': 'Business Name',
  'businessNature': 'Nature of Business',
  'businessStartDate': 'Business Start Date',
  'selfEmployedIncome': 'Self-Employed Income',
  'accountantName': 'Accountant Name',
  'accountantEmail': 'Accountant Email',
  'accountantPhone': 'Accountant Phone',
  'taxReturnUrl': 'Tax Return',
  'benefitsMonthlyAmount': 'Monthly Benefits',
  'benefitsAmount': 'Benefits Amount',
  'benefitsDocUrl': 'Benefits Document',
  'savingsAmount': 'Savings Amount',
  'savingsDocUrl': 'Savings Document',
  'pensionMonthlyAmount': 'Monthly Pension',
  'pensionAmount': 'Pension Amount',
  'pensionProvider': 'Pension Provider',
  'pensionStatementUrl': 'Pension Statement',
  'pensionDocUrl': 'Pension Document',
  'landlordRentalMonthlyAmount': 'Rental Income (Monthly)',
  'landlordRentalBankStatementUrl': 'Rental Bank Statement',
  'additionalIncomeType': 'Additional Income Type',
  'additionalIncomeSource': 'Additional Income Source',
  'additionalIncomeAmount': 'Additional Income Amount',
  'additionalIncomeFrequency': 'Income Frequency',
  'university': 'University/College',
  'course': 'Course',
  'studentDocUrl': 'Student Document',

  // Residential
  'currentAddress': 'Current Address',
  'line1': 'Address Line 1',
  'line2': 'Address Line 2',
  'city': 'City',
  'postcode': 'Postcode',
  'years': 'Years at Address',
  'months': 'Months at Address',
  'proofOfAddressUrl': 'Proof of Address',
  'landlordEmail': 'Landlord/Agent Email',
  'landlordName': 'Landlord/Agent Name',
  'landlordPhone': 'Landlord/Agent Phone',
  'landlordType': 'Landlord Type',
  'previousAddresses': 'Previous Addresses',

  // Personal
  'smoker': 'Smoker',
  'isSmoker': 'Smoker',
  'hasPets': 'Has Pets',
  'petDetails': 'Pet Details',
  'maritalStatus': 'Marital Status',
  'numberOfDependants': 'Number of Dependants',
  'dependants': 'Number of Dependants',
  'dependantsDetails': 'Dependant Details',
  'hasAdverseCredit': 'Adverse Credit History',
  'adverseCreditDetails': 'Adverse Credit Details',

  // Credit
  'status': 'Status',
  'riskLevel': 'Risk Level',
  'riskScore': 'Risk Score',
  'verifyMatch': 'Identity Verified',
  'ccjMatch': 'CCJ Found',
  'ccjCount': 'CCJ Count',
  'insolvencyMatch': 'Insolvency Found',
  'insolvencyCount': 'Insolvency Count',
  'electoralRegisterMatch': 'Electoral Roll Match',
  'electoralRollMatch': 'Electoral Roll Match',
  'checkedAt': 'Checked At',
  'notFound': 'Not Found on Records',

  // AML
  'sanctionsMatches': 'Sanctions Matches',
  'donationMatches': 'Donation Matches',
  'totalMatches': 'Total Matches',
  'summary': 'Summary',
  'requiresManualReview': 'Requires Manual Review',
  'shouldReject': 'Should Reject',

  // Residential - current living
  'currentLivingSituation': 'Current Living Situation',
  'currentLandlordName': 'Current Landlord Name',
  'currentLandlordEmail': 'Current Landlord Email',
  'currentLandlordPhone': 'Current Landlord Phone',

  // Guarantor
  'email': 'Email',
  'relationship': 'Relationship',

  // Consent / declarations
  'repositConfirmed': 'Reposit Confirmed',
  'repositInterested': 'Interested in Reposit',
  'creditCheck': 'Credit Check Consent',
  'amlCheck': 'AML Check Consent',
  'dataProcessing': 'Data Processing Consent',
  'printedName': 'Printed Name',
  'timestamp': 'Submitted At',

}

// Format field label from camelCase, dot notation, and array indices
function formatFieldLabel(key: string): string {
  // Extract the last segment of the key (after dots and array indices)
  const lastSegment = key.split('.').pop()?.replace(/\[\d+\]$/, '') || key

  // Check if the last segment has a known label
  const mappedLabel = labelMap[lastSegment]

  // Build prefix for nested keys
  let prefix = ''
  const parts = key.split('.')

  if (parts.length > 1) {
    // Build prefix from all parts except the last
    const prefixParts = parts.slice(0, -1)
    prefix = prefixParts.map(part => {
      // Handle array indices like "previousAddresses[1]" -> "Previous Address 1"
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
      if (arrayMatch) {
        const arrayName = arrayMatch[1]
        const index = arrayMatch[2]
        if (arrayName === 'previousAddresses') {
          return `Previous Address ${index}`
        }
        // Fallback: convert camelCase
        return arrayName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, s => s.toUpperCase())
          .trim() + ` ${index}`
      }
      // Check label map for prefix parts too
      if (labelMap[part]) return labelMap[part]
      // Fallback camelCase conversion
      return part
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim()
    }).join(' - ')
  }

  // Use mapped label or fallback to algorithmic conversion
  const label = mappedLabel || lastSegment
    .replace(/\[(\d+)\]/g, ' $1')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()

  return prefix ? `${prefix} - ${label}` : label
}

// Check if a field is a URL field (document link)
function isUrlField(key: string, value: any): boolean {
  if (typeof value !== 'string') return false

  // Check if value looks like a URL
  const looksLikeUrl = value.startsWith('http://') || value.startsWith('https://')
  if (!looksLikeUrl) return false

  // Check if key indicates it's a document/URL field
  // Common patterns: passportDocUrl, idDocumentUrl, proofOfIncomeUrl, selfieUrl, etc.
  const urlKeyPatterns = [
    /Url$/i,
    /Doc$/i,
    /Document$/i,
    /Proof$/i,
    /Evidence$/i,
    /Upload$/i
  ]

  const lastKeyPart = key.split('.').pop() || key
  if (urlKeyPatterns.some(pattern => pattern.test(lastKeyPart))) return true

  // Also treat any value that looks like a Supabase storage URL or common file URL as a document link
  if (value.includes('supabase') || value.includes('/storage/') || value.match(/\.(pdf|jpg|jpeg|png|gif|webp|doc|docx)(\?|$)/i)) {
    return true
  }

  return false
}

// Format field value for display
// Known value mappings for common enum/snake_case values
const valueMap: Record<string, string> = {
  'uk_citizen': 'UK Citizen',
  'eu_settled': 'EU Settled Status',
  'eu_pre_settled': 'EU Pre-Settled Status',
  'non_eu_visa': 'Non-EU Visa Holder',
  'indefinite_leave': 'Indefinite Leave to Remain',
  'time_limited': 'Time-Limited Leave to Remain',
  'renting_landlord': 'Renting from Private Landlord',
  'renting_agent': 'Renting via Letting Agent',
  'living_with_family': 'Living with Family/Friends',
  'employed': 'Employed',
  'self_employed': 'Self-Employed',
  'self-employed': 'Self-Employed',
  'benefits': 'Benefits',
  'savings': 'Savings/Investments',
  'pension': 'Pension',
  'student': 'Student',
  'unemployed': 'Unemployed',
  'landlord_rental': 'Landlord Rental Income',
  'full_time': 'Full-Time',
  'part_time': 'Part-Time',
  'contract': 'Contract',
  'temporary': 'Temporary',
  'passport': 'Passport',
  'driving_licence': 'Driving Licence',
  'national_id': 'National ID Card',
  'single': 'Single',
  'married': 'Married',
  'divorced': 'Divorced',
  'widowed': 'Widowed',
  'civil_partnership': 'Civil Partnership',
  'cohabiting': 'Cohabiting',
  'Private Landlord': 'Private Landlord',
  'Letting Agent': 'Letting Agent',
  'Living with Family/Friends': 'Living with Family/Friends'
}

function formatFieldValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'
  if (value === null || value === undefined) return '-'
  if (Array.isArray(value)) return value.map(v => valueMap[v] || capitalise(String(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  const str = String(value)
  // Check known values
  if (valueMap[str]) return valueMap[str]
  // Format snake_case to Title Case
  if (str.includes('_')) return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  // Format dates (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return str
}

const monetaryFields = new Set([
  'annualSalary', 'selfEmployedAnnualIncome', 'benefitsMonthlyAmount', 'savingsAmount',
  'pensionMonthlyAmount', 'landlordRentalMonthlyAmount', 'additionalIncomeAmount',
  'Annual Salary', 'Annual Income (Self-Employed)', 'Monthly Benefits', 'Savings Amount',
  'Monthly Pension', 'Rental Income (Monthly)', 'Additional Income Amount',
  'Creditsafe Score', 'Risk Score'
])

function formatDisplayValue(key: string, value: any): string {
  const lastKey = key.includes('.') ? key.split('.').pop()! : key
  // WillEmail fields that are true should display as "Will email separately"
  if (lastKey.endsWith('WillEmail') && value === true) {
    return 'Will email separately'
  }
  const lowerKey = lastKey.toLowerCase()
  // Check explicit monetary fields or any key containing salary/income/amount/pension/savings
  // Exclude phone/email/name/date/address fields
  const isExcluded = /phone|email|name|date|address|postcode|city|line|type|status|code|doc|url/i.test(lastKey)
  const isMoney = !isExcluded && (monetaryFields.has(lastKey) ||
    /salary|income|amount|pension|savings/i.test(lastKey))
  if (isMoney && typeof value === 'number') {
    return `£${value.toLocaleString()}`
  }
  if (isMoney && typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
    return `£${Number(value).toLocaleString()}`
  }
  return formatFieldValue(value)
}

function capitalise(str: string): string {
  if (!str) return ''
  if (str.includes('_')) return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Get contextual message when no data is available
function getNoDataMessage(sectionType: string): string {
  const status = fullReference.value?.reference?.status || props.reference?.status

  // For SENT status - form not submitted yet
  if (status === 'SENT') {
    return 'Awaiting tenant submission'
  }

  // For CREDIT/AML sections
  if (sectionType === 'CREDIT') {
    return 'Credit check pending...'
  }
  if (sectionType === 'AML') {
    return 'AML check pending...'
  }

  return 'No data submitted'
}

const canMakeDecision = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  return status === 'READY_FOR_REVIEW' || status === 'IN_REVIEW'
})

const hasFinalReport = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  // Show report actions when individual report exists (INDIVIDUAL_COMPLETE, GROUP_ASSESSMENT) or when fully accepted
  return ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'INDIVIDUAL_COMPLETE', 'GROUP_ASSESSMENT'].includes(status)
})

const canResendEmail = computed(() => {
  const status = fullReference.value?.reference?.status || props.reference?.status
  // Can resend only if reference hasn't been submitted yet
  return status === 'SENT'
})

const canConvertToTenancy = computed(() => {
  const ref = refData.value
  if (!ref) return false
  // Only show on parent/standalone — child references must convert from the parent
  if (ref.parent_reference_id) return false
  // Can convert any status except SENT, and not already converted
  return ref.status !== 'SENT' && !ref.converted_to_tenancy_id
})

watch(() => props.open, async (isOpen) => {
  if (isOpen && props.reference?.id) {
    // Reset state for fresh load
    activityLog.value = []
    showActivityLog.value = false
    // Show list data immediately as a placeholder
    fullReference.value = {
      reference: props.reference,
      sections: props.reference.sections || [],
      creditCheck: null,
      amlCheck: null
    }
    // Always fetch full data immediately — sections/credit/AML need it
    await fetchFullReference()
    loadApex27Status()
  }
}, { immediate: true })

async function fetchFullReference() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      const data = await response.json()
      fullReference.value = data
    }
  } catch (error) {
    console.error('Error fetching reference:', error)
  } finally {
    loading.value = false
  }
}

async function loadApex27Status() {
  try {
    const response = await fetch(`${API_URL}/api/settings/apex27`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      const data = await response.json()
      apex27Connected.value = data.configured && data.lastTestStatus === 'success'
    }
  } catch {
    // Silently fail
  }
}

async function pushReportToApex27() {
  const refId = fullReference.value?.reference?.id || props.reference?.id
  if (!refId) return

  pushingToApex27.value = true
  try {
    const response = await fetch(`${API_URL}/api/apex27/documents/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify({ sourceType: 'reference_report', sourceId: refId })
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to push report')
    }

    toast.success('Report pushed to Apex27')
  } catch (err: any) {
    console.error('Error pushing to Apex27:', err)
    toast.error(err.message || 'Failed to push to Apex27')
  } finally {
    pushingToApex27.value = false
  }
}

async function fetchLandlordEmail() {
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/landlord-email`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      landlordEmailInfo.value = await response.json()
    }
  } catch (error) {
    console.error('Error fetching landlord email:', error)
  }
}

async function openSendToLandlordModal() {
  sendToLandlordSuccess.value = false
  sendToLandlordError.value = ''
  manualLandlordEmail.value = ''
  await fetchLandlordEmail()
  showSendToLandlordModal.value = true
}

async function sendToLandlord() {
  sendingToLandlord.value = true
  sendToLandlordError.value = ''
  sendToLandlordSuccess.value = false

  try {
    const emailToUse = landlordEmailInfo.value.email || manualLandlordEmail.value
    if (!emailToUse) {
      sendToLandlordError.value = 'Please enter a landlord email address'
      return
    }

    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/send-to-landlord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        landlordEmail: landlordEmailInfo.value.email ? null : manualLandlordEmail.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      sendToLandlordError.value = data.error || 'Failed to send to landlord'
      return
    }

    sendToLandlordSuccess.value = true
    setTimeout(() => {
      showSendToLandlordModal.value = false
    }, 2000)
  } catch (error: any) {
    console.error('Error sending to landlord:', error)
    sendToLandlordError.value = error.message || 'Failed to send to landlord'
  } finally {
    sendingToLandlord.value = false
  }
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    'SENT': 'Sent',
    'COLLECTING_EVIDENCE': 'Collecting Evidence',
    'READY_FOR_REVIEW': 'Ready for Review',
    'IN_REVIEW': 'In Review',
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted (Guarantor)',
    'ACCEPTED_ON_CONDITION': 'Accepted (Condition)',
    'REJECTED': 'Rejected',
    'INDIVIDUAL_COMPLETE': 'Individual Complete',
    'GROUP_ASSESSMENT': 'Group Assessment'
  }
  return labels[status] || status
}

function getStatusClass(status: string) {
  if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(status)) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (status === 'IN_REVIEW' || status === 'READY_FOR_REVIEW' || status === 'INDIVIDUAL_COMPLETE') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  }
  if (status === 'GROUP_ASSESSMENT') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (status === 'COLLECTING_EVIDENCE') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
}

function getSectionLabel(type: string) {
  const labels: Record<string, string> = {
    'IDENTITY': 'Identity Verification',
    'RTR': 'Right to Rent',
    'INCOME': 'Income Verification',
    'RESIDENTIAL': 'Residential History',
    'GUARANTOR': 'Guarantor Details',
    'CREDIT': 'Credit Check',
    'AML': 'AML Check'
  }
  return labels[type] || type
}

function getSectionStatusLabel(section: any) {
  if (section.decision === 'PASS') return 'Passed'
  if (section.decision === 'PASS_WITH_CONDITION') return 'Conditional Pass'
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return 'Failed'
  if (section.status === 'IN_REVIEW') return 'In Review'
  if (section.is_ready_for_review) return 'Ready for Review'
  if (section.status === 'COLLECTING') return 'Collecting'
  return 'Pending'
}

function getSectionIcon(section: any) {
  if (section.decision === 'PASS') return Check
  if (section.decision === 'PASS_WITH_CONDITION') return AlertCircle
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return XCircle
  if (section.status === 'IN_REVIEW') return Clock
  if (section.is_ready_for_review) return AlertCircle
  return Clock
}

function getSectionIconClass(section: any) {
  if (section.decision === 'PASS') return 'text-green-600'
  if (section.decision === 'PASS_WITH_CONDITION') return 'text-amber-600'
  if (section.decision === 'FAIL' || section.decision === 'REJECT') return 'text-red-600'
  if (section.status === 'IN_REVIEW') return 'text-blue-600'
  if (section.is_ready_for_review) return 'text-amber-600'
  return 'text-gray-400'
}

function getSectionBadgeClass(section: any) {
  if (section.decision === 'PASS') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (section.decision === 'PASS_WITH_CONDITION') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  if (section.decision === 'FAIL' || section.decision === 'REJECT') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (section.status === 'IN_REVIEW') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (section.is_ready_for_review) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London'
  }) + ' GMT'
}

async function resendReferenceEmail() {
  resendingEmail.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/resend-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to resend email')
      return
    }

    toast.success('Reference request email resent successfully')
    emit('updated')
  } catch (error: any) {
    console.error('Error resending email:', error)
    toast.error(error.message || 'Failed to resend email')
  } finally {
    resendingEmail.value = false
  }
}

async function submitAddGuarantor() {
  addingGuarantor.value = true
  addGuarantorError.value = ''
  try {
    const refId = fullReference.value?.reference?.id
    if (!refId) throw new Error('Reference not found')

    const response = await fetch(`${API_URL}/api/v2/references/${refId}/add-guarantor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify(guarantorForm.value)
    })

    if (response.ok) {
      showAddGuarantorModal.value = false
      guarantorForm.value = { firstName: '', lastName: '', email: '', phone: '', relationship: '' }
      toast.success('Guarantor form sent successfully')
      emit('updated')
    } else {
      const data = await response.json()
      addGuarantorError.value = data.error || 'Failed to add guarantor'
    }
  } catch (err: any) {
    addGuarantorError.value = err.message || 'Failed to add guarantor'
  } finally {
    addingGuarantor.value = false
  }
}

async function deleteReference() {
  deleting.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to delete reference')
      return
    }

    const message = data.creditRefunded
      ? 'Reference deleted and credit refunded'
      : 'Reference deleted'
    toast.success(message)

    showDeleteConfirm.value = false
    emit('close')
    emit('updated')
  } catch (error: any) {
    console.error('Error deleting reference:', error)
    toast.error(error.message || 'Failed to delete reference')
  } finally {
    deleting.value = false
  }
}

// ============================================================================
// ISSUE & EDIT FUNCTIONS
// ============================================================================

function getSectionIssueStatus(section: any): string | null {
  return section.section_data?.issue_status || null
}

const hasRefereeFields = computed(() => {
  return !!(refData.value?.employer_ref_name || refData.value?.previous_landlord_name || refData.value?.accountant_name)
})

function onConverted() {
  toast.success('Reference converted to tenancy')
  fetchFullReference()
  emit('updated')
}

async function onFieldSaved(result: any) {
  toast.success('Field updated')
  await fetchFullReference()
  emit('updated')
}

async function onRefereeFieldSaved(result: any) {
  if (result?.isRefereeField) {
    // Determine referee type from field name
    let refereeType = ''
    let sectionType = ''
    if (result.field?.startsWith('employer_ref_')) {
      refereeType = 'EMPLOYER'
      sectionType = 'INCOME'
    } else if (result.field?.startsWith('previous_landlord_')) {
      refereeType = 'LANDLORD'
      sectionType = 'RESIDENTIAL'
    } else if (result.field?.startsWith('accountant_')) {
      refereeType = 'ACCOUNTANT'
      sectionType = 'INCOME'
    }

    if (refereeType && confirm('Referee details updated. Send new reference request to this referee?')) {
      try {
        await fetch(`${API_URL}/api/v2/references/${props.reference.id}/chase-referee`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.session?.access_token}`,
            'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refereeType, sectionType })
        })
        toast.success('Reference request sent to referee')
      } catch {
        toast.error('Failed to send reference request')
      }
    }
  }

  toast.success('Field updated')
  await fetchFullReference()
  emit('updated')
}

async function handleSectionUpload(event: Event, section: any) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  const reader = new FileReader()
  const base64 = await new Promise<string>((resolve) => {
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  })

  try {
    const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/sections/${section.id}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileData: base64,
        fileName: file.name,
        fileType: file.type
      })
    })

    if (response.ok) {
      toast.success('Document uploaded')
      await fetchFullReference()
    } else {
      toast.error('Failed to upload document')
    }
  } catch {
    toast.error('Failed to upload document')
  }
}

// Activity log
watch(showActivityLog, async (show) => {
  if (show && activityLog.value.length === 0) {
    loadingActivity.value = true
    try {
      const response = await fetch(`${API_URL}/api/v2/references/${props.reference.id}/activity`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
        }
      })
      if (response.ok) {
        const data = await response.json()
        activityLog.value = data.activity || []
      }
    } catch {
      console.error('Failed to load activity')
    } finally {
      loadingActivity.value = false
    }
  }
})

function getActivityDotClass(action: string): string {
  if (action === 'ISSUE_REPORTED') return 'bg-amber-500'
  if (action.includes('UPLOAD') || action.includes('RESPONSE')) return 'bg-blue-500'
  if (action === 'FIELD_EDITED') return 'bg-purple-500'
  if (action === 'REFEREE_CHASED') return 'bg-orange-500'
  return 'bg-gray-400'
}

function formatActivityAction(action: string): string {
  const labels: Record<string, string> = {
    'FIELD_EDITED': 'Field Edited',
    'ISSUE_REPORTED': 'Issue Reported',
    'TENANT_UPLOAD': 'Tenant Upload',
    'TENANT_RESPONSE': 'Tenant Response',
    'AGENT_UPLOAD': 'Agent Upload',
    'RESPONSE_ACCEPTED_VERIFY': 'Response Accepted (Verify)',
    'RESPONSE_ACCEPTED_CHASE': 'Response Accepted (Chase)',
    'REFEREE_CHASED': 'Referee Chased'
  }
  return labels[action] || action.replace(/_/g, ' ')
}

function formatActivityTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London'
  })
}
</script>
