<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <!-- Header -->
      <div v-if="!loading" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-16 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
            <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
          </template>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ formTitle }}</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">
          {{ formSubtitle }}
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-slate-600 mx-auto" style="border-top-color: #f97316;"></div>
        <p class="mt-4 text-gray-600 dark:text-slate-400">Loading reference form...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
        <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Unable to load form</h2>
        <p class="text-gray-600 dark:text-slate-400">{{ error }}</p>
      </div>

      <!-- Already Submitted -->
      <div v-else-if="alreadySubmitted" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
        <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Reference Already Submitted</h2>
        <p class="text-gray-600 dark:text-slate-400">This reference form has already been completed. Thank you for your response.</p>
      </div>

      <!-- Success -->
      <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
        <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Reference Submitted</h2>
        <p class="text-gray-600 dark:text-slate-400">
          Thank you for completing this reference. Your response has been recorded and will help with the tenant's application.
        </p>
        <p class="mt-4 text-sm text-gray-500 dark:text-slate-500">You can close this page now.</p>
      </div>

      <!-- Form -->
      <div v-else class="space-y-6">
        <!-- Context Card -->
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Reference Details</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500 dark:text-slate-400">{{ refereeType === 'employer' ? 'Employee' : refereeType === 'accountant' ? 'Client' : 'Tenant' }} Name</span>
              <p class="font-medium text-gray-900 dark:text-white">{{ tenantName }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-slate-400">Requested by</span>
              <p class="font-medium text-gray-900 dark:text-white">{{ companyName }}</p>
            </div>
            <div v-if="refereeType === 'employer' && employerName">
              <span class="text-gray-500 dark:text-slate-400">Employer</span>
              <p class="font-medium text-gray-900 dark:text-white">{{ employerName }}</p>
            </div>
          </div>
        </div>

        <!-- Form Fields -->
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Referee Info -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Details</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Your Name <span class="text-red-500">*</span></label>
                <input
                  v-model="form.refereeName"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          </div>

          <!-- EMPLOYER FORM -->
          <template v-if="refereeType === 'employer'">
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Employment Reference</h3>
              <div class="space-y-4">
                <!-- Confirmation -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Do you confirm {{ tenantName }} works at your company? <span class="text-red-500">*</span>
                  </label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsEmployment" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsEmployment" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Job Title -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Title / Position <span class="text-red-500">*</span></label>
                  <input v-model="form.jobTitle" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- Employment Start Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employment Start Date <span class="text-red-500">*</span></label>
                  <input v-model="form.employmentStartDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- Pay Type -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Pay Type <span class="text-red-500">*</span></label>
                  <select v-model="form.payType" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white">
                    <option value="salary">Annual Salary</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>

                <!-- Annual Salary (shown when pay type is salary) -->
                <div v-if="form.payType === 'salary'">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Salary (&pound;) <span class="text-red-500">*</span></label>
                  <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input v-model="form.annualSalary" type="number" min="0" step="0.01" required class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                  </div>
                </div>

                <!-- Hourly Rate fields (shown when pay type is hourly) -->
                <template v-if="form.payType === 'hourly'">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Hourly Rate (&pound;) <span class="text-red-500">*</span></label>
                    <div class="relative">
                      <span class="absolute left-3 top-2.5 text-gray-500 dark:text-slate-400">&pound;</span>
                      <input v-model="form.hourlyRate" type="number" min="0" step="0.01" required class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Hours Per Week <span class="text-red-500">*</span></label>
                    <input v-model="form.hoursPerWeek" type="number" min="0" step="0.5" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Pay Frequency <span class="text-red-500">*</span></label>
                    <select v-model="form.payFrequency" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div v-if="estimatedAnnualFromHourly !== null" class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p class="text-sm text-gray-600 dark:text-slate-300">
                      Estimated Annual Income: <span class="font-semibold text-gray-900 dark:text-white">&pound;{{ estimatedAnnualFromHourly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
                    </p>
                  </div>
                </template>

                <!-- Employment Type -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employment Type <span class="text-red-500">*</span></label>
                  <select v-model="form.employmentType" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white">
                    <option value="">Select...</option>
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                    <option value="zero-hours">Zero Hours</option>
                  </select>
                </div>

                <!-- In Probation -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Is this person currently in a probation period? <span class="text-red-500">*</span></label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.inProbation" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.inProbation" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Additional Comments -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Additional Comments</label>
                  <textarea v-model="form.additionalComments" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" placeholder="Any other information you'd like to provide..."></textarea>
                </div>
              </div>
            </div>
          </template>

          <!-- LANDLORD FORM -->
          <template v-if="refereeType === 'landlord'">
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Landlord Reference</h3>
              <div class="space-y-4">
                <!-- Confirmation -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Do you confirm {{ tenantName }} was/is your tenant? <span class="text-red-500">*</span>
                  </label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsTenancy" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsTenancy" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Tenancy Start Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy Start Date <span class="text-red-500">*</span></label>
                  <input v-model="form.tenancyStartDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- Still Current Tenant -->
                <div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="form.stillCurrentTenant" class="text-orange-500 focus:ring-orange-500 rounded" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Still current tenant</span>
                  </label>
                </div>

                <!-- Tenancy End Date -->
                <div v-if="!form.stillCurrentTenant">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy End Date <span class="text-red-500">*</span></label>
                  <input v-model="form.tenancyEndDate" type="date" :required="!form.stillCurrentTenant" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- Monthly Rent -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent Paid <span class="text-red-500">*</span></label>
                  <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input v-model="form.monthlyRent" type="number" min="0" step="0.01" required class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                  </div>
                </div>

                <!-- Rent Payments On Time -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Were rent payments made on time? <span class="text-red-500">*</span></label>
                  <select v-model="form.rentPaymentTimeliness" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white">
                    <option value="">Select...</option>
                    <option value="always">Always</option>
                    <option value="mostly">Mostly</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="rarely">Rarely</option>
                  </select>
                </div>

                <!-- Departure-only fields (hidden when still current tenant) -->
                <template v-if="!form.stillCurrentTenant">
                  <!-- Property Condition -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property condition on departure <span class="text-red-500">*</span></label>
                    <select v-model="form.propertyCondition" :required="!form.stillCurrentTenant" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white">
                      <option value="">Select...</option>
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>

                  <!-- Damage -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any damage to property? <span class="text-red-500">*</span></label>
                    <div class="flex gap-4 mt-1">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="form.propertyDamage" :value="true" class="text-orange-500 focus:ring-orange-500" :required="!form.stillCurrentTenant" />
                        <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="form.propertyDamage" :value="false" class="text-orange-500 focus:ring-orange-500" />
                        <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                      </label>
                    </div>
                  </div>
                  <div v-if="form.propertyDamage">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Please provide details</label>
                    <textarea v-model="form.damageDetails" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white"></textarea>
                  </div>

                  <!-- Anti-social Behaviour -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any anti-social behaviour? <span class="text-red-500">*</span></label>
                    <div class="flex gap-4 mt-1">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="form.antiSocialBehaviour" :value="true" class="text-orange-500 focus:ring-orange-500" :required="!form.stillCurrentTenant" />
                        <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="form.antiSocialBehaviour" :value="false" class="text-orange-500 focus:ring-orange-500" />
                        <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                      </label>
                    </div>
                  </div>
                  <div v-if="form.antiSocialBehaviour">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Please provide details</label>
                    <textarea v-model="form.antiSocialDetails" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white"></textarea>
                  </div>
                </template>

                <!-- Would Rent Again -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Would you rent to them again? <span class="text-red-500">*</span></label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.wouldRentAgain" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.wouldRentAgain" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Additional Comments -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Additional Comments</label>
                  <textarea v-model="form.additionalComments" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" placeholder="Any other information you'd like to provide..."></textarea>
                </div>
              </div>
            </div>
          </template>

          <!-- ACCOUNTANT FORM -->
          <template v-if="refereeType === 'accountant'">
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Accountant Reference</h3>
              <div class="space-y-4">
                <!-- Confirmation -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Do you confirm {{ tenantName }} is your client? <span class="text-red-500">*</span>
                  </label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsClient" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.confirmsClient" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Business Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Business Name <span class="text-red-500">*</span></label>
                  <input v-model="form.businessName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- How Long Client -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">How long have they been a client? <span class="text-red-500">*</span></label>
                  <input v-model="form.clientDuration" type="text" required placeholder="e.g. 3 years" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                </div>

                <!-- Annual Income -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Income (Declared) <span class="text-red-500">*</span></label>
                  <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-500 dark:text-slate-400">&pound;</span>
                    <input v-model="form.annualIncome" type="number" min="0" step="0.01" required class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" />
                  </div>
                </div>

                <!-- Accounts Up to Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Are their accounts up to date? <span class="text-red-500">*</span></label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.accountsUpToDate" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.accountsUpToDate" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>

                <!-- Financial Concerns -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Any concerns about their financial position? <span class="text-red-500">*</span></label>
                  <div class="flex gap-4 mt-1">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.financialConcerns" :value="true" class="text-orange-500 focus:ring-orange-500" required />
                      <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" v-model="form.financialConcerns" :value="false" class="text-orange-500 focus:ring-orange-500" />
                      <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                </div>
                <div v-if="form.financialConcerns">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Please provide details</label>
                  <textarea v-model="form.financialConcernDetails" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white"></textarea>
                </div>

                <!-- Additional Comments -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Additional Comments</label>
                  <textarea v-model="form.additionalComments" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-700 dark:text-white" placeholder="Any other information you'd like to provide..."></textarea>
                </div>
              </div>
            </div>
          </template>

          <!-- Signature -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Declaration</h3>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
              I confirm that the information provided above is true and accurate to the best of my knowledge.
            </p>
            <SignaturePad
              v-model="form.signature"
              label="Your Signature"
              :height="150"
              required
            />
          </div>

          <!-- Submit Error -->
          <div v-if="submitError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-700 dark:text-red-400">{{ submitError }}</p>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="submitting"
              class="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2"
            >
              <svg v-if="submitting" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ submitting ? 'Submitting...' : 'Submit Reference' }}
            </button>
          </div>
        </form>

        <!-- Footer -->
        <div class="text-center text-xs text-gray-400 dark:text-slate-500 pb-4">
          <p>Powered by PropertyGoose</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '@/components/forms/SignaturePad.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const token = computed(() => route.params.token as string)
const refereeType = computed(() => (route.meta.type as string) || 'employer')

const loading = ref(true)
const error = ref('')
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')
const alreadySubmitted = ref(false)

const tenantName = ref('')
const employerName = ref('')
const companyName = ref('')
const companyLogo = ref('')
const refereeEmail = ref('')

const form = reactive({
  refereeName: '',
  // Employer fields
  confirmsEmployment: null as boolean | null,
  jobTitle: '',
  employmentStartDate: '',
  payType: 'salary' as 'salary' | 'hourly',
  annualSalary: null as number | null,
  hourlyRate: null as number | null,
  hoursPerWeek: null as number | null,
  payFrequency: 'weekly' as 'weekly' | 'monthly',
  employmentType: '',
  inProbation: null as boolean | null,
  // Landlord fields
  confirmsTenancy: null as boolean | null,
  tenancyStartDate: '',
  tenancyEndDate: '',
  stillCurrentTenant: false,
  monthlyRent: null as number | null,
  rentPaymentTimeliness: '',
  propertyCondition: '',
  propertyDamage: null as boolean | null,
  damageDetails: '',
  antiSocialBehaviour: null as boolean | null,
  antiSocialDetails: '',
  wouldRentAgain: null as boolean | null,
  // Accountant fields
  confirmsClient: null as boolean | null,
  businessName: '',
  clientDuration: '',
  annualIncome: null as number | null,
  accountsUpToDate: null as boolean | null,
  financialConcerns: null as boolean | null,
  financialConcernDetails: '',
  // Shared
  additionalComments: '',
  signature: null as string | null
})

const formTitle = computed(() => {
  switch (refereeType.value) {
    case 'employer': return 'Employer Reference Form'
    case 'landlord': return 'Landlord Reference Form'
    case 'accountant': return 'Accountant Reference Form'
    default: return 'Reference Form'
  }
})

const formSubtitle = computed(() => {
  if (!tenantName.value) return 'Please complete the reference form below.'
  switch (refereeType.value) {
    case 'employer': return `Please provide an employment reference for ${tenantName.value}`
    case 'landlord': return `Please provide a landlord reference for ${tenantName.value}`
    case 'accountant': return `Please provide an accountant reference for ${tenantName.value}`
    default: return `Please provide a reference for ${tenantName.value}`
  }
})

const apiFormType = computed(() => {
  switch (refereeType.value) {
    case 'employer': return 'employer-form'
    case 'landlord': return 'landlord-form'
    case 'accountant': return 'accountant-form'
    default: return 'employer-form'
  }
})

const estimatedAnnualFromHourly = computed((): number | null => {
  if (form.hourlyRate && form.hoursPerWeek) {
    return form.hourlyRate * form.hoursPerWeek * 52
  }
  return null
})

async function loadForm() {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_URL}/api/v2/${apiFormType.value}/${token.value}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      error.value = data.error || 'This reference link is invalid or has expired.'
      return
    }

    const data = await res.json()

    companyName.value = data.companyName || 'PropertyGoose'
    companyLogo.value = data.companyLogo || ''

    if (refereeType.value === 'employer') {
      tenantName.value = data.reference?.employee_name || ''
      employerName.value = data.reference?.employer_name || ''
      if (data.reference?.submitted_at) {
        alreadySubmitted.value = true
      }
    } else if (refereeType.value === 'landlord') {
      tenantName.value = data.reference?.tenant_name || ''
      if (data.reference?.submitted_at) {
        alreadySubmitted.value = true
      }
    } else if (refereeType.value === 'accountant') {
      tenantName.value = data.reference?.client_name || ''
      if (data.reference?.submitted_at) {
        alreadySubmitted.value = true
      }
    }

    // The GET endpoints don't return referee_email for employer/landlord/accountant
    // but we can display it if available
    refereeEmail.value = data.reference?.referee_email || data.reference?.guarantor_email || ''
  } catch (e) {
    error.value = 'Failed to load the reference form. Please try again later.'
  } finally {
    loading.value = false
  }
}

