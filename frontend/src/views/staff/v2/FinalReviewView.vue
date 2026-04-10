<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-6xl mx-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="goBack"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft class="w-5 h-5" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <Award class="w-6 h-6 text-green-600" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">Final Review</h1>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Senior Assessor Decision
              </p>
            </div>
          </div>
          <UKTimeClock />
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="max-w-6xl mx-auto p-6">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 animate-pulse">
        <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Review View (when reference loaded) -->
    <main v-else-if="referenceData" class="max-w-6xl mx-auto p-6 space-y-6">

      <!-- Property Header Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-1">Property</p>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ referenceData.reference.property_address }}
              <span v-if="referenceData.reference.property_city">, {{ referenceData.reference.property_city }}</span>
              <span v-if="referenceData.reference.property_postcode"> {{ referenceData.reference.property_postcode }}</span>
            </h2>
            <p class="text-sm text-gray-400 dark:text-slate-500 mt-1">{{ referenceData.reference.company_name || 'Unknown Company' }}</p>
            <p v-if="referenceData.reference.reference_number" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              Ref: {{ referenceData.reference.reference_number }}
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary">&pound;{{ referenceData.reference.monthly_rent }}/mo</div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Monthly Rent</div>
          </div>
        </div>
      </div>

      <!-- Tenant Cards -->
      <div class="space-y-4">
        <div
          v-for="tenant in allTenants"
          :key="tenant.id"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6"
        >
          <!-- Tenant header row -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ tenant.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-slate-400">
                Monthly Share: &pound;{{ formatNumber(tenant.rent_share) }}/mo
              </p>
            </div>
            <button
              @click="openTenantModal(tenant)"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
            >
              <Eye class="w-4 h-4" />
              View Details
            </button>
          </div>

          <!-- Section badges row -->
          <div class="flex flex-wrap gap-2 mb-4">
            <span
              v-for="badge in tenant.sectionBadges"
              :key="badge.type"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full"
              :class="getBadgeClass(badge.decision)"
            >
              <component :is="getBadgeIcon(badge.decision)" class="w-3 h-3" />
              {{ badge.label }}
            </span>
          </div>

          <!-- Individual affordability -->
          <div
            class="p-3 rounded-lg text-sm"
            :class="tenant.affordability_pass
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'"
          >
            <div class="flex items-center gap-1.5 mb-1">
              <component
                :is="tenant.affordability_pass ? CheckCircle : AlertTriangle"
                class="w-4 h-4"
                :class="tenant.affordability_pass ? 'text-green-600' : 'text-red-600'"
              />
              <span
                class="font-medium"
                :class="tenant.affordability_pass ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'"
              >
                {{ tenant.affordability_pass ? 'Affordability Passed' : 'Affordability Failed' }}
              </span>
            </div>
            <p :class="tenant.affordability_pass ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
              Annual Income: &pound;{{ formatNumber(tenant.annual_income) }}
              | Monthly Share: &pound;{{ formatNumber(tenant.rent_share) }}
              | Ratio: {{ tenant.affordability_ratio.toFixed(1) }}x
              <span class="text-xs">(30x required)</span>
            </p>
          </div>

          <!-- Guarantor sub-card -->
          <div
            v-if="tenant.guarantor"
            class="mt-4 ml-6 border-l-2 border-blue-300 dark:border-blue-700 pl-4"
          >
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <Shield class="w-4 h-4 text-blue-600" />
                  <span class="font-semibold text-gray-900 dark:text-white">
                    Guarantor: {{ tenant.guarantor.name }}
                  </span>
                </div>
                <button
                  @click="openTenantModal(tenant.guarantor)"
                  class="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Eye class="w-3 h-3" />
                  Details
                </button>
              </div>

              <!-- Guarantor section badges -->
              <div class="flex flex-wrap gap-2 mb-3">
                <span
                  v-for="badge in tenant.guarantor.sectionBadges"
                  :key="badge.type"
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="getBadgeClass(badge.decision)"
                >
                  <component :is="getBadgeIcon(badge.decision)" class="w-3 h-3" />
                  {{ badge.label }}
                </span>
              </div>

              <!-- Guarantor affordability -->
              <div
                class="p-2 rounded text-sm"
                :class="tenant.guarantor.affordability_pass
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'"
              >
                <p :class="tenant.guarantor.affordability_pass ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                  Annual Income: &pound;{{ formatNumber(tenant.guarantor.annual_income) }}
                  | Rent Share: &pound;{{ formatNumber(tenant.guarantor.rent_share) }}/mo
                  | Ratio: {{ tenant.guarantor.affordability_ratio.toFixed(1) }}x
                  <span class="text-xs">(32x required)</span>
                  &mdash;
                  <span class="font-medium">{{ tenant.guarantor.affordability_pass ? 'PASS' : 'FAIL' }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Affordability Summary -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-4">
          {{ allTenants.length > 1 ? 'Group' : '' }} Affordability Summary
        </h3>
        <div class="grid grid-cols-3 gap-6">
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Combined Annual Income</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              &pound;{{ formatNumber(groupAffordability.totalAnnualIncome) }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Total Monthly Rent</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">
              &pound;{{ formatNumber(groupAffordability.totalMonthlyRent) }}
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-500 dark:text-slate-400">Combined Ratio</div>
            <div
              class="text-xl font-bold"
              :class="groupAffordability.pass ? 'text-green-600' : 'text-red-600'"
            >
              {{ groupAffordability.ratio.toFixed(1) }}x
              <span class="text-sm font-normal">(2.5x required)</span>
            </div>
          </div>
        </div>

        <div
          v-if="!groupAffordability.pass"
          class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
        >
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Affordability Below Threshold</p>
              <p class="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {{ referenceData?.reference?.is_guarantor ? 'Consider ACCEPTED_ON_CONDITION or REJECTED' : 'Consider ACCEPTED_WITH_GUARANTOR or ACCEPTED_ON_CONDITION' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Final Decision Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Final Decision</h3>

        <!-- Decision Options -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            @click="selectDecision('ACCEPTED')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-green-300'"
          >
            <Check class="w-6 h-6 text-green-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">Accepted</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">All clear, approved</div>
          </button>

          <button
            v-if="!referenceData?.reference?.is_guarantor"
            @click="selectDecision('ACCEPTED_WITH_GUARANTOR')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED_WITH_GUARANTOR'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'"
          >
            <UserPlus class="w-6 h-6 text-blue-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">With Guarantor</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Requires guarantor</div>
          </button>

          <button
            @click="selectDecision('ACCEPTED_ON_CONDITION')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'ACCEPTED_ON_CONDITION'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-amber-300'"
          >
            <AlertCircle class="w-6 h-6 text-amber-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">On Condition</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">With noted conditions</div>
          </button>

          <button
            @click="selectDecision('REJECTED')"
            class="p-4 rounded-xl border-2 text-left transition-all"
            :class="decision === 'REJECTED'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-slate-700 hover:border-red-300'"
          >
            <XCircle class="w-6 h-6 text-red-600 mb-2" />
            <div class="font-medium text-gray-900 dark:text-white">Rejected</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Does not pass</div>
          </button>
        </div>

        <!-- Condition/Notes -->
        <div v-if="decision === 'ACCEPTED_ON_CONDITION'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Condition Details *
          </label>
          <textarea
            v-model="conditionText"
            rows="2"
            required
            placeholder="Describe the condition(s)..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Decision Notes
          </label>
          <textarea
            v-model="decisionNotes"
            rows="3"
            placeholder="Notes visible to agent..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            @click="goBack"
            class="px-6 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            @click="submitDecision"
            :disabled="!canSubmit || submitting"
            class="flex-1 py-2.5 px-4 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ submitting ? 'Submitting...' : 'Submit Final Decision' }}
          </button>
        </div>
      </div>
    </main>

    <!-- Queue View (when not reviewing specific reference) -->
    <main v-else class="max-w-5xl mx-auto p-6">
      <div v-if="queueItems.length === 0" class="text-center py-16">
        <div class="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
          <CheckCircle class="w-8 h-8 text-green-600" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No references ready for final review</h3>
        <p class="text-gray-500 dark:text-slate-400 mt-1">Check back later</p>
      </div>

      <div v-else class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ queueItems.length }} Reference{{ queueItems.length > 1 ? 's' : '' }} Ready for Final Review
        </h2>
        <div
          v-for="item in queueItems"
          :key="item.id"
          @click="loadReference(item.id)"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">{{ item.tenant_name }}</span>
                <span
                  v-if="item.group_size > 1"
                  class="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full"
                >
                  Group of {{ item.group_size }}
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ item.property_address }}</p>
              <p class="text-xs text-gray-400 dark:text-slate-500">{{ item.company_name }}</p>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-primary">&pound;{{ item.monthly_rent }}/mo</div>
              <ChevronRight class="w-5 h-5 text-gray-400 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Tenant Detail Modal -->
    <Teleport to="body">
      <div
        v-if="modalTenant"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="closeTenantModal"></div>

        <!-- Modal content -->
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4">
          <!-- Modal header -->
          <div class="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between rounded-t-2xl z-10">
            <div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ modalTenant.name }}</h3>
              <p v-if="modalTenant.isGuarantor" class="text-xs text-blue-600 dark:text-blue-400">Guarantor</p>
            </div>
            <button
              @click="closeTenantModal"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Sections -->
          <div class="p-4 space-y-3">
            <div
              v-for="section in modalTenant.sections"
              :key="section.section_type"
              class="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
            >
              <!-- Section header (collapsible) -->
              <button
                @click="toggleModalSection(section.section_type)"
                class="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 dark:text-white">{{ getSectionLabel(section.section_type) }}</span>
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                    :class="getBadgeClass(section.decision)"
                  >
                    <component :is="getBadgeIcon(section.decision)" class="w-3 h-3" />
                    {{ getSectionStatusText(section) }}
                  </span>
                </div>
                <component
                  :is="expandedModalSections.has(section.section_type) ? ChevronDown : ChevronRight"
                  class="w-4 h-4 text-gray-400"
                />
              </button>

              <!-- Section details (expanded) -->
              <div
                v-if="expandedModalSections.has(section.section_type)"
                class="border-t border-gray-200 dark:border-slate-700 p-3 bg-gray-50 dark:bg-slate-900/50 space-y-3"
              >
                <!-- Loading -->
                <div v-if="sectionDetailLoading.has(section.id)" class="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Loading section data...
                </div>

                <template v-else-if="sectionDetailCache[section.id]">
                  <!-- Assessor decision -->
                  <div v-if="section.assessor_notes || section.condition_text">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Assessor Notes</p>
                    <p v-if="section.condition_text" class="text-sm text-amber-700 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                      Condition: {{ section.condition_text }}
                    </p>
                    <p v-if="section.assessor_notes" class="text-sm text-gray-700 dark:text-slate-300">
                      {{ section.assessor_notes }}
                    </p>
                  </div>

                  <!-- Checklist results -->
                  <div v-if="sectionDetailCache[section.id]?.section_data?.checklist_results">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Assessor Findings</p>
                    <div class="grid grid-cols-2 gap-1">
                      <template v-for="(value, key) in sectionDetailCache[section.id].section_data.checklist_results" :key="String(key)">
                        <span class="text-xs text-gray-500">{{ formatChecklistKey(String(key)) }}</span>
                        <span class="text-xs font-medium text-gray-900 dark:text-white text-right">{{ value }}</span>
                      </template>
                    </div>
                  </div>

                  <!-- Tenant Submitted Data -->
                  <div v-if="sectionDetailCache[section.id]?.form_data && Object.keys(filteredFormData(sectionDetailCache[section.id].form_data)).length > 0">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Tenant Submitted Data</p>
                    <div class="grid grid-cols-2 gap-1">
                      <template v-for="(value, key) in filteredFormData(sectionDetailCache[section.id].form_data)" :key="String(key)">
                        <span class="text-xs text-gray-500">{{ formatChecklistKey(String(key)) }}</span>
                        <span class="text-xs font-medium text-gray-900 dark:text-white text-right">{{ formatFieldVal(value) }}</span>
                      </template>
                    </div>
                  </div>

                  <!-- Evidence Documents -->
                  <div v-if="sectionDetailCache[section.id]?.evidence && Object.keys(sectionDetailCache[section.id].evidence).length > 0">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Evidence Documents</p>
                    <div class="space-y-1">
                      <a
                        v-for="(doc, docKey) in sectionDetailCache[section.id].evidence"
                        :key="String(docKey)"
                        :href="doc.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600 hover:border-primary text-sm text-primary transition-colors"
                      >
                        <Eye class="w-3.5 h-3.5 flex-shrink-0" />
                        {{ doc.filename || String(docKey) }}
                      </a>
                    </div>
                  </div>

                  <!-- Referee Submissions -->
                  <div v-if="sectionDetailCache[section.id]?.referee_submissions?.length > 0">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Referee Responses</p>
                    <div v-for="ref in sectionDetailCache[section.id].referee_submissions" :key="ref.id" class="p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600 space-y-1">
                      <p class="text-xs font-semibold text-gray-700 dark:text-slate-300">{{ ref.referee_type }}: {{ ref.referee_name || 'Unknown' }}</p>
                      <template v-if="ref.form_data">
                        <div class="grid grid-cols-2 gap-1">
                          <template v-for="(value, key) in ref.form_data" :key="String(key)">
                            <template v-if="String(key) !== 'submittedAt' && String(key) !== 'signature' && value !== null && value !== ''">
                              <span class="text-xs text-gray-500">{{ formatChecklistKey(String(key)) }}</span>
                              <span class="text-xs font-medium text-gray-900 dark:text-white text-right">{{ formatFieldVal(value) }}</span>
                            </template>
                          </template>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- Credit Check -->
                  <div v-if="sectionDetailCache[section.id]?.credit_check">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Credit Check Results</p>
                    <div class="grid grid-cols-3 gap-2">
                      <div class="p-2 bg-white dark:bg-slate-800 rounded text-center">
                        <p class="text-xs text-gray-500">Risk Score</p>
                        <p class="font-bold text-gray-900 dark:text-white">{{ sectionDetailCache[section.id].credit_check.risk_score }}/100</p>
                      </div>
                      <div class="p-2 bg-white dark:bg-slate-800 rounded text-center">
                        <p class="text-xs text-gray-500">Risk Level</p>
                        <p class="font-bold capitalize text-gray-900 dark:text-white">{{ sectionDetailCache[section.id].credit_check.risk_level }}</p>
                      </div>
                      <div class="p-2 bg-white dark:bg-slate-800 rounded text-center">
                        <p class="text-xs text-gray-500">Status</p>
                        <p class="font-bold capitalize text-gray-900 dark:text-white">{{ sectionDetailCache[section.id].credit_check.status }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- AML Check -->
                  <div v-if="sectionDetailCache[section.id]?.aml_check">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">AML/Sanctions Check</p>
                    <div class="p-2 bg-white dark:bg-slate-800 rounded text-sm">
                      <span class="font-medium capitalize" :class="sectionDetailCache[section.id].aml_check.risk_level === 'clear' ? 'text-green-600' : 'text-red-600'">
                        {{ sectionDetailCache[section.id].aml_check.risk_level }}
                      </span>
                      <span class="text-gray-500 ml-2">
                        Sanctions: {{ sectionDetailCache[section.id].aml_check.sanctions_matches || 0 }}
                      </span>
                    </div>
                  </div>

                  <!-- Verbal Reference -->
                  <div v-if="sectionDetailCache[section.id]?.verbalReference">
                    <p class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-1">Verbal Reference</p>
                    <div class="p-2 bg-white dark:bg-slate-800 rounded space-y-1">
                      <div v-for="(val, k) in sectionDetailCache[section.id].verbalReference.responses" :key="String(k)" class="flex justify-between text-xs">
                        <span class="text-gray-500">{{ formatChecklistKey(String(k)) }}</span>
                        <span class="text-gray-900 dark:text-white">{{ val }}</span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Fallback if no detail loaded -->
                <template v-else>
                  <div v-if="section.assessor_notes || section.condition_text">
                    <p class="text-xs font-medium text-gray-500 uppercase mb-1">Assessor Notes</p>
                    <p v-if="section.condition_text" class="text-sm text-amber-700">Condition: {{ section.condition_text }}</p>
                    <p v-if="section.assessor_notes" class="text-sm text-gray-700">{{ section.assessor_notes }}</p>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import {
  ArrowLeft,
  Award,
  Check,
  XCircle,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  Eye,
  Shield,
  X
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// ============================================================================
// Types
// ============================================================================

interface SectionBadge {
  type: string
  label: string
  decision: string | null
}

interface TenantView {
  id: string
  name: string
  rent_share: number
  annual_income: number
  affordability_ratio: number
  affordability_pass: boolean
  sections: any[]
  sectionBadges: SectionBadge[]
  isGuarantor?: boolean
  guarantor?: TenantView | null
}

// ============================================================================
// State
// ============================================================================

const loading = ref(true)
const submitting = ref(false)
const referenceData = ref<any>(null)
const queueItems = ref<any[]>([])

const decision = ref<string | null>(null)
const conditionText = ref('')
const decisionNotes = ref('')

// Modal state
const modalTenant = ref<TenantView | null>(null)
const expandedModalSections = ref<Set<string>>(new Set())
const sectionDetailCache = ref<Record<string, any>>({})
const sectionDetailLoading = ref<Set<string>>(new Set())

// ============================================================================
// Section labels and badge helpers
// ============================================================================

const TENANT_SECTION_TYPES = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']
const GUARANTOR_SECTION_TYPES = ['IDENTITY', 'ADDRESS', 'INCOME', 'CREDIT', 'AML']

const SECTION_SHORT_LABELS: Record<string, string> = {
  IDENTITY: 'ID',
  RTR: 'RTR',
  INCOME: 'Income',
  RESIDENTIAL: 'Res',
  ADDRESS: 'Address',
  CREDIT: 'Credit',
  AML: 'AML'
}

const SECTION_FULL_LABELS: Record<string, string> = {
  IDENTITY: 'Identity',
  RTR: 'Right to Rent',
  INCOME: 'Income',
  RESIDENTIAL: 'Residential',
  ADDRESS: 'Address',
  CREDIT: 'Credit',
  AML: 'AML'
}

function getSectionLabel(type: string): string {
  return SECTION_FULL_LABELS[type] || type
}

function getSectionStatusText(section: any): string {
  if (section.decision === 'PASS') return 'Passed'
  if (section.decision === 'PASS_WITH_CONDITION') return 'Condition'
  if (section.decision === 'FAIL') return 'Failed'
  return 'Pending'
}

function getBadgeClass(decision: string | null): string {
  if (decision === 'PASS') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (decision === 'PASS_WITH_CONDITION') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (decision === 'FAIL') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
}

function getBadgeIcon(decision: string | null) {
  if (decision === 'PASS') return CheckCircle
  if (decision === 'PASS_WITH_CONDITION') return AlertCircle
  if (decision === 'FAIL') return XCircle
  return AlertCircle
}

// ============================================================================
// Build tenant objects
// ============================================================================

function buildSectionBadges(sections: any[], sectionTypes: string[]): SectionBadge[] {
  return sectionTypes.map((type) => {
    const section = sections.find((s: any) => s.section_type === type)
    return {
      type,
      label: SECTION_SHORT_LABELS[type] || type,
      decision: section?.decision || null
    }
  })
}

function buildGuarantorView(guarantorData: any): TenantView | null {
  if (!guarantorData) return null
  const name = `${guarantorData.tenant_first_name || ''} ${guarantorData.tenant_last_name || ''}`.trim()
  const rentShare = guarantorData.rent_share || 0
  const annualIncome = guarantorData.annual_income || 0
  const annualRent = rentShare * 12
  const ratio = annualRent > 0 ? annualIncome / annualRent : 0
  // Guarantor: 32x monthly = annual_income >= 32 * rent_share (monthly)
  const pass = annualIncome >= 32 * rentShare

  return {
    id: guarantorData.id,
    name,
    rent_share: rentShare,
    annual_income: annualIncome,
    affordability_ratio: ratio,
    affordability_pass: pass,
    sections: guarantorData.sections || [],
    sectionBadges: buildSectionBadges(guarantorData.sections || [], GUARANTOR_SECTION_TYPES),
    isGuarantor: true,
    guarantor: null
  }
}

function buildTenantView(tenantData: any, sections: any[], guarantorData: any): TenantView {
  const name = `${tenantData.tenant_first_name || ''} ${tenantData.tenant_last_name || ''}`.trim()
  const rentShare = tenantData.rent_share || tenantData.monthly_rent || 0

  // Pull income from multiple sources: checklist_results (assessor verified) > section_data > reference field
  const incomeSection = sections.find((s: any) => s.section_type === 'INCOME')
  const checklist = (incomeSection?.section_data as any)?.checklist_results || {}
  const annualIncome = parseFloat(checklist.total_effective_income) || parseFloat(checklist.annual_income) || tenantData.annual_income || 0
  const annualRent = rentShare * 12
  const ratio = annualRent > 0 ? annualIncome / annualRent : 0
  // Tenant: 30x monthly = annual_income >= 30 * rent_share
  const pass = annualIncome >= 30 * rentShare

  return {
    id: tenantData.id,
    name,
    rent_share: rentShare,
    annual_income: annualIncome,
    affordability_ratio: ratio,
    affordability_pass: pass,
    sections,
    sectionBadges: buildSectionBadges(sections, TENANT_SECTION_TYPES),
    guarantor: buildGuarantorView(guarantorData)
  }
}

// ============================================================================
// Computed
// ============================================================================

const allTenants = computed<TenantView[]>(() => {
  if (!referenceData.value) return []

  const data = referenceData.value
  const ref = data.reference

  // If this reference is a guarantor, use guarantor section types and affordability
  if (ref.is_guarantor) {
    const name = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim()
    const rentShare = ref.rent_share || 0
    const incomeSection = (data.sections || []).find((s: any) => s.section_type === 'INCOME')
    const checklist = (incomeSection?.section_data as any)?.checklist_results || {}
    const annualIncome = parseFloat(checklist.total_effective_income) || parseFloat(checklist.annual_income) || ref.annual_income || 0
    const annualRent = rentShare * 12
    const ratio = annualRent > 0 ? annualIncome / annualRent : 0
    const pass = annualIncome >= 32 * rentShare

    return [{
      id: ref.id,
      name,
      rent_share: rentShare,
      annual_income: annualIncome,
      affordability_ratio: ratio,
      affordability_pass: pass,
      sections: data.sections || [],
      sectionBadges: buildSectionBadges(data.sections || [], GUARANTOR_SECTION_TYPES),
      guarantor: null
    }]
  }

  // Each individual gets their own final review — always show just this one person
  return [
    buildTenantView(data.reference, data.sections || [], data.guarantor)
  ]
})

const groupAffordability = computed(() => {
  const tenants = allTenants.value
  const totalAnnualIncome = tenants.reduce((sum, t) => sum + t.annual_income, 0)
  // Sum of tenant rent shares — final review should ALWAYS use the share set on group assessment
  let totalMonthlyRent = tenants.reduce((sum, t) => sum + (t.rent_share || 0), 0)
  if (totalMonthlyRent === 0 && referenceData.value?.reference?.monthly_rent) {
    totalMonthlyRent = referenceData.value.reference.monthly_rent
  }
  const totalAnnualRent = totalMonthlyRent * 12
  const ratio = totalAnnualRent > 0 ? totalAnnualIncome / totalAnnualRent : 0
  const pass = ratio >= 2.5

  return {
    totalAnnualIncome,
    totalMonthlyRent,
    ratio,
    pass
  }
})

const canSubmit = computed(() => {
  if (!decision.value) return false
  if (decision.value === 'ACCEPTED_ON_CONDITION' && !conditionText.value.trim()) return false
  return true
})

// ============================================================================
// Modal
// ============================================================================

function openTenantModal(tenant: TenantView) {
  modalTenant.value = tenant
  expandedModalSections.value = new Set()
}

function closeTenantModal() {
  modalTenant.value = null
  expandedModalSections.value = new Set()
  sectionDetailCache.value = {}
}

async function toggleModalSection(sectionType: string) {
  const s = new Set(expandedModalSections.value)
  if (s.has(sectionType)) {
    s.delete(sectionType)
  } else {
    s.add(sectionType)
    // Fetch section detail if not cached
    const section = modalTenant.value?.sections.find((sec: any) => sec.section_type === sectionType)
    if (section && !sectionDetailCache.value[section.id]) {
      const loadingSet = new Set(sectionDetailLoading.value)
      loadingSet.add(section.id)
      sectionDetailLoading.value = loadingSet
      try {
        const response = await fetch(`${API_URL}/api/v2/final-review/section-detail/${section.id}`, {
          headers: { 'Authorization': `Bearer ${authStore.session?.access_token}` }
        })
        if (response.ok) {
          sectionDetailCache.value[section.id] = await response.json()
        }
      } catch (e) {
        console.error('Error fetching section detail:', e)
      } finally {
        const done = new Set(sectionDetailLoading.value)
        done.delete(section.id)
        sectionDetailLoading.value = done
      }
    }
  }
  expandedModalSections.value = s
}

// ============================================================================
// Formatting
// ============================================================================

function formatChecklistKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function filteredFormData(formData: any): Record<string, any> {
  if (!formData) return {}
  const skip = ['selfieUrl', 'idDocumentUrl', 'passportDocUrl', 'alternativeDocUrl', 'supportingDocUrl',
    'proofOfAddressUrl', 'payslipsUrl', 'taxReturnUrl', 'studentDocUrl', 'savingsDocUrl', 'pensionDocUrl',
    'benefitsDocUrl', 'bankStatementsUrl', 'accountsDocUrl', 'otherDocUrl',
    'signature', 'proofOfAddress',
    'selfie', 'idDocument', 'passportDoc', 'alternativeDoc', 'supportingDoc', 'taxReturn', 'studentDoc']
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (skip.includes(key)) continue
    if (key.endsWith('Url') || key.endsWith('Doc')) continue
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) continue
    if (typeof value === 'object' && !Array.isArray(value)) continue
    result[key] = value
  }
  return result
}

