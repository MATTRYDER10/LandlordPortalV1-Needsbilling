<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex items-center space-x-4">
            <button
              @click="$router.push('/staff/dashboard')"
              class="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <h1 class="text-2xl font-bold text-gray-900">Step-by-Step Verification</h1>
          </div>
          <button
            @click="handleSignOut"
            class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Step {{ currentStep }} of {{ totalSteps }}</span>
          <span class="text-sm text-gray-500">{{ Math.round((currentStep / totalSteps) * 100) }}% Complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-primary h-2 rounded-full transition-all duration-300"
            :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
          ></div>
        </div>
        <div class="flex justify-between mt-3 text-xs">
          <span :class="currentStep >= 1 ? 'text-primary font-semibold' : 'text-gray-400'">ID Verification</span>
          <span :class="currentStep >= 2 ? 'text-primary font-semibold' : 'text-gray-400'">Selfie Match</span>
          <span :class="currentStep >= 3 ? 'text-primary font-semibold' : 'text-gray-400'">Employment</span>
          <span :class="currentStep >= 4 ? 'text-primary font-semibold' : 'text-gray-400'">Tenancy</span>
          <span :class="currentStep >= 5 ? 'text-primary font-semibold' : 'text-gray-400'">Address History</span>
          <span :class="currentStep >= 6 ? 'text-primary font-semibold' : 'text-gray-400'">Final Review</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading reference data...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="reference" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Step 1: ID Document Verification -->
      <VerificationStep
        v-if="currentStep === 1"
        title="ID Document Verification"
        description="Verify the ID document matches the provided information"
        :completed="verificationCheck.id_step_completed"
        :can-proceed="canProceedFromStep1"
        :show-previous="false"
        :notes="verificationCheck.id_notes"
        @update:notes="verificationCheck.id_notes = $event"
        @next="completeStep1"
        @save="saveProgress"
        :saving="saving"
      >
        <SideBySideViewer
          :left-image-url="idDocumentBlobUrl"
          left-title="ID Document"
          right-title="Verify Information Matches"
        >
          <template #right-content>
            <div class="mt-4 space-y-4">
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p class="text-sm font-medium text-gray-700">Full Name</p>
                  <p class="text-sm text-gray-900">{{ fullName }}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.id_name_match = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_name_match === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Match
                  </button>
                  <button
                    @click="verificationCheck.id_name_match = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_name_match === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No Match
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p class="text-sm font-medium text-gray-700">Date of Birth</p>
                  <p class="text-sm text-gray-900">{{ formatDate(reference.date_of_birth, 'Not provided') }}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.id_dob_match = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_dob_match === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Match
                  </button>
                  <button
                    @click="verificationCheck.id_dob_match = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_dob_match === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No Match
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <p class="text-sm font-medium text-gray-700">Document is valid/not expired</p>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.id_valid = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_valid === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Yes
                  </button>
                  <button
                    @click="verificationCheck.id_valid = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_valid === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <p class="text-sm font-medium text-gray-700">Photo is clear and legible</p>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.id_photo_clear = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_photo_clear === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Yes
                  </button>
                  <button
                    @click="verificationCheck.id_photo_clear = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_photo_clear === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <p class="text-sm font-medium text-gray-700">Document appears authentic</p>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.id_authentic = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_authentic === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Yes
                  </button>
                  <button
                    @click="verificationCheck.id_authentic = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.id_authentic === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </template>
        </SideBySideViewer>
      </VerificationStep>

      <!-- Step 2: Selfie Verification -->
      <VerificationStep
        v-if="currentStep === 2"
        title="Selfie Verification"
        description="Compare the selfie with the ID document photo"
        :completed="verificationCheck.selfie_step_completed"
        :can-proceed="canProceedFromStep2"
        :notes="verificationCheck.selfie_notes"
        @update:notes="verificationCheck.selfie_notes = $event"
        @previous="currentStep = 1"
        @next="completeStep2"
        @save="saveProgress"
        :saving="saving"
      >
        <SideBySideViewer
          :left-image-url="idDocumentBlobUrl"
          :right-image-url="selfieBlobUrl"
          left-title="ID Document Photo"
          right-title="Selfie"
        >
          <template #left-content>
            <p class="mt-2 text-xs text-gray-500">Look at the photo on the ID document</p>
          </template>
          <template #right-content>
            <div class="mt-4">
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                <p class="text-sm font-medium text-gray-700">Person in selfie matches ID photo</p>
                <div class="flex gap-2">
                  <button
                    @click="verificationCheck.selfie_matches_id = true"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.selfie_matches_id === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                    ]"
                  >
                    Match
                  </button>
                  <button
                    @click="verificationCheck.selfie_matches_id = false"
                    :class="[
                      'px-4 py-2 text-sm font-medium rounded-md transition-all',
                      verificationCheck.selfie_matches_id === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                    ]"
                  >
                    No Match
                  </button>
                </div>
              </div>
            </div>
          </template>
        </SideBySideViewer>
      </VerificationStep>

      <!-- Step 3: Employment Verification -->
      <VerificationStep
        v-if="currentStep === 3"
        title="Employment & Income Verification"
        description="Review employment details and verify data consistency"
        :completed="verificationCheck.employment_step_completed"
        :can-proceed="canProceedFromStep3"
        :notes="verificationCheck.employment_notes"
        @update:notes="verificationCheck.employment_notes = $event"
        @previous="currentStep = 2"
        @next="completeStep3"
        @save="saveProgress"
        :saving="saving"
      >
        <div class="space-y-6">
          <div v-if="reference.income_regular_employment && employerReference">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Employment Data Comparison</h4>
            <InteractiveComparisonTable
              :rows="employmentComparisonRows"
              v-model="employmentVerifications"
              tenant-column-label="Tenant Provided"
              reference-column-label="Employer Confirmed"
            />
          </div>
          <div v-else-if="reference.income_regular_employment">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-sm text-yellow-800">Employer reference pending - cannot verify employment data yet.</p>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p class="text-sm font-medium text-gray-700">Overall employment verification</p>
            <div class="flex gap-2">
              <button
                @click="verificationCheck.employment_verified = true"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.employment_verified === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                ]"
              >
                Verified
              </button>
              <button
                @click="verificationCheck.employment_verified = false"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.employment_verified === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                ]"
              >
                Not Verified
              </button>
            </div>
          </div>
        </div>
      </VerificationStep>

      <!-- Step 4: Previous Tenancy Verification -->
      <VerificationStep
        v-if="currentStep === 4"
        title="Previous Tenancy Verification"
        description="Review previous tenancy details and landlord/agent reference"
        :completed="verificationCheck.tenancy_step_completed"
        :can-proceed="canProceedFromStep4"
        :notes="verificationCheck.tenancy_notes"
        @update:notes="verificationCheck.tenancy_notes = $event"
        @previous="currentStep = 3"
        @next="completeStep4"
        @save="saveProgress"
        :saving="saving"
      >
        <div class="space-y-6">
          <div v-if="landlordReference">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Landlord Reference Comparison</h4>
            <InteractiveComparisonTable
              :rows="landlordComparisonRows"
              v-model="tenancyVerifications"
              tenant-column-label="Tenant Provided"
              reference-column-label="Landlord Confirmed"
            />
          </div>
          <div v-else-if="agentReference">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Agent Reference Comparison</h4>
            <InteractiveComparisonTable
              :rows="agentComparisonRows"
              v-model="tenancyVerifications"
              tenant-column-label="Tenant Provided"
              reference-column-label="Agent Confirmed"
            />
          </div>
          <div v-else>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-sm text-yellow-800">Landlord/Agent reference pending - cannot verify tenancy data yet.</p>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p class="text-sm font-medium text-gray-700">Overall tenancy verification</p>
            <div class="flex gap-2">
              <button
                @click="verificationCheck.tenancy_verified = true"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.tenancy_verified === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                ]"
              >
                Verified
              </button>
              <button
                @click="verificationCheck.tenancy_verified = false"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.tenancy_verified === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                ]"
              >
                Not Verified
              </button>
            </div>
          </div>
        </div>
      </VerificationStep>

      <!-- Step 5: Address History Verification -->
      <VerificationStep
        v-if="currentStep === 5"
        title="Address History Verification"
        description="Verify the tenant has provided sufficient address history (3 years minimum)"
        :completed="verificationCheck.address_history_step_completed"
        :can-proceed="canProceedFromStep5"
        :notes="verificationCheck.address_history_notes"
        @update:notes="verificationCheck.address_history_notes = $event"
        @previous="currentStep = 4"
        @next="completeStep5"
        @save="saveProgress"
        :saving="saving"
      >
        <div class="space-y-6">
          <div class="bg-white border rounded-lg p-4">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Address History Timeline (3-Year History)</h4>
            <div class="space-y-3">
              <!-- Current Address -->
              <div class="bg-green-50 border-l-4 border-green-500 p-3">
                <p class="text-sm font-medium text-green-900">Current Address</p>
                <p class="text-sm text-green-800">{{ reference.current_address_line1 }}</p>
                <p class="text-sm text-green-700">{{ reference.current_city }}, {{ reference.current_postcode }}</p>
                <p class="text-xs text-green-600 mt-1">
                  Time at address: {{ reference.time_at_address_years || 0 }} year(s), {{ reference.time_at_address_months || 0 }} month(s)
                </p>
              </div>

              <!-- Previous Addresses from 3-year history form -->
              <div v-for="(addr, index) in previousAddresses" :key="index" class="bg-blue-50 border-l-4 border-blue-500 p-3">
                <p class="text-sm font-medium text-blue-900">Previous Address {{ index + 1 }}</p>
                <p class="text-sm text-blue-800">{{ addr.address_line1 }}</p>
                <p class="text-sm text-blue-700">{{ addr.city }}, {{ addr.postcode }}</p>
                <p class="text-xs text-blue-600 mt-1">
                  Time at address: {{ addr.time_at_address_years || 0 }} year(s), {{ addr.time_at_address_months || 0 }} month(s)
                </p>
              </div>

              <!-- Show message if no previous addresses provided -->
              <div v-if="!previousAddresses || previousAddresses.length === 0" class="bg-gray-50 border-l-4 border-gray-300 p-3">
                <p class="text-sm text-gray-600 italic">No additional previous addresses provided</p>
              </div>
            </div>

            <div class="mt-6 p-4 rounded-lg" :class="addressHistoryMeetsRequirement ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'">
              <div class="flex items-center">
                <svg v-if="addressHistoryMeetsRequirement" class="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <svg v-else class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p class="text-sm font-medium" :class="addressHistoryMeetsRequirement ? 'text-green-800' : 'text-yellow-800'">
                  {{ addressHistoryMeetsRequirement ? '3-year address history requirement met' : 'Address history may not meet 3-year requirement' }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p class="text-sm font-medium text-gray-700">Address history is complete and acceptable</p>
            <div class="flex gap-2">
              <button
                @click="verificationCheck.address_history_complete = true"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.address_history_complete === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                ]"
              >
                Acceptable
              </button>
              <button
                @click="verificationCheck.address_history_complete = false"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  verificationCheck.address_history_complete === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                ]"
              >
                Incomplete
              </button>
            </div>
          </div>
        </div>
      </VerificationStep>

      <!-- Step 6: Final Review -->
      <VerificationStep
        v-if="currentStep === 6"
        title="Final Review & Decision"
        description="Review all verification steps and make final decision"
        :show-notes="false"
        @previous="currentStep = 5"
        @save="saveProgress"
        :saving="saving"
        :show-save="false"
        next-button-text="Complete Verification"
        @next="showFinalDecisionModal = true"
      >
        <div class="space-y-6">
          <!-- Verification Summary -->
          <div class="bg-white border rounded-lg p-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.id_step_completed ? 'bg-green-50' : 'bg-red-50'">
                <span class="text-sm font-medium">ID Verification</span>
                <span v-if="verificationCheck.id_step_completed" class="text-green-600">✓ Completed</span>
                <span v-else class="text-red-600">✗ Incomplete</span>
              </div>

              <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.selfie_step_completed ? 'bg-green-50' : 'bg-red-50'">
                <span class="text-sm font-medium">Selfie Match</span>
                <span v-if="verificationCheck.selfie_step_completed" class="text-green-600">✓ Completed</span>
                <span v-else class="text-red-600">✗ Incomplete</span>
              </div>

              <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.employment_step_completed ? 'bg-green-50' : 'bg-red-50'">
                <span class="text-sm font-medium">Employment</span>
                <span v-if="verificationCheck.employment_step_completed" class="text-green-600">✓ Completed</span>
                <span v-else class="text-red-600">✗ Incomplete</span>
              </div>

              <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.tenancy_step_completed ? 'bg-green-50' : 'bg-red-50'">
                <span class="text-sm font-medium">Previous Tenancy</span>
                <span v-if="verificationCheck.tenancy_step_completed" class="text-green-600">✓ Completed</span>
                <span v-else class="text-red-600">✗ Incomplete</span>
              </div>

              <div class="flex items-center justify-between p-3 rounded" :class="verificationCheck.address_history_step_completed ? 'bg-green-50' : 'bg-red-50'">
                <span class="text-sm font-medium">Address History</span>
                <span v-if="verificationCheck.address_history_step_completed" class="text-green-600">✓ Completed</span>
                <span v-else class="text-red-600">✗ Incomplete</span>
              </div>
            </div>

            <!-- Red Flags -->
            <div v-if="redFlags.length > 0" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h5 class="text-sm font-semibold text-red-900 mb-2">⚠️ Red Flags Identified:</h5>
              <ul class="list-disc list-inside space-y-1">
                <li v-for="flag in redFlags" :key="flag" class="text-sm text-red-800">{{ flag }}</li>
              </ul>
            </div>

            <!-- All Clear -->
            <div v-else class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <p class="text-sm font-semibold text-green-900">All verification checks passed</p>
              </div>
            </div>
          </div>

          <!-- Creditsafe Verification -->
          <CreditsafeVerificationCard
            v-if="reference.submitted_at"
            :verification="creditsafeVerification"
            :loading="loadingCreditsafe"
            :show-retry-button="true"
            :retrying="retryingCreditsafe"
            @retry="retryCreditsafeVerification"
          />

          <!-- UK Sanctions & PEP Screening -->
          <SanctionsScreeningCard
            v-if="reference.submitted_at"
            :screening="sanctionsScreening"
            :loading="loadingSanctions"
            :show-run-button="true"
            :running="runningSanctions"
            @run="runSanctionsScreening"
          />
        </div>
      </VerificationStep>
    </div>
  </div>

  <!-- Final Decision Modal -->
  <div v-if="showFinalDecisionModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75">
    <div class="flex items-center justify-center min-h-screen px-4">
      <div class="bg-white rounded-lg max-w-2xl w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Final Verification Decision</h3>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Final Notes</label>
          <textarea
            v-model="finalNotes"
            rows="4"
            placeholder="Add any final notes or comments about this reference..."
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          ></textarea>
        </div>

        <div class="flex gap-3">
          <button
            @click="completeVerification(true)"
            :disabled="completing"
            class="flex-1 px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
          >
            {{ completing ? 'Processing...' : '✓ Pass & Complete Reference' }}
          </button>
          <button
            @click="completeVerification(false)"
            :disabled="completing"
            class="flex-1 px-6 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
          >
            {{ completing ? 'Processing...' : '✗ Fail & Reject Reference' }}
          </button>
          <button
            @click="showFinalDecisionModal = false"
            :disabled="completing"
            class="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import VerificationStep from '../components/VerificationStep.vue'
