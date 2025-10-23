<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading reference...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="reference" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button
              @click="$router.push('/references')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to References
            </button>
            <h2 class="text-3xl font-bold text-gray-900">
              {{ reference.tenant_first_name }} {{ reference.middle_name ? reference.middle_name + ' ' : '' }}{{ reference.tenant_last_name }}
            </h2>
            <p class="mt-2 text-gray-600">Complete Reference Details</p>
          </div>
          <span
            class="px-3 py-1 text-sm font-semibold rounded-full"
            :class="{
              'bg-yellow-100 text-yellow-800': reference.status === 'pending',
              'bg-blue-100 text-blue-800': reference.status === 'in_progress',
              'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
              'bg-green-100 text-green-800': reference.status === 'completed',
              'bg-red-100 text-red-800': reference.status === 'rejected',
              'bg-gray-100 text-gray-800': reference.status === 'cancelled'
            }"
          >
            {{ formatStatus(reference.status) }}
          </span>
        </div>

        <!-- Child Reference Context Banner -->
        <div v-if="parentReference" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-blue-900 mb-1">Multi-Tenant Property</h4>
              <p class="text-sm text-blue-800">
                This is one of multiple tenants for this property.
                <span v-if="reference.rent_share">
                  This tenant's rent share: <strong>£{{ reference.rent_share }}</strong> of £{{ reference.monthly_rent }} total.
                </span>
              </p>
              <div v-if="siblingReferences && siblingReferences.length > 0" class="mt-2">
                <p class="text-xs text-blue-700 font-medium mb-1">Other tenants:</p>
                <ul class="text-xs text-blue-700 space-y-1">
                  <li v-for="sibling in siblingReferences" :key="sibling.id" class="flex items-center">
                    <span class="mr-2">•</span>
                    {{ sibling.tenant_first_name }} {{ sibling.tenant_last_name }}
                    <span v-if="sibling.rent_share" class="ml-2 text-blue-600">(£{{ sibling.rent_share }})</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Parent Reference - All Tenants Overview -->
        <div v-if="reference.is_group_parent && childReferences && childReferences.length > 0">
          <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-6 border border-purple-200">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">
                  Multi-Tenant Property Overview
                </h3>
                <p class="text-sm text-gray-700">
                  This property has <strong>{{ childReferences.length }} tenants</strong> with a total monthly rent of <strong>£{{ reference.monthly_rent }}</strong>
                </p>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold text-primary">{{ childReferences.length }}</div>
                <div class="text-xs text-gray-600 uppercase tracking-wide">Tenants</div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div v-for="(child, index) in childReferences" :key="child.id" class="bg-white rounded-lg shadow border border-gray-200">
              <!-- Card Header -->
              <button
                @click="toggleTenantExpanded(child.id)"
                class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-center gap-4 flex-1 text-left">
                  <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-90': expandedTenant === child.id }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                      <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Tenant {{ index + 1 }}</span>
                      <span
                        class="px-2 py-0.5 text-xs font-semibold rounded-full"
                        :class="{
                          'bg-yellow-100 text-yellow-800': child.status === 'pending',
                          'bg-blue-100 text-blue-800': child.status === 'in_progress',
                          'bg-orange-100 text-orange-800': child.status === 'pending_verification',
                          'bg-green-100 text-green-800': child.status === 'completed'
                        }"
                      >
                        {{ formatStatus(child.status) }}
                      </span>
                    </div>
                    <h4 class="text-lg font-bold text-gray-900">
                      {{ child.tenant_first_name }} {{ child.tenant_last_name }}
                    </h4>
                    <p class="text-sm text-gray-600">{{ child.tenant_email }}</p>
                  </div>
                  <div class="text-right">
                    <div class="text-sm text-gray-500">Rent Share</div>
                    <div class="text-xl font-bold text-primary">£{{ child.rent_share }}</div>
                  </div>
                </div>
              </button>

              <!-- Expanded Content -->
              <div v-if="expandedTenant === child.id" class="border-t border-gray-200 px-6 py-6 space-y-6 bg-gray-50">
                <!-- Load full reference details -->
                <div v-if="childReferenceDetails[child.id]" class="space-y-6">
                  <!-- Personal Details -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">Personal Details</h5>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-500">First Name</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.first_name || childReferenceDetails[child.id].reference.tenant_first_name || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Middle Name</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.middle_name || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Last Name</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.last_name || childReferenceDetails[child.id].reference.tenant_last_name || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Date of Birth</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.date_of_birth ? formatDate(childReferenceDetails[child.id].reference.date_of_birth) : 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Email</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.tenant_email }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Contact Number</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.contact_number || childReferenceDetails[child.id].reference.tenant_phone || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Nationality</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.nationality || 'Not provided' }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Identification Documents -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">Identification Documents</h5>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Document Type</label>
                        <p class="mt-1 text-gray-900 capitalize">{{ childReferenceDetails[child.id].reference.id_document_type ? childReferenceDetails[child.id].reference.id_document_type.replace('_', ' ') : 'Not provided' }}</p>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <div v-if="childReferenceDetails[child.id].reference.id_document_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                        <div class="flex items-center">
                          <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span class="text-sm text-gray-900">ID Document</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            @click="viewFile(childReferenceDetails[child.id].reference.id_document_path)"
                            class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                          >
                            View
                          </button>
                        </div>
                      </div>
                      <div v-if="childReferenceDetails[child.id].reference.selfie_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                        <div class="flex items-center">
                          <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span class="text-sm text-gray-900">Selfie Verification</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            @click="viewFile(childReferenceDetails[child.id].reference.selfie_path)"
                            class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                          >
                            View
                          </button>
                        </div>
                      </div>
                      <div v-if="!childReferenceDetails[child.id].reference.id_document_path && !childReferenceDetails[child.id].reference.selfie_path" class="text-gray-500 text-center py-4">
                        No identification documents uploaded yet
                      </div>
                    </div>
                  </div>

                  <!-- Current Address -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">Current Address</h5>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                      <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-500">Address Line 1</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.current_address_line1 || 'Not provided yet' }}</p>
                      </div>
                      <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-500">Address Line 2</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.current_address_line2 || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">City</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.current_city || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Postcode</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.current_postcode || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Country</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.current_country ? getCountryName(childReferenceDetails[child.id].reference.current_country) : 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Time at Address</label>
                        <p class="mt-1 text-gray-900">
                          <span v-if="childReferenceDetails[child.id].reference.time_at_address_years !== null || childReferenceDetails[child.id].reference.time_at_address_months !== null">
                            {{ childReferenceDetails[child.id].reference.time_at_address_years || 0 }} year{{ childReferenceDetails[child.id].reference.time_at_address_years !== 1 ? 's' : '' }},
                            {{ childReferenceDetails[child.id].reference.time_at_address_months || 0 }} month{{ childReferenceDetails[child.id].reference.time_at_address_months !== 1 ? 's' : '' }}
                          </span>
                          <span v-else>Not provided yet</span>
                        </p>
                      </div>
                    </div>

                    <!-- Proof of Address Document -->
                    <div class="mt-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Address Document</label>
                      <div v-if="childReferenceDetails[child.id].reference.proof_of_address_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                        <div class="flex items-center">
                          <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span class="text-sm text-gray-900">Proof of Address</span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            @click="viewFile(childReferenceDetails[child.id].reference.proof_of_address_path)"
                            class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                          >
                            View
                          </button>
                        </div>
                      </div>
                      <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        Proof of address document not uploaded yet
                      </div>
                    </div>
                  </div>

                  <!-- Financial Information -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">Financial Information</h5>

                    <!-- Income Sources -->
                    <div class="mb-6">
                      <label class="block text-sm font-medium text-gray-700 mb-3">Income Sources</label>
                      <div class="flex flex-wrap gap-2">
                        <span v-if="childReferenceDetails[child.id].reference.income_regular_employment" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Employed</span>
                        <span v-if="childReferenceDetails[child.id].reference.income_self_employed" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Self Employed</span>
                        <span v-if="childReferenceDetails[child.id].reference.income_benefits" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Benefits</span>
                        <span v-if="childReferenceDetails[child.id].reference.income_savings_pension_investments" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Savings/Pension/Investments</span>
                        <span v-if="childReferenceDetails[child.id].reference.income_student" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Student</span>
                        <span v-if="childReferenceDetails[child.id].reference.income_unemployed" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Unemployed</span>
                        <span v-if="!childReferenceDetails[child.id].reference.income_regular_employment && !childReferenceDetails[child.id].reference.income_self_employed && !childReferenceDetails[child.id].reference.income_benefits && !childReferenceDetails[child.id].reference.income_savings_pension_investments && !childReferenceDetails[child.id].reference.income_student && !childReferenceDetails[child.id].reference.income_unemployed" class="text-gray-500 text-sm">Not provided yet</span>
                      </div>
                    </div>

                    <!-- Employment Details -->
                    <div v-if="childReferenceDetails[child.id].reference.income_regular_employment" class="border-t pt-6">
                      <h6 class="text-sm font-semibold text-gray-900 mb-4">Employment Details</h6>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Employment Type</label>
                          <p class="mt-1 text-gray-900 capitalize">{{ childReferenceDetails[child.id].reference.employment_contract_type?.replace(/-/g, ' ') || 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Employment Start Date</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.employment_start_date ? formatDate(childReferenceDetails[child.id].reference.employment_start_date) : 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Job Title</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.employment_job_title || 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Company Name</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.employment_company_name || 'Not provided' }}</p>
                        </div>
                        <div v-if="!childReferenceDetails[child.id].reference.employment_is_hourly">
                          <label class="block text-sm font-medium text-gray-500">Annual Salary</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.employment_salary_amount ? `£${childReferenceDetails[child.id].reference.employment_salary_amount}` : 'Not provided' }}</p>
                        </div>
                        <div v-if="childReferenceDetails[child.id].reference.employment_is_hourly">
                          <label class="block text-sm font-medium text-gray-500">Hourly Rate</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.employment_salary_amount ? `£${childReferenceDetails[child.id].reference.employment_salary_amount}/hour` : 'Not provided' }}</p>
                        </div>
                      </div>

                      <!-- Payslips -->
                      <div class="mt-6">
                        <label class="block text-sm font-medium text-gray-700 mb-3">Payslips (Last 3 months)</label>
                        <div v-if="childReferenceDetails[child.id].reference.payslip_files?.length" class="space-y-2">
                          <div v-for="(file, idx) in childReferenceDetails[child.id].reference.payslip_files" :key="idx"
                               class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                            <div class="flex items-center">
                              <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              <span class="text-sm text-gray-900">Payslip {{ idx + 1 }}</span>
                            </div>
                            <div class="flex gap-2">
                              <button
                                @click="viewFile(file)"
                                class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                          Payslips not uploaded yet
                        </div>
                      </div>

                      <!-- Employer Reference -->
                      <div v-if="childReferenceDetails[child.id].employerReference" class="mt-6 bg-green-50 border border-green-200 rounded-lg">
                        <div class="p-4">
                          <div class="flex items-center justify-between mb-4">
                            <h6 class="text-sm font-semibold text-green-900">✓ Employer Reference Completed</h6>
                            <span class="text-xs text-green-700">Submitted {{ formatDateTime(childReferenceDetails[child.id].employerReference.submitted_at) }}</span>
                          </div>

                          <div class="space-y-4">
                            <!-- Company Info -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Company Information</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Company:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.company_name }}</span></div>
                                <div><span class="text-green-700 font-medium">Contact:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employer_name }}</span></div>
                                <div><span class="text-green-700 font-medium">Position:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employer_position }}</span></div>
                                <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employer_email }}</span></div>
                              </div>
                            </div>

                            <!-- Employment Details -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Employment Details</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Position:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employee_position }}</span></div>
                                <div><span class="text-green-700 font-medium">Type:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employment_type }}</span></div>
                                <div><span class="text-green-700 font-medium">Start Date:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].employerReference.employment_start_date) }}</span></div>
                                <div v-if="childReferenceDetails[child.id].employerReference.employment_end_date"><span class="text-green-700 font-medium">End Date:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].employerReference.employment_end_date) }}</span></div>
                                <div><span class="text-green-700 font-medium">Currently Employed:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.is_current_employee ? 'Yes' : 'No' }}</span></div>
                              </div>
                            </div>

                            <!-- Compensation -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Compensation</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Salary:</span> <span class="text-green-900">£{{ childReferenceDetails[child.id].employerReference.annual_salary }} ({{ childReferenceDetails[child.id].employerReference.salary_frequency }})</span></div>
                                <div><span class="text-green-700 font-medium">Probation:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.is_probation === 'yes' ? 'Yes' : 'No' }}</span></div>
                                <div v-if="childReferenceDetails[child.id].employerReference.is_probation === 'yes' && childReferenceDetails[child.id].employerReference.probation_end_date"><span class="text-green-700 font-medium">Probation End:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].employerReference.probation_end_date) }}</span></div>
                              </div>
                            </div>

                            <!-- Employment Confirmation -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Employment Confirmation</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Details Verified:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].employerReference.employment_status }}</span></div>
                                <div><span class="text-green-700 font-medium">Contract Type:</span> <span class="text-green-900 capitalize">{{ childReferenceDetails[child.id].employerReference.contract_type_confirmation || 'Not provided' }}</span></div>
                                <div><span class="text-green-700 font-medium">Income Expectation:</span> <span class="text-green-900 capitalize">{{ childReferenceDetails[child.id].employerReference.income_expectation || 'Not provided' }}</span></div>
                                <div><span class="text-green-700 font-medium">Position Security:</span> <span class="text-green-900 capitalize">{{ childReferenceDetails[child.id].employerReference.employment_stable || 'Not provided' }}</span></div>
                              </div>

                              <div v-if="childReferenceDetails[child.id].employerReference.clarification_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Clarification Notes:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].employerReference.clarification_details }}</p>
                              </div>

                              <div v-if="childReferenceDetails[child.id].employerReference.income_expectation_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Income Change Details:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].employerReference.income_expectation_details }}</p>
                              </div>

                              <div v-if="childReferenceDetails[child.id].employerReference.employment_stable_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Position Security Details:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].employerReference.employment_stable_details }}</p>
                              </div>

                              <div v-if="childReferenceDetails[child.id].employerReference.additional_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Additional Comments:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].employerReference.additional_comments }}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else-if="childReferenceDetails[child.id].reference.employer_ref_email" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p class="text-sm text-blue-800">
                          Waiting for employer reference from {{ childReferenceDetails[child.id].reference.employer_ref_email }}
                        </p>
                      </div>
                    </div>

                    <!-- Self-Employed & Accountant Details -->
                    <div v-if="childReferenceDetails[child.id].reference.income_self_employed" class="border-t pt-6">
                      <h6 class="text-sm font-semibold text-gray-900 mb-4">Self-Employed Details</h6>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Business Name</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.self_employed_business_name || 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Annual Income</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.self_employed_annual_income ? `£${childReferenceDetails[child.id].reference.self_employed_annual_income}` : 'Not provided' }}</p>
                        </div>
                      </div>

                      <!-- Accountant Reference -->
                      <div v-if="childReferenceDetails[child.id].accountantReference?.submitted_at" class="mt-6 bg-green-50 border border-green-200 rounded-lg">
                        <div class="p-4">
                          <div class="flex items-center justify-between mb-4">
                            <h6 class="text-sm font-semibold text-green-900">✓ Accountant Reference Completed</h6>
                            <span class="text-xs text-green-700">Submitted {{ formatDateTime(childReferenceDetails[child.id].accountantReference.submitted_at) }}</span>
                          </div>

                          <div class="space-y-4">
                            <!-- Accountant Information -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Accountant Information</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Name:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.accountant_name }}</span></div>
                                <div><span class="text-green-700 font-medium">Firm:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.firm_name }}</span></div>
                                <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.accountant_email }}</span></div>
                                <div><span class="text-green-700 font-medium">Phone:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.accountant_phone }}</span></div>
                              </div>
                            </div>

                            <!-- Business Information -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Business Information</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Business:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.business_name }}</span></div>
                                <div><span class="text-green-700 font-medium">Trading Status:</span> <span class="text-green-900 capitalize">{{ childReferenceDetails[child.id].accountantReference.business_trading_status }}</span></div>
                                <div><span class="text-green-700 font-medium">Start Date:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].accountantReference.business_start_date) }}</span></div>
                                <div><span class="text-green-700 font-medium">Nature:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.nature_of_business }}</span></div>
                              </div>
                            </div>

                            <!-- Financial Information -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Financial Information</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Annual Turnover:</span> <span class="text-green-900">£{{ childReferenceDetails[child.id].accountantReference.annual_turnover?.toLocaleString() }}</span></div>
                                <div><span class="text-green-700 font-medium">Annual Profit:</span> <span class="text-green-900">£{{ childReferenceDetails[child.id].accountantReference.annual_profit?.toLocaleString() }}</span></div>
                                <div><span class="text-green-700 font-medium">Tax Returns Filed:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.tax_returns_filed ? 'Yes' : 'No' }}</span></div>
                                <div v-if="childReferenceDetails[child.id].accountantReference.last_tax_return_date"><span class="text-green-700 font-medium">Last Tax Return:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].accountantReference.last_tax_return_date) }}</span></div>
                                <div><span class="text-green-700 font-medium">Accounts Prepared:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.accounts_prepared ? 'Yes' : 'No' }}</span></div>
                                <div v-if="childReferenceDetails[child.id].accountantReference.accounts_year_end"><span class="text-green-700 font-medium">Accounts Year End:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].accountantReference.accounts_year_end) }}</span></div>
                                <div><span class="text-green-700 font-medium">Tax Liabilities:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.any_outstanding_tax_liabilities ? 'Yes' : 'No' }}</span></div>
                                <div><span class="text-green-700 font-medium">Financially Stable:</span> <span class="text-green-900 font-semibold">{{ childReferenceDetails[child.id].accountantReference.business_financially_stable ? 'Yes' : 'No' }}</span></div>
                              </div>

                              <div v-if="childReferenceDetails[child.id].accountantReference.tax_liabilities_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Tax Liabilities Details:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].accountantReference.tax_liabilities_details }}</p>
                              </div>
                            </div>

                            <!-- Assessment -->
                            <div>
                              <h6 class="text-xs font-semibold text-green-800 mb-2">Assessment</h6>
                              <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-green-700 font-medium">Income Confirmed:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].accountantReference.accountant_confirms_income ? 'Yes' : 'No' }}</span></div>
                                <div><span class="text-green-700 font-medium">Would Recommend:</span> <span class="text-green-900 font-semibold">{{ childReferenceDetails[child.id].accountantReference.would_recommend ? 'Yes' : 'No' }}</span></div>
                              </div>

                              <div v-if="childReferenceDetails[child.id].accountantReference.recommendation_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                                <span class="text-green-700 font-medium text-xs">Recommendation Comments:</span>
                                <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].accountantReference.recommendation_comments }}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else-if="childReferenceDetails[child.id].reference.accountant_email" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p class="text-sm text-blue-800">
                          Waiting for accountant reference from {{ childReferenceDetails[child.id].reference.accountant_email }}
                        </p>
                      </div>
                    </div>

                    <!-- Savings, Pensions or Investments Details -->
                    <div v-if="childReferenceDetails[child.id].reference.income_savings_pension_investments" class="border-t pt-6">
                      <h6 class="text-sm font-semibold text-gray-900 mb-4">Savings, Pensions or Investments</h6>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Total Savings Amount</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.savings_amount ? `£${childReferenceDetails[child.id].reference.savings_amount.toLocaleString()}` : 'Not provided' }}</p>
                        </div>
                      </div>

                      <!-- Proof of Funds Document -->
                      <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Funds</label>
                        <div v-if="childReferenceDetails[child.id].reference.proof_of_funds_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                          <div class="flex items-center">
                            <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span class="text-sm text-gray-900">Proof of Funds</span>
                          </div>
                          <div class="flex gap-2">
                            <button
                              @click="viewFile(childReferenceDetails[child.id].reference.proof_of_funds_path)"
                              class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                            >
                              View
                            </button>
                          </div>
                        </div>
                        <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                          Proof of funds not uploaded yet
                        </div>
                      </div>
                    </div>

                    <!-- Additional Income -->
                    <div v-if="childReferenceDetails[child.id].reference.has_additional_income" class="mt-6 pt-6 border-t">
                      <h6 class="text-sm font-semibold text-gray-900 mb-4">Additional Income</h6>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Source</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.additional_income_source || 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Amount</label>
                          <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.additional_income_amount ? `£${childReferenceDetails[child.id].reference.additional_income_amount}` : 'Not provided' }}</p>
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-500">Frequency</label>
                          <p class="mt-1 text-gray-900 capitalize">{{ childReferenceDetails[child.id].reference.additional_income_frequency || 'Not provided' }}</p>
                        </div>
                      </div>

                      <!-- Proof of Additional Income Document -->
                      <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Additional Income</label>
                        <div v-if="childReferenceDetails[child.id].reference.proof_of_additional_income_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                          <div class="flex items-center">
                            <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span class="text-sm text-gray-900">Proof of Additional Income</span>
                          </div>
                          <div class="flex gap-2">
                            <button
                              @click="viewFile(childReferenceDetails[child.id].reference.proof_of_additional_income_path)"
                              class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                            >
                              View
                            </button>
                          </div>
                        </div>
                        <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                          Proof of additional income not uploaded yet
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- About the Tenant -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">About the Tenant</h5>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Smoker</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.is_smoker === true ? 'Yes' : childReferenceDetails[child.id].reference.is_smoker === false ? 'No' : 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Pets</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.has_pets ? 'Yes' : 'No' }}</p>
                      </div>
                      <div v-if="childReferenceDetails[child.id].reference.has_pets" class="col-span-2">
                        <label class="block text-sm font-medium text-gray-500">Pet Details</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.pet_details || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Marital Status</label>
                        <p class="mt-1 text-gray-900 capitalize">{{ childReferenceDetails[child.id].reference.marital_status?.replace('_', ' ') || 'Not provided' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Number of Dependants</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.number_of_dependants || 0 }}</p>
                      </div>
                      <div v-if="childReferenceDetails[child.id].reference.number_of_dependants > 0" class="col-span-2">
                        <label class="block text-sm font-medium text-gray-500">Dependants Details</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.dependants_details || 'Not provided' }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Previous Landlord/Agent Reference -->
                  <div class="bg-white rounded-lg shadow p-6">
                    <h5 class="text-md font-semibold text-gray-900 mb-4">Previous Landlord/Agent Information</h5>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-500">{{ childReferenceDetails[child.id].reference.reference_type === 'agent' ? 'Agent' : 'Landlord' }} Name</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.previous_landlord_name || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Email</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.previous_landlord_email || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Phone</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.previous_landlord_phone || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Previous Address</label>
                        <p class="mt-1 text-gray-900">
                          {{ [childReferenceDetails[child.id].reference.previous_rental_address_line1, childReferenceDetails[child.id].reference.previous_rental_address_line2].filter(Boolean).join(', ') || 'Not provided yet' }}
                        </p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Previous City</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.previous_rental_city || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Previous Postcode</label>
                        <p class="mt-1 text-gray-900">{{ childReferenceDetails[child.id].reference.previous_rental_postcode || 'Not provided yet' }}</p>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-500">Tenancy Duration</label>
                        <p class="mt-1 text-gray-900">{{ formatTenancyDuration(childReferenceDetails[child.id].reference.tenancy_years, childReferenceDetails[child.id].reference.tenancy_months) }}</p>
                      </div>
                    </div>

                    <!-- Landlord Reference -->
                    <div v-if="childReferenceDetails[child.id].landlordReference && childReferenceDetails[child.id].reference.reference_type === 'landlord'" class="mt-6 bg-green-50 border border-green-200 rounded-lg">
                      <div class="p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h6 class="text-sm font-semibold text-green-900">✓ Landlord Reference Completed</h6>
                          <span class="text-xs text-green-700">Submitted {{ formatDateTime(childReferenceDetails[child.id].landlordReference.submitted_at) }}</span>
                        </div>

                        <div class="space-y-4">
                          <!-- Landlord Contact Info -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Landlord Contact Information</h6>
                            <div class="grid grid-cols-2 gap-3 text-sm">
                              <div><span class="text-green-700 font-medium">Name:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].landlordReference.landlord_name }}</span></div>
                              <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].landlordReference.landlord_email }}</span></div>
                              <div><span class="text-green-700 font-medium">Phone:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].landlordReference.landlord_phone }}</span></div>
                            </div>
                          </div>

                          <!-- Property & Tenancy Details -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Property & Tenancy Details</h6>
                            <div class="grid grid-cols-2 gap-3 text-sm">
                              <div class="col-span-2">
                                <span class="text-green-700 font-medium">Property:</span>
                                <span class="text-green-900">
                                  {{ [childReferenceDetails[child.id].landlordReference.property_address_line1, childReferenceDetails[child.id].landlordReference.property_address_line2].filter(Boolean).join(', ') || childReferenceDetails[child.id].landlordReference.property_address }}
                                </span>
                              </div>
                              <div><span class="text-green-700 font-medium">City:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].landlordReference.property_city }}</span></div>
                              <div><span class="text-green-700 font-medium">Postcode:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].landlordReference.property_postcode }}</span></div>
                              <div><span class="text-green-700 font-medium">Tenancy Start:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].landlordReference.tenancy_start_date) }}</span></div>
                              <div><span class="text-green-700 font-medium">Tenancy End:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].landlordReference.tenancy_end_date) }}</span></div>
                              <div><span class="text-green-700 font-medium">Monthly Rent:</span> <span class="text-green-900">£{{ childReferenceDetails[child.id].landlordReference.monthly_rent }}</span></div>
                            </div>
                          </div>

                          <!-- Reference Assessment -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Reference Assessment</h6>
                            <div class="space-y-3">
                              <div v-if="childReferenceDetails[child.id].landlordReference.address_correct">
                                <span class="text-green-700 font-medium text-sm">Address Correct:</span>
                                <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].landlordReference.address_correct }}</span>
                              </div>

                              <div v-if="childReferenceDetails[child.id].landlordReference.tenancy_length_months">
                                <span class="text-green-700 font-medium text-sm">Tenancy Length:</span>
                                <span class="ml-2 text-green-900">{{ childReferenceDetails[child.id].landlordReference.tenancy_length_months }} months</span>
                              </div>

                              <div v-if="childReferenceDetails[child.id].landlordReference.monthly_rent_confirm">
                                <span class="text-green-700 font-medium text-sm">Monthly Rent (Confirmed):</span>
                                <span class="ml-2 text-green-900">£{{ childReferenceDetails[child.id].landlordReference.monthly_rent_confirm }}</span>
                              </div>

                              <div>
                                <span class="text-green-700 font-medium text-sm">Rent Paid On Time:</span>
                                <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].landlordReference.rent_paid_on_time }}</span>
                              </div>

                              <div v-if="childReferenceDetails[child.id].landlordReference.good_tenant">
                                <span class="text-green-700 font-medium text-sm">Good Tenant:</span>
                                <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].landlordReference.good_tenant }}</span>
                              </div>

                              <div>
                                <span class="text-green-700 font-medium text-sm">Would Rent Again:</span>
                                <span class="ml-2 text-green-900 capitalize font-semibold">{{ childReferenceDetails[child.id].landlordReference.would_rent_again }}</span>
                              </div>
                            </div>

                            <div v-if="childReferenceDetails[child.id].landlordReference.additional_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                              <span class="text-green-700 font-medium text-xs">Additional Comments:</span>
                              <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].landlordReference.additional_comments }}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Agent Reference -->
                    <div v-if="childReferenceDetails[child.id].agentReference && childReferenceDetails[child.id].reference.reference_type === 'agent'" class="mt-6 bg-green-50 border border-green-200 rounded-lg">
                      <div class="p-4">
                        <div class="flex items-center justify-between mb-4">
                          <h6 class="text-sm font-semibold text-green-900">✓ Letting Agent Reference Completed</h6>
                          <span class="text-xs text-green-700">Submitted {{ formatDateTime(childReferenceDetails[child.id].agentReference.submitted_at) }}</span>
                        </div>

                        <div class="space-y-4">
                          <!-- Agent Contact Information -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Agent Contact Information</h6>
                            <div class="grid grid-cols-2 gap-3 text-sm">
                              <div><span class="text-green-700 font-medium">Name:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.agent_name }}</span></div>
                              <div v-if="childReferenceDetails[child.id].agentReference.agency_name"><span class="text-green-700 font-medium">Agency:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.agency_name }}</span></div>
                              <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.agent_email }}</span></div>
                              <div><span class="text-green-700 font-medium">Phone:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.agent_phone }}</span></div>
                            </div>
                          </div>

                          <!-- Property & Tenancy Details -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Property & Tenancy Details</h6>
                            <div class="grid grid-cols-2 gap-3 text-sm">
                              <div class="col-span-2">
                                <span class="text-green-700 font-medium">Property:</span>
                                <span class="text-green-900">
                                  {{ [childReferenceDetails[child.id].agentReference.property_address_line1, childReferenceDetails[child.id].agentReference.property_address_line2].filter(Boolean).join(', ') || childReferenceDetails[child.id].agentReference.property_address }}
                                </span>
                              </div>
                              <div><span class="text-green-700 font-medium">City:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.property_city }}</span></div>
                              <div><span class="text-green-700 font-medium">Postcode:</span> <span class="text-green-900">{{ childReferenceDetails[child.id].agentReference.property_postcode }}</span></div>
                              <div><span class="text-green-700 font-medium">Tenancy Start:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].agentReference.tenancy_start_date) }}</span></div>
                              <div><span class="text-green-700 font-medium">Tenancy End:</span> <span class="text-green-900">{{ formatDate(childReferenceDetails[child.id].agentReference.tenancy_end_date) }}</span></div>
                              <div><span class="text-green-700 font-medium">Monthly Rent:</span> <span class="text-green-900">£{{ childReferenceDetails[child.id].agentReference.monthly_rent }}</span></div>
                            </div>
                          </div>

                          <!-- Reference Assessment -->
                          <div>
                            <h6 class="text-xs font-semibold text-green-800 mb-2">Reference Assessment</h6>
                            <div class="space-y-3">
                              <div>
                                <div class="mb-1">
                                  <span class="text-green-700 font-medium text-sm">Rent Paid On Time:</span>
                                  <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].agentReference.rent_paid_on_time }}</span>
                                </div>
                                <div v-if="childReferenceDetails[child.id].agentReference.rent_paid_on_time_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 text-xs italic">
                                  {{ childReferenceDetails[child.id].agentReference.rent_paid_on_time_details }}
                                </div>
                              </div>

                              <div>
                                <div class="mb-1">
                                  <span class="text-green-700 font-medium text-sm">Property Condition:</span>
                                  <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].agentReference.property_condition }}</span>
                                </div>
                                <div v-if="childReferenceDetails[child.id].agentReference.property_condition_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 text-xs italic">
                                  {{ childReferenceDetails[child.id].agentReference.property_condition_details }}
                                </div>
                              </div>

                              <div>
                                <div class="mb-1">
                                  <span class="text-green-700 font-medium text-sm">Neighbour Complaints:</span>
                                  <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].agentReference.neighbour_complaints }}</span>
                                </div>
                                <div v-if="childReferenceDetails[child.id].agentReference.neighbour_complaints_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 text-xs italic">
                                  {{ childReferenceDetails[child.id].agentReference.neighbour_complaints_details }}
                                </div>
                              </div>

                              <div>
                                <div class="mb-1">
                                  <span class="text-green-700 font-medium text-sm">Breach of Tenancy:</span>
                                  <span class="ml-2 text-green-900 capitalize">{{ childReferenceDetails[child.id].agentReference.breach_of_tenancy }}</span>
                                </div>
                                <div v-if="childReferenceDetails[child.id].agentReference.breach_of_tenancy_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 text-xs italic">
                                  {{ childReferenceDetails[child.id].agentReference.breach_of_tenancy_details }}
                                </div>
                              </div>

                              <div>
                                <div class="mb-1">
                                  <span class="text-green-700 font-medium text-sm">Would Rent Again:</span>
                                  <span class="ml-2 text-green-900 capitalize font-semibold">{{ childReferenceDetails[child.id].agentReference.would_rent_again }}</span>
                                </div>
                                <div v-if="childReferenceDetails[child.id].agentReference.would_rent_again_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 text-xs italic">
                                  {{ childReferenceDetails[child.id].agentReference.would_rent_again_details }}
                                </div>
                              </div>
                            </div>

                            <div v-if="childReferenceDetails[child.id].agentReference.additional_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                              <span class="text-green-700 font-medium text-xs">Additional Comments:</span>
                              <p class="text-green-900 text-xs mt-1">{{ childReferenceDetails[child.id].agentReference.additional_comments }}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="childReferenceDetails[child.id].reference.previous_landlord_email && !childReferenceDetails[child.id].landlordReference && !childReferenceDetails[child.id].agentReference" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p class="text-sm text-blue-800">
                        Waiting for {{ childReferenceDetails[child.id].reference.reference_type === 'agent' ? 'letting agent' : 'landlord' }} reference
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Loading State -->
                <div v-else class="flex items-center justify-center py-8">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span class="ml-3 text-sm text-gray-600">Loading details...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Property Information (from initial reference creation) -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Property Information</h3>
            <button
              v-if="!editingMoveInDate"
              @click="startEditingMoveInDate"
              class="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Edit Move-in Date
            </button>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Property Address</label>
              <p class="mt-1 text-gray-900">{{ reference.property_address }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">City</label>
              <p class="mt-1 text-gray-900">{{ reference.property_city || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.property_postcode || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Monthly Rent</label>
              <p class="mt-1 text-gray-900">{{ reference.monthly_rent ? `£${reference.monthly_rent}` : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Move-in Date</label>
              <div v-if="editingMoveInDate" class="mt-1">
                <DatePicker
                  v-model="editedMoveInDate"
                  label=""
                  :required="true"
                  year-range-type="move-in"
                />
                <div class="flex gap-2 mt-2">
                  <button
                    @click="saveMoveInDate"
                    :disabled="savingMoveInDate"
                    class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
                  >
                    {{ savingMoveInDate ? 'Saving...' : 'Save' }}
                  </button>
                  <button
                    @click="cancelEditingMoveInDate"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p v-else class="mt-1 text-gray-900">{{ reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Personal Details -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Personal Details</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">First Name</label>
              <p class="mt-1 text-gray-900">{{ reference.first_name || reference.tenant_first_name || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Middle Name</label>
              <p class="mt-1 text-gray-900">{{ reference.middle_name || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Last Name</label>
              <p class="mt-1 text-gray-900">{{ reference.last_name || reference.tenant_last_name || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Date of Birth</label>
              <p class="mt-1 text-gray-900">{{ reference.date_of_birth ? formatDate(reference.date_of_birth) : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Email</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_email }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Contact Number</label>
              <p class="mt-1 text-gray-900">{{ reference.contact_number || reference.tenant_phone || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Nationality</label>
              <p class="mt-1 text-gray-900">{{ reference.nationality || 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Identification Documents -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Identification Documents</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Document Type</label>
              <p class="mt-1 text-gray-900 capitalize">{{ reference.id_document_type ? reference.id_document_type.replace('_', ' ') : 'Not provided' }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div v-if="reference.id_document_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-gray-900">ID Document</span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="viewFile(reference.id_document_path)"
                  class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                >
                  View
                </button>
              </div>
            </div>
            <div v-if="reference.selfie_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-gray-900">Selfie Verification</span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="viewFile(reference.selfie_path)"
                  class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                >
                  View
                </button>
              </div>
            </div>
            <div v-if="!reference.id_document_path && !reference.selfie_path" class="text-gray-500 text-center py-4">
              No identification documents uploaded yet
            </div>
          </div>
        </div>

        <!-- Consent Declaration -->
        <div v-if="!reference.is_group_parent && reference.consent_pdf_path" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Consent Declaration</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Agreed On</label>
                <p class="mt-1 text-gray-900">{{ reference.consent_agreed_date ? new Date(reference.consent_agreed_date).toLocaleDateString('en-GB') : 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Printed Name</label>
                <p class="mt-1 text-gray-900">{{ reference.consent_printed_name || 'Not provided' }}</p>
              </div>
            </div>

            <!-- Consent PDF -->
            <div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-gray-900">Signed Consent Declaration</span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="viewFile(reference.consent_pdf_path)"
                  class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                >
                  View PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Current Address -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Current Address</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-500">Address Line 1</label>
              <p class="mt-1 text-gray-900">{{ reference.current_address_line1 || 'Not provided yet' }}</p>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-500">Address Line 2</label>
              <p class="mt-1 text-gray-900">{{ reference.current_address_line2 || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">City</label>
              <p class="mt-1 text-gray-900">{{ reference.current_city || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.current_postcode || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Country</label>
              <p class="mt-1 text-gray-900">{{ reference.current_country ? getCountryName(reference.current_country) : 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Time at Address</label>
              <p class="mt-1 text-gray-900">
                <span v-if="reference.time_at_address_years !== null || reference.time_at_address_months !== null">
                  {{ reference.time_at_address_years || 0 }} year{{ reference.time_at_address_years !== 1 ? 's' : '' }},
                  {{ reference.time_at_address_months || 0 }} month{{ reference.time_at_address_months !== 1 ? 's' : '' }}
                </span>
                <span v-else>Not provided yet</span>
              </p>
            </div>
          </div>

          <!-- Proof of Address Document -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Address Document</label>
            <div v-if="reference.proof_of_address_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-sm text-gray-900">Proof of Address</span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="viewFile(reference.proof_of_address_path)"
                  class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                >
                  View
                </button>
              </div>
            </div>
            <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              Proof of address document not uploaded yet
            </div>
          </div>

          <!-- Previous Address History (3-year history) -->
          <div v-if="previousAddresses.length > 0" class="mt-6 pt-6 border-t">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Previous Address History</h4>
            <p class="text-xs text-gray-500 mb-4">Previous addresses provided to meet 3-year address history requirement</p>

            <div v-for="(address, index) in previousAddresses" :key="address.id" class="mb-4 p-4 bg-gray-50 rounded-lg">
              <h5 class="text-sm font-semibold text-gray-900 mb-3">Previous Address {{ index + 1 }}</h5>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500">Address</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ address.address_line1 }}
                    <span v-if="address.address_line2">, {{ address.address_line2 }}</span>
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500">City</label>
                  <p class="mt-1 text-sm text-gray-900">{{ address.city }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500">Postcode</label>
                  <p class="mt-1 text-sm text-gray-900">{{ address.postcode }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500">Country</label>
                  <p class="mt-1 text-sm text-gray-900">{{ getCountryName(address.country) }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500">Time at Address</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ address.time_at_address_years || 0 }} year{{ address.time_at_address_years !== 1 ? 's' : '' }},
                    {{ address.time_at_address_months || 0 }} month{{ address.time_at_address_months !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Financial Information -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Financial Information</h3>

          <!-- Income Sources -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">Income Sources</label>
            <div class="flex flex-wrap gap-2">
              <span v-if="reference.income_regular_employment" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Employed</span>
              <span v-if="reference.income_self_employed" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Self Employed</span>
              <span v-if="reference.income_benefits" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Benefits</span>
              <span v-if="reference.income_savings_pension_investments" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Savings/Pension/Investments</span>
              <span v-if="reference.income_student" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Student</span>
              <span v-if="reference.income_unemployed" class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Unemployed</span>
              <span v-if="!reference.income_regular_employment && !reference.income_self_employed && !reference.income_benefits && !reference.income_savings_pension_investments && !reference.income_student && !reference.income_unemployed" class="text-gray-500 text-sm">Not provided yet</span>
            </div>
          </div>

          <!-- Employment Details -->
          <div v-if="reference.income_regular_employment" class="border-t pt-6">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Employment Details</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Employment Type</label>
                <p class="mt-1 text-gray-900 capitalize">{{ reference.employment_contract_type?.replace(/-/g, ' ') || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Employment Start Date</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_start_date ? formatDate(reference.employment_start_date) : 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Compensation Type</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_is_hourly ? 'Hourly' : 'Salary' }}</p>
              </div>
              <div v-if="reference.employment_is_hourly">
                <label class="block text-sm font-medium text-gray-500">Hourly Rate</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_salary_amount ? `£${reference.employment_salary_amount}/hour` : 'Not provided' }}</p>
              </div>
              <div v-if="reference.employment_is_hourly">
                <label class="block text-sm font-medium text-gray-500">Hours per Month</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_hours_per_month || 'Not provided' }}</p>
              </div>
              <div v-if="!reference.employment_is_hourly">
                <label class="block text-sm font-medium text-gray-500">Annual Salary</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_salary_amount ? `£${reference.employment_salary_amount}` : 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Job Title</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_job_title || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Company Name</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_company_name || 'Not provided' }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-500">Company Address</label>
                <p class="mt-1 text-gray-900">
                  {{ reference.employment_company_address_line1 || 'Not provided' }}
                  <span v-if="reference.employment_company_address_line2">, {{ reference.employment_company_address_line2 }}</span>
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Company City</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_company_city || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Company Postcode</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_company_postcode || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Company Country</label>
                <p class="mt-1 text-gray-900">{{ reference.employment_company_country ? getCountryName(reference.employment_company_country) : 'Not provided' }}</p>
              </div>
            </div>

            <!-- Payslips -->
            <div class="mt-6">
              <label class="block text-sm font-medium text-gray-700 mb-3">Payslips (Last 3 months)</label>
              <div v-if="reference.payslip_files?.length" class="space-y-2">
                <div v-for="(file, index) in reference.payslip_files" :key="index"
                     class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm text-gray-900">Payslip {{ index + 1 }}</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="viewFile(file)"
                      class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                Payslips not uploaded yet
              </div>
            </div>

            <!-- Employer Reference Contact -->
            <div class="mt-6 pt-6 border-t">
              <h5 class="text-sm font-semibold text-gray-700 mb-3">Employer Reference Contact</h5>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500">Position</label>
                  <p class="mt-1 text-gray-900">{{ reference.employer_ref_position || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Name</label>
                  <p class="mt-1 text-gray-900">{{ reference.employer_ref_name || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Email</label>
                  <p class="mt-1 text-gray-900">{{ reference.employer_ref_email || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Phone</label>
                  <p class="mt-1 text-gray-900">{{ reference.employer_ref_phone || 'Not provided' }}</p>
                </div>
              </div>

              <!-- Employer Reference Status -->
              <div v-if="reference.employer_ref_email && !employerReference" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 class="text-sm font-semibold text-blue-900 mb-2">Employer Reference</h4>
                <p class="text-sm text-blue-800">
                  An email has been sent to the employer to complete their reference.
                </p>
              </div>

              <!-- Employer Reference Submitted -->
              <div v-if="employerReference" class="mt-4 bg-green-50 border border-green-200 rounded-lg">
                <div class="p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-lg font-semibold text-green-900">✓ Employer Reference Completed</h4>
                    <span class="text-xs text-green-700">Submitted {{ formatDateTime(employerReference.submitted_at) }}</span>
                  </div>

                  <div class="space-y-6">
                    <!-- Company Info -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Company Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Company:</span> <span class="text-green-900">{{ employerReference.company_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Contact:</span> <span class="text-green-900">{{ employerReference.employer_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Position:</span> <span class="text-green-900">{{ employerReference.employer_position }}</span></div>
                        <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ employerReference.employer_email }}</span></div>
                      </div>
                    </div>

                    <!-- Employment Details -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Employment Details</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Position:</span> <span class="text-green-900">{{ employerReference.employee_position }}</span></div>
                        <div><span class="text-green-700 font-medium">Type:</span> <span class="text-green-900">{{ employerReference.employment_type }}</span></div>
                        <div><span class="text-green-700 font-medium">Start Date:</span> <span class="text-green-900">{{ formatDate(employerReference.employment_start_date) }}</span></div>
                        <div v-if="employerReference.employment_end_date"><span class="text-green-700 font-medium">End Date:</span> <span class="text-green-900">{{ formatDate(employerReference.employment_end_date) }}</span></div>
                        <div><span class="text-green-700 font-medium">Currently Employed:</span> <span class="text-green-900">{{ employerReference.is_current_employee ? 'Yes' : 'No' }}</span></div>
                      </div>
                    </div>

                    <!-- Salary Info -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Compensation</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Salary:</span> <span class="text-green-900">£{{ employerReference.annual_salary }} ({{ employerReference.salary_frequency }})</span></div>
                        <div><span class="text-green-700 font-medium">Probation:</span> <span class="text-green-900">{{ employerReference.is_probation === 'yes' ? 'Yes' : 'No' }}</span></div>
                        <div v-if="employerReference.is_probation === 'yes' && employerReference.probation_end_date"><span class="text-green-700 font-medium">Probation End Date:</span> <span class="text-green-900">{{ formatDate(employerReference.probation_end_date) }}</span></div>
                      </div>
                    </div>

                    <!-- Employment Confirmation -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Employment Confirmation</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Details Verified:</span> <span class="text-green-900">{{ employerReference.employment_status }}</span></div>
                        <div><span class="text-green-700 font-medium">Contract Type:</span> <span class="text-green-900 capitalize">{{ employerReference.contract_type_confirmation || 'Not provided' }}</span></div>
                        <div><span class="text-green-700 font-medium">Income Expectation:</span> <span class="text-green-900 capitalize">{{ employerReference.income_expectation || 'Not provided' }}</span></div>
                        <div><span class="text-green-700 font-medium">Position Security:</span> <span class="text-green-900 capitalize">{{ employerReference.employment_stable || 'Not provided' }}</span></div>
                      </div>

                      <div v-if="employerReference.clarification_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Clarification Notes:</span>
                        <p class="text-green-900 text-sm mt-1">{{ employerReference.clarification_details }}</p>
                      </div>

                      <div v-if="employerReference.income_expectation_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Income Change Details:</span>
                        <p class="text-green-900 text-sm mt-1">{{ employerReference.income_expectation_details }}</p>
                      </div>

                      <div v-if="employerReference.employment_stable_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Position Security Details:</span>
                        <p class="text-green-900 text-sm mt-1">{{ employerReference.employment_stable_details }}</p>
                      </div>

                      <div v-if="employerReference.additional_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Additional Comments:</span>
                        <p class="text-green-900 text-sm mt-1">{{ employerReference.additional_comments }}</p>
                      </div>
                    </div>

                    <!-- Signature -->
                    <div class="pt-3 border-t border-green-300">
                      <div class="space-y-3">
                        <div>
                          <span class="text-green-700 font-medium text-sm">Signature:</span>
                          <div class="mt-2 p-3 bg-white rounded border border-green-200">
                            <div v-if="employerReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                              {{ employerReference.signature_name }}
                            </div>
                            <img :src="employerReference.signature" alt="Signature" class="max-w-md h-auto" />
                          </div>
                        </div>
                        <div>
                          <span class="text-green-700 font-medium text-sm">Date:</span>
                          <span class="ml-2 text-green-900">{{ formatDate(employerReference.date) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Employment Verification Comparison -->
          <div v-if="reference.income_regular_employment && employerReference" class="bg-white rounded-lg shadow p-6 mt-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Employment Data Verification</h4>
            <p class="text-sm text-gray-600 mb-4">Comparison of tenant-provided information with employer-confirmed details</p>
            <ComparisonTable
              :rows="employmentComparisonRows"
              tenant-column-label="Tenant Provided"
              reference-column-label="Employer Confirmed"
            />
          </div>

          <!-- Self-Employed & Accountant Details -->
          <div v-if="reference.income_self_employed" class="border-t pt-6">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Self-Employed Details</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Business Name</label>
                <p class="mt-1 text-gray-900">{{ reference.self_employed_business_name || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Business Start Date</label>
                <p class="mt-1 text-gray-900">{{ reference.self_employed_start_date ? formatDate(reference.self_employed_start_date) : 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Nature of Business</label>
                <p class="mt-1 text-gray-900">{{ reference.self_employed_nature_of_business || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Annual Income</label>
                <p class="mt-1 text-gray-900">{{ reference.self_employed_annual_income ? `£${reference.self_employed_annual_income}` : 'Not provided' }}</p>
              </div>
            </div>

            <!-- Accountant Contact -->
            <div class="mt-6 pt-6 border-t">
              <h5 class="text-sm font-semibold text-gray-700 mb-3">Accountant Contact</h5>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500">Accountant/Firm Name</label>
                  <p class="mt-1 text-gray-900">{{ reference.accountant_name || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Contact Name</label>
                  <p class="mt-1 text-gray-900">{{ reference.accountant_contact_name || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Email</label>
                  <p class="mt-1 text-gray-900">{{ reference.accountant_email || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500">Phone</label>
                  <p class="mt-1 text-gray-900">{{ reference.accountant_phone || 'Not provided' }}</p>
                </div>
              </div>

              <!-- Accountant Reference Status -->
              <div v-if="reference.accountant_email && (!accountantReference || !accountantReference.submitted_at)" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 class="text-sm font-semibold text-blue-900 mb-2">Accountant Reference</h4>
                <p class="text-sm text-blue-800">
                  An email has been sent to the accountant to complete their reference.
                </p>
              </div>

              <!-- Accountant Reference Submitted -->
              <div v-if="accountantReference && accountantReference.submitted_at" class="mt-4 bg-green-50 border border-green-200 rounded-lg">
                <div class="p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-lg font-semibold text-green-900">✓ Accountant Reference Completed</h4>
                    <span class="text-xs text-green-700">Submitted {{ formatDateTime(accountantReference.submitted_at) }}</span>
                  </div>

                  <div class="space-y-4">
                    <!-- Accountant Information -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Accountant Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Name:</span> <span class="text-green-900">{{ accountantReference.accountant_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Firm:</span> <span class="text-green-900">{{ accountantReference.firm_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{ accountantReference.accountant_email }}</span></div>
                        <div><span class="text-green-700 font-medium">Phone:</span> <span class="text-green-900">{{ accountantReference.accountant_phone }}</span></div>
                      </div>
                    </div>

                    <!-- Business Details -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Business Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Business Name:</span> <span class="text-green-900">{{ accountantReference.business_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Trading Status:</span> <span class="text-green-900 capitalize">{{ accountantReference.business_trading_status }}</span></div>
                        <div><span class="text-green-700 font-medium">Start Date:</span> <span class="text-green-900">{{ formatDate(accountantReference.business_start_date) }}</span></div>
                        <div><span class="text-green-700 font-medium">Nature:</span> <span class="text-green-900">{{ accountantReference.nature_of_business }}</span></div>
                      </div>
                    </div>

                    <!-- Financial Details -->
                    <div class="pt-3 border-t border-green-200">
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Financial Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Annual Turnover:</span> <span class="text-green-900">£{{ accountantReference.annual_turnover?.toLocaleString() }}</span></div>
                        <div><span class="text-green-700 font-medium">Annual Profit:</span> <span class="text-green-900">£{{ accountantReference.annual_profit?.toLocaleString() }}</span></div>
                        <div><span class="text-green-700 font-medium">Tax Returns Filed:</span> <span class="text-green-900">{{ accountantReference.tax_returns_filed ? 'Yes' : 'No' }}</span></div>
                        <div v-if="accountantReference.last_tax_return_date"><span class="text-green-700 font-medium">Last Tax Return:</span> <span class="text-green-900">{{ formatDate(accountantReference.last_tax_return_date) }}</span></div>
                        <div><span class="text-green-700 font-medium">Accounts Prepared:</span> <span class="text-green-900">{{ accountantReference.accounts_prepared ? 'Yes' : 'No' }}</span></div>
                        <div v-if="accountantReference.accounts_year_end"><span class="text-green-700 font-medium">Accounts Year End:</span> <span class="text-green-900">{{ formatDate(accountantReference.accounts_year_end) }}</span></div>
                        <div><span class="text-green-700 font-medium">Tax Liabilities:</span> <span class="text-green-900">{{ accountantReference.any_outstanding_tax_liabilities ? 'Yes' : 'No' }}</span></div>
                        <div><span class="text-green-700 font-medium">Financially Stable:</span> <span class="text-green-900 font-semibold">{{ accountantReference.business_financially_stable ? 'Yes' : 'No' }}</span></div>
                      </div>

                      <div v-if="accountantReference.tax_liabilities_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Tax Liabilities Details:</span>
                        <p class="text-green-900 text-sm mt-1">{{ accountantReference.tax_liabilities_details }}</p>
                      </div>
                    </div>

                    <!-- Assessment -->
                    <div class="pt-3 border-t border-green-200">
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Assessment</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Income Confirmed:</span> <span class="text-green-900 font-semibold">{{ accountantReference.accountant_confirms_income ? 'Yes' : 'No' }}</span></div>
                        <div><span class="text-green-700 font-medium">Est. Monthly Income:</span> <span class="text-green-900">£{{ accountantReference.estimated_monthly_income?.toLocaleString() }}</span></div>
                        <div class="col-span-2"><span class="text-green-700 font-medium">Would Recommend:</span> <span class="text-green-900 font-semibold">{{ accountantReference.would_recommend ? 'Yes' : 'No' }}</span></div>
                      </div>

                      <div v-if="accountantReference.recommendation_comments" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Recommendation Comments:</span>
                        <p class="text-green-900 text-sm mt-1">{{ accountantReference.recommendation_comments }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Self-Employment Verification Comparison -->
          <div v-if="reference.income_self_employed && accountantReference && accountantReference.submitted_at" class="bg-white rounded-lg shadow p-6 mt-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">Business Data Verification</h4>
            <p class="text-sm text-gray-600 mb-4">Comparison of tenant-provided information with accountant-confirmed details</p>
            <ComparisonTable
              :rows="accountantComparisonRows"
              tenant-column-label="Tenant Provided"
              reference-column-label="Accountant Confirmed"
            />
          </div>

          <!-- Savings, Pensions or Investments Details -->
          <div v-if="reference.income_savings_pension_investments" class="border-t pt-6">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Savings, Pensions or Investments</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Total Savings Amount</label>
                <p class="mt-1 text-gray-900">{{ reference.savings_amount ? `£${reference.savings_amount.toLocaleString()}` : 'Not provided' }}</p>
              </div>
            </div>

            <!-- Proof of Funds Document -->
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Funds</label>
              <div v-if="reference.proof_of_funds_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-900">Proof of Funds</span>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="viewFile(reference.proof_of_funds_path)"
                    class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                  >
                    View
                  </button>
                </div>
              </div>
              <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                Proof of funds not uploaded yet
              </div>
            </div>
          </div>

          <!-- Additional Income -->
          <div v-if="reference.has_additional_income" class="mt-6 pt-6 border-t">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Additional Income</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Source</label>
                <p class="mt-1 text-gray-900">{{ reference.additional_income_source || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Amount</label>
                <p class="mt-1 text-gray-900">{{ reference.additional_income_amount ? `£${reference.additional_income_amount}` : 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Frequency</label>
                <p class="mt-1 text-gray-900 capitalize">{{ reference.additional_income_frequency || 'Not provided' }}</p>
              </div>
            </div>

            <!-- Proof of Additional Income Document -->
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Proof of Additional Income</label>
              <div v-if="reference.proof_of_additional_income_path" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-900">Proof of Additional Income</span>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="viewFile(reference.proof_of_additional_income_path)"
                    class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                  >
                    View
                  </button>
                </div>
              </div>
              <div v-else class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                Proof of additional income not uploaded yet
              </div>
            </div>
          </div>

          <!-- Adverse Credit -->
          <div v-if="reference.has_adverse_credit" class="mt-6 pt-6 border-t">
            <h4 class="text-md font-semibold text-gray-900 mb-4">Adverse Credit History</h4>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-sm text-yellow-900">{{ reference.adverse_credit_details || 'Details not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- About the Tenant -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">About the Tenant</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Smoker</label>
              <p class="mt-1 text-gray-900">{{ reference.is_smoker === true ? 'Yes' : reference.is_smoker === false ? 'No' : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Pets</label>
              <p class="mt-1 text-gray-900">{{ reference.has_pets ? 'Yes' : 'No' }}</p>
            </div>
            <div v-if="reference.has_pets" class="col-span-2">
              <label class="block text-sm font-medium text-gray-500">Pet Details</label>
              <p class="mt-1 text-gray-900">{{ reference.pet_details || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Marital Status</label>
              <p class="mt-1 text-gray-900 capitalize">{{ reference.marital_status?.replace('_', ' ') || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Number of Dependants</label>
              <p class="mt-1 text-gray-900">{{ reference.number_of_dependants || 0 }}</p>
            </div>
            <div v-if="reference.number_of_dependants > 0" class="col-span-2">
              <label class="block text-sm font-medium text-gray-500">Dependants Details</label>
              <p class="mt-1 text-gray-900">{{ reference.dependants_details || 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Previous Landlord Information -->
        <div v-if="!reference.is_group_parent" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Previous Landlord Information</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Name</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_name || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Email</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_email || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_phone || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Address</label>
              <p class="mt-1 text-gray-900">
                {{ [reference.previous_rental_address_line1, reference.previous_rental_address_line2].filter(Boolean).join(', ') || 'Not provided yet' }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous City</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_rental_city || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_rental_postcode || 'Not provided yet' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Tenancy Duration</label>
              <p class="mt-1 text-gray-900">{{ formatTenancyDuration(reference.tenancy_years, reference.tenancy_months) }}</p>
            </div>
          </div>

          <!-- Landlord Reference Status -->
          <div v-if="reference.previous_landlord_email && reference.reference_type === 'landlord' && !landlordReference" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="text-sm font-semibold text-purple-900 mb-2">Landlord Reference</h4>
            <p class="text-sm text-purple-800">
              Waiting for landlord reference to be submitted.
            </p>
          </div>

          <!-- Agent Reference Status -->
          <div v-if="reference.previous_landlord_email && reference.reference_type === 'agent' && !agentReference" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="text-sm font-semibold text-purple-900 mb-2">Letting Agent Reference</h4>
            <p class="text-sm text-purple-800">
              Waiting for letting agent reference to be submitted.
            </p>
          </div>

          <!-- Landlord Reference Submitted -->
          <div v-if="landlordReference && reference.reference_type === 'landlord'" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold text-green-900">✓ Landlord Reference Completed</h4>
              <span class="text-xs text-green-700">Submitted {{ formatDateTime(landlordReference.submitted_at) }}</span>
            </div>

            <div class="space-y-6 text-sm">
              <!-- Landlord Contact Information -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Landlord Contact Information</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <span class="text-green-700 font-medium">Full Name:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.landlord_name }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Email:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.landlord_email }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Phone:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.landlord_phone }}</span>
                  </div>
                </div>
              </div>

              <!-- Property & Tenancy Details -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Property & Tenancy Details</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <span class="text-green-700 font-medium">Property Address:</span>
                    <span class="ml-2 text-green-900">
                      {{ [landlordReference.property_address_line1, landlordReference.property_address_line2].filter(Boolean).join(', ') || landlordReference.property_address }}
                    </span>
                  </div>
                  <div v-if="landlordReference.property_city">
                    <span class="text-green-700 font-medium">City:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.property_city }}</span>
                  </div>
                  <div v-if="landlordReference.property_postcode">
                    <span class="text-green-700 font-medium">Postcode:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.property_postcode }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Tenancy Start:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(landlordReference.tenancy_start_date) }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Tenancy End:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(landlordReference.tenancy_end_date) }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Monthly Rent:</span>
                    <span class="ml-2 text-green-900">£{{ landlordReference.monthly_rent }}</span>
                  </div>
                </div>
              </div>

              <!-- Reference Assessment -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Reference Assessment</h5>
                <div class="space-y-3">
                  <div v-if="landlordReference.address_correct">
                    <span class="text-green-700 font-medium">Address Correct:</span>
                    <span class="ml-2 text-green-900 capitalize">{{ landlordReference.address_correct }}</span>
                  </div>

                  <div v-if="landlordReference.tenancy_length_months">
                    <span class="text-green-700 font-medium">Tenancy Length:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.tenancy_length_months }} months</span>
                  </div>

                  <div v-if="landlordReference.monthly_rent_confirm">
                    <span class="text-green-700 font-medium">Monthly Rent (Confirmed):</span>
                    <span class="ml-2 text-green-900">£{{ landlordReference.monthly_rent_confirm }}</span>
                  </div>

                  <div>
                    <span class="text-green-700 font-medium">Rent Paid On Time:</span>
                    <span class="ml-2 text-green-900 capitalize">{{ landlordReference.rent_paid_on_time }}</span>
                  </div>

                  <div v-if="landlordReference.good_tenant">
                    <span class="text-green-700 font-medium">Good Tenant:</span>
                    <span class="ml-2 text-green-900 capitalize">{{ landlordReference.good_tenant }}</span>
                  </div>

                  <div>
                    <span class="text-green-700 font-medium">Would Rent Again:</span>
                    <span class="ml-2 text-green-900 capitalize">{{ landlordReference.would_rent_again }}</span>
                  </div>
                </div>
              </div>

              <!-- Additional Comments -->
              <div v-if="landlordReference.additional_comments">
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Additional Comments</h5>
                <div class="bg-green-100 p-3 rounded border border-green-300 text-green-900">
                  {{ landlordReference.additional_comments }}
                </div>
              </div>

              <!-- Signature -->
              <div class="pt-3 border-t border-green-300">
                <div class="space-y-3">
                  <div>
                    <span class="text-green-700 font-medium text-sm">Signature:</span>
                    <div class="mt-2 p-3 bg-white rounded border border-green-200">
                      <div v-if="landlordReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                        {{ landlordReference.signature_name }}
                      </div>
                      <img :src="landlordReference.signature" alt="Signature" class="max-w-md h-auto" />
                    </div>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium text-sm">Date:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(landlordReference.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Agent Reference Submitted -->
          <div v-if="agentReference && reference.reference_type === 'agent'" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold text-green-900">✓ Letting Agent Reference Completed</h4>
              <span class="text-xs text-green-700">Submitted {{ formatDateTime(agentReference.submitted_at) }}</span>
            </div>

            <div class="space-y-6 text-sm">
              <!-- Agent Contact Information -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Agent Contact Information</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <span class="text-green-700 font-medium">Full Name:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.agent_name }}</span>
                  </div>
                  <div v-if="agentReference.agency_name">
                    <span class="text-green-700 font-medium">Agency:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.agency_name }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Email:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.agent_email }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Phone:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.agent_phone }}</span>
                  </div>
                </div>
              </div>

              <!-- Property & Tenancy Details -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Property & Tenancy Details</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <span class="text-green-700 font-medium">Property Address:</span>
                    <span class="ml-2 text-green-900">
                      {{ [agentReference.property_address_line1, agentReference.property_address_line2].filter(Boolean).join(', ') || agentReference.property_address }}
                    </span>
                  </div>
                  <div v-if="agentReference.property_city">
                    <span class="text-green-700 font-medium">City:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.property_city }}</span>
                  </div>
                  <div v-if="agentReference.property_postcode">
                    <span class="text-green-700 font-medium">Postcode:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.property_postcode }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Tenancy Start:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(agentReference.tenancy_start_date) }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Tenancy End:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(agentReference.tenancy_end_date) }}</span>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium">Monthly Rent:</span>
                    <span class="ml-2 text-green-900">£{{ agentReference.monthly_rent }}</span>
                  </div>
                </div>
              </div>

              <!-- Reference Assessment -->
              <div>
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Reference Assessment</h5>
                <div class="space-y-3">
                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Rent Paid On Time:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ agentReference.rent_paid_on_time }}</span>
                    </div>
                    <div v-if="agentReference.rent_paid_on_time_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ agentReference.rent_paid_on_time_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Property Condition:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ agentReference.property_condition }}</span>
                    </div>
                    <div v-if="agentReference.property_condition_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ agentReference.property_condition_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Neighbour Complaints:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ agentReference.neighbour_complaints }}</span>
                    </div>
                    <div v-if="agentReference.neighbour_complaints_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ agentReference.neighbour_complaints_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Breach of Tenancy:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ agentReference.breach_of_tenancy }}</span>
                    </div>
                    <div v-if="agentReference.breach_of_tenancy_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ agentReference.breach_of_tenancy_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Would Rent Again:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ agentReference.would_rent_again }}</span>
                    </div>
                    <div v-if="agentReference.would_rent_again_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ agentReference.would_rent_again_details }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Additional Comments -->
              <div v-if="agentReference.additional_comments">
                <h5 class="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Additional Comments</h5>
                <div class="bg-green-100 p-3 rounded border border-green-300 text-green-900">
                  {{ agentReference.additional_comments }}
                </div>
              </div>

              <!-- Signature -->
              <div class="pt-3 border-t border-green-300">
                <div class="space-y-3">
                  <div>
                    <span class="text-green-700 font-medium text-sm">Signature:</span>
                    <div class="mt-2 p-3 bg-white rounded border border-green-200">
                      <div v-if="agentReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                        {{ agentReference.signature_name }}
                      </div>
                      <img :src="agentReference.signature" alt="Signature" class="max-w-md h-auto" />
                    </div>
                  </div>
                  <div>
                    <span class="text-green-700 font-medium text-sm">Date:</span>
                    <span class="ml-2 text-green-900">{{ formatDate(agentReference.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rental History Comparison -->
        <div v-if="landlordReference || agentReference" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ reference.reference_type === 'agent' ? 'Agent' : 'Landlord' }} Reference Data Verification
          </h3>
          <p class="text-sm text-gray-600 mb-4">Comparison of tenant-provided information with reference details</p>
          <ComparisonTable
            v-if="landlordReference"
            :rows="landlordComparisonRows"
            tenant-column-label="Tenant Provided"
            reference-column-label="Landlord Confirmed"
          />
          <ComparisonTable
            v-else-if="agentReference"
            :rows="agentComparisonRows"
            tenant-column-label="Tenant Provided"
            reference-column-label="Agent Confirmed"
          />
        </div>

        <!-- Verification Status (Show if verification notes exist) -->
        <div v-if="reference.verification_notes" class="bg-white rounded-lg shadow p-6 border-l-4" :class="{
          'border-red-500 bg-red-50': reference.status === 'in_progress' && reference.verified_at,
          'border-green-500 bg-green-50': reference.status === 'completed' && reference.verified_at
        }">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg v-if="reference.status === 'completed'" class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg v-else class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h3 class="text-lg font-semibold mb-2" :class="{
                'text-red-900': reference.status === 'rejected',
                'text-green-900': reference.status === 'completed'
              }">
                {{ reference.status === 'completed' ? 'Verified & Completed' : 'Rejected - Corrections Required' }}
              </h3>
              <div class="mb-2">
                <label class="block text-sm font-medium" :class="{
                  'text-red-700': reference.status === 'rejected',
                  'text-green-700': reference.status === 'completed'
                }">
                  {{ reference.status === 'completed' ? 'Verification Notes:' : 'Rejection Notes:' }}
                </label>
                <p class="mt-1" :class="{
                  'text-red-800': reference.status === 'rejected',
                  'text-green-800': reference.status === 'completed'
                }">{{ reference.verification_notes }}</p>
              </div>
              <p class="text-sm" :class="{
                'text-red-600': reference.status === 'rejected',
                'text-green-600': reference.status === 'completed'
              }">
                {{ reference.status === 'completed' ? 'Verified' : 'Rejected' }} on {{ formatDateTime(reference.verified_at) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="reference.notes || reference.internal_notes" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <div v-if="reference.notes" class="mb-4">
            <label class="block text-sm font-medium text-gray-500">Reference Notes</label>
            <p class="mt-1 text-gray-900">{{ reference.notes }}</p>
          </div>
          <div v-if="reference.internal_notes">
            <label class="block text-sm font-medium text-gray-500">Internal Notes</label>
            <p class="mt-1 text-gray-900">{{ reference.internal_notes }}</p>
          </div>
        </div>

        <!-- Timeline -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
          <div class="space-y-2">
            <div>
              <label class="block text-sm font-medium text-gray-500">Created</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.created_at) }}</p>
            </div>
            <div v-if="reference.submitted_at">
              <label class="block text-sm font-medium text-gray-500">Submitted by Tenant</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.submitted_at) }}</p>
            </div>
            <div v-if="landlordReference?.submitted_at">
              <label class="block text-sm font-medium text-gray-500">Landlord Reference Submitted</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(landlordReference.submitted_at) }}</p>
            </div>
            <div v-if="employerReference?.submitted_at">
              <label class="block text-sm font-medium text-gray-500">Employer Reference Submitted</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(employerReference.submitted_at) }}</p>
            </div>
            <div v-if="reference.completed_at">
              <label class="block text-sm font-medium text-gray-500">Completed</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.completed_at) }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Document Viewer Modal -->
    <div v-if="viewingDocument" class="fixed inset-0 z-50 overflow-y-auto" @click="closeDocumentViewer">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>

        <!-- Center modal -->
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full" @click.stop>
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">
                {{ viewingDocumentName }}
              </h3>
              <button @click="closeDocumentViewer" class="text-gray-400 hover:text-gray-500">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="w-full flex items-center justify-center" style="height: 70vh;">
              <img v-if="viewingDocumentType === 'image'" :src="viewingDocumentUrl" class="max-w-full max-h-full object-contain" />
              <iframe v-else-if="viewingDocumentType === 'pdf'" :src="viewingDocumentUrl" class="w-full h-full border-0"></iframe>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="closeDocumentViewer"
              class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import { getCountryName } from '../utils/countries'
import ComparisonTable from '../components/ComparisonTable.vue'
import DatePicker from '../components/DatePicker.vue'

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const landlordReference = ref<any>(null)
const agentReference = ref<any>(null)
const employerReference = ref<any>(null)
const accountantReference = ref<any>(null)
const childReferences = ref<any[]>([])
const parentReference = ref<any>(null)
const siblingReferences = ref<any[]>([])
const previousAddresses = ref<any[]>([])
const documents = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const expandedTenant = ref<string | null>(null)
const childReferenceDetails = ref<Record<string, any>>({})

// Move-in date editing
const editingMoveInDate = ref(false)
const editedMoveInDate = ref('')
const savingMoveInDate = ref(false)

// Document viewer modal state
const viewingDocument = ref(false)
const viewingDocumentUrl = ref('')
const viewingDocumentName = ref('')
const viewingDocumentPath = ref('')
const viewingDocumentType = ref('') // 'image' or 'pdf'

onMounted(() => {
  fetchReference()
})

const fetchReference = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      error.value = 'No auth token available'
      loading.value = false
      return
    }

    const response = await fetch(`${API_URL}/api/references/${route.params.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch reference')
    }

    const data = await response.json()
    reference.value = data.reference
    landlordReference.value = data.landlordReference
    agentReference.value = data.agentReference
    employerReference.value = data.employerReference
    accountantReference.value = data.accountantReference
    childReferences.value = data.childReferences || []
    parentReference.value = data.parentReference
    siblingReferences.value = data.siblingReferences || []
    previousAddresses.value = data.previousAddresses || []
    documents.value = data.documents || []
  } catch (err: any) {
    error.value = err.message || 'Failed to load reference'
  } finally {
    loading.value = false
  }
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatTenancyDuration = (years: number | null, months: number | null) => {
  if (!years && !months) return 'Not provided'
  const parts = []
  if (years && years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  }
  if (months && months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const toggleTenantExpanded = async (tenantId: string) => {
  if (expandedTenant.value === tenantId) {
    expandedTenant.value = null
  } else {
    expandedTenant.value = tenantId
    // Fetch details if not already loaded
    if (!childReferenceDetails.value[tenantId]) {
      await fetchChildDetails(tenantId)
    }
  }
}

const fetchChildDetails = async (childId: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/references/${childId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      childReferenceDetails.value[childId] = data
    }
  } catch (error) {
    console.error('Failed to fetch child details:', error)
  }
}

const viewFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      useToast().error('Authentication required')
      return
    }

    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    const downloadUrl = `${API_URL}/api/references/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2] || '')}`

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load file')
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    // Detect file type from filename
    const filename = parts[2] || ''
    const extension = filename.split('.').pop()?.toLowerCase()
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
    const pdfExtensions = ['pdf']

    let docType = 'image'
    if (pdfExtensions.includes(extension || '')) {
      docType = 'pdf'
      // For PDFs, open in new window instead of modal to avoid CORS issues
      window.open(blobUrl, '_blank')
      return
    } else if (imageExtensions.includes(extension || '')) {
      docType = 'image'
    }

    // Set modal state for images
    viewingDocumentUrl.value = blobUrl
    viewingDocumentName.value = filename
    viewingDocumentPath.value = filePath
    viewingDocumentType.value = docType
    viewingDocument.value = true
  } catch (error) {
    useToast().error('Failed to view file')
  }
}

const closeDocumentViewer = () => {
  if (viewingDocumentUrl.value) {
    window.URL.revokeObjectURL(viewingDocumentUrl.value)
  }
  viewingDocument.value = false
  viewingDocumentUrl.value = ''
  viewingDocumentName.value = ''
  viewingDocumentPath.value = ''
  viewingDocumentType.value = ''
}

// Move-in date editing functions
const startEditingMoveInDate = () => {
  editedMoveInDate.value = reference.value.move_in_date || ''
  editingMoveInDate.value = true
}

const cancelEditingMoveInDate = () => {
  editingMoveInDate.value = false
  editedMoveInDate.value = ''
}

const saveMoveInDate = async () => {
  if (!editedMoveInDate.value) {
    toast.error('Move-in date is required')
    return
  }

  savingMoveInDate.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('No auth token available')
      return
    }

    const response = await fetch(`${API_URL}/api/references/${reference.value.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        move_in_date: editedMoveInDate.value
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update move-in date')
    }

    reference.value.move_in_date = editedMoveInDate.value
    editingMoveInDate.value = false
    toast.success('Move-in date updated successfully')
  } catch (error: any) {
    console.error('Error updating move-in date:', error)
    toast.error(error.message || 'Failed to update move-in date')
  } finally {
    savingMoveInDate.value = false
  }
}

// Computed properties for comparison rows
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
      label: 'Employee Position',
      tenantValue: reference.value.employment_job_title,
      referenceValue: employerReference.value.employee_position
    },
    {
      field: 'employment_start_date',
      label: 'Employment Start Date',
      tenantValue: reference.value.employment_start_date,
      referenceValue: employerReference.value.employment_start_date
    },
    {
      field: 'employment_end_date',
      label: 'Employment End Date',
      tenantValue: reference.value.employment_end_date,
      referenceValue: employerReference.value.employment_end_date
    },
    {
      field: 'employment_type',
      label: 'Employment Type',
      tenantValue: reference.value.employment_contract_type,
      referenceValue: employerReference.value.employment_type
    },
    {
      field: 'annual_salary',
      label: 'Annual Salary',
      tenantValue: reference.value.employment_salary_amount ? parseFloat(reference.value.employment_salary_amount) : null,
      referenceValue: employerReference.value.annual_salary ? parseFloat(employerReference.value.annual_salary) : null
    },
    {
      field: 'salary_frequency',
      label: 'Payment Frequency',
      tenantValue: reference.value.employment_salary_frequency,
      referenceValue: employerReference.value.salary_frequency
    },
    {
      field: 'employer_contact_name',
      label: 'Reference Contact Name',
      tenantValue: reference.value.employer_ref_name,
      referenceValue: employerReference.value.employer_name
    },
    {
      field: 'employer_contact_email',
      label: 'Reference Contact Email',
      tenantValue: reference.value.employer_ref_email,
      referenceValue: employerReference.value.employer_email
    },
    {
      field: 'employer_contact_phone',
      label: 'Reference Contact Phone',
      tenantValue: reference.value.employer_ref_phone,
      referenceValue: employerReference.value.employer_phone
    }
  ]
})

const landlordComparisonRows = computed(() => {
  if (!reference.value || !landlordReference.value) return []

  return [
    {
      field: 'property_address',
      label: 'Property Address',
      tenantValue: reference.value.previous_rental_address_line1,
      referenceValue: landlordReference.value.property_address
    },
    {
      field: 'property_city',
      label: 'Property City',
      tenantValue: reference.value.previous_rental_city,
      referenceValue: landlordReference.value.property_city
    },
    {
      field: 'property_postcode',
      label: 'Property Postcode',
      tenantValue: reference.value.previous_rental_postcode,
      referenceValue: landlordReference.value.property_postcode
    },
    {
      field: 'landlord_name',
      label: 'Landlord Name',
      tenantValue: reference.value.previous_landlord_name,
      referenceValue: landlordReference.value.landlord_name
    },
    {
      field: 'landlord_email',
      label: 'Landlord Email',
      tenantValue: reference.value.previous_landlord_email,
      referenceValue: landlordReference.value.landlord_email
    },
    {
      field: 'landlord_phone',
      label: 'Landlord Phone',
      tenantValue: reference.value.previous_landlord_phone,
      referenceValue: landlordReference.value.landlord_phone
    },
    {
      field: 'tenancy_start',
      label: 'Tenancy Start Date',
      tenantValue: reference.value.previous_tenancy_start_date,
      referenceValue: landlordReference.value.tenancy_start_date,
      isNotApplicable: false
    },
    {
      field: 'tenancy_end',
      label: 'Tenancy End Date',
      tenantValue: reference.value.previous_tenancy_end_date,
      referenceValue: landlordReference.value.tenancy_end_date,
      isNotApplicable: false
    },
    {
      field: 'monthly_rent',
      label: 'Monthly Rent',
      tenantValue: reference.value.previous_monthly_rent ? `£${reference.value.previous_monthly_rent}` : null,
      referenceValue: landlordReference.value.monthly_rent ? `£${landlordReference.value.monthly_rent}` : null,
      isNotApplicable: false
    }
  ]
})

const agentComparisonRows = computed(() => {
  if (!reference.value || !agentReference.value) return []

  return [
    {
      field: 'property_address',
      label: 'Property Address',
      tenantValue: reference.value.previous_rental_address_line1,
      referenceValue: agentReference.value.property_address
    },
    {
      field: 'property_city',
      label: 'Property City',
      tenantValue: reference.value.previous_rental_city,
      referenceValue: agentReference.value.property_city
    },
    {
      field: 'property_postcode',
      label: 'Property Postcode',
      tenantValue: reference.value.previous_rental_postcode,
      referenceValue: agentReference.value.property_postcode
    },
    {
      field: 'agent_name',
      label: 'Agent Name',
      tenantValue: reference.value.previous_landlord_name,
      referenceValue: agentReference.value.agent_name
    },
    {
      field: 'agency_name',
      label: 'Agency Name',
      tenantValue: reference.value.previous_agency_name,
      referenceValue: agentReference.value.agency_name,
      isNotApplicable: false
    },
    {
      field: 'agent_email',
      label: 'Agent Email',
      tenantValue: reference.value.previous_landlord_email,
      referenceValue: agentReference.value.agent_email
    },
    {
      field: 'agent_phone',
      label: 'Agent Phone',
      tenantValue: reference.value.previous_landlord_phone,
      referenceValue: agentReference.value.agent_phone
    },
    {
      field: 'tenancy_start',
      label: 'Tenancy Start Date',
      tenantValue: reference.value.previous_tenancy_start_date,
      referenceValue: agentReference.value.tenancy_start_date,
      isNotApplicable: false
    },
    {
      field: 'tenancy_end',
      label: 'Tenancy End Date',
      tenantValue: reference.value.previous_tenancy_end_date,
      referenceValue: agentReference.value.tenancy_end_date,
      isNotApplicable: false
    },
    {
      field: 'monthly_rent',
      label: 'Monthly Rent',
      tenantValue: reference.value.previous_monthly_rent ? `£${reference.value.previous_monthly_rent}` : null,
      referenceValue: agentReference.value.monthly_rent ? `£${agentReference.value.monthly_rent}` : null,
      isNotApplicable: false
    }
  ]
})

const accountantComparisonRows = computed(() => {
  if (!reference.value || !accountantReference.value) return []

  return [
    {
      field: 'business_name',
      label: 'Business Name',
      tenantValue: reference.value.self_employed_business_name,
      referenceValue: accountantReference.value.business_name
    },
    {
      field: 'nature_of_business',
      label: 'Nature of Business',
      tenantValue: reference.value.self_employed_nature_of_business,
      referenceValue: accountantReference.value.nature_of_business
    },
    {
      field: 'business_start_date',
      label: 'Business Start Date',
      tenantValue: reference.value.self_employed_start_date,
      referenceValue: accountantReference.value.business_start_date
    },
    {
      field: 'annual_income',
      label: 'Annual Income (Stated)',
      tenantValue: reference.value.self_employed_annual_income ? parseFloat(reference.value.self_employed_annual_income) : null,
      referenceValue: accountantReference.value.estimated_monthly_income ? parseFloat(accountantReference.value.estimated_monthly_income) * 12 : null
    },
    {
      field: 'accountant_firm',
      label: 'Accountant Firm',
      tenantValue: reference.value.accountant_name,
      referenceValue: accountantReference.value.accountant_firm
    },
    {
      field: 'accountant_name',
      label: 'Accountant Contact Name',
      tenantValue: reference.value.accountant_contact_name,
      referenceValue: accountantReference.value.accountant_name
    },
    {
      field: 'accountant_email',
      label: 'Accountant Email',
      tenantValue: reference.value.accountant_email,
      referenceValue: accountantReference.value.accountant_email
    },
    {
      field: 'accountant_phone',
      label: 'Accountant Phone',
      tenantValue: reference.value.accountant_phone,
      referenceValue: accountantReference.value.accountant_phone
    }
  ]
})
</script>