function buildSubmitPayload() {
  if (refereeType.value === 'employer') {
    return {
      refereeName: form.refereeName,
      confirmsEmployment: form.confirmsEmployment,
      jobTitle: form.jobTitle,
      employmentStartDate: form.employmentStartDate,
      payType: form.payType,
      annualSalary: form.payType === 'salary' ? form.annualSalary : null,
      hourlyRate: form.payType === 'hourly' ? form.hourlyRate : null,
      hoursPerWeek: form.payType === 'hourly' ? form.hoursPerWeek : null,
      payFrequency: form.payType === 'hourly' ? form.payFrequency : null,
      calculatedAnnualIncome: form.payType === 'hourly' ? estimatedAnnualFromHourly.value : form.annualSalary,
      employmentType: form.employmentType,
      inProbation: form.inProbation,
      additionalComments: form.additionalComments,
      signature: form.signature
    }
  } else if (refereeType.value === 'landlord') {
    return {
      refereeName: form.refereeName,
      confirmsTenancy: form.confirmsTenancy,
      tenancyStartDate: form.tenancyStartDate,
      tenancyEndDate: form.stillCurrentTenant ? null : form.tenancyEndDate,
      stillCurrentTenant: form.stillCurrentTenant,
      monthlyRent: form.monthlyRent,
      rentPaymentTimeliness: form.rentPaymentTimeliness,
      propertyCondition: form.propertyCondition,
      propertyDamage: form.propertyDamage,
      damageDetails: form.damageDetails,
      antiSocialBehaviour: form.antiSocialBehaviour,
      antiSocialDetails: form.antiSocialDetails,
      wouldRentAgain: form.wouldRentAgain,
      additionalComments: form.additionalComments,
      signature: form.signature
    }
  } else {
    // accountant
    return {
      accountantName: form.refereeName,
      confirmsClient: form.confirmsClient,
      businessName: form.businessName,
      clientDuration: form.clientDuration,
      annualIncome: form.annualIncome,
      accountsUpToDate: form.accountsUpToDate,
      financialConcerns: form.financialConcerns,
      financialConcernDetails: form.financialConcernDetails,
      additionalComments: form.additionalComments,
      signature: form.signature
    }
  }
}

async function handleSubmit() {
  submitting.value = true
  submitError.value = ''

  try {
    const payload = buildSubmitPayload()
    const res = await fetch(`${API_URL}/api/v2/${apiFormType.value}/${token.value}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      submitError.value = data.error || 'Failed to submit. Please try again.'
      return
    }

    submitted.value = true
  } catch (e) {
    submitError.value = 'Failed to submit. Please check your connection and try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadForm()
})
</script>