import SideBySideViewer from '../components/SideBySideViewer.vue'
import InteractiveComparisonTable from '../components/InteractiveComparisonTable.vue'
import CreditsafeVerificationCard from '../components/CreditsafeVerificationCard.vue'
import SanctionsScreeningCard from '../components/SanctionsScreeningCard.vue'
import { formatDate as formatUkDate } from '../utils/date'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL
const referenceId = route.params.id as string

const loading = ref(true)
const saving = ref(false)
const completing = ref(false)
const currentStep = ref(1)
const totalSteps = 6

const reference = ref<any>(null)
const verificationCheck = ref<any>({
  id_name_match: null,
  id_dob_match: null,
  id_valid: null,
  id_photo_clear: null,
  id_authentic: null,
  id_notes: '',
  id_step_completed: false,
  selfie_matches_id: null,
  selfie_notes: '',
  selfie_step_completed: false,
  employment_verified: null,
  employment_notes: '',
  employment_step_completed: false,
  tenancy_verified: null,
  tenancy_notes: '',
  tenancy_step_completed: false,
  address_history_complete: null,
  address_history_notes: '',
  address_history_step_completed: false,
  current_step: 1
})

const employerReference = ref<any>(null)
const landlordReference = ref<any>(null)
const agentReference = ref<any>(null)
const previousAddresses = ref<any[]>([])

