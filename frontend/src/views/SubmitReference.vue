<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!initialLoading" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-20 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
            <span class="text-2xl font-bold">
              <span class="text-gray-900">Property</span><span :style="{ color: primaryColor }">Goose</span>
            </span>
          </template>
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Tenant Reference Form</h1>
        <p class="mt-2 text-gray-600">Please complete all sections to submit your reference</p>
      </div>

      <!-- Progress Bar -->
      <div v-if="!initialLoading && !tokenError && reference && !reference.submitted_at" class="mb-8">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700">Page {{ currentPage }} of 10</span>
          <span class="text-sm text-gray-500">{{ Math.round((currentPage / 10) * 100) }}% Complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="h-2 rounded-full transition-all duration-300" :style="{ width: (currentPage / 10 * 100) + '%', backgroundColor: primaryColor }"></div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="initialLoading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="text-gray-600">Loading reference details...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="tokenError" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
        {{ tokenError }}
      </div>

      <!-- Success/Already Submitted -->
      <div v-else-if="reference && reference.submitted_at" class="bg-white rounded-lg shadow p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-semibold text-gray-900">{{ justSubmitted ? 'Thank You!' : 'Reference Already Submitted' }}</h3>
        <p class="mt-2 text-gray-600">{{ justSubmitted ? 'Your reference has been submitted successfully. We appreciate you taking the time to complete this form.' : 'You have already submitted this reference. Thank you!' }}</p>
      </div>

      <!-- Form -->
      <form v-else-if="reference" @submit.prevent="handlePageSubmit" class="space-y-6">

        <!-- PAGE 1: ID Document Upload -->
        <div v-if="currentPage === 1" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Identification Document</h2>
          <p class="text-sm text-gray-600 mb-6">Please upload a clear photo of your Driving Licence or Passport</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
              <select
                v-model="formData.id_document_type"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="">Select document type</option>
                <option value="driving_licence">Driving Licence</option>
                <option value="passport">Passport</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Upload Document *</label>
              <input
                ref="idDocumentInput"
                type="file"
                @change="handleIdDocumentUpload"
                accept=".pdf,.jpg,.jpeg,.png"
                class="hidden"
              />
              <button
                type="button"
                @click="($refs.idDocumentInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                :style="{ color: buttonColor }"
              >
                {{ idDocument ? 'Change File' : 'Choose File' }}
              </button>
              <p class="mt-1 text-xs text-gray-500">Upload PDF or image (max 10MB)</p>
              <div v-if="idDocument" class="mt-2 p-3 bg-gray-50 rounded">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">{{ idDocument.name }} ({{ formatFileSize(idDocument.size) }})</span>
                  <button type="button" @click="removeIdDocument" class="text-red-600 hover:text-red-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div v-else-if="formData.id_document_path" class="mt-2 p-3 bg-green-50 rounded border border-green-200">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-green-700">Document uploaded successfully</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 2: Personal Details -->
        <div v-if="currentPage === 2" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Personal Details</h2>
          <p class="text-sm text-gray-600 mb-6">Please ensure these details match your ID document</p>

          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  v-model="formData.first_name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Middle Name</label>
                <input
                  v-model="formData.middle_name"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Last Name *</label>
              <input
                v-model="formData.last_name"
                type="text"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <select
                    v-model="dobDay"
                    required
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Day</option>
                    <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
                  </select>
                </div>
                <div>
                  <select
                    v-model="dobMonth"
                    required
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Month</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div>
                  <select
                    v-model="dobYear"
                    required
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Year</option>
                    <option v-for="year in yearRange" :key="year" :value="year">{{ year }}</option>
                  </select>
                </div>
              </div>
            </div>

            <PhoneInput
              v-model="formData.contact_number"
              label="Contact Number"
              id="contact-number"
              :required="true"
            />

            <div class="relative">
              <label class="block text-sm font-medium text-gray-700">Nationality *</label>
              <input
                v-model="nationalitySearch"
                @focus="showNationalityDropdown = true"
                @input="showNationalityDropdown = true"
                @blur="hideNationalityDropdown"
                type="text"
                required
                placeholder="Search and select nationality..."
                autocomplete="off"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
              <div
                v-if="showNationalityDropdown && filteredNationalities.length > 0"
                class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
              >
                <div
                  v-for="nationality in filteredNationalities"
                  :key="nationality"
                  @mousedown.prevent="selectNationality(nationality)"
                  class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                >
                  {{ nationality }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 3: Selfie -->
        <div v-if="currentPage === 3" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Selfie Verification</h2>
          <p class="text-sm text-gray-600 mb-6">Please upload a clear selfie for identity verification</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Upload Selfie *</label>
              <input
                ref="selfieInput"
                type="file"
                @change="handleSelfieUpload"
                accept=".jpg,.jpeg,.png"
                class="hidden"
              />
              <button
                type="button"
                @click="($refs.selfieInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                :style="{ color: buttonColor }"
              >
                {{ selfie ? 'Change Photo' : 'Take/Upload Photo' }}
              </button>
              <p class="mt-1 text-xs text-gray-500">Upload a clear photo of yourself (max 10MB)</p>
              <div v-if="selfie" class="mt-4">
                <img v-if="selfiePreview" :src="selfiePreview" alt="Selfie preview" class="w-48 h-48 object-cover rounded-lg border-2 border-gray-300" />
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-sm text-gray-700">{{ selfie.name }} ({{ formatFileSize(selfie.size) }})</span>
                  <button type="button" @click="removeSelfie" class="text-red-600 hover:text-red-800 text-sm">
                    Remove
                  </button>
                </div>
              </div>
              <div v-else-if="formData.selfie_path" class="mt-2 p-3 bg-green-50 rounded border border-green-200">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-green-700">Selfie uploaded successfully</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 4: Address Details -->
        <div v-if="currentPage === 4" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Current Address Details</h2>
          <p class="text-sm text-gray-600 mb-6">Please provide your current residential address</p>

          <div class="space-y-4">
            <div class="relative">
              <label class="block text-sm font-medium text-gray-700">Country *</label>
              <input
                v-model="countrySearch"
                @focus="showCountryDropdown = true"
                @input="showCountryDropdown = true"
                @blur="hideCountryDropdown"
                type="text"
                required
                placeholder="Search and select country..."
                autocomplete="off"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
              <div
                v-if="showCountryDropdown && filteredCountries.length > 0"
                class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
              >
                <div
                  v-for="country in filteredCountries"
                  :key="country"
                  @mousedown.prevent="selectCountry(country)"
                  class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                >
                  {{ country }}
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Address Line 1 *</label>
              <input
                v-model="formData.current_address_line1"
                type="text"
                required
                placeholder="Street address"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Address Line 2</label>
              <input
                v-model="formData.current_address_line2"
                type="text"
                placeholder="Apartment, suite, building, floor, etc."
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">City *</label>
                <input
                  v-model="formData.current_city"
                  type="text"
                  required
                  :placeholder="cityPlaceholder"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">{{ postcodeLabel }} *</label>
                <input
                  v-model="formData.current_postcode"
                  type="text"
                  required
                  :placeholder="postcodePlaceholder"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 5: Proof of Address -->
        <div v-if="currentPage === 5" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Proof of Address</h2>
          <p class="text-sm text-gray-600 mb-6">Upload a bank statement or utility bill from the last 3 months</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Upload Document *</label>
              <input
                ref="proofOfAddressInput"
                type="file"
                @change="handleProofOfAddressUpload"
                accept=".pdf,.jpg,.jpeg,.png"
                class="hidden"
              />
              <button
                type="button"
                @click="($refs.proofOfAddressInput as any).click()"
                class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                :style="{ color: buttonColor }"
              >
                {{ proofOfAddress ? 'Change File' : 'Choose File' }}
              </button>
              <p class="mt-1 text-xs text-gray-500">Upload PDF or image (max 10MB)</p>
              <div v-if="proofOfAddress" class="mt-2 p-3 bg-gray-50 rounded">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">{{ proofOfAddress.name }} ({{ formatFileSize(proofOfAddress.size) }})</span>
                  <button type="button" @click="removeProofOfAddress" class="text-red-600 hover:text-red-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div v-else-if="formData.proof_of_address_path" class="mt-2 p-3 bg-green-50 rounded border border-green-200">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-sm text-green-700">Proof of address uploaded successfully</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 6: Financial Information -->
        <div v-if="currentPage === 6" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Financial Information</h2>
          <p class="text-sm text-gray-600 mb-6">Please select all sources of income that apply to you</p>

          <div class="space-y-6">
            <!-- Income Sources -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Income Sources *</label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    v-model="formData.income_regular_employment"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Regular Income (Employment)</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.income_benefits"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Benefits</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.income_savings_pension_investments"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Savings, Pensions or Investments</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.income_student"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Student</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.income_unemployed"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Unemployed</span>
                </label>
              </div>
            </div>

            <!-- Employment Details (shown if Regular Employment is selected) -->
            <div v-if="formData.income_regular_employment" class="pt-6 border-t border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Employment Details</h3>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Contract Type *</label>
                  <select
                    v-model="formData.employment_contract_type"
                    :required="formData.income_regular_employment"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select contract type</option>
                    <option value="permanent">Permanent</option>
                    <option value="fixed_term">Fixed Term</option>
                    <option value="zero_hours">Zero Hours</option>
                    <option value="agency">Agency</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Employment Start Date *</label>
                  <div class="grid grid-cols-3 gap-3">
                    <div>
                      <select
                        v-model="employmentStartDay"
                        :required="formData.income_regular_employment"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      >
                        <option value="">Day</option>
                        <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
                      </select>
                    </div>
                    <div>
                      <select
                        v-model="employmentStartMonth"
                        :required="formData.income_regular_employment"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      >
                        <option value="">Month</option>
                        <option value="01">January</option>
                        <option value="02">February</option>
                        <option value="03">March</option>
                        <option value="04">April</option>
                        <option value="05">May</option>
                        <option value="06">June</option>
                        <option value="07">July</option>
                        <option value="08">August</option>
                        <option value="09">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                    </div>
                    <div>
                      <select
                        v-model="employmentStartYear"
                        :required="formData.income_regular_employment"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      >
                        <option value="">Year</option>
                        <option v-for="year in employmentYearRange" :key="year" :value="year">{{ year }}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Compensation Structure *</label>
                  <div class="space-y-2">
                    <label class="flex items-center">
                      <input
                        v-model="formData.employment_is_hourly"
                        type="radio"
                        :value="true"
                        :name="'compensation'"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                      />
                      <span class="ml-2 text-sm text-gray-700">Hourly</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="formData.employment_is_hourly"
                        type="radio"
                        :value="false"
                        :name="'compensation'"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                      />
                      <span class="ml-2 text-sm text-gray-700">Salary</span>
                    </label>
                  </div>
                </div>

                <div v-if="formData.employment_is_hourly" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Hourly Rate (£) *</label>
                    <input
                      v-model="formData.employment_salary_amount"
                      type="number"
                      step="0.01"
                      :required="formData.income_regular_employment && formData.employment_is_hourly"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Hours per Month *</label>
                    <input
                      v-model="formData.employment_hours_per_month"
                      type="number"
                      :required="formData.income_regular_employment && formData.employment_is_hourly"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div v-else>
                  <label class="block text-sm font-medium text-gray-700">Annual Salary (£) *</label>
                  <input
                    v-model="formData.employment_salary_amount"
                    type="number"
                    step="0.01"
                    :required="formData.income_regular_employment && !formData.employment_is_hourly"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Company Name *</label>
                  <input
                    v-model="formData.employment_company_name"
                    type="text"
                    :required="formData.income_regular_employment"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Job Title *</label>
                  <input
                    v-model="formData.employment_job_title"
                    type="text"
                    :required="formData.income_regular_employment"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Company Address Line 1 *</label>
                  <input
                    v-model="formData.employment_company_address_line1"
                    type="text"
                    :required="formData.income_regular_employment"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Company Address Line 2</label>
                  <input
                    v-model="formData.employment_company_address_line2"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Company City *</label>
                    <input
                      v-model="formData.employment_company_city"
                      type="text"
                      :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Company Postcode *</label>
                    <input
                      v-model="formData.employment_company_postcode"
                      type="text"
                      :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div class="relative">
                  <label class="block text-sm font-medium text-gray-700">Company Country *</label>
                  <input
                    v-model="companyCountrySearch"
                    @focus="showCompanyCountryDropdown = true"
                    @input="showCompanyCountryDropdown = true"
                    @blur="hideCompanyCountryDropdown"
                    type="text"
                    :required="formData.income_regular_employment"
                    placeholder="Search and select country..."
                    autocomplete="off"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                  <div
                    v-if="showCompanyCountryDropdown && filteredCompanyCountries.length > 0"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    <div
                      v-for="country in filteredCompanyCountries"
                      :key="country"
                      @mousedown.prevent="selectCompanyCountry(country)"
                      class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {{ country }}
                    </div>
                  </div>
                </div>

                <!-- Payslips Upload -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Payslips (Last 3 months) *</label>
                  <input
                    ref="payslipInput"
                    type="file"
                    @change="handlePayslipUpload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    class="hidden"
                  />
                  <button
                    type="button"
                    @click="($refs.payslipInput as any).click()"
                    class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                    :style="{ color: buttonColor }"
                  >
                    Choose Files
                  </button>
                  <p class="mt-1 text-xs text-gray-500">Upload PDF or images (max 10MB per file)</p>
                  <div v-if="payslips.length > 0" class="mt-2 space-y-1">
                    <div v-for="(file, index) in payslips" :key="index" class="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                      <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
                      <button type="button" @click="removePayslip(index)" class="text-red-600 hover:text-red-800">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div v-else-if="formData.payslip_paths.length > 0" class="mt-2 p-3 bg-green-50 rounded border border-green-200">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span class="text-sm text-green-700">{{ formData.payslip_paths.length }} payslip(s) uploaded successfully</span>
                    </div>
                  </div>
                </div>

                <!-- Employer Reference Contact -->
                <div class="pt-4 border-t border-gray-200">
                  <h4 class="text-md font-semibold text-gray-900 mb-3">Employer Reference Contact</h4>
                  <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700">Position *</label>
                        <input
                          v-model="formData.employer_ref_position"
                          type="text"
                          :required="formData.income_regular_employment"
                          placeholder="e.g. HR Manager"
                          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700">Name *</label>
                        <input
                          v-model="formData.employer_ref_name"
                          type="text"
                          :required="formData.income_regular_employment"
                          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700">Email *</label>
                        <input
                          v-model="formData.employer_ref_email"
                          type="email"
                          :required="formData.income_regular_employment"
                          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <PhoneInput
                        v-model="formData.employer_ref_phone"
                        label="Phone"
                        id="employer-ref-phone"
                        :required="formData.income_regular_employment"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 7: Additional Income -->
        <div v-if="currentPage === 7" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Additional Income</h2>
          <p class="text-sm text-gray-600 mb-6">Do you have any additional sources of income?</p>

          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="formData.has_additional_income"
                  type="checkbox"
                  class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">Yes, I have additional income</span>
              </label>
            </div>

            <div v-if="formData.has_additional_income" class="space-y-4 pt-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Source of Additional Income *</label>
                <input
                  v-model="formData.additional_income_source"
                  type="text"
                  :required="formData.has_additional_income"
                  placeholder="e.g. Freelance work, rental income, etc."
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Amount (£) *</label>
                  <input
                    v-model="formData.additional_income_amount"
                    type="number"
                    step="0.01"
                    :required="formData.has_additional_income"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Frequency *</label>
                  <select
                    v-model="formData.additional_income_frequency"
                    :required="formData.has_additional_income"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select frequency</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 8: Adverse Credit -->
        <div v-if="currentPage === 8" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Adverse Credit</h2>
          <p class="text-sm text-gray-600 mb-6">Do you have any personal adverse credit history?</p>

          <div class="space-y-4">
            <div>
              <label class="flex items-center">
                <input
                  v-model="formData.has_adverse_credit"
                  type="checkbox"
                  class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">Yes, I have adverse credit</span>
              </label>
            </div>

            <div v-if="formData.has_adverse_credit" class="pt-4">
              <label class="block text-sm font-medium text-gray-700">Please provide details *</label>
              <textarea
                v-model="formData.adverse_credit_details"
                :required="formData.has_adverse_credit"
                rows="4"
                placeholder="Please explain any CCJs, defaults, bankruptcies, or other adverse credit events..."
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- PAGE 9: Tenant Details -->
        <div v-if="currentPage === 9" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">About You</h2>
          <p class="text-sm text-gray-600 mb-6">Please provide some additional information about yourself</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Are you a smoker? *</label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    v-model="formData.is_smoker"
                    type="radio"
                    :value="true"
                    name="smoker"
                    required
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center">
                  <input
                    v-model="formData.is_smoker"
                    type="radio"
                    :value="false"
                    name="smoker"
                    required
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span class="ml-2 text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Do you have any pets? *</label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    v-model="formData.has_pets"
                    type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">Yes, I have pets</span>
                </label>
              </div>
              <div v-if="formData.has_pets" class="mt-3">
                <label class="block text-sm font-medium text-gray-700">Pet Details *</label>
                <textarea
                  v-model="formData.pet_details"
                  :required="formData.has_pets"
                  rows="3"
                  placeholder="Please describe your pets (type, breed, size, etc.)"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                ></textarea>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Marital Status *</label>
              <select
                v-model="formData.marital_status"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="">Select marital status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="civil_partnership">Civil Partnership</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Number of Dependants *</label>
              <input
                v-model="formData.number_of_dependants"
                type="number"
                min="0"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <div v-if="formData.number_of_dependants > 0">
              <label class="block text-sm font-medium text-gray-700">Dependants Details *</label>
              <textarea
                v-model="formData.dependants_details"
                :required="formData.number_of_dependants > 0"
                rows="3"
                placeholder="Please provide ages and relationship (e.g. 2 children aged 5 and 7)"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- PAGE 10: Review and Submit -->
        <div v-if="currentPage === 10" class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Review & Submit</h2>
          <p class="text-sm text-gray-600 mb-6">Please review your information before submitting</p>

          <div class="space-y-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-blue-800">Before you submit</h3>
                  <div class="mt-2 text-sm text-blue-700">
                    <ul class="list-disc list-inside space-y-1">
                      <li>Ensure all information is accurate and complete</li>
                      <li>All uploaded documents are clear and legible</li>
                      <li>You can use the "Back" button to review any section</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Summary Sections -->
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-sm font-medium text-gray-700">✓ Personal Details</span>
                <button type="button" @click="currentPage = 2" class="text-xs hover:opacity-80" :style="{ color: primaryColor }">Edit</button>
              </div>
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-sm font-medium text-gray-700">✓ Address Information</span>
                <button type="button" @click="currentPage = 4" class="text-xs hover:opacity-80" :style="{ color: primaryColor }">Edit</button>
              </div>
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-sm font-medium text-gray-700">✓ Financial Information</span>
                <button type="button" @click="currentPage = 6" class="text-xs hover:opacity-80" :style="{ color: primaryColor }">Edit</button>
              </div>
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-sm font-medium text-gray-700">✓ Personal Details</span>
                <button type="button" @click="currentPage = 9" class="text-xs hover:opacity-80" :style="{ color: primaryColor }">Edit</button>
              </div>
            </div>

            <div class="pt-4">
              <label class="flex items-start">
                <input
                  v-model="consentGiven"
                  type="checkbox"
                  required
                  class="h-4 w-4 mt-0.5 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">
                  I confirm that all information provided is accurate and complete. I consent to this information being used for reference purposes and understand that false information may result in my application being rejected. *
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- Error Messages -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
          {{ submitError }}
        </div>

        <!-- Progress Indicator for Uploads -->
        <div v-if="uploadProgress > 0 && uploadProgress < 100" class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-600">Uploading files...</span>
            <span class="text-sm text-gray-600">{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-300" :style="{ width: uploadProgress + '%', backgroundColor: primaryColor }"></div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between">
            <button
              v-if="currentPage > 1"
              type="button"
              @click="goToPreviousPage"
              class="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Back
            </button>
            <div v-else></div>

            <button
              v-if="currentPage < 10"
              type="submit"
              :disabled="submitting"
              class="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 hover:opacity-90"
              :style="{ backgroundColor: buttonColor }"
            >
              {{ submitting ? 'Uploading...' : 'Next' }}
            </button>
            <button
              v-else
              type="submit"
              :disabled="submitting || !consentGiven"
              class="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              :style="{ backgroundColor: buttonColor }"
            >
              {{ submitting ? 'Submitting...' : 'Submit Reference' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PhoneInput from '../components/PhoneInput.vue'

const route = useRoute()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// LocalStorage key for this reference
const getStorageKey = () => `tenant_reference_form_${route.params.token}`

const reference = ref<any>(null)
const initialLoading = ref(true)
const tokenError = ref('')
const submitting = ref(false)
const submitError = ref('')
const justSubmitted = ref(false)
const uploadProgress = ref(0)
const currentPage = ref(1)
const consentGiven = ref(false)

// Company branding
const companyLogo = ref('')
const primaryColor = ref('#FF8C41')
const buttonColor = ref('#FF8C41')

// Nationality search
const nationalitySearch = ref('')
const showNationalityDropdown = ref(false)

// Country search
const countrySearch = ref('')
const showCountryDropdown = ref(false)

// Company Country search
const companyCountrySearch = ref('')
const showCompanyCountryDropdown = ref(false)

// Date of Birth fields
const dobDay = ref('')
const dobMonth = ref('')
const dobYear = ref('')

// Employment Start Date fields
const employmentStartDay = ref('')
const employmentStartMonth = ref('')
const employmentStartYear = ref('')


// Generate year range (from current year - 18 to current year - 100)
const currentYear = new Date().getFullYear()
const yearRange = Array.from({ length: 83 }, (_, i) => currentYear - 18 - i)

// Generate employment year range (from current year to current year - 60)
const employmentYearRange = Array.from({ length: 61 }, (_, i) => currentYear - i)

// Nationalities list
const nationalities = [
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Andorran',
  'Angolan',
  'Argentine',
  'Armenian',
  'Australian',
  'Austrian',
  'Azerbaijani',
  'Bahamian',
  'Bahraini',
  'Bangladeshi',
  'Barbadian',
  'Belarusian',
  'Belgian',
  'Belizean',
  'Beninese',
  'Bhutanese',
  'Bolivian',
  'Bosnian',
  'Botswanan',
  'Brazilian',
  'British',
  'Bruneian',
  'Bulgarian',
  'Burkinabe',
  'Burmese',
  'Burundian',
  'Cambodian',
  'Cameroonian',
  'Canadian',
  'Cape Verdean',
  'Central African',
  'Chadian',
  'Chilean',
  'Chinese',
  'Colombian',
  'Comoran',
  'Congolese',
  'Costa Rican',
  'Croatian',
  'Cuban',
  'Cypriot',
  'Czech',
  'Danish',
  'Djiboutian',
  'Dominican',
  'Dutch',
  'East Timorese',
  'Ecuadorean',
  'Egyptian',
  'Emirati',
  'Equatorial Guinean',
  'Eritrean',
  'Estonian',
  'Ethiopian',
  'Fijian',
  'Filipino',
  'Finnish',
  'French',
  'Gabonese',
  'Gambian',
  'Georgian',
  'German',
  'Ghanaian',
  'Greek',
  'Grenadian',
  'Guatemalan',
  'Guinean',
  'Guinea-Bissauan',
  'Guyanese',
  'Haitian',
  'Honduran',
  'Hungarian',
  'Icelandic',
  'Indian',
  'Indonesian',
  'Iranian',
  'Iraqi',
  'Irish',
  'Israeli',
  'Italian',
  'Ivorian',
  'Jamaican',
  'Japanese',
  'Jordanian',
  'Kazakh',
  'Kenyan',
  'Kuwaiti',
  'Kyrgyz',
  'Laotian',
  'Latvian',
  'Lebanese',
  'Liberian',
  'Libyan',
  'Liechtensteiner',
  'Lithuanian',
  'Luxembourger',
  'Macedonian',
  'Malagasy',
  'Malawian',
  'Malaysian',
  'Maldivian',
  'Malian',
  'Maltese',
  'Mauritanian',
  'Mauritian',
  'Mexican',
  'Moldovan',
  'Monacan',
  'Mongolian',
  'Montenegrin',
  'Moroccan',
  'Mozambican',
  'Namibian',
  'Nepalese',
  'New Zealander',
  'Nicaraguan',
  'Nigerian',
  'Nigerien',
  'North Korean',
  'Norwegian',
  'Omani',
  'Pakistani',
  'Panamanian',
  'Papua New Guinean',
  'Paraguayan',
  'Peruvian',
  'Polish',
  'Portuguese',
  'Qatari',
  'Romanian',
  'Russian',
  'Rwandan',
  'Saudi',
  'Scottish',
  'Senegalese',
  'Serbian',
  'Singaporean',
  'Slovak',
  'Slovenian',
  'Somali',
  'South African',
  'South Korean',
  'Spanish',
  'Sri Lankan',
  'Sudanese',
  'Surinamese',
  'Swedish',
  'Swiss',
  'Syrian',
  'Taiwanese',
  'Tajik',
  'Tanzanian',
  'Thai',
  'Togolese',
  'Trinidadian',
  'Tunisian',
  'Turkish',
  'Turkmen',
  'Ugandan',
  'Ukrainian',
  'Uruguayan',
  'Uzbek',
  'Venezuelan',
  'Vietnamese',
  'Welsh',
  'Yemeni',
  'Zambian',
  'Zimbabwean'
]

// Countries list
const countries = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominican Republic',
  'East Timor',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macedonia',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'Norway',
  'Oman',
  'Pakistan',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saudi Arabia',
  'Scotland',
  'Senegal',
  'Serbia',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Somalia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Togo',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Venezuela',
  'Vietnam',
  'Wales',
  'Yemen',
  'Zambia',
  'Zimbabwe'
]

// Filtered nationalities based on search
const filteredNationalities = computed(() => {
  if (!nationalitySearch.value) {
    return nationalities
  }
  const search = nationalitySearch.value.toLowerCase()
  return nationalities.filter(n => n.toLowerCase().includes(search))
})

// Filtered countries based on search
const filteredCountries = computed(() => {
  if (!countrySearch.value) {
    // Show United Kingdom first, then all other countries
    const ukIndex = countries.indexOf('United Kingdom')
    if (ukIndex !== -1) {
      return ['United Kingdom', ...countries.filter(c => c !== 'United Kingdom')]
    }
    return countries
  }
  const search = countrySearch.value.toLowerCase()
  const filtered = countries.filter(c => c.toLowerCase().includes(search))

  // If UK matches the search, show it first
  const ukIndex = filtered.indexOf('United Kingdom')
  if (ukIndex !== -1) {
    return ['United Kingdom', ...filtered.filter(c => c !== 'United Kingdom')]
  }
  return filtered
})

// Filtered company countries based on search
const filteredCompanyCountries = computed(() => {
  if (!companyCountrySearch.value) {
    // Show United Kingdom first, then all other countries
    const ukIndex = countries.indexOf('United Kingdom')
    if (ukIndex !== -1) {
      return ['United Kingdom', ...countries.filter(c => c !== 'United Kingdom')]
    }
    return countries
  }
  const search = companyCountrySearch.value.toLowerCase()
  const filtered = countries.filter(c => c.toLowerCase().includes(search))

  // If UK matches the search, show it first
  const ukIndex = filtered.indexOf('United Kingdom')
  if (ukIndex !== -1) {
    return ['United Kingdom', ...filtered.filter(c => c !== 'United Kingdom')]
  }
  return filtered
})


// Select nationality from dropdown
const selectNationality = (nationality: string) => {
  nationalitySearch.value = nationality
  formData.value.nationality = nationality
  showNationalityDropdown.value = false
}

// Hide dropdown with delay to allow click
const hideNationalityDropdown = () => {
  setTimeout(() => {
    showNationalityDropdown.value = false
  }, 200)
}

// Select country from dropdown
const selectCountry = (country: string) => {
  countrySearch.value = country
  formData.value.current_country = country
  showCountryDropdown.value = false
}

// Hide country dropdown with delay to allow click
const hideCountryDropdown = () => {
  setTimeout(() => {
    showCountryDropdown.value = false
  }, 200)
}

// Select company country from dropdown
const selectCompanyCountry = (country: string) => {
  companyCountrySearch.value = country
  formData.value.employment_company_country = country
  showCompanyCountryDropdown.value = false
}

// Hide company country dropdown with delay to allow click
const hideCompanyCountryDropdown = () => {
  setTimeout(() => {
    showCompanyCountryDropdown.value = false
  }, 200)
}

// Dynamic postcode label based on country
const postcodeLabel = computed(() => {
  const country = formData.value.current_country || countrySearch.value

  if (country === 'United States') {
    return 'ZIP Code'
  } else if (country === 'Canada') {
    return 'Postal Code'
  } else if (country === 'Ireland' || country === 'United Kingdom') {
    return 'Postcode'
  } else if (country === 'India') {
    return 'PIN Code'
  }

  return 'Postal Code'
})

// Dynamic postcode placeholder based on country
const postcodePlaceholder = computed(() => {
  const country = formData.value.current_country || countrySearch.value

  const placeholders: { [key: string]: string } = {
    'United Kingdom': 'SW1A 1AA',
    'United States': '10001',
    'Ireland': 'D02 XY45',
    'Canada': 'K1A 0B1',
    'Australia': '2000',
    'Germany': '10115',
    'France': '75001',
    'Spain': '28001',
    'Italy': '00100',
    'Netherlands': '1012',
    'Belgium': '1000',
    'Switzerland': '8000',
    'Austria': '1010',
    'Sweden': '111 22',
    'Norway': '0001',
    'Denmark': '1050',
    'Finland': '00100',
    'Poland': '00-001',
    'India': '110001',
    'China': '100000',
    'Japan': '100-0001',
    'Singapore': '018956',
    'Hong Kong': '999077',
    'South Korea': '03163',
    'Brazil': '01000-000',
    'Mexico': '01000',
    'Argentina': 'C1001',
    'South Africa': '0001',
    'New Zealand': '1010'
  }

  return placeholders[country] || 'Enter postal code'
})

// Dynamic city placeholder based on country
const cityPlaceholder = computed(() => {
  const country = formData.value.current_country || countrySearch.value

  const capitals: { [key: string]: string } = {
    'United Kingdom': 'London',
    'United States': 'Washington D.C.',
    'Ireland': 'Dublin',
    'Canada': 'Ottawa',
    'Australia': 'Canberra',
    'Germany': 'Berlin',
    'France': 'Paris',
    'Spain': 'Madrid',
    'Italy': 'Rome',
    'Netherlands': 'Amsterdam',
    'Belgium': 'Brussels',
    'Switzerland': 'Bern',
    'Austria': 'Vienna',
    'Sweden': 'Stockholm',
    'Norway': 'Oslo',
    'Denmark': 'Copenhagen',
    'Finland': 'Helsinki',
    'Poland': 'Warsaw',
    'India': 'New Delhi',
    'China': 'Beijing',
    'Japan': 'Tokyo',
    'Singapore': 'Singapore',
    'Hong Kong': 'Hong Kong',
    'South Korea': 'Seoul',
    'Brazil': 'Brasília',
    'Mexico': 'Mexico City',
    'Argentina': 'Buenos Aires',
    'South Africa': 'Pretoria',
    'New Zealand': 'Wellington',
    'Afghanistan': 'Kabul',
    'Albania': 'Tirana',
    'Algeria': 'Algiers',
    'Andorra': 'Andorra la Vella',
    'Angola': 'Luanda',
    'Armenia': 'Yerevan',
    'Azerbaijan': 'Baku',
    'Bahamas': 'Nassau',
    'Bahrain': 'Manama',
    'Bangladesh': 'Dhaka',
    'Barbados': 'Bridgetown',
    'Belarus': 'Minsk',
    'Belize': 'Belmopan',
    'Benin': 'Porto-Novo',
    'Bhutan': 'Thimphu',
    'Bolivia': 'La Paz',
    'Bosnia and Herzegovina': 'Sarajevo',
    'Botswana': 'Gaborone',
    'Brunei': 'Bandar Seri Begawan',
    'Bulgaria': 'Sofia',
    'Burkina Faso': 'Ouagadougou',
    'Burundi': 'Gitega',
    'Cambodia': 'Phnom Penh',
    'Cameroon': 'Yaoundé',
    'Cape Verde': 'Praia',
    'Central African Republic': 'Bangui',
    'Chad': 'N\'Djamena',
    'Chile': 'Santiago',
    'Colombia': 'Bogotá',
    'Comoros': 'Moroni',
    'Congo': 'Brazzaville',
    'Costa Rica': 'San José',
    'Croatia': 'Zagreb',
    'Cuba': 'Havana',
    'Cyprus': 'Nicosia',
    'Czech Republic': 'Prague',
    'Djibouti': 'Djibouti',
    'Dominican Republic': 'Santo Domingo',
    'East Timor': 'Dili',
    'Ecuador': 'Quito',
    'Egypt': 'Cairo',
    'El Salvador': 'San Salvador',
    'Equatorial Guinea': 'Malabo',
    'Eritrea': 'Asmara',
    'Estonia': 'Tallinn',
    'Ethiopia': 'Addis Ababa',
    'Fiji': 'Suva',
    'Gabon': 'Libreville',
    'Gambia': 'Banjul',
    'Georgia': 'Tbilisi',
    'Ghana': 'Accra',
    'Greece': 'Athens',
    'Grenada': 'St. George\'s',
    'Guatemala': 'Guatemala City',
    'Guinea': 'Conakry',
    'Guinea-Bissau': 'Bissau',
    'Guyana': 'Georgetown',
    'Haiti': 'Port-au-Prince',
    'Honduras': 'Tegucigalpa',
    'Hungary': 'Budapest',
    'Iceland': 'Reykjavik',
    'Indonesia': 'Jakarta',
    'Iran': 'Tehran',
    'Iraq': 'Baghdad',
    'Israel': 'Jerusalem',
    'Ivory Coast': 'Yamoussoukro',
    'Jamaica': 'Kingston',
    'Jordan': 'Amman',
    'Kazakhstan': 'Nur-Sultan',
    'Kenya': 'Nairobi',
    'Kuwait': 'Kuwait City',
    'Kyrgyzstan': 'Bishkek',
    'Laos': 'Vientiane',
    'Latvia': 'Riga',
    'Lebanon': 'Beirut',
    'Lesotho': 'Maseru',
    'Liberia': 'Monrovia',
    'Libya': 'Tripoli',
    'Liechtenstein': 'Vaduz',
    'Lithuania': 'Vilnius',
    'Luxembourg': 'Luxembourg',
    'Macedonia': 'Skopje',
    'Madagascar': 'Antananarivo',
    'Malawi': 'Lilongwe',
    'Malaysia': 'Kuala Lumpur',
    'Maldives': 'Malé',
    'Mali': 'Bamako',
    'Malta': 'Valletta',
    'Mauritania': 'Nouakchott',
    'Mauritius': 'Port Louis',
    'Moldova': 'Chișinău',
    'Monaco': 'Monaco',
    'Mongolia': 'Ulaanbaatar',
    'Montenegro': 'Podgorica',
    'Morocco': 'Rabat',
    'Mozambique': 'Maputo',
    'Myanmar': 'Naypyidaw',
    'Namibia': 'Windhoek',
    'Nepal': 'Kathmandu',
    'Nicaragua': 'Managua',
    'Niger': 'Niamey',
    'Nigeria': 'Abuja',
    'North Korea': 'Pyongyang',
    'Oman': 'Muscat',
    'Pakistan': 'Islamabad',
    'Panama': 'Panama City',
    'Papua New Guinea': 'Port Moresby',
    'Paraguay': 'Asunción',
    'Peru': 'Lima',
    'Philippines': 'Manila',
    'Portugal': 'Lisbon',
    'Qatar': 'Doha',
    'Romania': 'Bucharest',
    'Russia': 'Moscow',
    'Rwanda': 'Kigali',
    'Saudi Arabia': 'Riyadh',
    'Scotland': 'Edinburgh',
    'Senegal': 'Dakar',
    'Serbia': 'Belgrade',
    'Slovakia': 'Bratislava',
    'Slovenia': 'Ljubljana',
    'Somalia': 'Mogadishu',
    'Sri Lanka': 'Colombo',
    'Sudan': 'Khartoum',
    'Suriname': 'Paramaribo',
    'Syria': 'Damascus',
    'Taiwan': 'Taipei',
    'Tajikistan': 'Dushanbe',
    'Tanzania': 'Dodoma',
    'Thailand': 'Bangkok',
    'Togo': 'Lomé',
    'Trinidad and Tobago': 'Port of Spain',
    'Tunisia': 'Tunis',
    'Turkey': 'Ankara',
    'Turkmenistan': 'Ashgabat',
    'Uganda': 'Kampala',
    'Ukraine': 'Kyiv',
    'United Arab Emirates': 'Abu Dhabi',
    'Uruguay': 'Montevideo',
    'Uzbekistan': 'Tashkent',
    'Venezuela': 'Caracas',
    'Vietnam': 'Hanoi',
    'Wales': 'Cardiff',
    'Yemen': 'Sana\'a',
    'Zambia': 'Lusaka',
    'Zimbabwe': 'Harare'
  }

  return capitals[country] || 'City'
})

// File uploads
const idDocument = ref<File | null>(null)
const selfie = ref<File | null>(null)
const selfiePreview = ref<string | null>(null)
const proofOfAddress = ref<File | null>(null)
const payslips = ref<File[]>([])

const formData = ref({
  // Page 2: Personal Details
  first_name: '',
  middle_name: '',
  last_name: '',
  nationality: '',
  contact_number: '',

  // Page 1: ID Document
  id_document_type: '',
  id_document_path: '', // Uploaded file path

  // Page 4: Current Address
  current_address_line1: '',
  current_address_line2: '',
  current_city: '',
  current_postcode: '',
  current_country: '',

  // Page 3: Selfie
  selfie_path: '', // Uploaded file path

  // Page 5: Proof of Address
  proof_of_address_path: '', // Uploaded file path

  // Page 6: Financial - Income Sources
  income_regular_employment: false,
  income_benefits: false,
  income_savings_pension_investments: false,
  income_student: false,
  income_unemployed: false,

  // Employment Details
  employment_contract_type: '',
  employment_start_date: '',
  employment_is_hourly: false,
  employment_hours_per_month: null,
  employment_salary_amount: null,
  employment_company_name: '',
  employment_company_address_line1: '',
  employment_company_address_line2: '',
  employment_company_city: '',
  employment_company_postcode: '',
  employment_company_country: '',
  employment_job_title: '',

  // Employer Reference
  employer_ref_position: '',
  employer_ref_name: '',
  employer_ref_email: '',
  employer_ref_phone: '',

  // Payslips
  payslip_paths: [] as string[], // Uploaded file paths

  // Page 7: Additional Income
  has_additional_income: false,
  additional_income_source: '',
  additional_income_amount: null,
  additional_income_frequency: '',

  // Page 8: Adverse Credit
  has_adverse_credit: false,
  adverse_credit_details: '',

  // Page 9: Tenant Details
  is_smoker: null,
  has_pets: false,
  pet_details: '',
  marital_status: '',
  number_of_dependants: 0,
  dependants_details: ''
})

onMounted(() => {
  fetchReferenceByToken()
})

const fetchReferenceByToken = async () => {
  try {
    const token = route.params.token
    const response = await fetch(`${API_URL}/api/references/view/${token}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        tokenError.value = 'Reference not found or link has expired.'
      } else {
        tokenError.value = 'Failed to load reference details.'
      }
      return
    }

    const data = await response.json()
    reference.value = data.reference

    // Extract company branding
    if (reference.value.companies) {
      companyLogo.value = reference.value.companies.logo_url || ''
      primaryColor.value = reference.value.companies.primary_color || '#FF8C41'
      buttonColor.value = reference.value.companies.button_color || '#FF8C41'
    }

    // Pre-fill name from reference
    formData.value.first_name = reference.value.tenant_first_name || ''
    formData.value.last_name = reference.value.tenant_last_name || ''

    // Load current page if saved
    if (reference.value.current_page) {
      currentPage.value = reference.value.current_page
    }

    // Load from localStorage after loading reference
    loadFromLocalStorage()
  } catch (error) {
    tokenError.value = 'An error occurred while loading the reference.'
  } finally {
    initialLoading.value = false
  }
}

// LocalStorage functions
const saveToLocalStorage = () => {
  const dataToSave = {
    formData: formData.value,
    currentPage: currentPage.value,
    dobDay: dobDay.value,
    dobMonth: dobMonth.value,
    dobYear: dobYear.value,
    employmentStartDay: employmentStartDay.value,
    employmentStartMonth: employmentStartMonth.value,
    employmentStartYear: employmentStartYear.value,
    nationalitySearch: nationalitySearch.value,
    countrySearch: countrySearch.value,
    companyCountrySearch: companyCountrySearch.value,
    consentGiven: consentGiven.value
  }
  localStorage.setItem(getStorageKey(), JSON.stringify(dataToSave))
}

const loadFromLocalStorage = () => {
  const saved = localStorage.getItem(getStorageKey())
  if (saved) {
    try {
      const data = JSON.parse(saved)

      // Restore form data
      if (data.formData) {
        Object.assign(formData.value, data.formData)
      }

      // Restore other fields
      if (data.currentPage) currentPage.value = data.currentPage
      if (data.dobDay) dobDay.value = data.dobDay
      if (data.dobMonth) dobMonth.value = data.dobMonth
      if (data.dobYear) dobYear.value = data.dobYear
      if (data.employmentStartDay) employmentStartDay.value = data.employmentStartDay
      if (data.employmentStartMonth) employmentStartMonth.value = data.employmentStartMonth
      if (data.employmentStartYear) employmentStartYear.value = data.employmentStartYear
      if (data.nationalitySearch) nationalitySearch.value = data.nationalitySearch
      if (data.countrySearch) countrySearch.value = data.countrySearch
      if (data.companyCountrySearch) companyCountrySearch.value = data.companyCountrySearch
      if (data.consentGiven !== undefined) consentGiven.value = data.consentGiven
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }
  }
}

const clearLocalStorage = () => {
  localStorage.removeItem(getStorageKey())
}

// Watch for changes and save to localStorage
watch([formData, currentPage, dobDay, dobMonth, dobYear, employmentStartDay, employmentStartMonth, employmentStartYear, nationalitySearch, countrySearch, companyCountrySearch, consentGiven], () => {
  saveToLocalStorage()
}, { deep: true })

// File upload handlers
const handleIdDocumentUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    idDocument.value = file
    submitError.value = ''
  }
}

const removeIdDocument = () => {
  idDocument.value = null
}

const handleSelfieUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    selfie.value = file

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      selfiePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
    submitError.value = ''
  }
}

const removeSelfie = () => {
  selfie.value = null
  selfiePreview.value = null
}

const handleProofOfAddressUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    proofOfAddress.value = file
    submitError.value = ''
  }
}

const removeProofOfAddress = () => {
  proofOfAddress.value = null
}

const handlePayslipUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        submitError.value = `File ${file.name} is too large. Max size is 10MB.`
        return false
      }
      return true
    })
    payslips.value = [...payslips.value, ...validFiles]
  }
}

const removePayslip = (index: number) => {
  payslips.value.splice(index, 1)
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    submitError.value = ''
  }
}

// Upload files for the current page
const uploadCurrentPageFiles = async () => {
  const token = route.params.token as string
  const formDataFiles = new FormData()
  let hasFilesToUpload = false

  // Check which page we're on and add appropriate files
  if (currentPage.value === 1 && idDocument.value && !formData.value.id_document_path) {
    formDataFiles.append('id_document', idDocument.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 3 && selfie.value && !formData.value.selfie_path) {
    formDataFiles.append('selfie', selfie.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 5 && proofOfAddress.value && !formData.value.proof_of_address_path) {
    formDataFiles.append('proof_of_address', proofOfAddress.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 6 && payslips.value.length > 0 && formData.value.payslip_paths.length === 0) {
    payslips.value.forEach((file) => {
      formDataFiles.append('payslips', file)
    })
    hasFilesToUpload = true
  }

  // If there are no files to upload, skip
  if (!hasFilesToUpload) {
    return
  }

  // Upload the files
  const response = await fetch(`${API_URL}/api/references/upload/${token}`, {
    method: 'POST',
    body: formDataFiles
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to upload files')
  }

  const uploadedFiles = await response.json()

  // Store the uploaded file paths in formData
  if (uploadedFiles.id_document) {
    formData.value.id_document_path = uploadedFiles.id_document
  }
  if (uploadedFiles.selfie) {
    formData.value.selfie_path = uploadedFiles.selfie
  }
  if (uploadedFiles.proof_of_address) {
    formData.value.proof_of_address_path = uploadedFiles.proof_of_address
  }
  if (uploadedFiles.payslips && uploadedFiles.payslips.length > 0) {
    formData.value.payslip_paths = uploadedFiles.payslips
  }
}

const handlePageSubmit = async () => {
  submitError.value = ''

  // Validate current page
  if (currentPage.value === 1) {
    if (!formData.value.id_document_type || (!idDocument.value && !formData.value.id_document_path)) {
      submitError.value = 'Please select document type and upload your ID document'
      return
    }
  } else if (currentPage.value === 2) {
    if (!dobDay.value || !dobMonth.value || !dobYear.value) {
      submitError.value = 'Please select your complete date of birth'
      return
    }
    if (!formData.value.contact_number) {
      submitError.value = 'Please enter your contact number'
      return
    }
  } else if (currentPage.value === 3) {
    if (!selfie.value && !formData.value.selfie_path) {
      submitError.value = 'Please upload a selfie'
      return
    }
  } else if (currentPage.value === 5) {
    if (!proofOfAddress.value && !formData.value.proof_of_address_path) {
      submitError.value = 'Please upload proof of address'
      return
    }
  } else if (currentPage.value === 6) {
    if (formData.value.income_regular_employment && payslips.value.length === 0 && formData.value.payslip_paths.length === 0) {
      submitError.value = 'Please upload your payslips'
      return
    }
  }

  // If on last page, submit the form
  if (currentPage.value === 10) {
    await handleFinalSubmit()
  } else {
    // Upload files for current page before moving to next page
    try {
      submitting.value = true
      uploadProgress.value = 10

      await uploadCurrentPageFiles()

      uploadProgress.value = 0
      submitting.value = false

      // Move to next page
      currentPage.value++
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error: any) {
      submitError.value = error.message || 'Failed to upload files'
      uploadProgress.value = 0
      submitting.value = false
    }
  }
}

const handleFinalSubmit = async () => {
  submitting.value = true
  submitError.value = ''
  uploadProgress.value = 0

  try {
    const token = route.params.token as string

    uploadProgress.value = 30

    // Combine DOB fields into proper date format
    const dateOfBirth = dobDay.value && dobMonth.value && dobYear.value
      ? `${dobYear.value}-${dobMonth.value.padStart(2, '0')}-${String(dobDay.value).padStart(2, '0')}`
      : ''

    // Combine employment start date fields into proper date format
    const employmentStartDate = employmentStartDay.value && employmentStartMonth.value && employmentStartYear.value
      ? `${employmentStartYear.value}-${employmentStartMonth.value.padStart(2, '0')}-${String(employmentStartDay.value).padStart(2, '0')}`
      : ''

    uploadProgress.value = 50

    // Submit form data with already uploaded file paths
    const submitData = {
      ...formData.value,
      date_of_birth: dateOfBirth,
      employment_start_date: employmentStartDate,
      // Use the paths already stored in formData (uploaded on each step)
      payslip_files: formData.value.payslip_paths
    }

    const response = await fetch(`${API_URL}/api/references/submit/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to submit reference')
    }

    uploadProgress.value = 100
    justSubmitted.value = true

    // Clear localStorage after successful submission
    clearLocalStorage()

    // Refresh the reference data to show submitted state
    setTimeout(() => {
      fetchReferenceByToken()
    }, 2000)
  } catch (error: any) {
    submitError.value = error.message || 'Failed to submit reference'
    uploadProgress.value = 0
  } finally {
    submitting.value = false
  }
}

</script>

<style scoped>
/* Override focus colors with company branding */
select:focus,
input:focus,
textarea:focus,
:deep(select:focus),
:deep(input:focus),
:deep(textarea:focus) {
  --tw-ring-color: v-bind(primaryColor);
  border-color: v-bind(primaryColor) !important;
}

/* Checkbox and radio colors */
input[type="checkbox"]:checked,
input[type="radio"]:checked {
  background-color: v-bind(primaryColor);
  border-color: v-bind(primaryColor);
}
</style>