function formatFieldVal(value: any): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GB').format(num)
}

// ============================================================================
// Decision
// ============================================================================

function selectDecision(d: string) {
  decision.value = d
  if (d !== 'ACCEPTED_ON_CONDITION') {
    conditionText.value = ''
  }
}

// ============================================================================
// API calls
// ============================================================================

async function fetchQueueItems() {
  try {
    const response = await fetch(`${API_URL}/api/v2/final-review/queue`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      queueItems.value = data.items || []
    }
  } catch (error) {
    console.error('Error fetching final review queue:', error)
  }
}

async function loadReference(referenceId: string) {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/final-review/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      const data = await response.json()

      // Enrich reference with company name from queue if available
      const queueItem = queueItems.value.find((q) => q.id === referenceId || q.reference_id === referenceId)
      if (queueItem?.company_name && data.reference) {
        data.reference.company_name = queueItem.company_name
      }

      referenceData.value = data
    }
  } catch (error) {
    console.error('Error loading reference:', error)
  } finally {
    loading.value = false
  }
}

async function submitDecision() {
  if (!canSubmit.value || !referenceData.value?.reference) return

  submitting.value = true
  try {
    const refId = referenceData.value.reference.id
    const response = await fetch(`${API_URL}/api/v2/final-review/${refId}/decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        decision: decision.value,
        conditionText: conditionText.value || undefined,
        notes: decisionNotes.value || undefined
      })
    })

    if (response.ok) {
      referenceData.value = null
      decision.value = null
      conditionText.value = ''
      decisionNotes.value = ''
      await fetchQueueItems()
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to submit decision')
    }
  } catch (error) {
    console.error('Error submitting decision:', error)
    alert('Failed to submit decision')
  } finally {
    submitting.value = false
  }
}

// ============================================================================
// Navigation
// ============================================================================

function goBack() {
  if (referenceData.value) {
    referenceData.value = null
    decision.value = null
  } else {
    router.push({ name: 'StaffDashboardV2' })
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  const refId = route.params.referenceId as string
  if (refId) {
    await loadReference(refId)
  } else {
    await fetchQueueItems()
  }
  loading.value = false
})
</script>