const employmentVerifications = ref<Record<string, boolean>>({})
const tenancyVerifications = ref<Record<string, boolean>>({})

const showFinalDecisionModal = ref(false)
const finalNotes = ref('')

// Image blob URLs
const idDocumentBlobUrl = ref('')
const selfieBlobUrl = ref('')

// Creditsafe verification
const creditsafeVerification = ref<any>(null)
const loadingCreditsafe = ref(false)
const retryingCreditsafe = ref(false)

// Sanctions screening
const sanctionsScreening = ref<any>(null)
const loadingSanctions = ref(false)
const runningSanctions = ref(false)

// Helper function to capitalize first letter of each word
const capitalizeWords = (str: string | null | undefined): string => {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Computed
const fullName = computed(() => {
  const parts = [
    reference.value?.tenant_first_name,
    reference.value?.middle_name,
    reference.value?.tenant_last_name
  ].filter(Boolean)

  return parts.map(part => capitalizeWords(part)).join(' ')
})

const canProceedFromStep1 = computed(() => {
  // Can proceed if all checks have been made (true or false, not null)
  return verificationCheck.value.id_name_match !== null &&
         verificationCheck.value.id_dob_match !== null &&
         verificationCheck.value.id_valid !== null &&
         verificationCheck.value.id_photo_clear !== null &&
         verificationCheck.value.id_authentic !== null
})

const canProceedFromStep2 = computed(() => {
  // Can proceed if selfie check has been made (true or false, not null)
  return verificationCheck.value.selfie_matches_id !== null
})

const canProceedFromStep3 = computed(() => {
  // Can proceed if employment check has been made (true or false, not null)
  return verificationCheck.value.employment_verified !== null
})

const canProceedFromStep4 = computed(() => {
  // Can proceed if tenancy check has been made (true or false, not null)
  return verificationCheck.value.tenancy_verified !== null
})

const canProceedFromStep5 = computed(() => {
  // Can proceed if address history check has been made (true or false, not null)
  return verificationCheck.value.address_history_complete !== null
})

const addressHistoryMeetsRequirement = computed(() => {
  if (!reference.value) return false

  // Calculate total time at addresses (from 3-year address history)
  let totalMonths = 0

  // Add time at CURRENT address
  const currentYears = reference.value.time_at_address_years || 0
  const currentMonths = reference.value.time_at_address_months || 0
  totalMonths += (currentYears * 12) + currentMonths

  // Add time from previous addresses (from 3-year history form)
  if (previousAddresses.value && previousAddresses.value.length > 0) {
    previousAddresses.value.forEach((addr: any) => {
      const years = addr.time_at_address_years || 0
      const months = addr.time_at_address_months || 0
      totalMonths += (years * 12) + months
    })
  }

  // 3 years = 36 months
  return totalMonths >= 36
})

const employmentComparisonRows = computed(() => {
  if (!reference.value || !employerReference.value) return []

  return [
    {
      field: 'company_name',
      label: 'Company Name',
      tenantValue: reference.value.employment_company_name,
      referenceValue: employerReference.value.company_name
    },
    {
      field: 'position',
      label: 'Position',
      tenantValue: reference.value.employment_job_title,
      referenceValue: employerReference.value.employee_position
    },
    {
      field: 'salary',
      label: 'Annual Salary',
      tenantValue: reference.value.employment_salary_amount ? `£${reference.value.employment_salary_amount}` : null,
      referenceValue: employerReference.value.annual_salary ? `£${employerReference.value.annual_salary}` : null
    }
  ]
})

const landlordComparisonRows = computed(() => {
  if (!reference.value || !landlordReference.value) return []

  return [
    {
      field: 'rent',
      label: 'Monthly Rent',
      tenantValue: reference.value.previous_monthly_rent ? `£${reference.value.previous_monthly_rent}` : null,
      referenceValue: landlordReference.value.monthly_rent ? `£${landlordReference.value.monthly_rent}` : null
    },
    {
      field: 'tenancy_start',
      label: 'Tenancy Start',
      tenantValue: reference.value.previous_tenancy_start_date,
      referenceValue: landlordReference.value.tenancy_start_date
    }
  ]
})

const agentComparisonRows = computed(() => {
  if (!reference.value || !agentReference.value) return []

  return [
    {
      field: 'rent',
      label: 'Monthly Rent',
      tenantValue: reference.value.previous_monthly_rent ? `£${reference.value.previous_monthly_rent}` : null,
      referenceValue: agentReference.value.monthly_rent ? `£${agentReference.value.monthly_rent}` : null
    },
    {
      field: 'tenancy_start',
      label: 'Tenancy Start',
      tenantValue: reference.value.previous_tenancy_start_date,
      referenceValue: agentReference.value.tenancy_start_date
    }
  ]
})

const redFlags = computed(() => {
  const flags: string[] = []

  if (verificationCheck.value.id_name_match === false) flags.push('ID name does not match')
  if (verificationCheck.value.id_dob_match === false) flags.push('Date of birth does not match')
  if (verificationCheck.value.id_valid === false) flags.push('ID document is not valid or expired')
  if (verificationCheck.value.id_photo_clear === false) flags.push('ID photo is not clear')
  if (verificationCheck.value.id_authentic === false) flags.push('ID document authenticity questionable')
  if (verificationCheck.value.selfie_matches_id === false) flags.push('Selfie does not match ID photo')
  if (verificationCheck.value.employment_verified === false) flags.push('Employment could not be verified')
  if (verificationCheck.value.tenancy_verified === false) flags.push('Previous tenancy could not be verified')
  if (verificationCheck.value.address_history_complete === false) flags.push('Address history incomplete')

  return flags
})

// Helper function to convert file path to viewable URL
const getFileUrl = (filePath: string): string => {
  if (!filePath) return ''

  // Parse file path: referenceId/folder/filename
  const parts = filePath.split('/')
  if (parts.length < 3) return ''

  return `${API_URL}/api/staff/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2] || '')}`
}

// Methods
const loadImageAsBlob = async (filePath: string): Promise<string> => {
  const token = authStore.session?.access_token
  if (!token || !filePath) return ''

  try {
    const url = getFileUrl(filePath)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) return ''

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Error loading image:', error)
    return ''
  }
}

