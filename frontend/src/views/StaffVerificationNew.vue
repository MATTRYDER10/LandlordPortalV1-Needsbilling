<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div class="flex items-center">
            <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="w-10 h-10 mr-3" />
            <h1 class="text-3xl font-bold">
              <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
              <span class="ml-3 text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Staff Portal</span>
            </h1>
          </div>
          <div class="flex items-center gap-4">
            <router-link
              to="/staff/work-queue"
              class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Back to Work Queue
            </router-link>
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
    </div>

    <!-- Progress Bar -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xl font-bold text-gray-900">4-Step Verification</h2>
          <span class="text-sm text-gray-500">Step {{ currentStep }} of 4 • {{ Math.round((currentStep / 4) * 100) }}% Complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-primary h-2 rounded-full transition-all duration-300"
            :style="{ width: `${(currentStep / 4) * 100}%` }"
          ></div>
        </div>
        <div class="grid grid-cols-4 gap-4 mt-3">
          <div
            v-for="(step, index) in stepLabels"
            :key="index"
            :class="[
              'text-center py-2 px-3 rounded-md text-sm font-medium transition-all',
              currentStep > index + 1 ? 'bg-green-100 text-green-800' :
              currentStep === index + 1 ? 'bg-primary/10 text-primary' :
              'bg-gray-100 text-gray-400'
            ]"
          >
            <div class="flex items-center justify-center gap-2">
              <svg v-if="currentStep > index + 1" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span>{{ step }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading verification data...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800">{{ error }}</p>
        <button @click="loadData" class="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">
          Retry
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Tenant Info Card -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Reference Information</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-sm text-gray-500">Tenant Name</p>
            <p class="font-medium">{{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Email</p>
            <p class="font-medium">{{ reference?.tenant_email }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Property</p>
            <p class="font-medium">{{ reference?.property_address }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p class="font-medium">{{ reference?.status }}</p>
          </div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="bg-white rounded-lg shadow p-6">

        <!-- Step 1: ID & Selfie -->
        <div v-if="currentStep === 1">
          <h3 class="text-xl font-bold text-gray-900 mb-4">Step 1: ID & Selfie Verification</h3>
          <p class="text-gray-600 mb-6">Verify the ID document and selfie match the provided information.</p>

          <div class="space-y-6">
            <!-- ID Document vs Info -->
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
                      <p class="text-sm text-gray-900">{{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        @click="idChecks.nameMatch = true"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.nameMatch === true
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                        ]"
                      >
                        Match
                      </button>
                      <button
                        @click="idChecks.nameMatch = false"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.nameMatch === false
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
                      <p class="text-sm text-gray-900">{{ reference?.date_of_birth ? new Date(reference.date_of_birth).toLocaleDateString('en-GB') : 'Not provided' }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        @click="idChecks.dobMatch = true"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.dobMatch === true
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                        ]"
                      >
                        Match
                      </button>
                      <button
                        @click="idChecks.dobMatch = false"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.dobMatch === false
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

            <!-- Selfie vs ID Photo -->
            <SideBySideViewer
              :left-image-url="idDocumentBlobUrl"
              :right-image-url="selfieBlobUrl"
              left-title="ID Document Photo"
              right-title="Selfie"
            >
              <template #right-content>
                <div class="mt-4">
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <p class="text-sm font-medium text-gray-700">Person in selfie matches ID photo</p>
                    <div class="flex gap-2">
                      <button
                        @click="idChecks.selfieMatch = true"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.selfieMatch === true
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                        ]"
                      >
                        Match
                      </button>
                      <button
                        @click="idChecks.selfieMatch = false"
                        :class="[
                          'px-4 py-2 text-sm font-medium rounded-md transition-all',
                          idChecks.selfieMatch === false
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

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                v-model="steps[0]!.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add any notes about this verification step..."
              ></textarea>
            </div>

            <!-- Pass/Fail -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Result</label>
              <div class="flex gap-4">
                <button
                  @click="steps[0]!.overall_pass = true"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[0]!.overall_pass === true
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                  ]"
                >
                  Pass
                </button>
                <button
                  @click="steps[0]!.overall_pass = false"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[0]!.overall_pass === false
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                  ]"
                >
                  Fail
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Income & Affordability -->
        <div v-if="currentStep === 2">
          <h3 class="text-xl font-bold text-gray-900 mb-4">Step 2: Income & Affordability</h3>
          <p class="text-gray-600 mb-6">Verify income and affordability documentation.</p>

          <div class="space-y-6">
            <!-- Income Data Display -->
            <div class="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 class="font-semibold text-gray-900">Declared Income Sources</h4>

              <!-- Employment Income -->
              <div v-if="reference?.income_employment || reference?.income_regular_employment" class="border-l-4 border-blue-500 pl-4">
                <p class="font-medium text-gray-900">Employment Income</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p v-if="reference?.employment_company_name"><strong>Company:</strong> {{ reference.employment_company_name }}</p>
                  <p v-if="reference?.employment_job_title"><strong>Position:</strong> {{ reference.employment_job_title }}</p>
                  <p v-if="reference?.employment_salary_amount"><strong>Salary:</strong> £{{ reference.employment_salary_amount }} {{ reference.employment_salary_frequency || 'per year' }}</p>
                  <p v-if="reference?.employer_ref_name"><strong>Reference Contact:</strong> {{ reference.employer_ref_name }}</p>
                  <p v-if="reference?.employer_ref_email"><strong>Email:</strong> {{ reference.employer_ref_email }}</p>
                </div>
              </div>

              <!-- Self-Employed Income -->
              <div v-if="reference?.income_self_employed" class="border-l-4 border-purple-500 pl-4">
                <p class="font-medium text-gray-900">Self-Employed Income</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p v-if="reference?.self_employed_business_name"><strong>Business:</strong> {{ reference.self_employed_business_name }}</p>
                  <p v-if="reference?.self_employed_nature_of_business"><strong>Nature:</strong> {{ reference.self_employed_nature_of_business }}</p>
                  <p v-if="reference?.self_employed_annual_income"><strong>Annual Income:</strong> £{{ reference.self_employed_annual_income }}</p>
                  <p v-if="reference?.accountant_name"><strong>Accountant:</strong> {{ reference.accountant_contact_name }} ({{ reference.accountant_name }})</p>
                  <p v-if="reference?.accountant_email"><strong>Email:</strong> {{ reference.accountant_email }}</p>
                </div>
              </div>

              <!-- Benefits -->
              <div v-if="reference?.income_benefits" class="border-l-4 border-green-500 pl-4">
                <p class="font-medium text-gray-900">Benefits Income</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p v-if="reference?.benefits_monthly_amount"><strong>Monthly Amount:</strong> £{{ reference.benefits_monthly_amount }}</p>
                  <p v-if="reference?.benefits_annual_amount"><strong>Annual Amount:</strong> £{{ reference.benefits_annual_amount }}</p>
                </div>
              </div>

              <!-- Savings/Investments -->
              <div v-if="reference?.income_savings_pension_investments" class="border-l-4 border-yellow-500 pl-4">
                <p class="font-medium text-gray-900">Savings/Pension/Investments</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p v-if="reference?.savings_amount"><strong>Amount:</strong> £{{ reference.savings_amount }}</p>
                </div>
              </div>

              <!-- Additional Income -->
              <div v-if="reference?.additional_income_source" class="border-l-4 border-orange-500 pl-4">
                <p class="font-medium text-gray-900">Additional Income</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p v-if="reference?.additional_income_source"><strong>Source:</strong> {{ reference.additional_income_source }}</p>
                  <p v-if="reference?.additional_income_amount"><strong>Amount:</strong> £{{ reference.additional_income_amount }}</p>
                </div>
              </div>

              <!-- Monthly Rent -->
              <div v-if="reference?.monthly_rent" class="border-l-4 border-red-500 pl-4">
                <p class="font-medium text-gray-900">Property Details</p>
                <div class="mt-2 space-y-1 text-sm">
                  <p><strong>Monthly Rent:</strong> £{{ reference.monthly_rent }}</p>
                  <p v-if="reference?.property_address"><strong>Property:</strong> {{ reference.property_address }}, {{ reference.property_city }} {{ reference.property_postcode }}</p>
                </div>
              </div>

              <!-- No income declared -->
              <div v-if="!reference?.income_employment && !reference?.income_regular_employment && !reference?.income_self_employed && !reference?.income_benefits && !reference?.income_savings_pension_investments" class="text-gray-500 italic">
                No income sources declared
              </div>
            </div>

            <!-- Verification Checks -->
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Verification Checks</h4>
              <div class="space-y-3">
                <div v-if="reference?.income_employment || reference?.income_regular_employment" class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Is the employer email genuine? (Business domain check)</p>
                    <p v-if="reference?.employer_ref_email" class="text-xs text-gray-500 mt-1">{{ reference.employer_ref_email }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleCheck('employerEmailGenuine', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('employerEmailGenuine') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleCheck('employerEmailGenuine', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('employerEmailGenuine') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="reference?.income_employment || reference?.income_regular_employment" class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Is the business actively trading?</p>
                    <p v-if="reference?.employment_company_name" class="text-xs text-gray-500 mt-1">{{ reference.employment_company_name }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleCheck('businessTrading', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('businessTrading') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleCheck('businessTrading', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('businessTrading') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>

                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Income sufficient for rent affordability?</p>
                    <p v-if="reference?.monthly_rent" class="text-xs text-gray-500 mt-1">Monthly rent: £{{ reference.monthly_rent }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleCheck('affordability', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('affordability') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleCheck('affordability', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getCheckValue('affordability') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evidence Source Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Evidence Sources Used</label>
              <div class="grid grid-cols-2 gap-3">
                <label
                  v-for="source in evidenceSourceOptions.INCOME_AFFORDABILITY"
                  :key="source.evidence_type"
                  class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  :class="steps[1]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="source.evidence_type"
                    v-model="steps[1]!.evidence_sources"
                    class="mr-3 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span class="text-sm">{{ source.display_label }}</span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                v-model="steps[1]!.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add notes about income verification, affordability calculations, etc."
              ></textarea>
            </div>

            <!-- Pass/Fail -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Result</label>
              <div class="flex gap-4">
                <button
                  @click="steps[1]!.overall_pass = true"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[1]!.overall_pass === true
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                  ]"
                >
                  Pass
                </button>
                <button
                  @click="steps[1]!.overall_pass = false"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[1]!.overall_pass === false
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                  ]"
                >
                  Fail
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Residential -->
        <div v-if="currentStep === 3">
          <h3 class="text-xl font-bold text-gray-900 mb-4">Step 3: Residential Verification</h3>
          <p class="text-gray-600 mb-6">Verify residential history and landlord references.</p>

          <div class="space-y-6">
            <!-- Current Address Display -->
            <div class="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 class="font-semibold text-gray-900">Current Address</h4>
              <div class="border-l-4 border-blue-500 pl-4">
                <div class="space-y-1 text-sm">
                  <p v-if="reference?.current_address_line1"><strong>Address:</strong> {{ reference.current_address_line1 }}</p>
                  <p v-if="reference?.current_address_line2" class="ml-16">{{ reference.current_address_line2 }}</p>
                  <p v-if="reference?.current_city || reference?.current_postcode">
                    <span class="ml-16">{{ reference.current_city }}{{ reference.current_city && reference.current_postcode ? ', ' : '' }}{{ reference.current_postcode }}</span>
                  </p>
                  <p v-if="reference?.current_country"><span class="ml-16">{{ reference.current_country }}</span></p>
                  <p v-if="reference?.time_at_address_years || reference?.time_at_address_months">
                    <strong>Time at address:</strong>
                    {{ reference.time_at_address_years || 0 }} year(s), {{ reference.time_at_address_months || 0 }} month(s)
                  </p>
                </div>
              </div>
            </div>

            <!-- Previous Rental History -->
            <div v-if="reference?.previous_landlord_name || reference?.previous_rental_address_line1" class="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 class="font-semibold text-gray-900">Previous Rental History</h4>
              <div class="border-l-4 border-purple-500 pl-4">
                <div class="space-y-1 text-sm">
                  <p v-if="reference?.previous_landlord_name"><strong>Landlord/Agent:</strong> {{ reference.previous_landlord_name }}</p>
                  <p v-if="reference?.previous_landlord_email"><strong>Email:</strong> {{ reference.previous_landlord_email }}</p>
                  <p v-if="reference?.previous_landlord_phone"><strong>Phone:</strong> {{ reference.previous_landlord_phone }}</p>
                  <p v-if="reference?.previous_rental_address_line1" class="mt-2"><strong>Previous Address:</strong> {{ reference.previous_rental_address_line1 }}</p>
                  <p v-if="reference?.previous_rental_address_line2" class="ml-20">{{ reference.previous_rental_address_line2 }}</p>
                  <p v-if="reference?.previous_rental_city || reference?.previous_rental_postcode">
                    <span class="ml-20">{{ reference.previous_rental_city }}{{ reference.previous_rental_city && reference.previous_rental_postcode ? ', ' : '' }}{{ reference.previous_rental_postcode }}</span>
                  </p>
                  <p v-if="reference?.previous_monthly_rent"><strong>Previous Rent:</strong> £{{ reference.previous_monthly_rent }}/month</p>
                  <p v-if="reference?.previous_tenancy_start_date || reference?.previous_tenancy_end_date">
                    <strong>Tenancy Period:</strong>
                    {{ reference.previous_tenancy_start_date ? new Date(reference.previous_tenancy_start_date).toLocaleDateString('en-GB') : 'N/A' }}
                    {{ ' to ' }}
                    {{ reference.previous_tenancy_still_in_progress ? 'Present' : (reference.previous_tenancy_end_date ? new Date(reference.previous_tenancy_end_date).toLocaleDateString('en-GB') : 'N/A') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Landlord/Agent Reference Response -->
            <div v-if="landlordReference || agentReference" class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">{{ landlordReference ? 'Landlord' : 'Agent' }} Reference Response</h4>
              <div class="space-y-2 text-sm">
                <div v-if="landlordReference">
                  <p><strong>Landlord:</strong> {{ landlordReference.landlord_name }}</p>
                  <p><strong>Email:</strong> {{ landlordReference.landlord_email }}</p>
                  <p v-if="landlordReference.submitted_at" class="text-green-600"><strong>Submitted:</strong> {{ new Date(landlordReference.submitted_at).toLocaleDateString('en-GB') }}</p>
                  <p v-else class="text-orange-600"><strong>Status:</strong> Awaiting response</p>
                </div>
                <div v-if="agentReference">
                  <p><strong>Agent:</strong> {{ agentReference.agent_name }}</p>
                  <p><strong>Agency:</strong> {{ agentReference.agency_name }}</p>
                  <p><strong>Email:</strong> {{ agentReference.agent_email }}</p>
                  <p v-if="agentReference.submitted_at" class="text-green-600"><strong>Submitted:</strong> {{ new Date(agentReference.submitted_at).toLocaleDateString('en-GB') }}</p>
                  <p v-else class="text-orange-600"><strong>Status:</strong> Awaiting response</p>
                </div>
              </div>
            </div>

            <!-- Verification Checks -->
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Verification Checks</h4>
              <div class="space-y-3">
                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Do tenancy dates match application?</p>
                    <p class="text-xs text-gray-500 mt-1">Check previous tenancy dates align with declared residential history</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleResidentialCheck('tenancyDatesMatch', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('tenancyDatesMatch') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleResidentialCheck('tenancyDatesMatch', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('tenancyDatesMatch') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="reference?.previous_landlord_email || (landlordReference || agentReference)" class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Are contact details verifiable?</p>
                    <p class="text-xs text-gray-500 mt-1">
                      {{ reference?.previous_landlord_email || landlordReference?.landlord_email || agentReference?.agent_email }}
                    </p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleResidentialCheck('contactDetailsVerifiable', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('contactDetailsVerifiable') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleResidentialCheck('contactDetailsVerifiable', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('contactDetailsVerifiable') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>

                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Any conflicts vs. application?</p>
                    <p class="text-xs text-gray-500 mt-1">Check for discrepancies between reference and application data</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleResidentialCheck('noConflicts', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('noConflicts') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleResidentialCheck('noConflicts', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('noConflicts') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="landlordReference?.submitted_at || agentReference?.submitted_at" class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Reference response received and satisfactory?</p>
                    <p class="text-xs text-gray-500 mt-1">Review the full reference response for any red flags</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button
                      @click="toggleResidentialCheck('referenceResponseSatisfactory', true)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('referenceResponseSatisfactory') === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      ]"
                    >
                      Pass
                    </button>
                    <button
                      @click="toggleResidentialCheck('referenceResponseSatisfactory', false)"
                      :class="[
                        'px-3 py-1 text-xs font-medium rounded transition-all',
                        getResidentialCheckValue('referenceResponseSatisfactory') === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      ]"
                    >
                      Fail
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evidence Source Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Evidence Sources Used</label>
              <div class="grid grid-cols-2 gap-3">
                <label
                  v-for="source in evidenceSourceOptions.RESIDENTIAL"
                  :key="source.evidence_type"
                  class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  :class="steps[2]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="source.evidence_type"
                    v-model="steps[2]!.evidence_sources"
                    class="mr-3 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span class="text-sm">{{ source.display_label }}</span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                v-model="steps[2]!.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add notes about landlord references, address history, etc."
              ></textarea>
            </div>

            <!-- Pass/Fail -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Result</label>
              <div class="flex gap-4">
                <button
                  @click="steps[2]!.overall_pass = true"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[2]!.overall_pass === true
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                  ]"
                >
                  Pass
                </button>
                <button
                  @click="steps[2]!.overall_pass = false"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[2]!.overall_pass === false
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                  ]"
                >
                  Fail
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Credit & TAS -->
        <div v-if="currentStep === 4">
          <h3 class="text-xl font-bold text-gray-900 mb-4">Step 4: Credit & TAS Decision</h3>
          <p class="text-gray-600 mb-6">Review credit reports and make final TAS decision.</p>

          <div class="space-y-6">
            <!-- Credit Check Summary -->
            <div v-if="creditCheckData" class="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 class="font-semibold text-gray-900">Credit Check Summary</h4>
              <div class="border-l-4 border-blue-500 pl-4">
                <div class="space-y-2 text-sm">
                  <p v-if="creditCheckData.credit_rating"><strong>Credit Rating:</strong> {{ creditCheckData.credit_rating }}</p>
                  <p v-if="creditCheckData.credit_score"><strong>Credit Score:</strong> {{ creditCheckData.credit_score }}</p>
                  <p v-if="creditCheckData.band_text"><strong>Band:</strong> {{ creditCheckData.band_text }}</p>
                  <p v-if="creditCheckData.adverse_credit !== undefined">
                    <strong>Adverse Credit:</strong>
                    <span :class="creditCheckData.adverse_credit ? 'text-red-600 font-semibold' : 'text-green-600'">
                      {{ creditCheckData.adverse_credit ? 'Yes' : 'No' }}
                    </span>
                  </p>
                  <p v-if="creditCheckData.adverse_credit_details" class="text-red-600">
                    <strong>Details:</strong> {{ creditCheckData.adverse_credit_details }}
                  </p>
                  <p v-if="creditCheckData.checked_at" class="text-gray-500">
                    <strong>Checked:</strong> {{ new Date(creditCheckData.checked_at).toLocaleDateString('en-GB') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Sanctions Screening -->
            <div v-if="sanctionsData" class="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 class="font-semibold text-gray-900">Sanctions Screening</h4>
              <div
                class="border-l-4 pl-4"
                :class="{
                  'border-green-500': sanctionsData.risk_level === 'clear',
                  'border-blue-500': sanctionsData.risk_level === 'low',
                  'border-yellow-500': sanctionsData.risk_level === 'medium',
                  'border-red-500': sanctionsData.risk_level === 'high'
                }"
              >
                <div class="space-y-2 text-sm">
                  <p>
                    <strong>Risk Level:</strong>
                    <span
                      :class="{
                        'text-green-600 font-semibold': sanctionsData.risk_level === 'clear',
                        'text-blue-600 font-semibold': sanctionsData.risk_level === 'low',
                        'text-yellow-600 font-semibold': sanctionsData.risk_level === 'medium',
                        'text-red-600 font-semibold': sanctionsData.risk_level === 'high'
                      }"
                    >
                      {{ sanctionsData.risk_level?.toUpperCase() }}
                    </span>
                  </p>
                  <p v-if="sanctionsData.summary_message"><strong>Summary:</strong> {{ sanctionsData.summary_message }}</p>
                  <p v-if="sanctionsData.matches_found > 0" class="text-orange-600">
                    <strong>Matches Found:</strong> {{ sanctionsData.matches_found }}
                  </p>
                  <p v-if="sanctionsData.screened_at" class="text-gray-500">
                    <strong>Screened:</strong> {{ new Date(sanctionsData.screened_at).toLocaleDateString('en-GB') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Creditsafe Identity Check -->
            <div class="bg-gray-50 rounded-lg p-4 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="font-semibold text-gray-900">Creditsafe Identity Verification</h4>
                <span v-if="creditsafeLoading" class="text-sm text-gray-500">
                  <svg class="inline-block animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running identity check...
                </span>
              </div>

              <div v-if="creditsafeData" class="border-l-4 border-purple-500 pl-4">
                <div class="space-y-2 text-sm">
                  <p v-if="creditsafeData.verifyMatch !== undefined">
                    <strong>Identity Match:</strong>
                    <span :class="creditsafeData.verifyMatch ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'">
                      {{ creditsafeData.verifyMatch ? 'VERIFIED' : 'NOT VERIFIED' }}
                    </span>
                  </p>
                  <p v-if="creditsafeData.electoralRegisterMatch !== undefined">
                    <strong>Electoral Register:</strong>
                    <span :class="creditsafeData.electoralRegisterMatch ? 'text-green-600' : 'text-red-600'">
                      {{ creditsafeData.electoralRegisterMatch ? 'Found' : 'Not Found' }}
                    </span>
                  </p>
                  <p v-if="creditsafeData.ccjMatch !== undefined">
                    <strong>CCJs:</strong>
                    <span :class="!creditsafeData.ccjMatch ? 'text-green-600' : 'text-red-600 font-semibold'">
                      {{ creditsafeData.ccjMatch ? 'FOUND' : 'None Found' }}
                    </span>
                  </p>
                  <p v-if="creditsafeData.insolvencyMatch !== undefined">
                    <strong>Insolvencies:</strong>
                    <span :class="!creditsafeData.insolvencyMatch ? 'text-green-600' : 'text-red-600 font-semibold'">
                      {{ creditsafeData.insolvencyMatch ? 'FOUND' : 'None Found' }}
                    </span>
                  </p>
                  <p v-if="creditsafeData.riskLevel">
                    <strong>Risk Level:</strong>
                    <span :class="{
                      'text-green-600': creditsafeData.riskLevel === 'low',
                      'text-yellow-600': creditsafeData.riskLevel === 'medium',
                      'text-orange-600': creditsafeData.riskLevel === 'high',
                      'text-red-600': creditsafeData.riskLevel === 'very_high'
                    }">
                      {{ creditsafeData.riskLevel.toUpperCase().replace('_', ' ') }}
                    </span>
                  </p>
                  <p v-if="creditsafeData.riskScore !== undefined">
                    <strong>Risk Score:</strong> {{ creditsafeData.riskScore }}
                  </p>
                  <p v-if="creditsafeData.verified_at" class="text-gray-500">
                    <strong>Checked:</strong> {{ new Date(creditsafeData.verified_at).toLocaleDateString('en-GB') }}
                  </p>
                </div>
              </div>
              <div v-else-if="!creditsafeLoading" class="text-gray-500 italic text-sm">
                No Creditsafe data available yet.
              </div>
            </div>

            <!-- Overall Assessment Summary -->
            <div class="bg-white border-2 border-primary rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Overall Assessment Summary</h4>
              <div class="grid grid-cols-4 gap-4 text-center">
                <div class="p-3 bg-gray-50 rounded">
                  <p class="text-xs text-gray-500 mb-1">Step 1: ID & Selfie</p>
                  <p :class="{
                    'text-green-600 font-semibold': steps[0]!.overall_pass === true,
                    'text-red-600 font-semibold': steps[0]!.overall_pass === false,
                    'text-gray-400': steps[0]!.overall_pass === null
                  }">
                    {{ steps[0]!.overall_pass === null ? 'Pending' : (steps[0]!.overall_pass ? 'PASS' : 'FAIL') }}
                  </p>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <p class="text-xs text-gray-500 mb-1">Step 2: Income</p>
                  <p :class="{
                    'text-green-600 font-semibold': steps[1]!.overall_pass === true,
                    'text-red-600 font-semibold': steps[1]!.overall_pass === false,
                    'text-gray-400': steps[1]!.overall_pass === null
                  }">
                    {{ steps[1]!.overall_pass === null ? 'Pending' : (steps[1]!.overall_pass ? 'PASS' : 'FAIL') }}
                  </p>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <p class="text-xs text-gray-500 mb-1">Step 3: Residential</p>
                  <p :class="{
                    'text-green-600 font-semibold': steps[2]!.overall_pass === true,
                    'text-red-600 font-semibold': steps[2]!.overall_pass === false,
                    'text-gray-400': steps[2]!.overall_pass === null
                  }">
                    {{ steps[2]!.overall_pass === null ? 'Pending' : (steps[2]!.overall_pass ? 'PASS' : 'FAIL') }}
                  </p>
                </div>
                <div class="p-3 bg-gray-50 rounded">
                  <p class="text-xs text-gray-500 mb-1">Credit Checks</p>
                  <p :class="{
                    'text-green-600 font-semibold': !creditCheckData?.adverse_credit && sanctionsData?.risk_level === 'clear',
                    'text-yellow-600 font-semibold': sanctionsData?.risk_level === 'low' || sanctionsData?.risk_level === 'medium',
                    'text-red-600 font-semibold': creditCheckData?.adverse_credit || sanctionsData?.risk_level === 'high',
                    'text-gray-400': !creditCheckData && !sanctionsData
                  }">
                    {{ !creditCheckData && !sanctionsData ? 'N/A' :
                       (creditCheckData?.adverse_credit || sanctionsData?.risk_level === 'high' ? 'FAIL' :
                       (sanctionsData?.risk_level === 'low' || sanctionsData?.risk_level === 'medium' ? 'REFER' : 'PASS')) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- TAS Decision Section -->
            <div class="bg-white border-2 border-gray-300 rounded-lg p-6">
              <h4 class="font-semibold text-gray-900 mb-4">Tenancy Assessment Score (TAS) Decision</h4>
              <p class="text-sm text-gray-600 mb-4">
                Make your final decision based on all verification steps and credit checks above.
              </p>

              <!-- Evidence Source Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Evidence Sources Used</label>
              <div class="grid grid-cols-2 gap-3">
                <label
                  v-for="source in evidenceSourceOptions.CREDIT_TAS"
                  :key="source.evidence_type"
                  class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  :class="steps[3]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="source.evidence_type"
                    v-model="steps[3]!.evidence_sources"
                    class="mr-3 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span class="text-sm">{{ source.display_label }}</span>
                </label>
              </div>
            </div>

            <!-- TAS Decision Categories -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Select TAS Category</label>
              <div class="grid grid-cols-2 gap-4">
                <button
                  @click="tasDecision = 'PASS_PLUS'"
                  :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'PASS_PLUS'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-300 bg-white hover:border-green-300'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2',
                      tasDecision === 'PASS_PLUS' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                    ]">
                      <svg v-if="tasDecision === 'PASS_PLUS'" class="w-full h-full text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    </div>
                    <span class="font-semibold text-green-700">Pass+ (Top 5%)</span>
                  </div>
                  <p class="text-xs text-gray-600 ml-6">Exceptional applicant, no concerns</p>
                </button>

                <button
                  @click="tasDecision = 'PASS'"
                  :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'PASS'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-blue-300'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2',
                      tasDecision === 'PASS' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    ]">
                      <svg v-if="tasDecision === 'PASS'" class="w-full h-full text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    </div>
                    <span class="font-semibold text-blue-700">Pass (Accept)</span>
                  </div>
                  <p class="text-xs text-gray-600 ml-6">Satisfactory applicant, recommend acceptance</p>
                </button>

                <button
                  @click="tasDecision = 'REFER'"
                  :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'REFER'
                      ? 'border-yellow-600 bg-yellow-50'
                      : 'border-gray-300 bg-white hover:border-yellow-300'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2',
                      tasDecision === 'REFER' ? 'border-yellow-600 bg-yellow-600' : 'border-gray-300'
                    ]">
                      <svg v-if="tasDecision === 'REFER'" class="w-full h-full text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    </div>
                    <span class="font-semibold text-yellow-700">Refer (Review Required)</span>
                  </div>
                  <p class="text-xs text-gray-600 ml-6">Requires landlord/agent review - must provide reason</p>
                </button>

                <button
                  @click="tasDecision = 'FAIL'"
                  :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'FAIL'
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-red-300'
                  ]"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2',
                      tasDecision === 'FAIL' ? 'border-red-600 bg-red-600' : 'border-gray-300'
                    ]">
                      <svg v-if="tasDecision === 'FAIL'" class="w-full h-full text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    </div>
                    <span class="font-semibold text-red-700">Fail (Reject)</span>
                  </div>
                  <p class="text-xs text-gray-600 ml-6">Not suitable - must provide reason</p>
                </button>
              </div>
            </div>

            <!-- TAS Reason (required for REFER and FAIL) -->
            <div v-if="tasDecision === 'REFER' || tasDecision === 'FAIL'">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Reason for {{ tasDecision }} Decision *
              </label>
              <textarea
                v-model="tasReason"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Explain the reason for this decision..."
                required
              ></textarea>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <textarea
                v-model="steps[3]!.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add notes about credit checks, sanctions screening, etc."
              ></textarea>
            </div>

            <!-- Overall Pass/Fail -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Step Result</label>
              <div class="flex gap-4">
                <button
                  @click="steps[3]!.overall_pass = true"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[3]!.overall_pass === true
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                  ]"
                >
                  Pass
                </button>
                <button
                  @click="steps[3]!.overall_pass = false"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[3]!.overall_pass === false
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                  ]"
                >
                  Fail
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex justify-between mt-8 pt-6 border-t">
          <button
            v-if="currentStep > 1"
            @click="previousStep"
            class="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
          >
            Previous
          </button>
          <div v-else></div>

          <div class="flex gap-3">
            <button
              @click="saveProgress"
              :disabled="saving"
              class="px-6 py-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-md font-medium disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save Progress' }}
            </button>
            <button
              v-if="currentStep < 4"
              @click="nextStep"
              :disabled="!canProceed"
              class="px-6 py-2 text-white bg-primary hover:bg-primary-dark rounded-md font-medium disabled:opacity-50"
            >
              Next Step
            </button>
            <button
              v-else
              @click="finalizeVerification"
              :disabled="!canFinalize || saving"
              class="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md font-medium disabled:opacity-50"
            >
              {{ saving ? 'Finalizing...' : 'Finalize & Generate Report' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import SideBySideViewer from '../components/SideBySideViewer.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const currentStep = ref(1)
const reference = ref<any>(null)
const workItemId = ref<string | null>(null)
const idDocumentBlobUrl = ref('')
const selfieBlobUrl = ref('')
const landlordReference = ref<any>(null)
const agentReference = ref<any>(null)
const creditCheckData = ref<any>(null)
const sanctionsData = ref<any>(null)
const creditsafeData = ref<any>(null)
const creditsafeLoading = ref(false)

const stepLabels = ['ID & Selfie', 'Income & Affordability', 'Residential', 'Credit & TAS']

// Type definition for verification step
interface VerificationStep {
  step_number: number
  step_type: string
  overall_pass: boolean | null
  notes: string
  evidence_sources: any[]
  checks: any[]
}

// Step data
const steps = ref<VerificationStep[]>([
  { step_number: 1, step_type: 'ID_SELFIE', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 2, step_type: 'INCOME_AFFORDABILITY', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 3, step_type: 'RESIDENTIAL', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 4, step_type: 'CREDIT_TAS', overall_pass: null, notes: '', evidence_sources: [], checks: [] }
])

// Step 1 individual checks
const idChecks = ref({
  nameMatch: null as boolean | null,
  dobMatch: null as boolean | null,
  selfieMatch: null as boolean | null
})

// TAS decision
const tasDecision = ref<'PASS_PLUS' | 'PASS' | 'REFER' | 'FAIL' | null>(null)
const tasReason = ref('')

// Evidence source options
const evidenceSourceOptions = ref<any>({
  INCOME_AFFORDABILITY: [],
  RESIDENTIAL: [],
  CREDIT_TAS: []
})

// Computed
const canProceed = computed(() => {
  const step = steps.value[currentStep.value - 1]
  if (!step) return false

  // For Step 1, all ID checks must be complete before assigning overall pass/fail
  if (currentStep.value === 1) {
    const allChecksComplete = idChecks.value.nameMatch !== null &&
                              idChecks.value.dobMatch !== null &&
                              idChecks.value.selfieMatch !== null
    if (allChecksComplete && step.overall_pass === null) {
      // Auto-set overall pass based on individual checks
      const allPass = idChecks.value.nameMatch && idChecks.value.dobMatch && idChecks.value.selfieMatch
      step.overall_pass = allPass
    }
    return step.overall_pass !== null
  }

  return step.overall_pass !== null
})

const canFinalize = computed(() => {
  // All steps must have a decision
  const allStepsDecided = steps.value.every(step => step.overall_pass !== null)
  // TAS decision must be made
  const tasDecided = tasDecision.value !== null
  // If REFER or FAIL, reason is required
  const reasonProvided = (tasDecision.value === 'REFER' || tasDecision.value === 'FAIL')
    ? tasReason.value.trim().length > 0
    : true

  return allStepsDecided && tasDecided && reasonProvided
})

// Helper functions
const loadImageAsBlob = async (filePath: string): Promise<string> => {
  const token = authStore.session?.access_token
  if (!token || !filePath) {
    console.warn('Cannot load image: missing token or filePath', { hasToken: !!token, filePath })
    return ''
  }

  try {
    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    if (parts.length !== 3) {
      console.error('Invalid file path format. Expected: referenceId/folder/filename, got:', filePath)
      return ''
    }

    const [referenceId, folder, filename] = parts
    if (!referenceId || !folder || !filename) {
      console.error('Missing parts in file path')
      return ''
    }
    const downloadUrl = `${import.meta.env.VITE_API_URL}/api/staff/download/${referenceId}/${folder}/${encodeURIComponent(filename)}`

    console.log('Loading image from staff API:', downloadUrl)

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      console.error('Failed to load image:', response.status, response.statusText, downloadUrl)
      return ''
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    console.log('Successfully loaded image:', filePath, 'Blob URL:', blobUrl)
    return blobUrl
  } catch (error) {
    console.error('Error loading image:', error, filePath)
    return ''
  }
}

// Methods
const loadData = async () => {
  try {
    loading.value = true
    error.value = null

    const referenceId = route.params.id as string
    workItemId.value = route.query.workItemId as string || null

    // Load reference data
    const refResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/references/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!refResponse.ok) {
      throw new Error('Failed to load reference data')
    }

    const refData = await refResponse.json()
    reference.value = refData.reference

    console.log('Reference data loaded:', {
      id: reference.value.id,
      id_document_path: reference.value.id_document_path,
      selfie_path: reference.value.selfie_path
    })

    // Load ID document and selfie images
    if (reference.value.id_document_path) {
      console.log('Loading ID document from path:', reference.value.id_document_path)
      idDocumentBlobUrl.value = await loadImageAsBlob(reference.value.id_document_path)
    } else {
      console.warn('No ID document path found')
    }

    if (reference.value.selfie_path) {
      console.log('Loading selfie from path:', reference.value.selfie_path)
      selfieBlobUrl.value = await loadImageAsBlob(reference.value.selfie_path)
    } else {
      console.warn('No selfie path found')
    }

    // Load landlord/agent references and credit data
    try {
      const refDetailResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/references/${referenceId}`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (refDetailResponse.ok) {
        const refDetailData = await refDetailResponse.json()
        landlordReference.value = refDetailData.landlordReference || null
        agentReference.value = refDetailData.agentReference || null
        console.log('Landlord/Agent references loaded:', {
          hasLandlord: !!landlordReference.value,
          hasAgent: !!agentReference.value
        })
      }
    } catch (err) {
      console.error('Error loading landlord/agent references:', err)
    }

    // Load credit check data
    try {
      const creditResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/references/${referenceId}/creditsafe`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (creditResponse.ok) {
        const creditData = await creditResponse.json()
        creditsafeData.value = creditData.verification || null
        console.log('Creditsafe data loaded:', !!creditsafeData.value)

        // If no Creditsafe data exists and reference is submitted, trigger automatic check
        if (!creditsafeData.value && reference.value?.submitted_at) {
          console.log('No Creditsafe data found, triggering automatic check...')
          triggerCreditsafeCheck()
        }
      }
    } catch (err) {
      console.log('No Creditsafe data available, will trigger automatic check if on step 4')
      // If no Creditsafe data exists and reference is submitted, trigger automatic check
      if (reference.value?.submitted_at) {
        triggerCreditsafeCheck()
      }
    }

    // Load sanctions data
    try {
      const sanctionsResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/references/${referenceId}/sanctions`, {
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (sanctionsResponse.ok) {
        const sanctionsResponseData = await sanctionsResponse.json()
        sanctionsData.value = sanctionsResponseData.screening || null
        console.log('Sanctions data loaded:', !!sanctionsData.value)
      }
    } catch (err) {
      console.log('No sanctions data available')
    }

    // Set credit check data from reference
    if (reference.value.adverse_credit !== undefined) {
      creditCheckData.value = {
        adverse_credit: reference.value.adverse_credit,
        adverse_credit_details: reference.value.adverse_credit_details,
        credit_rating: reference.value.credit_rating,
        credit_score: reference.value.credit_score,
        band_text: reference.value.band_text,
        checked_at: reference.value.created_at
      }
    }

    // Load evidence source options
    const evidenceResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/verification-steps/evidence-sources`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (evidenceResponse.ok) {
      const evidenceData = await evidenceResponse.json()
      console.log('Evidence sources loaded:', evidenceData)
      if (evidenceData.evidenceSources) {
        evidenceSourceOptions.value = evidenceData.evidenceSources
      }
    } else {
      console.error('Failed to load evidence sources:', evidenceResponse.status, evidenceResponse.statusText)
    }

    // Load existing progress if any
    const progressResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/verification-steps/reference/${referenceId}/progress`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (progressResponse.ok) {
      const progressData = await progressResponse.json()
      // Populate steps with existing data
      if (progressData.steps && progressData.steps.length > 0) {
        progressData.steps.forEach((savedStep: any) => {
          const stepIndex = savedStep.step_number - 1
          if (stepIndex >= 0 && stepIndex < 4) {
            steps.value[stepIndex] = {
              ...steps.value[stepIndex],
              ...savedStep,
              evidence_sources: savedStep.evidence_sources || []
            }
          }
        })
        // Set TAS decision if exists
        if (progressData.tas_category) {
          tasDecision.value = progressData.tas_category
          tasReason.value = progressData.tas_reason || ''
        }
        // Find first incomplete step
        const firstIncomplete = steps.value.findIndex(s => s.overall_pass === null)
        currentStep.value = firstIncomplete >= 0 ? firstIncomplete + 1 : 1
      }
    }

  } catch (err: any) {
    error.value = err.message
    console.error('Error loading verification data:', err)
  } finally {
    loading.value = false
  }
}

const saveProgress = async () => {
  try {
    saving.value = true
    const referenceId = route.params.id as string
    const stepData = steps.value[currentStep.value - 1]
    if (!stepData) {
      console.error('Step data not found')
      return
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/verification-steps/reference/${referenceId}/steps/${stepData.step_number}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          step_type: stepData.step_type,
          overall_pass: stepData.overall_pass,
          notes: stepData.notes,
          evidence_sources: stepData.evidence_sources,
          checks: stepData.checks
        })
      }
    )

    if (!response.ok) {
      throw new Error('Failed to save progress')
    }

    // Show success message (could add a toast notification here)
    console.log('Progress saved successfully')
  } catch (err: any) {
    alert(`Error saving progress: ${err.message}`)
    console.error('Error saving progress:', err)
  } finally {
    saving.value = false
  }
}

const nextStep = async () => {
  await saveProgress()
  if (currentStep.value < 4) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const finalizeVerification = async () => {
  try {
    saving.value = true
    const referenceId = route.params.id as string

    // Save final step first
    await saveProgress()

    // Finalize verification
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/verification-steps/reference/${referenceId}/finalize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tas_category: tasDecision.value,
          tas_reason: tasReason.value,
          work_item_id: workItemId.value
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to finalize verification')
    }

    await response.json() // Consume response

    // Show success and redirect
    alert('Verification completed and report generated successfully!')

    // If there's a work item, mark it complete and go back to work queue
    if (workItemId.value) {
      await fetch(`${import.meta.env.VITE_API_URL}/api/work-queue/${workItemId.value}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'COMPLETED' })
      })
      router.push('/staff/work-queue')
    } else {
      router.push('/staff/dashboard')
    }
  } catch (err: any) {
    alert(`Error finalizing verification: ${err.message}`)
    console.error('Error finalizing verification:', err)
  } finally {
    saving.value = false
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}

// Helper functions for verification checks
const toggleCheck = (checkName: string, pass: boolean) => {
  const currentChecks = steps.value[1]!.checks as any[]
  const existingCheckIndex = currentChecks.findIndex((c: any) => c.name === checkName)

  if (existingCheckIndex >= 0) {
    currentChecks[existingCheckIndex].pass = pass
  } else {
    currentChecks.push({
      name: checkName,
      pass,
      notes: '',
      evidence_source: ''
    })
  }
}

const getCheckValue = (checkName: string): boolean | null => {
  const currentChecks = steps.value[1]!.checks as any[]
  const check = currentChecks.find((c: any) => c.name === checkName)
  return check ? check.pass : null
}

// Helper functions for residential verification checks
const toggleResidentialCheck = (checkName: string, pass: boolean) => {
  const currentChecks = steps.value[2]!.checks as any[]
  const existingCheckIndex = currentChecks.findIndex((c: any) => c.name === checkName)

  if (existingCheckIndex >= 0) {
    currentChecks[existingCheckIndex].pass = pass
  } else {
    currentChecks.push({
      name: checkName,
      pass,
      notes: '',
      evidence_source: ''
    })
  }
}

const getResidentialCheckValue = (checkName: string): boolean | null => {
  const currentChecks = steps.value[2]!.checks as any[]
  const check = currentChecks.find((c: any) => c.name === checkName)
  return check ? check.pass : null
}

// Trigger Creditsafe check
const triggerCreditsafeCheck = async () => {
  try {
    creditsafeLoading.value = true
    const referenceId = route.params.id as string

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/staff/references/${referenceId}/creditsafe/retry`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to run Creditsafe check')
    }

    const result = await response.json()
    creditsafeData.value = result.verification
    console.log('Creditsafe check completed:', result.verification)

    alert('Creditsafe check completed successfully!')
  } catch (err: any) {
    alert(`Error running Creditsafe check: ${err.message}`)
    console.error('Error running Creditsafe check:', err)
  } finally {
    creditsafeLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
/* Add any custom styles here */
</style>