const fetchReference = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      router.push('/staff/login')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch reference')

    const data = await response.json()
    reference.value = data.reference
    employerReference.value = data.employerReference
    landlordReference.value = data.landlordReference
    agentReference.value = data.agentReference
    previousAddresses.value = data.previousAddresses || []

    // Load images as blobs
    if (reference.value.id_document_path) {
      idDocumentBlobUrl.value = await loadImageAsBlob(reference.value.id_document_path)
    }
    if (reference.value.selfie_path) {
      selfieBlobUrl.value = await loadImageAsBlob(reference.value.selfie_path)
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to load reference')
  } finally {
    loading.value = false
  }
}

const fetchVerificationCheck = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/verification/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch verification check')

    const data = await response.json()
    if (data.verificationCheck) {
      verificationCheck.value = { ...verificationCheck.value, ...data.verificationCheck }
      currentStep.value = data.verificationCheck.current_step || 1
    }
  } catch (error: any) {
    console.error('Error fetching verification check:', error)
  }
}

const fetchCreditsafeVerification = async () => {
  try {
    loadingCreditsafe.value = true
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}/creditsafe`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      creditsafeVerification.value = data.verification
    } else if (response.status !== 404) {
      console.error('Failed to fetch Creditsafe verification')
    }
  } catch (error: any) {
    console.error('Error fetching Creditsafe verification:', error)
  } finally {
    loadingCreditsafe.value = false
  }
}

const fetchSanctionsScreening = async () => {
  try {
    loadingSanctions.value = true
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}/sanctions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      sanctionsScreening.value = data.screening
    } else if (response.status === 404) {
      // No screening found - automatically run it (silently, no toast)
      console.log('No sanctions screening found, running automatically...')
      await runSanctionsScreening(false)
    } else {
      console.error('Failed to fetch sanctions screening')
    }
  } catch (error: any) {
    console.error('Error fetching sanctions screening:', error)
  } finally {
    loadingSanctions.value = false
  }
}

const runSanctionsScreening = async (showToast = true) => {
  try {
    runningSanctions.value = true
    const token = authStore.session?.access_token
    if (!token) {
      if (showToast) toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}/sanctions/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to run screening')
    }

    await response.json()
    if (showToast) toast.success('Sanctions screening completed successfully')

    // Refresh the screening data
    await fetchSanctionsScreening()
  } catch (err: any) {
    if (showToast) toast.error(err.message || 'Failed to run screening')
    else console.error('Sanctions screening failed:', err)
  } finally {
    runningSanctions.value = false
  }
}

const retryCreditsafeVerification = async () => {
  try {
    retryingCreditsafe.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}/creditsafe/retry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to retry verification')
    }

    await response.json()
    toast.success('Creditsafe verification completed successfully')

    // Refresh the verification data
    await fetchCreditsafeVerification()
  } catch (err: any) {
    toast.error(err.message || 'Failed to retry verification')
  } finally {
    retryingCreditsafe.value = false
  }
}

const saveProgress = async () => {
  try {
    saving.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/verification/${referenceId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...verificationCheck.value,
        current_step: currentStep.value,
        overall_status: 'in_progress'
      })
    })

    if (!response.ok) throw new Error('Failed to save progress')

    toast.success('Progress saved')
  } catch (error: any) {
    toast.error(error.message || 'Failed to save progress')
  } finally {
    saving.value = false
  }
}

const completeStep1 = async () => {
  verificationCheck.value.id_step_completed = true
  currentStep.value = 2
  await saveProgress()
}

const completeStep2 = async () => {
  verificationCheck.value.selfie_step_completed = true
  currentStep.value = 3
  await saveProgress()
}

const completeStep3 = async () => {
  verificationCheck.value.employment_step_completed = true
  currentStep.value = 4
  await saveProgress()
}

const completeStep4 = async () => {
  verificationCheck.value.tenancy_step_completed = true
  currentStep.value = 5
  await saveProgress()
}

const completeStep5 = async () => {
  verificationCheck.value.address_history_step_completed = true
  currentStep.value = 6
  await saveProgress()
}

const completeVerification = async (passed: boolean) => {
  try {
    completing.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/verification/${referenceId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        passed,
        finalDecision: passed ? 'Reference verification passed' : 'Reference verification failed',
        finalNotes: finalNotes.value
      })
    })

    if (!response.ok) throw new Error('Failed to complete verification')

    toast.success(passed ? 'Reference verified and completed!' : 'Reference failed verification')
    router.push('/staff/dashboard')
  } catch (error: any) {
    toast.error(error.message || 'Failed to complete verification')
  } finally {
    completing.value = false
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}

const formatDate = (value?: string | null, fallback = 'Not provided') =>
  formatUkDate(
    value,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

onMounted(async () => {
  await fetchReference()
  await fetchVerificationCheck()
  await fetchCreditsafeVerification()
  await fetchSanctionsScreening()
})
</script>
